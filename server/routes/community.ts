import { db, newId, now, transaction, withUserLock, type Db } from '../lib/db.js';
import { badRequest, forbidden, Messages, notFound, tooManyRequests } from '../lib/errors.js';
import {
  Check,
  created,
  isAdmin,
  intQuery,
  me,
  noContent,
  optString,
  parseInstant,
  readJson,
  uuidParam,
  type App,
  type AuthUser,
  type Ctx,
} from '../lib/http.js';
import { deleteFile, fileUrl, storeImage } from '../lib/storage.js';
import { excerpt, normalize } from '../lib/text.js';
import { authorDto, displayName, unknownAuthor, type AuthorDto } from '../lib/users.js';
import { notifyCommunity, notifyReply } from './notifications.js';

const MAX_BODY = 500;
const MAX_COMMENT = 300;
const DAILY_LIMIT = 10;
const COOLDOWN_MS = 30_000;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const LINK = '/comunidade';
/** Quantos posts recentes entram no ranking "Em alta" (o decaimento por idade cuida do resto). */
const HOT_CANDIDATES = 500;
const PREVIEW_COMMENTS = 2;
const TOP_VOICES = 5;
const MAX_QUERY = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Categorias válidas de post (o valor gravado/retornado é o rótulo com acento). */
const CATEGORIES = ['Conquista', 'Dúvida', 'Networking', 'Case', 'Insight'];

/** #palavra: letras (com acento), dígitos e _. Não casa no meio de palavras ("abc#x"). */
const HASHTAG_SOURCE = '(?<![\\p{L}\\p{N}_#])#([\\p{L}\\p{N}_]{1,50})';

// ------------------------------------------------------------------ tipos

interface AuthorCols {
  a_id: string | null;
  a_email: string | null;
  a_full_name: string | null;
  a_avatar_path: string | null;
}

interface PostRow extends AuthorCols {
  id: string;
  user_id: string;
  category: string;
  body: string;
  image_path: string | null;
  image_width: number | null;
  image_height: number | null;
  created_at: Date;
  likes_count: number;
  comments_count: number;
  liked: boolean;
}

interface CommentRow extends AuthorCols {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: Date;
}

interface FeedFilter {
  category: string | null;
  tag: string | null;
  query: string | null;
  unanswered: boolean;
}

// ------------------------------------------------------------------ helpers

/** String.strip() do Java (Character.isWhitespace; não remove espaço inquebrável). */
const JAVA_WS = '[\\t\\n\\u000B\\f\\r\\u001C-\\u001F \\u1680\\u2000-\\u2006\\u2008-\\u200A\\u2028\\u2029\\u205F\\u3000]+';
const STRIP_RE = new RegExp(`^${JAVA_WS}|${JAVA_WS}$`, 'g');

function strip(value: string): string {
  return value.replace(STRIP_RE, '');
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || strip(value) === '';
}

/** Aceita variações de caixa/acento ("duvida" → "Dúvida"). */
function resolveCategory(value: string | null | undefined): string | null {
  if (isBlank(value)) return null;
  const normalized = normalize(strip(value!));
  return CATEGORIES.find((c) => normalize(c) === normalized) ?? null;
}

/** Filtro de categoria opcional; valor desconhecido → 400. */
function categoryFilter(raw: string | undefined): string | null {
  if (isBlank(raw)) return null;
  const category = resolveCategory(raw);
  if (category == null) throw badRequest('Categoria inválida.');
  return category;
}

/** Hashtag do filtro: com ou sem "#", minúsculas; formato inválido → 400. */
function tagFilter(raw: string | undefined): string | null {
  if (isBlank(raw)) return null;
  const tag = strip(raw!).replace(/^#/, '').toLowerCase();
  if (!/^[\p{L}\p{N}_]{1,50}$/u.test(tag)) throw badRequest('Hashtag inválida.');
  return tag;
}

function queryFilter(raw: string | undefined): string | null {
  if (isBlank(raw)) return null;
  const q = strip(raw!).replace(/[ \t\n\u000B\f\r]+/g, ' ').toLowerCase();
  return q.length > MAX_QUERY ? q.substring(0, MAX_QUERY) : q;
}

/** Escapa curingas do LIKE (o escape usado nas consultas é "!"). */
function escapeLike(value: string): string {
  return value.replaceAll('!', '!!').replaceAll('%', '!%').replaceAll('_', '!_');
}

/** Hashtags do texto (minúsculas, sem "#"), na ordem em que aparecem. */
export function hashtags(body: string | null): string[] {
  if (body == null || !body.includes('#')) return [];
  return [...body.matchAll(new RegExp(HASHTAG_SOURCE, 'gu'))].map((m) => m[1].toLowerCase());
}

/** Confere a hashtag exata (o LIKE do banco também casa prefixos). */
function hasTag(p: PostRow, tag: string | null): boolean {
  return tag == null || hashtags(p.body).includes(tag);
}

/** Boolean de @RequestParam do Spring (true/on/yes/1, false/off/no/0). */
function boolQuery(c: Ctx, name: string, fallback: boolean): boolean {
  const raw = c.req.query(name);
  if (raw === undefined || raw.trim() === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (['true', 'on', 'yes', '1'].includes(v)) return true;
  if (['false', 'off', 'no', '0'].includes(v)) return false;
  throw badRequest(`Parâmetro inválido: ${name}.`);
}

/** Integer opcional de @RequestParam (vazio → null; inválido → 400). */
function optIntParam(raw: string | undefined, name: string): number | null {
  if (raw === undefined || raw === '') return null;
  const v = raw.replace(/\s+/g, '');
  let n: number;
  if (/^[+-]?\d+$/.test(v)) n = Number(v);
  else if (/^[+-]?(0x|0X|#)[0-9a-fA-F]+$/.test(v)) n = (v.startsWith('-') ? -1 : 1) * parseInt(v.replace(/^[+-]?(0x|0X|#)/, ''), 16);
  else throw badRequest(`Parâmetro inválido: ${name}.`);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 2_147_483_647) throw badRequest(`Parâmetro inválido: ${name}.`);
  return n;
}

function author(row: AuthorCols, userId: string): AuthorDto {
  return row.a_id != null
    ? authorDto({ id: row.a_id, email: row.a_email!, full_name: row.a_full_name, avatar_path: row.a_avatar_path })
    : unknownAuthor(userId);
}

/** Link da notificação: abre direto a conversa do post. */
function linkTo(postId: string): string {
  return `${LINK}?post=${postId}`;
}

function canDeleteComment(c: { user_id: string }, postOwnerId: string | null, user: AuthUser): boolean {
  return isAdmin(user) || c.user_id === user.id || (postOwnerId != null && postOwnerId === user.id);
}

function commentDto(c: CommentRow, postOwnerId: string | null, user: AuthUser) {
  return {
    id: c.id,
    body: c.body,
    createdAt: c.created_at,
    author: author(c, c.user_id),
    canDelete: canDeleteComment(c, postOwnerId, user),
  };
}

function postDto(p: PostRow, recentComments: ReturnType<typeof commentDto>[], user: AuthUser) {
  return {
    id: p.id,
    category: p.category,
    body: p.body,
    imageUrl: fileUrl(p.image_path),
    imageWidth: p.image_width,
    imageHeight: p.image_height,
    likesCount: p.likes_count,
    commentsCount: p.comments_count,
    likedByMe: p.liked,
    createdAt: p.created_at,
    author: author(p, p.user_id),
    canDelete: isAdmin(user) || p.user_id === user.id,
    recentComments,
  };
}

/** SELECT de posts já com autor, contagens e "curti". */
function postSelect(sql: Db, userId: string) {
  return sql`
    SELECT p.id, p.user_id, p.category, p.body, p.image_path, p.image_width, p.image_height, p.created_at,
           u.id AS a_id, u.email AS a_email, u.full_name AS a_full_name, u.avatar_path AS a_avatar_path,
           (SELECT count(*) FROM post_likes l WHERE l.post_id = p.id) AS likes_count,
           (SELECT count(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
           EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = ${userId}) AS liked
    FROM community_posts p LEFT JOIN users u ON u.id = p.user_id`;
}

function filteredQuery(sql: Db, userId: string, f: FeedFilter, before: Date | null, max: number) {
  return sql<PostRow[]>`
    ${postSelect(sql, userId)}
    WHERE 1 = 1
    ${f.category != null ? sql`AND p.category = ${f.category}` : sql``}
    ${f.tag != null ? sql`AND lower(p.body) LIKE ${'%#' + escapeLike(f.tag) + '%'} ESCAPE '!'` : sql``}
    ${f.query != null
      ? sql`AND (lower(p.body) LIKE ${'%' + escapeLike(f.query) + '%'} ESCAPE '!' OR p.user_id IN
            (SELECT uu.id FROM users uu WHERE lower(uu.full_name) LIKE ${'%' + escapeLike(f.query) + '%'} ESCAPE '!'))`
      : sql``}
    ${f.unanswered ? sql`AND NOT EXISTS (SELECT 1 FROM post_comments nc WHERE nc.post_id = p.id)` : sql``}
    ${before != null ? sql`AND p.created_at < ${before}` : sql``}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT ${max}`;
}

/** Cronológico. Com filtro de hashtag o LIKE traz falsos positivos (#vendas ⊂ #vendasb2b): busca em lotes. */
async function recentPage(sql: Db, userId: string, f: FeedFilter, before: Date | null, size: number) {
  const out: PostRow[] = [];
  let cursor = before;
  const batch = f.tag != null ? size * 2 : size;
  for (let round = 0; round < 10 && out.length < size; round++) {
    const chunk = await filteredQuery(sql, userId, f, cursor, batch);
    for (const p of chunk) {
      if (out.length < size && hasTag(p, f.tag)) out.push(p);
    }
    if (chunk.length < batch) break;
    cursor = chunk[chunk.length - 1].created_at;
  }
  return out;
}

/**
 * Pontuação "em alta" (estilo Hacker News): engajamento dividido pela idade elevada a 1,5.
 * Comentário vale o dobro da curtida — conversa é o que a comunidade quer ver.
 */
function hotScore(likesCount: number, commentsCount: number, createdAt: Date, nowMs: number): number {
  const minutes = Math.trunc(Math.floor((nowMs - createdAt.getTime()) / 1000) / 60);
  const hours = Math.max(0, minutes / 60.0);
  return (1 + likesCount + 2.0 * commentsCount) / Math.pow(hours + 2, 1.5);
}

/** "Em alta": ranqueia os HOT_CANDIDATES posts mais recentes que passam no filtro. */
async function hotPage(sql: Db, userId: string, f: FeedFilter, offset: number, size: number) {
  const candidates = (await filteredQuery(sql, userId, f, null, HOT_CANDIDATES)).filter((p) => hasTag(p, f.tag));
  if (candidates.length === 0 || offset >= candidates.length) return [];
  const nowMs = now().getTime();
  const score = new Map(candidates.map((p) => [p.id, hotScore(p.likes_count, p.comments_count, p.created_at, nowMs)]));
  return [...candidates]
    .sort((a, b) => score.get(b.id)! - score.get(a.id)! || b.created_at.getTime() - a.created_at.getTime())
    .slice(offset, offset + size);
}

/** Monta os DTOs com a prévia dos 2 comentários mais novos de cada post (em ordem cronológica). */
async function toDtos(sql: Db, list: PostRow[], user: AuthUser) {
  if (list.length === 0) return [];
  const ids = list.map((p) => p.id);
  const rows = await sql<CommentRow[]>`
    SELECT c.id, c.post_id, c.user_id, c.body, c.created_at,
           u.id AS a_id, u.email AS a_email, u.full_name AS a_full_name, u.avatar_path AS a_avatar_path
    FROM post_comments c LEFT JOIN users u ON u.id = c.user_id
    WHERE c.post_id IN ${sql(ids)}
      AND (SELECT count(*) FROM post_comments c2 WHERE c2.post_id = c.post_id AND c2.created_at > c.created_at) < 2
    ORDER BY c.created_at ASC, c.id ASC`;
  const latest = new Map<string, CommentRow[]>();
  for (const c of rows) {
    const cs = latest.get(c.post_id) ?? [];
    cs.push(c);
    latest.set(c.post_id, cs);
  }
  return list.map((p) =>
    postDto(
      p,
      (latest.get(p.id) ?? []).slice(-PREVIEW_COMMENTS).map((c) => commentDto(c, p.user_id, user)),
      user,
    ),
  );
}

async function findPost(sql: Db, userId: string, postId: string): Promise<PostRow> {
  const rows = await sql<PostRow[]>`${postSelect(sql, userId)} WHERE p.id = ${postId}`;
  if (rows.length === 0) throw notFound(Messages.POST_NOT_FOUND);
  return rows[0];
}

async function requirePost(sql: Db, postId: string) {
  const rows = await sql<{ id: string; user_id: string; body: string; image_path: string | null }[]>`
    SELECT id, user_id, body, image_path FROM community_posts WHERE id = ${postId}`;
  if (rows.length === 0) throw notFound(Messages.POST_NOT_FOUND);
  return rows[0];
}

/** Top 6 hashtags (minúsculas, sem "#"), contando cada tag uma vez por post. */
export function topTags(bodies: string[]) {
  const counts = new Map<string, number>();
  for (const body of bodies) {
    for (const tag of new Set(hashtags(body))) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 6)
    .map(([tag, n]) => ({ tag, n }));
}

/** Parâmetros de @RequestParam: query string + corpo multipart ou form-urlencoded (a query vence). */
async function readParams(c: Ctx): Promise<Record<string, string | File>> {
  const out: Record<string, string | File> = {};
  const type = (c.req.header('content-type') ?? '').toLowerCase();
  if (type.startsWith('multipart/form-data') || type.startsWith('application/x-www-form-urlencoded')) {
    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody();
    } catch {
      throw badRequest('Envio de arquivo inválido. Tente novamente.');
    }
    for (const [k, v] of Object.entries(body)) {
      const value = Array.isArray(v) ? v[0] : v;
      if (typeof value === 'string' || value instanceof File) out[k] = value;
    }
  }
  for (const [k, v] of Object.entries(c.req.query())) {
    out[k] = v;
  }
  return out;
}

// ------------------------------------------------------------------ rotas

export function registerCommunity(app: App) {
  /**
   * sort: recent (padrão, paginado por before) | hot (em alta, paginado por offset).
   * Filtros opcionais: category, tag (hashtag exata), q (texto ou nome do autor), unanswered (sem comentários).
   */
  app.get('/api/community/posts', async (c) => {
    const user = me(c);
    const limit = intQuery(c, 'limit', 20);
    const unanswered = boolQuery(c, 'unanswered', false);
    const offset = intQuery(c, 'offset', 0);
    const before = parseInstant(c.req.query('before'), 'before');
    const size = Math.max(1, Math.min(limit, 50));
    const filter: FeedFilter = {
      category: categoryFilter(c.req.query('category')),
      tag: tagFilter(c.req.query('tag')),
      query: queryFilter(c.req.query('q')),
      unanswered,
    };
    const rawSort = c.req.query('sort');
    const sort = rawSort === undefined ? 'recent' : strip(rawSort).toLowerCase();
    const sql = db();
    let page: PostRow[];
    if (sort === '' || sort === 'recent') {
      page = await recentPage(sql, user.id, filter, before, size);
    } else if (sort === 'hot') {
      page = await hotPage(sql, user.id, filter, Math.max(0, offset), size);
    } else {
      throw badRequest('Ordenação inválida.');
    }
    return c.json(await toDtos(sql, page, user));
  });

  /** Quantas publicações de outras pessoas chegaram desde since + até 3 autores delas. */
  app.get('/api/community/posts/new-count', async (c) => {
    const user = me(c);
    const since = parseInstant(c.req.query('since'), 'since');
    if (since == null) return c.json({ count: 0, authors: [] });
    const category = categoryFilter(c.req.query('category'));
    const sql = db();
    const catCond = category != null ? sql`AND p.category = ${category}` : sql``;
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT count(*) AS n FROM community_posts p WHERE p.created_at > ${since} AND p.user_id <> ${user.id} ${catCond}`;
    if (n === 0) return c.json({ count: 0, authors: [] });
    const rows = await sql<(AuthorCols & { user_id: string })[]>`
      SELECT p.user_id, u.id AS a_id, u.email AS a_email, u.full_name AS a_full_name, u.avatar_path AS a_avatar_path
      FROM community_posts p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.created_at > ${since} AND p.user_id <> ${user.id} ${catCond}
      ORDER BY p.created_at DESC
      LIMIT 20`;
    const seen = new Set<string>();
    const authors: AuthorDto[] = [];
    for (const r of rows) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      if (authors.length < 3) authors.push(author(r, r.user_id));
    }
    return c.json({ count: n, authors });
  });

  app.get('/api/community/posts/:id', async (c) => {
    const id = uuidParam(c, 'id');
    const user = me(c);
    const sql = db();
    const post = await findPost(sql, user.id, id);
    return c.json((await toDtos(sql, [post], user))[0]);
  });

  /** multipart/form-data (com ou sem imagem); também aceita form-urlencoded quando não há imagem. */
  app.post('/api/community/posts', async (c) => {
    const user = me(c);
    const params = await readParams(c);
    const rawBody = typeof params.body === 'string' ? params.body : null;
    const rawCategory = typeof params.category === 'string' ? params.category : null;
    const image = params.image instanceof File ? params.image : null;
    const width = optIntParam(typeof params.imageWidth === 'string' ? params.imageWidth : undefined, 'imageWidth');
    const height = optIntParam(typeof params.imageHeight === 'string' ? params.imageHeight : undefined, 'imageHeight');

    const category = resolveCategory(rawCategory);
    if (category == null) throw badRequest('Escolha uma categoria válida.');
    const body = rawBody == null ? '' : strip(rawBody);
    if (body.length > MAX_BODY) throw badRequest('O texto pode ter no máximo 500 caracteres.');
    const hasImage = image != null && image.size > 0;
    if (body === '' && !hasImage) throw badRequest('Escreva alguma coisa ou anexe uma imagem.');

    const dto = await withUserLock(user.id, async (tx) => {
      const current = now();
      const [{ n }] = await tx<{ n: number }[]>`
        SELECT count(*) AS n FROM community_posts
        WHERE user_id = ${user.id} AND created_at > ${new Date(current.getTime() - DAY_MS)}`;
      if (n >= DAILY_LIMIT) throw tooManyRequests('Você atingiu o limite de 10 publicações por dia.');
      const last = await tx<{ created_at: Date }[]>`
        SELECT created_at FROM community_posts WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 1`;
      if (last.length && last[0].created_at.getTime() > current.getTime() - COOLDOWN_MS) {
        throw tooManyRequests('Aguarde alguns segundos antes de publicar de novo.');
      }

      let imagePath: string | null = null;
      let w: number | null = null;
      let h: number | null = null;
      if (hasImage) {
        imagePath = (await storeImage(tx, image!, 'community', IMAGE_MAX_BYTES, 'A imagem deve ter no máximo 2 MB.')).path;
        const valid = (v: number | null) => v != null && v > 0 && v <= 20_000;
        if (valid(width) && valid(height)) {
          w = width;
          h = height;
        }
      }
      const id = newId();
      await tx`
        INSERT INTO community_posts (id, user_id, category, body, image_path, image_width, image_height, created_at)
        VALUES (${id}, ${user.id}, ${category}, ${body}, ${imagePath}, ${w}, ${h}, ${current})`;
      const [u] = await tx<{ id: string; email: string; full_name: string | null; avatar_path: string | null; role: string }[]>`
        SELECT id, email, full_name, avatar_path, role FROM users WHERE id = ${user.id}`;
      if (u.role === 'ADMIN') {
        const ex = excerpt(body, 140);
        await notifyCommunity(tx, user.id, 'Nova publicação da equipe LURE',
          ex ?? 'Uma nova imagem foi compartilhada na comunidade.', linkTo(id));
      }
      const row: PostRow = {
        id, user_id: user.id, category, body, image_path: imagePath, image_width: w, image_height: h,
        created_at: current, likes_count: 0, comments_count: 0, liked: false,
        a_id: u.id, a_email: u.email, a_full_name: u.full_name, a_avatar_path: u.avatar_path,
      };
      return postDto(row, [], user);
    });
    return created(c, dto);
  });

  app.delete('/api/community/posts/:id', async (c) => {
    const id = uuidParam(c, 'id');
    const user = me(c);
    await transaction(async (tx) => {
      const post = await requirePost(tx, id);
      if (!isAdmin(user) && post.user_id !== user.id) throw forbidden(Messages.NO_PERMISSION);
      await deleteFile(tx, post.image_path);
      await tx`DELETE FROM community_posts WHERE id = ${id}`;
    });
    return noContent(c);
  });

  // ---------------------------------------------------------------- curtidas

  app.post('/api/community/posts/:id/like', async (c) => {
    const postId = uuidParam(c, 'id');
    const user = me(c);
    const result = await withUserLock(user.id, async (tx) => {
      const post = await requirePost(tx, postId);
      const exists = await tx`SELECT 1 FROM post_likes WHERE post_id = ${postId} AND user_id = ${user.id}`;
      if (exists.length === 0) {
        await tx`
          INSERT INTO post_likes (id, post_id, user_id, created_at)
          VALUES (${newId()}, ${postId}, ${user.id}, ${now()})`;
        const actors = await tx<{ email: string; full_name: string | null }[]>`
          SELECT email, full_name FROM users WHERE id = ${user.id}`;
        const actor = actors.length ? displayName(actors[0]) : 'Alguém';
        await notifyReply(tx, post.user_id, user.id, 'LIKE', `${actor} curtiu sua publicação`,
          excerpt(post.body, 120), linkTo(postId));
      }
      const [{ n }] = await tx<{ n: number }[]>`SELECT count(*) AS n FROM post_likes WHERE post_id = ${postId}`;
      return { liked: true, likesCount: n };
    });
    return c.json(result);
  });

  app.delete('/api/community/posts/:id/like', async (c) => {
    const postId = uuidParam(c, 'id');
    const user = me(c);
    const result = await withUserLock(user.id, async (tx) => {
      await requirePost(tx, postId);
      await tx`DELETE FROM post_likes WHERE post_id = ${postId} AND user_id = ${user.id}`;
      const [{ n }] = await tx<{ n: number }[]>`SELECT count(*) AS n FROM post_likes WHERE post_id = ${postId}`;
      return { liked: false, likesCount: n };
    });
    return c.json(result);
  });

  // ---------------------------------------------------------------- comentários

  app.get('/api/community/posts/:id/comments', async (c) => {
    const postId = uuidParam(c, 'id');
    const user = me(c);
    const sql = db();
    const post = await requirePost(sql, postId);
    const rows = await sql<CommentRow[]>`
      SELECT c.id, c.post_id, c.user_id, c.body, c.created_at,
             u.id AS a_id, u.email AS a_email, u.full_name AS a_full_name, u.avatar_path AS a_avatar_path
      FROM post_comments c LEFT JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ${postId}
      ORDER BY c.created_at ASC, c.id ASC`;
    return c.json(rows.map((r) => commentDto(r, post.user_id, user)));
  });

  app.post('/api/community/posts/:id/comments', async (c) => {
    const postId = uuidParam(c, 'id');
    const user = me(c);
    const json = await readJson(c);
    const rawBody = optString(json, 'body');
    new Check().notBlank('body', rawBody, 'Escreva um comentário.').done();

    const dto = await transaction(async (tx) => {
      const post = await requirePost(tx, postId);
      const body = rawBody == null ? '' : strip(rawBody);
      if (body === '') throw badRequest('Escreva um comentário.');
      if (body.length > MAX_COMMENT) throw badRequest('O comentário pode ter no máximo 300 caracteres.');
      const id = newId();
      const createdAt = now();
      await tx`
        INSERT INTO post_comments (id, post_id, user_id, body, created_at)
        VALUES (${id}, ${postId}, ${user.id}, ${body}, ${createdAt})`;
      const [u] = await tx<{ id: string; email: string; full_name: string | null; avatar_path: string | null }[]>`
        SELECT id, email, full_name, avatar_path FROM users WHERE id = ${user.id}`;
      await notifyReply(tx, post.user_id, user.id, 'COMMENT', `${displayName(u)} comentou na sua publicação`,
        excerpt(body, 120), linkTo(postId));
      const row: CommentRow = {
        id, post_id: postId, user_id: user.id, body, created_at: createdAt,
        a_id: u.id, a_email: u.email, a_full_name: u.full_name, a_avatar_path: u.avatar_path,
      };
      return commentDto(row, post.user_id, user);
    });
    return created(c, dto);
  });

  /** Pode apagar: autor do comentário, autor do post ou admin. */
  app.delete('/api/community/comments/:id', async (c) => {
    const commentId = uuidParam(c, 'id');
    const user = me(c);
    await transaction(async (tx) => {
      const rows = await tx<{ user_id: string; post_owner: string | null }[]>`
        SELECT c.user_id, p.user_id AS post_owner
        FROM post_comments c LEFT JOIN community_posts p ON p.id = c.post_id
        WHERE c.id = ${commentId}`;
      if (rows.length === 0) throw notFound(Messages.COMMENT_NOT_FOUND);
      if (!canDeleteComment(rows[0], rows[0].post_owner, user)) throw forbidden(Messages.NO_PERMISSION);
      await tx`DELETE FROM post_comments WHERE id = ${commentId}`;
    });
    return noContent(c);
  });

  // ---------------------------------------------------------------- estatísticas

  app.get('/api/community/stats', async (c) => {
    const user = me(c);
    const sql = db();
    const current = now().getTime();
    const since24h = new Date(current - DAY_MS);
    const since30d = new Date(current - 30 * DAY_MS);
    const since7d = new Date(current - 7 * DAY_MS);
    const [[counts], bodies, voices] = await Promise.all([
      sql<{ members: number; posts_today: number; posts_total: number; mine: number }[]>`
        SELECT
          (SELECT count(*) FROM users WHERE active = true) AS members,
          (SELECT count(*) FROM community_posts WHERE created_at >=
              (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')) AS posts_today,
          (SELECT count(*) FROM community_posts) AS posts_total,
          (SELECT count(*) FROM community_posts WHERE user_id = ${user.id} AND created_at > ${since24h}) AS mine`,
      sql<{ body: string }[]>`SELECT body FROM community_posts WHERE created_at >= ${since30d}`,
      // Quem mais movimentou (post vale 2, comentário vale 1); só contas ativas.
      sql<{ id: string; email: string; full_name: string | null; avatar_path: string | null; posts: number; comments: number }[]>`
        WITH p AS (SELECT user_id, count(*) AS n FROM community_posts WHERE created_at >= ${since7d} GROUP BY user_id),
             c AS (SELECT user_id, count(*) AS n FROM post_comments WHERE created_at >= ${since7d} GROUP BY user_id)
        SELECT u.id, u.email, u.full_name, u.avatar_path, COALESCE(p.n, 0) AS posts, COALESCE(c.n, 0) AS comments
        FROM users u LEFT JOIN p ON p.user_id = u.id LEFT JOIN c ON c.user_id = u.id
        WHERE u.active = true AND (p.n IS NOT NULL OR c.n IS NOT NULL)`,
    ]);
    const topVoices = voices
      .map((v) => ({ author: authorDto(v), posts: v.posts, comments: v.comments }))
      .sort((a, b) => {
        const diff = 2 * b.posts + b.comments - (2 * a.posts + a.comments);
        if (diff !== 0) return diff;
        return a.author.fullName < b.author.fullName ? -1 : a.author.fullName > b.author.fullName ? 1 : 0;
      })
      .slice(0, TOP_VOICES);
    return c.json({
      members: counts.members,
      postsToday: counts.posts_today,
      postsTotal: counts.posts_total,
      myPosts24h: counts.mine,
      remainingToday: Math.max(0, DAILY_LIMIT - counts.mine),
      tags: topTags(bodies.map((b) => b.body)),
      topVoices,
    });
  });
}
