import type { Role } from './http.js';
import { badRequest } from './errors.js';
import { fileUrl } from './storage.js';

/** Linha da tabela users. */
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  avatar_path: string | null;
  role: Role;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export interface UserDto {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: Role;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface AuthorDto {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export function userDto(u: UserRow): UserDto {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    avatarUrl: fileUrl(u.avatar_path),
    role: u.role,
    active: u.active,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
  };
}

/** Nome para exibição: nome completo ou a parte do e-mail antes do @. */
export function displayName(u: { email: string; full_name: string | null }): string {
  if (u.full_name != null && u.full_name.trim() !== '') {
    return u.full_name.trim();
  }
  const at = u.email.indexOf('@');
  return at > 0 ? u.email.substring(0, at) : u.email;
}

/** Autor de post/comentário — sempre montado a partir do perfil atual. */
export function authorDto(u: { id: string; email: string; full_name: string | null; avatar_path: string | null }): AuthorDto {
  return { id: u.id, fullName: displayName(u), avatarUrl: fileUrl(u.avatar_path) };
}

/** Autor de uma conta que não existe mais. */
export function unknownAuthor(id: string): AuthorDto {
  return { id, fullName: 'Usuário', avatarUrl: null };
}

export function normalizeEmail(email: string | null | undefined): string {
  return email == null ? '' : email.trim().toLowerCase();
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

/** O BCrypt só considera 72 bytes. */
export function fitsBcrypt(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') <= PASSWORD_MAX_BYTES;
}

/** Regras de senha compartilhadas (mínimo 8 caracteres, máximo 72 bytes). */
export function validatePassword(password: string | null | undefined): asserts password is string {
  if (password == null || password.length < PASSWORD_MIN_LENGTH) {
    throw badRequest('A senha precisa ter pelo menos 8 caracteres.');
  }
  if (!fitsBcrypt(password)) {
    throw badRequest('A senha pode ter no máximo 72 caracteres.');
  }
}
