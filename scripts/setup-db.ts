import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Prepara o banco para a API em TypeScript (idempotente):
 *  1. cria a tabela stored_files (os arquivos enviados passam a ficar no banco);
 *  2. copia para ela os arquivos que o backend Java gravou em backend/data/uploads.
 * Uso: npx tsx scripts/setup-db.ts   (lê supabase.env como o iniciar.cmd)
 */
if (existsSync('supabase.env')) {
  for (const line of readFileSync('supabase.env', 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    process.env[t.substring(0, i).trim()] ??= t.substring(i + 1).trim();
  }
}

const { db } = await import('../server/lib/db.js');
const sql = db();

await sql.unsafe(readFileSync('server/sql/001_stored_files.sql', 'utf8'));
console.log('Tabela stored_files pronta.');

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain', csv: 'text/csv', mp4: 'video/mp4',
};

const root = 'backend/data/uploads';
let copied = 0;
if (existsSync(root)) {
  for (const folder of ['avatars', 'covers', 'community', 'materials']) {
    const dir = join(root, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const file = join(dir, name);
      if (!statSync(file).isFile()) continue;
      const path = `${folder}/${name}`;
      const data = readFileSync(file);
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      // Materiais guardam o content-type original na tabela lesson_materials.
      const material = folder === 'materials'
        ? await sql<{ content_type: string | null }[]>`SELECT content_type FROM lesson_materials WHERE file_path = ${path}`
        : [];
      const type = material[0]?.content_type ?? TYPES[ext] ?? 'application/octet-stream';
      const result = await sql`
        INSERT INTO stored_files (path, content_type, size_bytes, data, created_at)
        VALUES (${path}, ${type}, ${data.length}, ${data}, ${new Date()})
        ON CONFLICT (path) DO NOTHING`;
      copied += result.count;
    }
  }
}
console.log(`${copied} arquivo(s) copiados para o banco.`);
await sql.end();
