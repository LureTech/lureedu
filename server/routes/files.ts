import { db } from '../lib/db.js';
import { errorBody } from '../lib/errors.js';
import type { App } from '../lib/http.js';

/** GET /files/{pasta}/{arquivo} — público. Nomes são UUIDs (imutáveis), então o cache é longo. */
export function registerFiles(app: App) {
  app.get('/files/:folder/:name', async (c) => {
    const path = `${c.req.param('folder')}/${c.req.param('name')}`;
    const rows = await db()<{ content_type: string | null; data: Buffer }[]>`
      SELECT content_type, data FROM stored_files WHERE path = ${path}`;
    if (rows.length === 0) {
      return c.json(errorBody(404, 'Recurso não encontrado.'), 404);
    }
    const { content_type, data } = rows[0];
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': content_type ?? 'application/octet-stream',
        'Content-Length': String(data.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
