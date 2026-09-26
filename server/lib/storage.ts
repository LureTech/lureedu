import { badRequest, payloadTooLarge } from './errors.js';
import type { Db } from './db.js';

/**
 * Arquivos enviados (avatares, capas, imagens da comunidade, materiais) ficam na tabela
 * stored_files do próprio banco — funções serverless não têm disco persistente.
 * São servidos publicamente em /files/{pasta}/{uuid}.{ext} (rota em routes/files.ts).
 * Como a gravação usa a mesma transação da regra de negócio, um erro desfaz os dois juntos.
 */

export const PUBLIC_PREFIX = '/files/';

export type Folder = 'avatars' | 'covers' | 'community' | 'materials';

/** Tipos de imagem aceitos → extensão gravada (a extensão vem do tipo validado, não do nome). */
const IMAGE_TYPES: Record<string, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Extensões mantidas em materiais; qualquer outra vira ".bin" (evita servir HTML/SVG/JS). */
const SAFE_MATERIAL_EXTENSIONS = new Set([
  'pdf', 'zip', 'rar', '7z', 'txt', 'csv', 'md', 'json',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf',
  'key', 'numbers', 'pages', 'png', 'jpg', 'jpeg', 'webp', 'gif',
  'mp3', 'wav', 'm4a', 'mp4', 'mov', 'epub', 'fig', 'psd', 'ai', 'sketch', 'xd',
]);

export interface StoredFile {
  path: string;
  sizeBytes: number;
  contentType: string | null;
  originalFilename: string;
}

/** URL pública relativa (/files/avatars/x.webp) ou null. */
export function fileUrl(storedPath: string | null | undefined): string | null {
  return storedPath == null ? null : PUBLIC_PREFIX + storedPath;
}

/** Valida (tipo + "magic bytes") e grava uma imagem jpeg/png/webp. */
export async function storeImage(
  db: Db,
  file: File,
  folder: Folder,
  maxBytes: number,
  tooLargeMessage: string,
): Promise<StoredFile> {
  if (file.size > maxBytes) {
    throw payloadTooLarge(tooLargeMessage);
  }
  const ext = IMAGE_TYPES[(file.type ?? '').toLowerCase()];
  const data = Buffer.from(await file.arrayBuffer());
  if (!ext || !matchesImageSignature(data, ext)) {
    throw badRequest('Formato de imagem não suportado. Use JPG, PNG ou WEBP.');
  }
  const contentType = ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp';
  return write(db, data, folder, ext, contentType, file.name);
}

/** Grava um material de aula (qualquer tipo), mantendo a extensão só se for segura. */
export async function storeMaterial(
  db: Db,
  file: File,
  maxBytes: number,
  tooLargeMessage: string,
): Promise<StoredFile> {
  if (file.size > maxBytes) {
    throw payloadTooLarge(tooLargeMessage);
  }
  const original = file.name ?? '';
  const dot = original.lastIndexOf('.');
  let ext = dot >= 0 ? original.substring(dot + 1).toLowerCase() : '';
  if (!SAFE_MATERIAL_EXTENSIONS.has(ext)) {
    ext = 'bin';
  }
  let contentType: string | null = file.type || null;
  if (contentType && contentType.length > 150) {
    contentType = contentType.substring(0, 150);
  }
  const data = Buffer.from(await file.arrayBuffer());
  return write(db, data, 'materials', ext, contentType, original);
}

/** Apaga o arquivo (na mesma transação da regra de negócio). */
export async function deleteFile(db: Db, storedPath: string | null | undefined): Promise<void> {
  if (storedPath == null) return;
  await db`DELETE FROM stored_files WHERE path = ${storedPath}`;
}

export async function deleteFiles(db: Db, paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => p != null);
  if (list.length === 0) return;
  await db`DELETE FROM stored_files WHERE path IN ${db(list)}`;
}

async function write(
  db: Db,
  data: Buffer,
  folder: Folder,
  ext: string,
  contentType: string | null,
  originalFilename: string,
): Promise<StoredFile> {
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  await db`
    INSERT INTO stored_files (path, content_type, size_bytes, data, created_at)
    VALUES (${path}, ${contentType}, ${data.length}, ${data}, ${new Date()})`;
  return { path, sizeBytes: data.length, contentType, originalFilename };
}

function matchesImageSignature(head: Buffer, ext: 'jpg' | 'png' | 'webp'): boolean {
  switch (ext) {
    case 'jpg':
      return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case 'png':
      return head.length >= 8 && head[0] === 0x89 && head.toString('latin1', 1, 4) === 'PNG';
    case 'webp':
      return head.length >= 12 && head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP';
  }
}
