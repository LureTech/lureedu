import type { Context, Hono } from 'hono';
import { ApiException, badRequest, validationError } from './errors.js';

export type Role = 'ADMIN' | 'MEMBER';

/** Usuário autenticado da requisição (papel e status conferidos no banco). */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export type AppEnv = { Variables: { user: AuthUser } };
export type App = Hono<AppEnv>;
export type Ctx = Context<AppEnv>;

export const INVALID_BODY = 'Requisição inválida. Verifique os dados enviados.';

/** Usuário logado (as rotas /api não públicas já passaram pelo filtro de autenticação). */
export function me(c: Ctx): AuthUser {
  return c.get('user');
}

export function isAdmin(user: AuthUser): boolean {
  return user.role === 'ADMIN';
}

/** Corpo JSON como objeto; JSON inválido ou que não é objeto → 400. */
export async function readJson(c: Ctx): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    const text = await c.req.text();
    body = text.trim() === '' ? {} : JSON.parse(text);
  } catch {
    throw badRequest(INVALID_BODY);
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest(INVALID_BODY);
  }
  return body as Record<string, unknown>;
}

/** Corpo JSON opcional (ex.: logout sem corpo). */
export async function readJsonOptional(c: Ctx): Promise<Record<string, unknown> | null> {
  const text = await c.req.text();
  if (text.trim() === '') {
    return null;
  }
  try {
    const body = JSON.parse(text);
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    throw badRequest(INVALID_BODY);
  }
}

/**
 * Acumula erros de campo como o Bean Validation do Java: o primeiro erro de cada campo vale,
 * e {@link done} lança um 400 com todos eles.
 */
export class Check {
  readonly fields: Record<string, string> = {};

  fail(field: string, message: string): this {
    if (!(field in this.fields)) {
      this.fields[field] = message;
    }
    return this;
  }

  /** Falha se o valor não for texto com algo além de espaços. */
  notBlank(field: string, value: unknown, message: string): this {
    if (typeof value !== 'string' || value.trim() === '') {
      this.fail(field, message);
    }
    return this;
  }

  maxLength(field: string, value: unknown, max: number, message: string): this {
    if (typeof value === 'string' && value.length > max) {
      this.fail(field, message);
    }
    return this;
  }

  minLength(field: string, value: unknown, min: number, message: string): this {
    if (typeof value === 'string' && value.length < min) {
      this.fail(field, message);
    }
    return this;
  }

  email(field: string, value: unknown, message: string): this {
    if (typeof value === 'string' && value !== '' && !isEmail(value)) {
      this.fail(field, message);
    }
    return this;
  }

  notNull(field: string, value: unknown, message: string): this {
    if (value === undefined || value === null) {
      this.fail(field, message);
    }
    return this;
  }

  get ok(): boolean {
    return Object.keys(this.fields).length === 0;
  }

  done(): void {
    if (!this.ok) {
      throw validationError(this.fields);
    }
  }
}

/** Mesma regra permissiva do @Email do Hibernate Validator. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(value) && !value.startsWith('.') && value.length <= 254;
}

/**
 * Tipos dos campos JSON: valor ausente/null → undefined; tipo errado → 400 "Requisição inválida"
 * (igual ao Jackson quando não consegue converter o corpo).
 */
export function optString(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  throw badRequest(INVALID_BODY);
}

export function optBoolean(body: Record<string, unknown>, key: string): boolean | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 'false') return v === 'true';
  throw badRequest(INVALID_BODY);
}

export function optInt(body: Record<string, unknown>, key: string): number | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= 2_147_483_647) return n;
  throw badRequest(INVALID_BODY);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Parâmetro de rota UUID; inválido → 400 "Parâmetro inválido: nome." (igual ao Spring). */
export function uuidParam(c: Ctx, name: string): string {
  const value = c.req.param(name);
  if (!isUuid(value)) {
    throw badRequest(`Parâmetro inválido: ${name}.`);
  }
  return value.toLowerCase();
}

/** Query string inteira opcional; inválida → 400. */
export function intQuery(c: Ctx, name: string, fallback: number): number {
  const raw = c.req.query(name);
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw badRequest(`Parâmetro inválido: ${name}.`);
  }
  return n;
}

/** Data ISO-8601 (com "Z" ou offset). Vazio → null. Inválida → 400. */
export function parseInstant(value: string | undefined, name: string): Date | null {
  if (value === undefined || value.trim() === '') return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i.test(v)) {
    throw badRequest(`Parâmetro inválido: ${name}.`);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`Parâmetro inválido: ${name}.`);
  }
  return d;
}

/** Formulário multipart; corpo que não é multipart → 400. */
export async function readForm(c: Ctx): Promise<Record<string, string | File>> {
  const type = c.req.header('content-type') ?? '';
  if (!type.toLowerCase().startsWith('multipart/form-data')) {
    throw new ApiException(415, 'Formato de requisição não suportado.');
  }
  try {
    const body = await c.req.parseBody();
    const out: Record<string, string | File> = {};
    for (const [k, v] of Object.entries(body)) {
      const value = Array.isArray(v) ? v[0] : v;
      if (typeof value === 'string' || value instanceof File) {
        out[k] = value;
      }
    }
    return out;
  } catch {
    throw badRequest('Envio de arquivo inválido. Tente novamente.');
  }
}

/** Arquivo do multipart (campo ausente ou vazio → 400 "Selecione um arquivo para enviar."). */
export function formFile(form: Record<string, string | File>, name: string): File {
  const f = form[name];
  if (!(f instanceof File) || f.size === 0) {
    throw badRequest('Selecione um arquivo para enviar.');
  }
  return f;
}

export function formString(form: Record<string, string | File>, name: string): string | undefined {
  const v = form[name];
  return typeof v === 'string' ? v : undefined;
}

/** 204 sem corpo. */
export function noContent(c: Ctx): Response {
  return c.body(null, 204);
}

/** 201 com JSON (POST que cria recurso). */
export function created(c: Ctx, body: unknown): Response {
  return c.json(body as object, 201);
}
