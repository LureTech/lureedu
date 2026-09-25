/** Utilitários de formatação (PT-BR). */

/** 125 → "2:05", 3725 → "1:02:05"; vazio → null */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

/** Tempo do player: 75 → "1:15" */
export function formatClock(seconds: number): string {
  const e = !isFinite(seconds) || seconds < 0 ? 0 : seconds;
  return `${Math.floor(e / 60)}:${Math.floor(e % 60).toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  const b = bytes ?? 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/** 1234 → "1,2k" (estilo do original) */
export function compactNumber(n: number | null | undefined): string {
  const e = n ?? 0;
  return e < 1000 ? String(e) : `${(e / 1000).toFixed(e < 10000 ? 1 : 0)}k`.replace('.0', '').replace('.', ',');
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Estilo Twitter: "agora", "5 min", "3h", "2d", "12 de set." (e o ano se não for o atual). */
export function timeShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const t = date.getTime();
  if (isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "14:32 · 22 de set. de 2026" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${time} · ${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export interface RichPart {
  kind: 'text' | 'tag' | 'url';
  text: string;
  /** tag: minúscula e sem "#" (igual ao filtro do servidor) · url: o endereço */
  value?: string;
}

/**
 * Divide o texto em partes normais, #hashtags e links (para o feed). A hashtag segue a regra do
 * servidor: não conta no meio de palavra ("abc#x"). Sem lookbehind, para funcionar em Safari antigo.
 */
export function splitRichText(text: string): RichPart[] {
  const out: RichPart[] = [];
  const re = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(^|[^\p{L}\p{N}_#])#([\p{L}\p{N}_]{1,50})/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushText = (s: string) => {
    if (!s) return;
    const prev = out[out.length - 1];
    if (prev?.kind === 'text') prev.text += s;
    else out.push({ kind: 'text', text: s });
  };
  while ((m = re.exec(text)) !== null) {
    pushText(text.slice(last, m.index));
    if (m[1]) {
      out.push({ kind: 'url', text: m[1].replace(/^https?:\/\/(www\.)?/, ''), value: m[1] });
    } else {
      pushText(m[2]);
      out.push({ kind: 'tag', text: '#' + m[3], value: m[3].toLowerCase() });
    }
    last = m.index + m[0].length;
  }
  pushText(text.slice(last));
  return out;
}
