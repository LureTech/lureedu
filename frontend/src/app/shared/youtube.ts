/** Parsing de links de vídeo (YouTube, Google Drive ou arquivo direto) + validadores de upload (portados do original). */

const PATTERNS = [
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?[^ ]*v=([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
];

/** ID de 11 caracteres ou null. Aceita ID puro, youtu.be, watch?v=, /embed/, /shorts/, /live/. */
export function youtubeId(url: string | null | undefined): string | null {
  const t = (url ?? '').trim();
  if (!t) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(t)) return t;
  for (const re of PATTERNS) {
    const m = t.match(re);
    if (m) return m[1];
  }
  return null;
}

export function youtubeThumb(id: string, quality: 'hqdefault' | 'maxresdefault' = 'hqdefault'): string {
  return `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
}

const DIRECT = /^https:\/\/[^\s/?#]+\/[^\s?#]+\.(?:mp4|m4v|webm|mov)(?:[?#]\S*)?$/i;

/** Link direto de arquivo de vídeo (https://…/aula.mp4), ex.: Cloudflare R2. Mesma regra do backend (VideoUrls). */
export function isDirectVideo(url: string | null | undefined): boolean {
  const t = (url ?? '').trim();
  return t.length <= 1000 && DIRECT.test(t);
}

const DRIVE_PATTERNS = [
  /^(?:https?:\/\/)?(?:drive|docs)\.google\.com\/(?:a\/[^/]+\/)?file\/d\/([A-Za-z0-9_-]{20,})(?:[/?#].*)?$/,
  /^(?:https?:\/\/)?drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([A-Za-z0-9_-]{20,})(?:[&#].*)?$/,
];

/** ID do arquivo no Google Drive (drive.google.com/file/d/{id}/…, open?id=…, uc?id=…) ou null. Mesma regra do backend. */
export function driveId(url: string | null | undefined): string | null {
  const t = (url ?? '').trim();
  for (const re of DRIVE_PATTERNS) {
    const m = t.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Miniatura (capa) do vídeo da aula: YouTube ou Google Drive; arquivo direto não tem → null. */
export function videoThumb(url: string | null | undefined, width = 480): string | null {
  const yt = youtubeId(url);
  if (yt) return youtubeThumb(yt);
  const drive = driveId(url);
  return drive ? `https://drive.google.com/thumbnail?id=${drive}&sz=w${width}` : null;
}

/** Link aceito pelo player: YouTube, Google Drive ou arquivo direto. */
export function isPlayableVideo(url: string | null | undefined): boolean {
  return !!youtubeId(url) || !!driveId(url) || isDirectVideo(url);
}

export const MB = 1024 * 1024;

export function validateMaterial(file: File): string | null {
  return file.size > 50 * MB ? 'O arquivo precisa ter no máximo 50 MB.' : null;
}

export function validateCover(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Escolha um arquivo de imagem (JPG, PNG…).';
  return file.size > 10 * MB ? 'A imagem precisa ter no máximo 10 MB.' : null;
}

/** Avatar: jpeg/png/webp, ≤ 5 MB (regra do contrato). */
export function validateAvatar(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Escolha uma imagem JPG, PNG ou WebP.';
  }
  return file.size > 5 * MB ? 'A imagem precisa ter no máximo 5 MB.' : null;
}
