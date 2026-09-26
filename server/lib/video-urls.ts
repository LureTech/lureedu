import { badRequest } from './errors.js';

/**
 * Valida o vídeo da aula (igual ao VideoUrls.java). Aceita:
 * - YouTube — ID de 11 caracteres, youtu.be/…, youtube.com/watch?v=…, /embed/…, /shorts/…, /live/…;
 *   normalizado para https://www.youtube.com/watch?v={id}.
 * - Link direto — https://…/arquivo.mp4 (ou .webm/.m4v/.mov), hospedado fora do banco; gravado como veio.
 */
export const VIDEO_URL_INVALID =
  'Link de vídeo inválido. Use um link do YouTube ou um link direto terminando em .mp4.';

const ID = '([A-Za-z0-9_-]{11})';
const YOUTUBE: RegExp[] = [
  new RegExp('^' + ID + '$'),
  new RegExp('^(?:https?://)?(?:www\\.|m\\.)?youtu\\.be/' + ID + '(?:[?&#/].*)?$'),
  new RegExp(
    '^(?:https?://)?(?:www\\.|m\\.|music\\.)?youtube(?:-nocookie)?\\.com/watch\\?(?:.*&)?v=' + ID + '(?:[&#].*)?$',
  ),
  new RegExp('^(?:https?://)?(?:www\\.|m\\.)?youtube(?:-nocookie)?\\.com/(?:embed|shorts|live|v)/' + ID + '(?:[?&#/].*)?$'),
];
// \s do Java (sem flag Unicode) = [ \t\n\x0B\f\r]
const WS = ' \\t\\n\\x0B\\f\\r';
const DIRECT = new RegExp(`^https://[^${WS}/?#]+/[^${WS}?#]+\\.(?:mp4|m4v|webm|mov)(?:[?#][^${WS}]*)?$`);

/** Vazio → null (aula sem vídeo). Inválido → 400. */
export function normalizeVideoUrl(input: string | null | undefined): string | null {
  if (input == null || input.trim() === '') {
    return null;
  }
  const value = input.trim();
  for (const p of YOUTUBE) {
    const m = p.exec(value);
    if (m) {
      return 'https://www.youtube.com/watch?v=' + m[1];
    }
  }
  if (value.length <= 1000 && DIRECT.test(value.toLowerCase())) {
    return value;
  }
  throw badRequest(VIDEO_URL_INVALID);
}
