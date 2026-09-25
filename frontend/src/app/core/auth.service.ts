import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, firstValueFrom, map, shareReplay, tap, throwError } from 'rxjs';
import { WebAuthnApi } from './api/webauthn.api';
import { isBlockedError } from './api-error';
import { AuthResponse, LoginRequest, UserDto } from './models';
import { safeGetJson, safeRemove, safeSet } from './storage';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
  remember: boolean;
  /** Último usuário conhecido — deixa o app abrir sem esperar o servidor. */
  user?: UserDto;
}

const SESSION_KEY = 'lure.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly webauthn = inject(WebAuthnApi);

  private session: StoredSession | null = this.readStored();
  private refresh$: Observable<string> | null = null;
  private restoring = false;

  /** Usuário logado (null = sem sessão). */
  readonly user = signal<UserDto | null>(null);
  /** Conta bloqueada detectada (403 com a mensagem de bloqueio). */
  readonly blocked = signal(false);

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly displayName = computed(() => {
    const u = this.user();
    return u?.fullName?.trim() || u?.email?.split('@')[0] || 'Aluno LURE';
  });

  // ------------------------------------------------------------ tokens
  accessToken(): string | null {
    return this.session?.accessToken ?? null;
  }

  hasRefreshToken(): boolean {
    return !!this.session?.refreshToken;
  }

  private readStored(): StoredSession | null {
    return (
      safeGetJson<StoredSession>('local', SESSION_KEY) ??
      safeGetJson<StoredSession>('session', SESSION_KEY)
    );
  }

  private persist(s: StoredSession): void {
    safeRemove('local', SESSION_KEY);
    safeRemove('session', SESSION_KEY);
    safeSet(s.remember ? 'local' : 'session', SESSION_KEY, JSON.stringify(s));
  }

  private applyAuth(res: AuthResponse, remember: boolean): void {
    this.session = {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      expiresAt: Date.now() + res.expiresIn * 1000,
      remember,
      user: res.user,
    };
    this.persist(this.session);
    this.user.set(res.user);
    this.blocked.set(false);
  }

  /** Limpa a sessão local (não chama o servidor). */
  clearSession(): void {
    this.session = null;
    this.refresh$ = null;
    safeRemove('local', SESSION_KEY);
    safeRemove('session', SESSION_KEY);
    this.user.set(null);
  }

  // ------------------------------------------------------------ fluxo
  /**
   * Chamado no bootstrap. Com um usuário guardado na sessão, o app abre na hora com ele e a
   * conferência no servidor corre por baixo — sem tela branca esperando a rede. Só a primeira
   * abertura depois do login (sessão antiga, sem usuário salvo) espera o {@code GET /api/auth/me}.
   */
  async restore(): Promise<void> {
    if (!this.session) return;
    const known = this.session.user;
    if (known) {
      this.user.set(known);
      void this.validateSession(true);
      return;
    }
    await this.validateSession(false);
  }

  /** Confere a sessão no servidor e atualiza o usuário (papel, nome, foto). */
  private async validateSession(background: boolean): Promise<void> {
    this.restoring = true;
    try {
      const me = await firstValueFrom(this.http.get<UserDto>('/api/auth/me'));
      this.user.set(me);
      this.rememberUser(me);
    } catch (err) {
      if (isBlockedError(err)) {
        this.blocked.set(true);
      } else {
        this.clearSession();
        // Em segundo plano a tela já está montada: manda para o login em vez de deixar o app sem usuário.
        if (background) {
          void this.router.navigateByUrl('/login', { replaceUrl: true });
        }
      }
    } finally {
      this.restoring = false;
    }
  }

  /** Mantém o usuário salvo em dia com o que veio do servidor. */
  private rememberUser(u: UserDto): void {
    if (!this.session) return;
    this.session = { ...this.session, user: u };
    this.persist(this.session);
  }

  login(req: LoginRequest): Observable<UserDto> {
    return this.http.post<AuthResponse>('/api/auth/login', req).pipe(
      tap((res) => this.applyAuth(res, req.rememberMe)),
      map((res) => res.user),
    );
  }

  /** Entrar com Face ID / Windows Hello (passkey cadastrada na aba Face ID). */
  loginWithPasskey(rememberMe: boolean): Observable<UserDto> {
    return this.webauthn.login(rememberMe).pipe(
      tap((res) => this.applyAuth(res, rememberMe)),
      map((res) => res.user),
    );
  }

  /** Refresh único e compartilhado (single-flight) — devolve o novo access token. */
  refreshOnce(): Observable<string> {
    const rt = this.session?.refreshToken;
    if (!rt) return throwError(() => new Error('Sem refresh token'));
    if (!this.refresh$) {
      const remember = this.session?.remember ?? false;
      this.refresh$ = this.http.post<AuthResponse>('/api/auth/refresh', { refreshToken: rt }).pipe(
        tap((res) => this.applyAuth(res, remember)),
        map((res) => res.accessToken),
        finalize(() => (this.refresh$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refresh$;
  }

  async logout(): Promise<void> {
    const rt = this.session?.refreshToken;
    this.clearSession();
    this.blocked.set(false);
    if (rt) {
      try {
        await firstValueFrom(this.http.post<void>('/api/auth/logout', { refreshToken: rt }));
      } catch {
        /* sessão local já foi limpa */
      }
    }
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  /** Sessão expirou/refresh falhou: limpa e volta para o login. */
  expireSession(): void {
    const wasLogged = this.session !== null;
    this.clearSession();
    if (wasLogged && !this.restoring) {
      void this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }

  markBlocked(): void {
    this.blocked.set(true);
  }

  setUser(u: UserDto): void {
    this.user.set(u);
    this.rememberUser(u);
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>('/api/auth/forgot-password', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>('/api/auth/reset-password', { token, newPassword });
  }
}
