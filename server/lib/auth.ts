import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { MiddlewareHandler } from 'hono';
import { db, newId, now, type Db } from './db.js';
import { env, jwtSecret } from './env.js';
import { ApiException, Messages } from './errors.js';
import type { AppEnv, AuthUser, Role } from './http.js';
import { userDto, type UserDto, type UserRow } from './users.js';

// ------------------------------------------------------------------ tokens opacos

/** Token aleatório de 256 bits em base64url (refresh, redefinição de senha). */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash SHA-256 (hex) que vai para o banco. */
export function sha256(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

// ------------------------------------------------------------------ senhas (BCrypt, compatível com o Java)

export function hashPassword(raw: string): Promise<string> {
  return bcrypt.hash(raw, 10);
}

export function checkPassword(raw: string, hash: string): Promise<boolean> {
  // O Spring grava $2a$; o bcryptjs aceita $2a$/$2b$/$2y$.
  return bcrypt.compare(raw, hash);
}

// ------------------------------------------------------------------ JWT HS256

interface Claims {
  iss: string;
  sub: string;
  iat: number;
  exp: number;
  role: Role;
  email: string;
}

function signJwt(claims: Claims): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', jwtSecret()).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/** Valida assinatura, emissor e validade; qualquer problema → null. */
function verifyJwt(token: string): Claims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  try {
    const head = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (head.alg !== 'HS256') return null;
    const expected = createHmac('sha256', jwtSecret()).update(`${header}.${payload}`).digest();
    const given = Buffer.from(signature, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Claims;
    const nowSeconds = Math.floor(Date.now() / 1000);
    // 60 s de tolerância de relógio, como o validador padrão do Spring.
    if (claims.iss !== env.jwt.issuer || typeof claims.exp !== 'number' || claims.exp + 60 < nowSeconds) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDto;
}

/** Emite access token (15 min) + refresh token opaco (12 h, ou 30 dias com "lembrar"). */
export async function issueTokens(sql: Db, user: UserRow, rememberMe: boolean): Promise<AuthResponse> {
  const issuedAt = now();
  const iat = Math.floor(issuedAt.getTime() / 1000);
  const accessToken = signJwt({
    iss: env.jwt.issuer,
    sub: user.id,
    iat,
    exp: iat + env.jwt.accessTtlSeconds,
    role: user.role,
    email: user.email,
  });
  const refreshToken = newToken();
  const ttl = rememberMe ? env.jwt.refreshRememberTtlSeconds : env.jwt.refreshTtlSeconds;
  await sql`
    INSERT INTO refresh_tokens (id, user_id, token_hash, remember_me, expires_at, revoked, created_at)
    VALUES (${newId()}, ${user.id}, ${sha256(refreshToken)}, ${rememberMe},
            ${new Date(issuedAt.getTime() + ttl * 1000)}, false, ${issuedAt})`;
  return { accessToken, refreshToken, expiresIn: env.jwt.accessTtlSeconds, user: userDto(user) };
}

// ------------------------------------------------------------------ filtro de autenticação

/** Rotas /api que não exigem login. */
const PUBLIC_POST_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/webauthn/login/options',
  '/api/auth/webauthn/login/verify',
]);

export function isPublicRoute(method: string, path: string): boolean {
  return (method === 'POST' && PUBLIC_POST_ROUTES.has(path)) || path.startsWith('/api/public/') || method === 'OPTIONS';
}

/**
 * Conta ativa + papel atual, guardados por 15 s por instância (bloqueios e trocas de papel
 * valem quase na hora sem um SELECT a cada requisição).
 */
const CACHE_TTL_MS = 15_000;
const accessCache = new Map<string, { active: boolean; role: Role | null; expiresAt: number }>();

async function access(userId: string) {
  const t = Date.now();
  const cached = accessCache.get(userId);
  if (cached && cached.expiresAt > t) return cached;
  const rows = await db()<{ active: boolean; role: Role }[]>`SELECT active, role FROM users WHERE id = ${userId}`;
  const fresh = rows.length
    ? { active: rows[0].active, role: rows[0].role, expiresAt: t + CACHE_TTL_MS }
    : { active: false, role: null, expiresAt: t + CACHE_TTL_MS };
  if (accessCache.size >= 5_000) accessCache.clear();
  accessCache.set(userId, fresh);
  return fresh;
}

/** Esquece o acesso guardado (ex.: admin bloqueou ou mudou o papel). */
export function forgetAccess(userId: string): void {
  accessCache.delete(userId);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Exige login em /api (exceto rotas públicas) e ADMIN em /api/admin. */
export const authentication: MiddlewareHandler<AppEnv> = async (c, next) => {
  const path = c.req.path;
  if (!path.startsWith('/api/') || isPublicRoute(c.req.method, path)) {
    return next();
  }
  const header = c.req.header('authorization');
  if (!header) {
    throw new ApiException(401, Messages.LOGIN_REQUIRED);
  }
  const match = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/i.exec(header.trim());
  const claims = match ? verifyJwt(match[1]) : null;
  if (!claims || !UUID_RE.test(claims.sub ?? '')) {
    throw new ApiException(401, Messages.SESSION_EXPIRED);
  }
  const acc = await access(claims.sub);
  if (!acc.active || acc.role == null) {
    throw new ApiException(403, Messages.ACCOUNT_BLOCKED);
  }
  const user: AuthUser = { id: claims.sub.toLowerCase(), email: claims.email, role: acc.role };
  if (path.startsWith('/api/admin/') && user.role !== 'ADMIN') {
    throw new ApiException(403, Messages.NO_PERMISSION);
  }
  c.set('user', user);
  return next();
};
