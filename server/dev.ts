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

const { createApp } = await import('./app.js');
const port = Number(process.env.API_PORT ?? 8085);
serve({ fetch: createApp().fetch, port }, () => console.log(`API em http://localhost:${port}`));
