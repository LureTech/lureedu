import { db, newId, now, type Db } from '../lib/db.js';
import { notFound } from '../lib/errors.js';
import { Check, intQuery, me, noContent, optBoolean, readJson, uuidParam, type App } from '../lib/http.js';

export type NotificationType = 'LIKE' | 'COMMENT' | 'NEW_CONTENT' | 'COMMUNITY' | 'SYSTEM';

interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: Date;
}

interface PrefsRow {
  community: boolean;
  replies: boolean;
  new_content: boolean;
}

function prefsDto(p: PrefsRow | undefined) {
  return { community: p?.community ?? true, replies: p?.replies ?? true, newContent: p?.new_content ?? true };
}

function truncate(value: string | null, max: number): string | null {
  if (value == null) return null;
  return value.length <= max ? value : `${value.substring(0, max - 1)}…`;
}

// ------------------------------------------------------------------ geração (usada por comunidade e admin)

/** Curtida/comentário no post de alguém: respeita a preferência "replies" e nunca notifica a si mesmo. */
export async function notifyReply(
  sql: Db,
  recipientId: string,
  actorId: string,
  type: NotificationType,
  title: string,
  body: string | null,
  link: string | null,
): Promise<void> {
  if (recipientId === actorId) return;
  const prefs = await sql<{ replies: boolean }[]>`SELECT replies FROM notification_prefs WHERE user_id = ${recipientId}`;
  if (prefs.length && !prefs[0].replies) return;
  await sql`
    INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
    VALUES (${newId()}, ${recipientId}, ${type}, ${title}, ${body}, ${link}, false, ${now()})`;
}

/** Aviso direto a uma pessoa (ex.: resultado da moderação da comunidade); não depende de preferência. */
export async function notifyUser(
  sql: Db,
  recipientId: string,
  type: NotificationType,
  title: string,
  body: string | null,
  link: string | null,
): Promise<void> {
  await sql`
    INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
    VALUES (${newId()}, ${recipientId}, ${type}, ${truncate(title, 200)}, ${truncate(body, 500)}, ${link}, false, ${now()})`;
}

/** Avisa todos os admins ativos (exceto quem agiu). */
export async function notifyAdmins(sql: Db, actorId: string, title: string, body: string | null, link: string | null): Promise<void> {
  await sql`
    INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
    SELECT gen_random_uuid(), u.id, 'SYSTEM', ${truncate(title, 200)}, ${truncate(body, 500)}, ${link}, false, ${now()}
    FROM users u
    WHERE u.active = true AND u.role = 'ADMIN' AND u.id <> ${actorId}`;
}

/** Novo módulo liberado: todos os usuários ativos (exceto quem liberou) com "newContent" ligado. */
export async function notifyNewContent(sql: Db, actorId: string, title: string, body: string | null, link: string | null): Promise<number> {
  const result = await sql`
    INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
    SELECT gen_random_uuid(), u.id, 'NEW_CONTENT', ${truncate(title, 200)}, ${truncate(body, 500)}, ${link}, false, ${now()}
    FROM users u
    WHERE u.active = true AND u.id <> ${actorId}
      AND NOT EXISTS (SELECT 1 FROM notification_prefs p WHERE p.user_id = u.id AND p.new_content = false)`;
  return result.count;
}

/** Post de admin na comunidade: usuários ativos (exceto o autor) com "community" ligado. */
export async function notifyCommunity(sql: Db, actorId: string, title: string, body: string | null, link: string | null): Promise<number> {
  const result = await sql`
    INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
    SELECT gen_random_uuid(), u.id, 'COMMUNITY', ${truncate(title, 200)}, ${truncate(body, 500)}, ${link}, false, ${now()}
    FROM users u
    WHERE u.active = true AND u.id <> ${actorId}
      AND NOT EXISTS (SELECT 1 FROM notification_prefs p WHERE p.user_id = u.id AND p.community = false)`;
  return result.count;
}

// ------------------------------------------------------------------ rotas

export function registerNotifications(app: App) {
  app.get('/api/notifications', async (c) => {
    const userId = me(c).id;
    const size = Math.max(1, Math.min(intQuery(c, 'limit', 20), 50));
    const sql = db();
    const [rows, unread] = await Promise.all([
      sql<NotificationRow[]>`
        SELECT id, type, title, body, link, is_read, created_at FROM notifications
        WHERE user_id = ${userId} ORDER BY created_at DESC, id DESC LIMIT ${size}`,
      sql<{ n: number }[]>`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ${userId} AND is_read = false`,
    ]);
    return c.json({
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        read: n.is_read,
        createdAt: n.created_at,
      })),
      unread: unread[0].n,
    });
  });

  app.post('/api/notifications/read-all', async (c) => {
    await db()`UPDATE notifications SET is_read = true WHERE user_id = ${me(c).id} AND is_read = false`;
    return noContent(c);
  });

  app.post('/api/notifications/:id/read', async (c) => {
    const id = uuidParam(c, 'id');
    const result = await db()`UPDATE notifications SET is_read = true WHERE id = ${id} AND user_id = ${me(c).id}`;
    if (result.count === 0) {
      throw notFound('Notificação não encontrada.');
    }
    return noContent(c);
  });

  app.get('/api/me/notification-prefs', async (c) => {
    const rows = await db()<PrefsRow[]>`
      SELECT community, replies, new_content FROM notification_prefs WHERE user_id = ${me(c).id}`;
    return c.json(prefsDto(rows[0]));
  });

  app.put('/api/me/notification-prefs', async (c) => {
    const body = await readJson(c);
    const community = optBoolean(body, 'community');
    const replies = optBoolean(body, 'replies');
    const newContent = optBoolean(body, 'newContent');
    new Check()
      .notNull('community', community, 'Campo obrigatório.')
      .notNull('replies', replies, 'Campo obrigatório.')
      .notNull('newContent', newContent, 'Campo obrigatório.')
      .done();
    const rows = await db()<PrefsRow[]>`
      INSERT INTO notification_prefs (user_id, community, replies, new_content)
      VALUES (${me(c).id}, ${community!}, ${replies!}, ${newContent!})
      ON CONFLICT (user_id) DO UPDATE
        SET community = EXCLUDED.community, replies = EXCLUDED.replies, new_content = EXCLUDED.new_content
      RETURNING community, replies, new_content`;
    return c.json(prefsDto(rows[0]));
  });
}
