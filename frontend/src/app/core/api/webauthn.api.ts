import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';
import { AuthResponse } from '../models';

export interface PasskeyDto {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface LoginOptions {
  requestId: string;
  /** JSON de navigator.credentials.get() — {"publicKey": {...}} com binários em base64url. */
  publicKey: string;
}

// ------------------------------------------------------------ base64url <-> ArrayBuffer

function b64urlToBuffer(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufferToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// O servidor manda campos nulos (ex.: "extensions": null); a API do navegador não aceita null.
function dropNulls<T>(v: T): T {
  if (Array.isArray(v)) return v.map(dropNulls) as T;
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== null).map(([k, x]) => [k, dropNulls(x)]),
    ) as T;
  }
  return v;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCreateOptions(json: any): PublicKeyCredentialCreationOptions {
  const pk = dropNulls(json.publicKey);
  return {
    ...pk,
    challenge: b64urlToBuffer(pk.challenge),
    user: { ...pk.user, id: b64urlToBuffer(pk.user.id) },
    excludeCredentials: (pk.excludeCredentials ?? []).map((c: { id: string }) => ({ ...c, id: b64urlToBuffer(c.id) })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGetOptions(json: any): PublicKeyCredentialRequestOptions {
  const pk = dropNulls(json.publicKey);
  return {
    ...pk,
    challenge: b64urlToBuffer(pk.challenge),
    allowCredentials: (pk.allowCredentials ?? []).map((c: { id: string }) => ({ ...c, id: b64urlToBuffer(c.id) })),
  };
}

function registrationJson(cred: PublicKeyCredential): unknown {
  const r = cred.response as AuthenticatorAttestationResponse;
  return {
    id: cred.id,
    rawId: bufferToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToB64url(r.clientDataJSON),
      attestationObject: bufferToB64url(r.attestationObject),
      transports: typeof r.getTransports === 'function' ? r.getTransports() : [],
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  };
}

function assertionJson(cred: PublicKeyCredential): unknown {
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: bufferToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToB64url(r.clientDataJSON),
      authenticatorData: bufferToB64url(r.authenticatorData),
      signature: bufferToB64url(r.signature),
      userHandle: r.userHandle ? bufferToB64url(r.userHandle) : null,
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  };
}

/** O navegador/aparelho suporta passkeys com biometria (Face ID, Windows Hello, digital)? */
export async function passkeySupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !window.isSecureContext) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Mensagem amigável para erros do navegador (cancelado, tempo esgotado, já cadastrado…). */
export function passkeyErrorMessage(err: unknown): string | null {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'AbortError':
        return 'Leitura cancelada ou tempo esgotado. Tente de novo.';
      case 'InvalidStateError':
        return 'Este aparelho já está cadastrado.';
      case 'SecurityError':
        return 'Face ID só funciona em um endereço seguro (https).';
      case 'NotSupportedError':
        return 'Este aparelho não suporta Face ID / biometria no navegador.';
    }
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class WebAuthnApi {
  private readonly http = inject(HttpClient);

  list(): Observable<PasskeyDto[]> {
    return this.http.get<PasskeyDto[]>('/api/me/webauthn');
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/me/webauthn/${id}`);
  }

  /** Abre o Face ID / Windows Hello do aparelho e cadastra a passkey na conta logada. */
  register(label: string): Observable<PasskeyDto> {
    return this.http.post<unknown>('/api/me/webauthn/register/options', {}).pipe(
      switchMap((opts) => from(navigator.credentials.create({ publicKey: toCreateOptions(opts) }))),
      switchMap((cred) => {
        if (!cred) throw new DOMException('Cancelado', 'NotAllowedError');
        return this.http.post<PasskeyDto>('/api/me/webauthn/register/verify', {
          credential: registrationJson(cred as PublicKeyCredential),
          label,
        });
      }),
    );
  }

  /** Login sem senha: o aparelho escolhe a passkey e confirma o rosto. */
  login(rememberMe: boolean): Observable<AuthResponse> {
    return this.http.post<LoginOptions>('/api/auth/webauthn/login/options', {}).pipe(
      switchMap((opts) =>
        from(navigator.credentials.get({ publicKey: toGetOptions(JSON.parse(opts.publicKey)) })).pipe(
          map((cred) => ({ opts, cred })),
        ),
      ),
      switchMap(({ opts, cred }) => {
        if (!cred) throw new DOMException('Cancelado', 'NotAllowedError');
        return this.http.post<AuthResponse>('/api/auth/webauthn/login/verify', {
          requestId: opts.requestId,
          credential: assertionJson(cred as PublicKeyCredential),
          rememberMe,
        });
      }),
    );
  }
}
