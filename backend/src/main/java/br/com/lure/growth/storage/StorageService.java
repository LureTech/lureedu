package br.com.lure.growth.storage;

import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Guarda arquivos enviados em {@code app.storage.dir}/{pasta}/{uuid}.{ext}.
 * Os arquivos são servidos publicamente em {@code /files/**} (veja {@code WebConfig}).
 * <p>
 * Se a transação corrente for desfeita, o arquivo recém-gravado é apagado; exclusões pedidas com
 * {@link #deleteAfterCommit(String)} só acontecem depois do commit.
 */
@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    public static final String PUBLIC_PREFIX = "/files/";

    /** Tipos de imagem aceitos → extensão gravada (a extensão vem do tipo validado, não do nome). */
    private static final Map<String, String> IMAGE_TYPES = Map.of(
            "image/jpeg", "jpg",
            "image/jpg", "jpg",
            "image/pjpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp");

    /** Extensões mantidas em materiais; qualquer outra vira ".bin" (evita servir HTML/SVG/JS). */
    private static final Set<String> SAFE_MATERIAL_EXTENSIONS = Set.of(
            "pdf", "zip", "rar", "7z", "txt", "csv", "md", "json",
            "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf",
            "key", "numbers", "pages", "png", "jpg", "jpeg", "webp", "gif",
            "mp3", "wav", "m4a", "mp4", "mov", "epub", "fig", "psd", "ai", "sketch", "xd");

    private final Path root;

    public StorageService(AppProperties props) {
        this.root = Path.of(props.storage().dir()).toAbsolutePath().normalize();
        try {
            for (Folder folder : Folder.values()) {
                Files.createDirectories(root.resolve(folder.dirName()));
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Não foi possível criar a pasta de arquivos " + root, e);
        }
        log.info("Arquivos enviados em {}", root);
    }

    public Path root() {
        return root;
    }

    /** URL pública relativa ({@code /files/avatars/x.webp}) ou null. */
    public static String urlOf(String storedPath) {
        return storedPath == null ? null : PUBLIC_PREFIX + storedPath;
    }

    /**
     * Valida e grava uma imagem jpeg/png/webp.
     *
     * @return caminho relativo gravado (ex.: {@code covers/uuid.png})
     */
    public StoredFile storeImage(MultipartFile file, Folder folder, long maxBytes, String tooLargeMessage) {
        requireFile(file);
        if (file.getSize() > maxBytes) {
            throw ApiException.payloadTooLarge(tooLargeMessage);
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String ext = IMAGE_TYPES.get(contentType);
        if (ext == null || !matchesImageSignature(file, ext)) {
            throw ApiException.badRequest("Formato de imagem não suportado. Use JPG, PNG ou WEBP.");
        }
        String normalizedType = switch (ext) {
            case "jpg" -> "image/jpeg";
            case "png" -> "image/png";
            default -> "image/webp";
        };
        return write(file, folder, ext, normalizedType);
    }

    /** Grava um material de aula (qualquer tipo), mantendo a extensão só se for segura. */
    public StoredFile storeMaterial(MultipartFile file, long maxBytes, String tooLargeMessage) {
        requireFile(file);
        if (file.getSize() > maxBytes) {
            throw ApiException.payloadTooLarge(tooLargeMessage);
        }
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        int dot = original.lastIndexOf('.');
        String ext = dot >= 0 ? original.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
        if (!SAFE_MATERIAL_EXTENSIONS.contains(ext)) {
            ext = "bin";
        }
        String contentType = file.getContentType();
        if (contentType != null && contentType.length() > 150) {
            contentType = contentType.substring(0, 150);
        }
        return write(file, Folder.MATERIALS, ext, contentType);
    }

    /** Apaga agora (fora de transação) ou depois do commit da transação corrente. */
    public void deleteAfterCommit(String storedPath) {
        if (storedPath == null) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteNow(storedPath);
                }
            });
        } else {
            deleteNow(storedPath);
        }
    }

    public void deleteNow(String storedPath) {
        if (storedPath == null) {
            return;
        }
        try {
            Path target = root.resolve(storedPath).normalize();
            if (target.startsWith(root)) {
                Files.deleteIfExists(target);
            }
        } catch (IOException e) {
            log.warn("Não foi possível apagar o arquivo {}: {}", storedPath, e.getMessage());
        }
    }

    private StoredFile write(MultipartFile file, Folder folder, String ext, String contentType) {
        String relative = folder.dirName() + "/" + UUID.randomUUID() + "." + ext;
        Path target = root.resolve(relative).normalize();
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("Falha ao gravar arquivo", e);
        }
        // Se a transação falhar, não deixa arquivo órfão.
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) {
                        deleteNow(relative);
                    }
                }
            });
        }
        return new StoredFile(relative, file.getSize(), contentType, file.getOriginalFilename());
    }

    private static void requireFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Selecione um arquivo para enviar.");
        }
    }

    /** Confere os "magic bytes" para não aceitar qualquer coisa rotulada como imagem. */
    private static boolean matchesImageSignature(MultipartFile file, String ext) {
        byte[] head = new byte[12];
        int read;
        try (InputStream in = file.getInputStream()) {
            read = in.readNBytes(head, 0, head.length);
        } catch (IOException e) {
            return false;
        }
        return switch (ext) {
            case "jpg" -> read >= 3 && (head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF;
            case "png" -> read >= 8 && (head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G';
            case "webp" -> read >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                    && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P';
            default -> false;
        };
    }

    public enum Folder {
        AVATARS("avatars"),
        COVERS("covers"),
        COMMUNITY("community"),
        MATERIALS("materials");

        private final String dirName;

        Folder(String dirName) {
            this.dirName = dirName;
        }

        public String dirName() {
            return dirName;
        }
    }

    public record StoredFile(String path, long sizeBytes, String contentType, String originalFilename) {
    }
}
