import nodemailer from 'nodemailer';
import { env } from './env.js';

/** SMTP só é usado quando SPRING_MAIL_HOST (ou SMTP_HOST) está configurado. */
export function mailEnabled(): boolean {
  return env.mail.host !== '';
}

/**
 * Envia um e-mail de texto. Numa função serverless o envio precisa terminar antes da resposta,
 * então é aguardado — mas uma falha só vai para o log (não revela nada a quem pediu).
 */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!mailEnabled()) {
    console.info(`SMTP não configurado: e-mail "${subject}" para ${to} não foi enviado.`);
    return;
  }
  try {
    const transport = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.port === 465,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
    });
    await transport.sendMail({ from: env.mail.from, to, subject, text });
  } catch (e) {
    console.error(`Falha ao enviar e-mail para ${to}: ${(e as Error).message}`);
  }
}
