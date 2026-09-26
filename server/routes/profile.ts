import { checkPassword, hashPassword } from '../lib/auth.js';
import { db, now, transaction, type Db } from '../lib/db.js';
import { badRequest, Messages, notFound } from '../lib/errors.js';
import { Check, formFile, me, noContent, optString, readForm, readJson, type App } from '../lib/http.js';
import { deleteFile, storeImage } from '../lib/storage.js';
import { trimToNull } from '../lib/text.js';
import { fitsBcrypt, userDto, validatePassword, type UserRow } from '../lib/users.js';

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Usuário travado para atualização (404 se não existir). */
async function requireUser(sql: Db, userId: string): Promise<UserRow> {
  const rows = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${userId} FOR UPDATE`;
  if (!rows.length) {
    throw notFound(Messages.USER_NOT_FOUND);
  }
  return rows[0];
}

/** Troca o caminho da foto; updated_at só muda se o valor mudar (como o @PreUpdate do JPA). */
async function setAvatar(sql: Db, userId: string, path: string | null): Promise<UserRow> {
  const rows = await sql<UserRow[]>`
    UPDATE users SET avatar_path = ${path},
      updated_at = CASE WHEN avatar_path IS DISTINCT FROM ${path} THEN ${now()} ELSE updated_at END
    WHERE id = ${userId} RETURNING *`;
  return rows[0];
}

export function registerProfile(app: App) {
  app.put('/api/me', async (c) => {
    const body = await readJson(c);
    const fullName = optString(body, 'fullName');
    new Check().maxLength('fullName', fullName, 80, 'O nome pode ter no máximo 80 caracteres.').done();
    const name = trimToNull(fullName);
    const rows = await db()<UserRow[]>`
      UPDATE users SET full_name = ${name},
        updated_at = CASE WHEN full_name IS DISTINCT FROM ${name} THEN ${now()} ELSE updated_at END
      WHERE id = ${me(c).id} RETURNING *`;
    if (!rows.length) {
      throw notFound(Messages.USER_NOT_FOUND);
    }
    return c.json(userDto(rows[0]));
  });

  app.post('/api/me/avatar', async (c) => {
    const form = await readForm(c);
    const file = formFile(form, 'file');
    const userId = me(c).id;
    const user = await transaction(async (tx) => {
      const current = await requireUser(tx, userId);
      const stored = await storeImage(tx, file, 'avatars', AVATAR_MAX_BYTES, 'A foto deve ter no máximo 5 MB.');
      // A foto antiga sai na mesma transação (se algo falhar, nada muda).
      await deleteFile(tx, current.avatar_path);
      return setAvatar(tx, userId, stored.path);
    });
    return c.json(userDto(user));
  });

  app.delete('/api/me/avatar', async (c) => {
    const userId = me(c).id;
    const user = await transaction(async (tx) => {
      const current = await requireUser(tx, userId);
      await deleteFile(tx, current.avatar_path);
      return setAvatar(tx, userId, null);
    });
    return c.json(userDto(user));
  });

  app.put('/api/me/password', async (c) => {
    const body = await readJson(c);
    const currentPassword = optString(body, 'currentPassword');
    const newPassword = optString(body, 'newPassword');
    new Check()
      .notBlank('currentPassword', currentPassword, 'Informe a senha atual.')
      .notBlank('newPassword', newPassword, 'Informe a nova senha.')
      .minLength('newPassword', newPassword, 8, 'A senha precisa ter pelo menos 8 caracteres.')
      .maxLength('newPassword', newPassword, 72, 'A senha pode ter no máximo 72 caracteres.')
      .done();
    const userId = me(c).id;
    await transaction(async (tx) => {
      const user = await requireUser(tx, userId);
      if (!fitsBcrypt(currentPassword!) || !(await checkPassword(currentPassword!, user.password_hash))) {
        throw badRequest('Senha atual incorreta.');
      }
      validatePassword(newPassword);
      const hash = await hashPassword(newPassword);
      await tx`UPDATE users SET password_hash = ${hash}, updated_at = ${now()} WHERE id = ${userId}`;
    });
    return noContent(c);
  });
}
