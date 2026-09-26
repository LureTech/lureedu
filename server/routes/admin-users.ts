import { forgetAccess, hashPassword } from '../lib/auth.js';
import { db, newId, now, transaction, type Db } from '../lib/db.js';
import { badRequest, conflict, Messages, notFound } from '../lib/errors.js';
import {
  Check,
  INVALID_BODY,
  me,
  optBoolean,
  optString,
  readForm,
  readJson,
  uuidParam,
  created,
  noContent,
  type App,
  type Ctx,
  type Role,
} from '../lib/http.js';
import { deleteFile, storeImage } from '../lib/storage.js';
import { trimToNull } from '../lib/text.js';
import { normalizeEmail, userDto, validatePassword, type UserRow } from '../lib/users.js';

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const USER_COLUMNS = ['id', 'email', 'full_name', 'avatar_path', 'role', 'active', 'created_at', 'updated_at', 'last_login_at'];

/** Corpo JSON obrigatório (vazio → 400, igual ao @RequestBody do Spring). */
async function readBody(c: Ctx): Promise<Record<string, unknown>> {
  const text = await c.req.text();
  if (text.trim() === '') {
    throw badRequest(INVALID_BODY);
  }
  return readJson(c);
}

/** Enum Role do Jackson: nome exato ou índice (0 = ADMIN, 1 = MEMBER). */
function optRole(body: Record<string, unknown>, key: string): Role | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (v === 'ADMIN' || v === 'MEMBER') return v;
  if (v === 0 || v === '0') return 'ADMIN';
  if (v === 1 || v === '1') return 'MEMBER';
  throw badRequest(INVALID_BODY);
}

async function requireUser(sql: Db, id: string): Promise<UserRow> {
  const rows = await sql<UserRow[]>`SELECT ${sql(USER_COLUMNS)} FROM users WHERE id = ${id}`;
  if (rows.length === 0) {
    throw notFound(Messages.USER_NOT_FOUND);
  }
  return rows[0];
}

/** Visão geral e gestão de contas (somente ADMIN — o filtro já garante). */
export function registerAdminUsers(app: App) {
  app.get('/api/admin/stats', async (c) => {
    const [s] = await db()<Record<string, number>[]>`
      SELECT
        (SELECT count(*) FROM users) AS users,
        (SELECT count(*) FROM users WHERE active = true) AS active_users,
        (SELECT count(*) FROM users WHERE role = 'ADMIN') AS admins,
        (SELECT count(*) FROM courses) AS modules,
        (SELECT count(*) FROM lessons) AS lessons,
        (SELECT count(*) FROM lesson_progress WHERE completed = true) AS lessons_completed,
        (SELECT count(*) FROM certificates) AS certificates,
        (SELECT count(*) FROM community_posts) AS posts_total,
        (SELECT count(*) FROM community_posts
          WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
        ) AS posts_today,
        (SELECT count(*) FROM diagnostic_submissions) AS diagnostics`;
    return c.json({
      users: s.users,
      activeUsers: s.active_users,
      admins: s.admins,
      modules: s.modules,
      lessons: s.lessons,
      lessonsCompleted: s.lessons_completed,
      certificates: s.certificates,
      postsTotal: s.posts_total,
      postsToday: s.posts_today,
      diagnostics: s.diagnostics,
    });
  });

  // Admins primeiro, depois por data de criação; q filtra por nome ou e-mail.
  app.get('/api/admin/users', async (c) => {
    const q = c.req.query('q');
    const filter = q == null ? '' : q.trim().toLowerCase();
    const sql = db();
    const rows = await sql<UserRow[]>`
      SELECT ${sql(USER_COLUMNS)} FROM users u
      WHERE (${filter} = '' OR lower(u.email) LIKE '%' || ${filter} || '%'
             OR lower(coalesce(u.full_name, '')) LIKE '%' || ${filter} || '%')
      ORDER BY CASE WHEN u.role = 'ADMIN' THEN 0 ELSE 1 END, u.created_at ASC`;
    return c.json(rows.map(userDto));
  });

  app.post('/api/admin/users', async (c) => {
    const body = await readBody(c);
    const email = optString(body, 'email');
    const password = optString(body, 'password');
    const fullName = optString(body, 'fullName');
    const role = optRole(body, 'role');
    new Check()
      .notBlank('email', email, 'Informe o e-mail.')
      .email('email', email, 'E-mail inválido.')
      .maxLength('email', email, 254, 'E-mail longo demais.')
      .notBlank('password', password, 'Informe a senha.')
      .minLength('password', password, 8, 'A senha precisa ter pelo menos 8 caracteres.')
      .maxLength('password', password, 72, 'A senha pode ter no máximo 72 caracteres.')
      .maxLength('fullName', fullName, 80, 'O nome pode ter no máximo 80 caracteres.')
      .notNull('role', role, 'Escolha o perfil de acesso.')
      .done();

    const normalized = normalizeEmail(email);
    validatePassword(password);
    const sql = db();
    const exists = await sql`SELECT 1 FROM users WHERE email = ${normalized}`;
    if (exists.length > 0) {
      throw conflict('Já existe uma conta com esse e-mail.');
    }
    const hash = await hashPassword(password);
    const t = now();
    const [row] = await sql<UserRow[]>`
      INSERT INTO users (id, email, password_hash, full_name, avatar_path, role, active, created_at, updated_at, last_login_at)
      VALUES (${newId()}, ${normalized}, ${hash}, ${trimToNull(fullName)}, NULL, ${role!}, true, ${t}, ${t}, NULL)
      RETURNING ${sql(USER_COLUMNS)}`;
    return created(c, userDto(row));
  });

  app.post('/api/admin/users/:id/avatar', async (c) => {
    const form = await readForm(c);
    const id = uuidParam(c, 'id');
    const file = form.file;
    if (!(file instanceof File)) {
      throw badRequest('Selecione um arquivo para enviar.');
    }
    const row = await transaction(async (tx) => {
      const user = await requireUser(tx, id);
      if (file.size === 0) {
        throw badRequest('Selecione um arquivo para enviar.');
      }
      const stored = await storeImage(tx, file, 'avatars', AVATAR_MAX_BYTES, 'A foto deve ter no máximo 5 MB.');
      await deleteFile(tx, user.avatar_path);
      const [updated] = await tx<UserRow[]>`
        UPDATE users SET avatar_path = ${stored.path}, updated_at = ${now()} WHERE id = ${id}
        RETURNING ${tx(USER_COLUMNS)}`;
      return updated;
    });
    return c.json(userDto(row));
  });

  // Não é permitido alterar o próprio papel nem se bloquear. O bloqueio vale na hora.
  app.patch('/api/admin/users/:id', async (c) => {
    const id = uuidParam(c, 'id');
    const body = await readBody(c);
    const fullName = optString(body, 'fullName');
    const role = optRole(body, 'role');
    const active = optBoolean(body, 'active');
    new Check().maxLength('fullName', fullName, 80, 'O nome pode ter no máximo 80 caracteres.').done();

    const current = me(c);
    let accessChanged = false;
    const row = await transaction(async (tx) => {
      const user = await requireUser(tx, id);
      const changesRole = role !== undefined && role !== user.role;
      const changesActive = active !== undefined && active !== user.active;
      if (user.id === current.id && (changesRole || changesActive)) {
        throw badRequest('Você não pode alterar o próprio acesso.');
      }
      const newName = fullName !== undefined ? trimToNull(fullName) : user.full_name;
      const newRole = changesRole ? role! : user.role;
      const newActive = changesActive ? active! : user.active;
      if (newName === user.full_name && !changesRole && !changesActive) {
        return user;
      }
      accessChanged = changesRole || changesActive;
      const [updated] = await tx<UserRow[]>`
        UPDATE users SET full_name = ${newName}, role = ${newRole}, active = ${newActive}, updated_at = ${now()}
        WHERE id = ${id}
        RETURNING ${tx(USER_COLUMNS)}`;
      return updated;
    });
    if (accessChanged) {
      forgetAccess(id);
    }
    return c.json(userDto(row));
  });

  app.post('/api/admin/users/:id/reset-password', async (c) => {
    const id = uuidParam(c, 'id');
    const body = await readBody(c);
    const newPassword = optString(body, 'newPassword');
    new Check()
      .notBlank('newPassword', newPassword, 'Informe a nova senha.')
      .minLength('newPassword', newPassword, 8, 'A senha precisa ter pelo menos 8 caracteres.')
      .maxLength('newPassword', newPassword, 72, 'A senha pode ter no máximo 72 caracteres.')
      .done();

    await transaction(async (tx) => {
      await requireUser(tx, id);
      validatePassword(newPassword);
      const hash = await hashPassword(newPassword);
      await tx`UPDATE users SET password_hash = ${hash}, updated_at = ${now()} WHERE id = ${id}`;
      await tx`UPDATE refresh_tokens SET revoked = true WHERE user_id = ${id} AND revoked = false`;
    });
    return noContent(c);
  });
}
