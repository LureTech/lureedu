import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { db, newId, now, transaction, withUserLock } from '../lib/db.js';
import { env, jwtSecret } from '../lib/env.js';
import { badRequest, Messages, notFound, unauthorized } from '../lib/errors.js';
import { Check, me, noContent, optBoolean, optString, readJson, uuidParam, type App } from '../lib/http.js';
import { displayName, type UserRow } from '../lib/users.js';
import { loginWithPasskey } from './auth.js';

/**
 * Face ID / passkeys. Login: rotas públicas em /api/auth/webauthn/login/*.
 * Cadastro e gestão dos aparelhos: /api/me/webauthn (usuário logado).
 *
 * Sem memória entre requisições (serverless): o desafio carrega a própria validade e um HMAC
 * com o segredo do JWT, então não dá para forjar nem reaproveitar depois de 5 minutos.
 * Uso único: o cadastro recusa um desafio emitido antes do último aparelho cadastrado pelo usuário,
 * e o login recusa um pedido emitido antes do último uso da mesma passkey.
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CREDENTIALS = 10;
const EXPIRED = 'O pedido de Face ID expirou. Tente de novo.';
const NOT_RECOGNIZED = 'Não reconhecemos esse Face ID. Entre com e-mail e senha.';
const NOT_CONFIRMED = 'Não foi possível confirmar o Face ID. Tente de novo.';

/**
 * Algoritmos oferecidos no cadastro (mesma ordem do Java/Yubico, sem o Ed448 (-53),
 * que a biblioteca de verificação não suporta — aparelhos de plataforma usam ES256/RS256).
 */
const ALGORITHMS = [-7, -8, -35, -36, -257, -258, -259];

interface CredentialRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key_cose: string;
  signature_count: number;
  label: string;
  created_at: Date;
  last_used_at: Date | null;
}

function credentialDto(c: CredentialRow) {
  return { id: c.id, label: c.label, createdAt: c.created_at, lastUsedAt: c.last_used_at };
}

// ------------------------------------------------------------------ user handle (16 bytes do UUID)

export function userHandle(userId: string): Buffer {
  return Buffer.from(userId.replace(/-/g, ''), 'hex');
}

export function userIdFromHandle(handle: Buffer): string | null {
  if (handle.length !== 16) return null;
  const h = handle.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** base64url canônico (sem padding), como o ByteArray.getBase64Url() do Yubico. */
function canonicalB64url(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*={0,2}$/.test(value)) return null;
  return Buffer.from(value, 'base64url').toString('base64url');
}

// ------------------------------------------------------------------ desafios assinados

function mac(purpose: string, payload: Buffer): Buffer {
  return createHmac('sha256', jwtSecret()).update(purpose, 'utf8').update(payload).digest();
}

/** random(16) ‖ validade(8, ms) ‖ HMAC(propósito ‖ random ‖ validade) em base64url. */
function signedToken(purpose: string): string {
  const head = Buffer.alloc(24);
  randomBytes(16).copy(head, 0);
  head.writeBigUInt64BE(BigInt(Date.now() + CHALLENGE_TTL_MS), 16);
  return Buffer.concat([head, mac(purpose, head)]).toString('base64url');
}

type TokenCheck = { ok: true; issuedAt: Date } | { ok: false; expired: boolean };

/** Confere o HMAC e a validade; "expired" = autêntico, mas vencido. */
function checkSignedToken(purpose: string, token: unknown): TokenCheck {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{75}$/.test(token)) return { ok: false, expired: false };
  const raw = Buffer.from(token, 'base64url');
  if (raw.length !== 56) return { ok: false, expired: false };
  const head = raw.subarray(0, 24);
  if (!timingSafeEqual(raw.subarray(24), mac(purpose, head))) return { ok: false, expired: false };
  const expiresAt = Number(head.readBigUInt64BE(16));
  if (expiresAt < Date.now()) return { ok: false, expired: true };
  return { ok: true, issuedAt: new Date(expiresAt - CHALLENGE_TTL_MS) };
}

const regPurpose = (userId: string) => `webauthn-reg:${userId}`;
const LOGIN_PURPOSE = 'webauthn-login';

/** Desafio do login, derivado do requestId (32 bytes, como o Yubico). */
function loginChallenge(requestId: string): string {
  return mac('webauthn-login-challenge', Buffer.from(requestId, 'utf8')).toString('base64url');
}

/** Desafio de dentro do clientDataJSON (sem confiar nele: só para localizar o pedido). */
function clientChallenge(credential: unknown): string | null {
  try {
    const cd = (credential as { response?: { clientDataJSON?: unknown } })?.response?.clientDataJSON;
    if (typeof cd !== 'string') return null;
    const parsed = JSON.parse(Buffer.from(cd, 'base64url').toString('utf8'));
    return typeof parsed?.challenge === 'string' ? parsed.challenge : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ opções (formato do Yubico)

/** JSON de navigator.credentials.create() — {"publicKey": {...}} com binários em base64url. */
export function registrationOptions(user: { id: string; email: string; full_name: string | null }, existing: string[]) {
  return {
    publicKey: {
      rp: { name: env.webauthn.rpName, id: env.webauthn.rpId },
      user: { name: user.email, displayName: displayName(user), id: userHandle(user.id).toString('base64url') },
      challenge: signedToken(regPurpose(user.id)),
      pubKeyCredParams: ALGORITHMS.map((alg) => ({ alg, type: 'public-key' })),
      timeout: CHALLENGE_TTL_MS,
      hints: [],
      excludeCredentials: existing.map((id) => ({ type: 'public-key', id })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        residentKey: 'required',
        userVerification: 'required',
      },
      attestation: 'none',
      extensions: { credProps: true },
    },
  };
}

/** { requestId, publicKey: JSON (string) de navigator.credentials.get() }. */
export function loginOptions() {
  const requestId = signedToken(LOGIN_PURPOSE);
  const publicKey = {
    publicKey: {
      challenge: loginChallenge(requestId),
      timeout: CHALLENGE_TTL_MS,
      hints: [],
      rpId: env.webauthn.rpId,
      userVerification: 'required',
      extensions: {},
    },
  };
  return { requestId, publicKey: JSON.stringify(publicKey) };
}

// ------------------------------------------------------------------ verificações (sem banco)

export interface VerifiedRegistration {
  credentialId: string;
  publicKeyCose: string;
  signatureCount: number;
  issuedAt: Date;
}

/** Confere a resposta do create(); desafio vencido → 400 EXPIRED, resto → 400 NOT_CONFIRMED. */
export async function verifyRegistration(userId: string, credential: unknown): Promise<VerifiedRegistration> {
  const challenge = clientChallenge(credential);
  const check = checkSignedToken(regPurpose(userId), challenge);
  if (!check.ok) {
    throw badRequest(check.expired ? EXPIRED : NOT_CONFIRMED);
  }
  try {
    const result = await verifyRegistrationResponse({
      response: credential as RegistrationResponseJSON,
      expectedChallenge: (c) => c === challenge,
      expectedOrigin: env.webauthn.origins,
      expectedRPID: env.webauthn.rpId,
      requireUserPresence: true,
      requireUserVerification: true,
      supportedAlgorithmIDs: ALGORITHMS,
    });
    if (!result.verified) {
      throw new Error('registro não verificado');
    }
    const cred = result.registrationInfo.credential;
    return {
      credentialId: canonicalB64url(cred.id)!,
      publicKeyCose: Buffer.from(cred.publicKey).toString('base64url'),
      signatureCount: cred.counter,
      issuedAt: check.issuedAt,
    };
  } catch (e) {
    console.info(`Cadastro de passkey recusado para ${userId}: ${(e as Error).message}`);
    throw badRequest(NOT_CONFIRMED);
  }
}

/** Dados da resposta do get() necessários antes de ir ao banco. */
export function assertionCredentialId(credential: unknown): string | null {
  const c = credential as { rawId?: unknown; id?: unknown } | null;
  return canonicalB64url(c?.rawId ?? c?.id) || null;
}

/** Confere a assinatura do get() contra a passkey guardada; devolve o novo contador. */
export async function verifyAssertion(requestId: string, credential: unknown, stored: CredentialRow): Promise<number> {
  try {
    const handle = (credential as { response?: { userHandle?: unknown } }).response?.userHandle;
    const handleB64 = canonicalB64url(handle);
    // Login sem e-mail: o user handle é obrigatório e precisa ser o dono da passkey.
    if (handleB64 == null || userIdFromHandle(Buffer.from(handleB64, 'base64url')) !== stored.user_id) {
      throw new Error('user handle não confere');
    }
    const expected = loginChallenge(requestId);
    const result = await verifyAuthenticationResponse({
      response: credential as AuthenticationResponseJSON,
      expectedChallenge: (c) => c === expected,
      expectedOrigin: env.webauthn.origins,
      expectedRPID: env.webauthn.rpId,
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(Buffer.from(stored.public_key_cose, 'base64url')),
        counter: Number(stored.signature_count),
      },
      requireUserVerification: true,
    });
    if (!result.verified) {
      throw new Error('assinatura não verificada');
    }
    return result.authenticationInfo.newCounter;
  } catch (e) {
    console.info(`Login por passkey recusado: ${(e as Error).message}`);
    throw unauthorized(NOT_RECOGNIZED);
  }
}

/** Confere o requestId do login (400 EXPIRED se inválido ou vencido) e devolve quando foi emitido. */
export function checkRequestId(requestId: string): Date {
  const check = checkSignedToken(LOGIN_PURPOSE, requestId);
  if (!check.ok) {
    throw badRequest(EXPIRED);
  }
  return check.issuedAt;
}

// ------------------------------------------------------------------ rotas

export function registerWebAuthn(app: App) {
  app.get('/api/me/webauthn', async (c) => {
    const rows = await db()<CredentialRow[]>`
      SELECT * FROM webauthn_credentials WHERE user_id = ${me(c).id} ORDER BY created_at ASC`;
    return c.json(rows.map(credentialDto));
  });

  app.post('/api/me/webauthn/register/options', async (c) => {
    const userId = me(c).id;
    const sql = db();
    const [users, creds] = await Promise.all([
      sql<UserRow[]>`SELECT id, email, full_name FROM users WHERE id = ${userId}`,
      sql<{ credential_id: string }[]>`
        SELECT credential_id FROM webauthn_credentials WHERE user_id = ${userId} ORDER BY created_at ASC`,
    ]);
    if (!users.length) {
      throw notFound(Messages.USER_NOT_FOUND);
    }
    if (creds.length >= MAX_CREDENTIALS) {
      throw badRequest(`Você já tem ${MAX_CREDENTIALS} aparelhos cadastrados. Remova um antes.`);
    }
    return c.json(registrationOptions(users[0], creds.map((r) => r.credential_id)));
  });

  app.post('/api/me/webauthn/register/verify', async (c) => {
    const body = await readJson(c);
    const label = optString(body, 'label');
    new Check()
      .notNull('credential', body.credential, 'não deve ser nulo')
      .maxLength('label', label, 100, 'tamanho deve ser entre 0 e 100')
      .done();
    const userId = me(c).id;
    const verified = await verifyRegistration(userId, body.credential);

    const saved = await withUserLock(userId, async (tx) => {
      // Uso único: um desafio emitido antes do último cadastro não vale mais.
      const newer = await tx`
        SELECT 1 FROM webauthn_credentials WHERE user_id = ${userId} AND created_at >= ${verified.issuedAt} LIMIT 1`;
      if (newer.length) {
        throw badRequest(EXPIRED);
      }
      const dup = await tx`SELECT 1 FROM webauthn_credentials WHERE credential_id = ${verified.credentialId}`;
      if (dup.length) {
        throw badRequest('Este aparelho já está cadastrado.');
      }
      let name = label == null || label.trim() === '' ? 'Meu aparelho' : label.trim();
      if (name.length > 100) {
        name = name.substring(0, 100);
      }
      const rows = await tx<CredentialRow[]>`
        INSERT INTO webauthn_credentials
          (id, user_id, credential_id, public_key_cose, signature_count, label, created_at, last_used_at)
        VALUES (${newId()}, ${userId}, ${verified.credentialId}, ${verified.publicKeyCose},
                ${verified.signatureCount}, ${name}, ${now()}, null)
        RETURNING *`;
      return rows[0];
    });
    return c.json(credentialDto(saved));
  });

  app.delete('/api/me/webauthn/:id', async (c) => {
    const id = uuidParam(c, 'id');
    const result = await db()`DELETE FROM webauthn_credentials WHERE id = ${id} AND user_id = ${me(c).id}`;
    if (result.count === 0) {
      throw notFound('Aparelho não encontrado.');
    }
    return noContent(c);
  });

  app.post('/api/auth/webauthn/login/options', (c) => c.json(loginOptions()));

  app.post('/api/auth/webauthn/login/verify', async (c) => {
    const body = await readJson(c);
    const requestId = optString(body, 'requestId');
    const rememberMe = optBoolean(body, 'rememberMe') ?? false;
    new Check()
      .notBlank('requestId', requestId, 'não deve estar em branco')
      .notNull('credential', body.credential, 'não deve ser nulo')
      .done();
    const issuedAt = checkRequestId(requestId!);

    const credentialId = assertionCredentialId(body.credential);
    const rows = credentialId
      ? await db()<CredentialRow[]>`SELECT * FROM webauthn_credentials WHERE credential_id = ${credentialId}`
      : [];
    if (!rows.length) {
      console.info('Login por passkey recusado: credencial desconhecida');
      throw unauthorized(NOT_RECOGNIZED);
    }
    const newCounter = await verifyAssertion(requestId!, body.credential, rows[0]);

    const res = await transaction(async (tx) => {
      // Uso único do pedido: recusa se esta passkey já foi usada depois que ele foi emitido.
      const used = await tx<{ user_id: string }[]>`
        UPDATE webauthn_credentials SET signature_count = ${newCounter}, last_used_at = ${now()}
        WHERE id = ${rows[0].id} AND (last_used_at IS NULL OR last_used_at < ${issuedAt})
        RETURNING user_id`;
      if (!used.length) {
        throw badRequest(EXPIRED);
      }
      return loginWithPasskey(tx, used[0].user_id, rememberMe);
    });
    return c.json(res);
  });
}
