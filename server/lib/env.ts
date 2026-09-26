/**
 * Configuração lida das variáveis de ambiente (mesmos nomes usados pelo backend Java).
 * Na Vercel: Project Settings → Environment Variables.
 */

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

const frontendUrl = (process.env.APP_FRONTEND_URL ?? 'http://localhost:4200').replace(/\/$/, '');

export const env = {
  frontendUrl,
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    issuer: 'lure-growth',
    accessTtlSeconds: 15 * 60,
    refreshTtlSeconds: 12 * 60 * 60,
    refreshRememberTtlSeconds: 30 * 24 * 60 * 60,
  },
  webauthn: {
    rpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    rpName: 'AssessoriaLure',
    origins: list(process.env.WEBAUTHN_ORIGINS ?? frontendUrl),
  },
  mail: {
    host: process.env.SPRING_MAIL_HOST ?? process.env.SMTP_HOST ?? '',
    port: Number(process.env.SPRING_MAIL_PORT ?? process.env.SMTP_PORT ?? 587),
    user: process.env.SPRING_MAIL_USERNAME ?? process.env.SMTP_USER ?? '',
    password: process.env.SPRING_MAIL_PASSWORD ?? process.env.SMTP_PASSWORD ?? '',
    from: process.env.MAIL_FROM || 'AssessoriaLure <nao-responda@lure.com.br>',
  },
};

export function jwtSecret(): Buffer {
  const secret = env.jwt.secret;
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Defina JWT_SECRET com pelo menos 32 caracteres.');
  }
  return Buffer.from(secret, 'utf8');
}
