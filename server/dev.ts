import { readFileSync, existsSync } from 'node:fs';
import { serve } from '@hono/node-server';

/**
 * Servidor local da API (npm run dev:api). Lê supabase.env como o iniciar.cmd
 * e sobe em http://localhost:8085 (para onde o proxy do Angular aponta).
 */
if (existsSync('supabase.env')) {
  for (const line of readFileSync('supabase.env', 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    process.env[t.substring(0, i).trim()] ??= t.substring(i + 1).trim();
  }
}
process.env.JWT_SECRET ??= 'lure-growth-dev-only-secret-change-me-0123456789abcdefghijklmnopqrstuvwxyz';

// Uma queda de rede até o banco (ECONNRESET) às vezes escapa como promessa sem tratamento;
// sem isto o processo inteiro morre e o site local fica sem API até alguém religar.
process.on('unhandledRejection', (err) => console.error('Erro sem tratamento (API continua no ar):', err));
process.on('uncaughtException', (err) => console.error('Exceção sem tratamento (API continua no ar):', err));

const { createHandler } = await import('./app.js');
const port = Number(process.env.API_PORT ?? 8085);
serve({ fetch: createHandler(), port }, () => console.log(`API em http://localhost:${port}`));
