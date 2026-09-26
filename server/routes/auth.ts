import { checkPassword, hashPassword, issueTokens, newToken, sha256 } from '../lib/auth.js';
import { db, newId, now, transaction, withUserLock, type Db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { badRequest, forbidden, Messages, notFound, tooManyRequests, unauthorized } from '../lib/errors.js';
import { Check, me, noContent, optBoolean, optString, readJson, readJsonOptional, type App } from '../lib/http.js';
import { mailEnabled, sendMail } from '../lib/mail.js';
import { displayName, fitsBcrypt, normalizeEmail, userDto, validatePassword, type UserRow } from '../lib/users.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
const INVALID_RESET = 'Link de redefinição inválido ou expirado. Peça um novo.';

// ------------------------------------------------------------------ limite de tentativas de login

/**
 * 5 falhas para o mesmo e-mail em 15 minutos → bloqueio até a falha mais antiga sair da janela.
 * Fica em memória, por instância da função (como no Java, que era por processo).
 */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const CLEANUP_THRESHOLD = 10_000;
const failures = new Map<string, number[]>();

function prune(list: number[], t: number): void {
  const limit = t - WINDOW_MS;
  while (list.length && list[0] < limit) list.shift();
}

export const loginAttempts = {
  isBlocked(email: string): boolean {
    const list = failures.get(email);
    if (!list) return false;
    prune(list, Date.now());
    return list.length >= MAX_FAILURES;
  },
  recordFailure(email: string): void {
    const t = Date.now();
    if (failures.size > CLEANUP_THRESHOLD) {
      for (const [key, list] of failures) {
        prune(list, t);
        if (!list.length) failures.delete(key);
      }
    }
    let list = failures.get(email);
    if (!list) failures.set(email, (list = []));
    prune(list, t);
    list.push(t);
  },
  reset(email: string): void {
    failures.delete(email);
  },
};

/**
 * Hash "de mentira" (custo 10, senha aleatória descartada) para igualar o tempo de resposta
 * quando o e-mail não existe. Fixo para não gastar um BCrypt a cada cold start.
 */
const DUMMY_HASH = '$2a$10$Y0XUnLhuFnG9dIJ4NwJnUOLKsDlwleF4RbgT7wFY2zS8U1148o2Mu';

// ------------------------------------------------------------------ login por passkey (usado por webauthn.ts)

/** Login já provado por passkey: só confere a conta e emite os tokens (roda na transação de quem chama). */
export async function loginWithPasskey(sql: Db, userId: string, rememberMe: boolean) {
  const t = now();
  const rows = await sql<UserRow[]>`
    UPDATE users SET last_login_at = ${t}, updated_at = ${t}
    WHERE id = ${userId} AND active = true RETURNING *`;
  if (!rows.length) {
    const exists = await sql`SELECT 1 FROM users WHERE id = ${userId}`;
    throw exists.length ? forbidden(Messages.ACCOUNT_BLOCKED) : unauthorized(Messages.BAD_CREDENTIALS);
  }
  return issueTokens(sql, rows[0], rememberMe);
}

// ------------------------------------------------------------------ rotas

export function registerAuth(app: App) {
  app.post('/api/auth/login', async (c) => {
    const body = await readJson(c);
    const rawEmail = optString(body, 'email');
    const password = optString(body, 'password');
    const rememberMe = optBoolean(body, 'rememberMe') ?? false;
    new Check()
      .notBlank('email', rawEmail, 'Informe o e-mail.')
      .email('email', rawEmail, 'E-mail inválido.')
      .notBlank('password', password, 'Informe a senha.')
      .done();

    const email = normalizeEmail(rawEmail);
    if (loginAttempts.isBlocked(email)) {
      throw tooManyRequests(Messages.TOO_MANY_LOGIN_ATTEMPTS);
    }
    const rows = await db()<UserRow[]>`SELECT * FROM users WHERE email = ${email}`;
    const user = rows[0];
    const passwordOk =
      password != null && fitsBcrypt(password) && (await checkPassword(password, user ? user.password_hash : DUMMY_HASH));
    if (!user || !passwordOk) {
      loginAttempts.recordFailure(email);
      throw unauthorized(Messages.BAD_CREDENTIALS);
    }
    if (!user.active) {
      throw forbidden(Messages.ACCOUNT_BLOCKED);
    }
    loginAttempts.reset(email);
    const res = await transaction(async (tx) => {
      const t = now();
      const updated = await tx<UserRow[]>`
        UPDATE users SET last_login_at = ${t}, updated_at = ${t} WHERE id = ${user.id} RETURNING *`;
      return issueTokens(tx, updated[0] ?? user, rememberMe);
    });
    return c.json(res);
  });

  app.post('/api/auth/refresh', async (c) => {
    const body = await readJson(c);
    const rawToken = optString(body, 'refreshToken');
    new Check().notBlank('refreshToken', rawToken, 'Refresh token ausente.').done();

    const res = await transaction(async (tx) => {
      // Revoga o token usado (se ainda servir) e emite um novo par; um erro depois desfaz a revogação.
      const tokens = await tx<{ user_id: string; remember_me: boolean }[]>`
        UPDATE refresh_tokens SET revoked = true
        WHERE token_hash = ${sha256(rawToken!)} AND revoked = false AND expires_at > ${now()}
        RETURNING user_id, remember_me`;
      if (!tokens.length) {
        throw unauthorized(Messages.SESSION_EXPIRED);
      }
      const users = await tx<UserRow[]>`SELECT * FROM users WHERE id = ${tokens[0].user_id}`;
      if (!users.length) {
        throw unauthorized(Messages.SESSION_EXPIRED);
      }
      if (!users[0].active) {
        throw forbidden(Messages.ACCOUNT_BLOCKED);
      }
      return issueTokens(tx, users[0], tokens[0].remember_me);
    });
    return c.json(res);
  });

  app.post('/api/auth/logout', async (c) => {
    const body = await readJsonOptional(c);
    const rawToken = body == null ? undefined : optString(body, 'refreshToken');
    if (rawToken != null && rawToken.trim() !== '') {
      await db()`UPDATE refresh_tokens SET revoked = true WHERE token_hash = ${sha256(rawToken)}`;
    }
    return noContent(c);
  });

  app.get('/api/auth/me', async (c) => {
    const rows = await db()<UserRow[]>`SELECT * FROM users WHERE id = ${me(c).id}`;
    if (!rows.length) {
      throw notFound(Messages.USER_NOT_FOUND);
    }
    return c.json(userDto(rows[0]));
  });

  /** Sempre "sucesso" para quem chama: não revela se o e-mail existe. */
  app.post('/api/auth/forgot-password', async (c) => {
    const body = await readJson(c);
    const rawEmail = optString(body, 'email');
    new Check()
      .notBlank('email', rawEmail, 'Informe o e-mail.')
      .email('email', rawEmail, 'E-mail inválido.')
      .done();

    const email = normalizeEmail(rawEmail);
    const users = await db()<UserRow[]>`SELECT * FROM users WHERE email = ${email}`;
    const user = users[0];
    if (!user || !user.active) {
      return noContent(c);
    }
    const token = await withUserLock(user.id, async (tx) => {
      const t = now();
      const recent = await tx`
        SELECT 1 FROM password_reset_tokens
        WHERE user_id = ${user.id} AND created_at > ${new Date(t.getTime() - RESET_REQUEST_COOLDOWN_MS)} LIMIT 1`;
      if (recent.length) {
        return null; // evita spam de e-mails
      }
      const raw = newToken();
      await tx`
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
        VALUES (${newId()}, ${user.id}, ${sha256(raw)}, ${new Date(t.getTime() + RESET_TOKEN_TTL_MS)}, null, ${t})`;
      return raw;
    });
    if (token == null) {
      return noContent(c);
    }

    const link = `${env.frontendUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    const text = `Olá, ${displayName(user)}!

Recebemos um pedido para redefinir a sua senha no AssessoriaLure.
Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):

${link}

Se não foi você, ignore este e-mail — sua senha continua a mesma.

Time LURE
`;
    if (!mailEnabled()) {
      console.info(`Link de redefinição de senha para ${email}: ${link}`);
    }
    await sendMail(email, 'Redefinição de senha — AssessoriaLure', text);
    return noContent(c);
  });

  app.post('/api/auth/reset-password', async (c) => {
    const body = await readJson(c);
    const rawToken = optString(body, 'token');
    const newPassword = optString(body, 'newPassword');
    new Check()
      .notBlank('token', rawToken, 'Link de redefinição inválido ou expirado.')
      .notBlank('newPassword', newPassword, 'Informe a nova senha.')
      .minLength('newPassword', newPassword, 8, 'A senha precisa ter pelo menos 8 caracteres.')
      .maxLength('newPassword', newPassword, 72, 'A senha pode ter no máximo 72 caracteres.')
      .done();
    validatePassword(newPassword);

    const email = await transaction(async (tx) => {
      const t = now();
      const tokens = await tx<{ id: string; user_id: string }[]>`
        SELECT id, user_id FROM password_reset_tokens
        WHERE token_hash = ${sha256(rawToken!)} AND used_at IS NULL AND expires_at > ${t}
        FOR UPDATE`;
      if (!tokens.length) {
        throw badRequest(INVALID_RESET);
      }
      const userId = tokens[0].user_id;
      const users = await tx<{ email: string }[]>`SELECT email FROM users WHERE id = ${userId}`;
      if (!users.length) {
        throw badRequest(INVALID_RESET);
      }
      const hash = await hashPassword(newPassword);
      await tx`UPDATE users SET password_hash = ${hash}, updated_at = ${t} WHERE id = ${userId}`;
      // Marca este e invalida todos os outros links pendentes do usuário.
      await tx`UPDATE password_reset_tokens SET used_at = ${t} WHERE user_id = ${userId} AND used_at IS NULL`;
      await tx`UPDATE refresh_tokens SET revoked = true WHERE user_id = ${userId} AND revoked = false`;
      return users[0].email;
    });
    loginAttempts.reset(email);
    return noContent(c);
  });
}
