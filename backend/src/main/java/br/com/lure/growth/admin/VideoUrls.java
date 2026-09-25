package br.com.lure.growth.admin;

import br.com.lure.growth.common.ApiException;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Valida o vídeo da aula. Aceita dois formatos:
 * <ul>
 *   <li>YouTube — ID de 11 caracteres, youtu.be/…, youtube.com/watch?v=…, /embed/…, /shorts/…, /live/…;
 *       normalizado para {@code https://www.youtube.com/watch?v={id}}.</li>
 *   <li>Link direto — {@code https://…/arquivo.mp4} (ou .webm/.m4v/.mov), hospedado fora do banco
 *       (Cloudflare R2, Backblaze, etc.); gravado como veio.</li>
 * </ul>
 */
public final class VideoUrls {

    public static final String INVALID =
            "Link de vídeo inválido. Use um link do YouTube ou um link direto terminando em .mp4.";

    private static final String ID = "([A-Za-z0-9_-]{11})";
    private static final List<Pattern> YOUTUBE = List.of(
            Pattern.compile("^" + ID + "$"),
            Pattern.compile("^(?:https?://)?(?:www\\.|m\\.)?youtu\\.be/" + ID + "(?:[?&#/].*)?$"),
            Pattern.compile("^(?:https?://)?(?:www\\.|m\\.|music\\.)?youtube(?:-nocookie)?\\.com/watch\\?(?:.*&)?v="
                    + ID + "(?:[&#].*)?$"),
            Pattern.compile("^(?:https?://)?(?:www\\.|m\\.)?youtube(?:-nocookie)?\\.com/(?:embed|shorts|live|v)/"
                    + ID + "(?:[?&#/].*)?$"));
    private static final Pattern DIRECT =
            Pattern.compile("^https://[^\\s/?#]+/[^\\s?#]+\\.(?:mp4|m4v|webm|mov)(?:[?#]\\S*)?$");

    private VideoUrls() {
    }

    /** Vazio → null (aula sem vídeo). Inválido → 400. */
    public static String normalize(String input) {
        if (input == null || input.isBlank()) {
            return null;
        }
        String value = input.strip();
        for (Pattern p : YOUTUBE) {
            Matcher m = p.matcher(value);
            if (m.matches()) {
                return "https://www.youtube.com/watch?v=" + m.group(1);
            }
        }
        if (value.length() <= 1000 && DIRECT.matcher(value.toLowerCase(Locale.ROOT)).matches()) {
            return value;
        }
        throw ApiException.badRequest(INVALID);
    }
}
