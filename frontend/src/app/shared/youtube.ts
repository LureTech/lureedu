/** Parsing de links de vídeo (YouTube ou arquivo direto) + validadores de upload (portados do original). */

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

/** Link aceito pelo player: YouTube ou arquivo direto. */
export function isPlayableVideo(url: string | null | undefined): boolean {
  return !!youtubeId(url) || isDirectVideo(url);
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
