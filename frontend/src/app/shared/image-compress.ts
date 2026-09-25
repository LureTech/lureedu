/**
 * Compressão de imagem no cliente (portada do original): canvas → WebP (ou JPEG),
 * lado maior ≤ 1600 px, alvo ≤ 400 KB, busca binária de qualidade.
 */
import { formatBytes } from './format';

const MAX_SIDE = 1600;
const TARGET_BYTES = 400 * 1024;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MIN_QUALITY = 0.55;

export interface CompressedImage {
  file: File;
  width: number;
  height: number;
  bytes: number;
  originalBytes: number;
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export function validateCommunityImage(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Escolha um arquivo de imagem (JPG, PNG, WebP…).';
  if (file.type === 'image/gif') return 'GIF não rola por aqui — mande uma imagem estática.';
  if (file.size > MAX_INPUT_BYTES) {
    return `Essa imagem tem ${formatBytes(file.size)}. O limite é ${formatBytes(MAX_INPUT_BYTES)}.`;
  }
  return null;
}

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

async function toBlob(canvas: AnyCanvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise<Blob>((resolve, reject) =>
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))),
      type,
      quality,
    ),
  );
}

let outputType: Promise<string> | null = null;
function bestType(): Promise<string> {
  outputType ??= (async () => {
    try {
      const b = await toBlob(makeCanvas(1, 1), 'image/webp', 0.8);
      return b.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    } catch {
      return 'image/jpeg';
    }
  })();
  return outputType;
}

function draw(src: ImageBitmap, scale: number): { canvas: AnyCanvas; width: number; height: number } {
  const width = Math.max(1, Math.round(src.width * scale));
  const height = Math.max(1, Math.round(src.height * scale));
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Este navegador não conseguiu processar a imagem.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(src, 0, 0, width, height);
  return { canvas, width, height };
}

/** Capa de módulo: 3:4, a mesma proporção do card. */
export const COVER_WIDTH = 1080;
export const COVER_HEIGHT = 1440;
const COVER_TARGET_BYTES = 500 * 1024;

/**
 * Deixa toda capa no mesmo formato: recorte central em 1080×1440 (3:4), sem distorcer.
 * Assim os cards do catálogo ficam iguais, venha a imagem no tamanho que vier.
 */
export async function prepareCover(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const canvas = makeCanvas(COVER_WIDTH, COVER_HEIGHT);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error('Este navegador não conseguiu processar a imagem.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
    const scale = Math.max(COVER_WIDTH / bitmap.width, COVER_HEIGHT / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (COVER_WIDTH - w) / 2, (COVER_HEIGHT - h) / 2, w, h);

    const type = await bestType();
    let blob = await toBlob(canvas, type, 0.92);
    for (let q = 0.82; blob.size > COVER_TARGET_BYTES && q >= 0.6; q -= 0.1) {
      blob = await toBlob(canvas, type, q);
    }
    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'capa';
    return new File([blob], `${base}.${ext}`, { type });
  } finally {
    bitmap.close();
  }
}

export async function compressImage(file: File): Promise<CompressedImage> {
  const invalid = validateCommunityImage(file);
  if (invalid) throw new Error(invalid);

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const type = await bestType();
  try {
    let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    let result: { blob: Blob; width: number; height: number } | null = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      const { canvas, width, height } = draw(bitmap, scale);
      let hi = 0.92;
      let lo = MIN_QUALITY;
      let best: Blob | null = null;
      for (let i = 0; i < 5; i++) {
        const q = (hi + lo) / 2;
        const blob = await toBlob(canvas, type, q);
        if (blob.size <= TARGET_BYTES) {
          best = blob;
          lo = q;
        } else {
          hi = q;
        }
        if (hi - lo < 0.04) break;
      }
      if (best) {
        result = { blob: best, width, height };
        break;
      }
      const floor = await toBlob(canvas, type, MIN_QUALITY);
      result = { blob: floor, width, height };
      if (floor.size <= TARGET_BYTES) break;
      scale *= 0.75;
    }

    if (!result) throw new Error('Não foi possível preparar essa imagem.');
    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'imagem';
    return {
      file: new File([result.blob], `${base}.${ext}`, { type }),
      width: result.width,
      height: result.height,
      bytes: result.blob.size,
      originalBytes: file.size,
    };
  } finally {
    bitmap.close();
  }
}
