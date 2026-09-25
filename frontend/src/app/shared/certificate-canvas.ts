/**
 * Desenho do certificado em canvas (1600×1100 PNG), portado do original —
 * agora com dados REAIS: nome do aluno, data de emissão, código e URL de verificação.
 */
import { CertificateDto } from '../core/models';
import { formatDateLong, slugify } from './format';

const W = 1600;
const H = 1100;
const SANS = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

export function verificationUrl(code: string): string {
  return `${location.origin}/certificado/${encodeURIComponent(code)}`;
}

/** Ajusta o tamanho da fonte para caber na largura máxima. */
function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, maxWidth: number): void {
  let px = start;
  ctx.font = font(px);
  while (px > 18 && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = font(px);
  }
}

export async function renderCertificate(c: CertificateDto): Promise<Blob> {
  // Garante que a fonte serifada do título esteja carregada antes de desenhar.
  try {
    await Promise.all([
      document.fonts.load('italic 96px "Cormorant Garamond"'),
      document.fonts.load('italic 600 96px "Cormorant Garamond"'),
    ]);
  } catch {
    /* segue com fallback */
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu gerar o certificado.');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0A0A0A');
  bg.addColorStop(0.5, '#141414');
  bg.addColorStop(1, '#0A0A0A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H, 100, W / 2, H, 900);
  glow.addColorStop(0, 'rgba(187, 154, 53, 0.35)');
  glow.addColorStop(1, 'rgba(187, 154, 53, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(187, 154, 53, 0.9)';
  ctx.lineWidth = 4;
  ctx.strokeRect(60, 60, W - 120, H - 120);
  ctx.strokeStyle = 'rgba(187, 154, 53, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(90, 90, W - 180, H - 180);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#BB9A35';
  ctx.font = `bold 24px ${SANS}`;
  ctx.fillText('ASSESSORIA  LURE   ·   ÁREA DE MEMBROS', W / 2, 220);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 96px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('Certificado de Conclusão', W / 2, 350);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `22px ${SANS}`;
  ctx.fillText('Concedido a', W / 2, 430);

  ctx.fillStyle = '#ffffff';
  fitText(ctx, c.studentName, (px) => `bold ${px}px ${SANS}`, 72, W - 320);
  ctx.fillText(c.studentName, W / 2, 520);

  ctx.strokeStyle = 'rgba(187, 154, 53, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 220, 560);
  ctx.lineTo(W / 2 + 220, 560);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `24px ${SANS}`;
  ctx.fillText('por concluir com êxito o curso', W / 2, 620);

  ctx.fillStyle = '#BB9A35';
  fitText(ctx, c.moduleTitle, (px) => `bold ${px}px ${SANS}`, 52, W - 320);
  ctx.fillText(c.moduleTitle, W / 2, 700);

  const meta = [
    c.sectionTitle,
    c.author ? `Mentor: ${c.author}` : null,
    `${c.lessonCount} ${c.lessonCount === 1 ? 'aula' : 'aulas'}`,
  ]
    .filter(Boolean)
    .join('  ·  ');
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  fitText(ctx, meta, (px) => `${px}px ${SANS}`, 20, W - 320);
  ctx.fillText(meta, W / 2, 750);

  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(300, 920);
  ctx.lineTo(600, 920);
  ctx.moveTo(W - 600, 920);
  ctx.lineTo(W - 300, 920);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `20px ${SANS}`;
  ctx.fillText('Lure Digital', 450, 960);
  ctx.fillText(formatDateLong(c.issuedAt), W - 450, 960);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `16px ${SANS}`;
  ctx.fillText('Assinatura', 450, 985);
  ctx.fillText('Data de emissão', W - 450, 985);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '15px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`Código de verificação: ${c.code}`, W / 2, H - 118);
  ctx.fillStyle = 'rgba(187, 154, 53, 0.75)';
  ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`Verifique em ${verificationUrl(c.code)}`, W / 2, H - 94);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar o PNG.'))), 'image/png'),
  );
}

/** Gera e baixa o PNG do certificado. */
export async function downloadCertificate(c: CertificateDto): Promise<void> {
  const blob = await renderCertificate(c);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `certificado-${slugify(c.moduleTitle) || 'lure'}-${c.code}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
