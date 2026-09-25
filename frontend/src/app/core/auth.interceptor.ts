import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { isBlockedError } from './api-error';
import { AuthService } from './auth.service';

/** Rotas de autenticação públicas: não recebem Bearer nem disparam refresh. */
const PUBLIC_AUTH = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/webauthn/login/',
];

function isPublicAuth(url: string): boolean {
  return PUBLIC_AUTH.some((p) => url.startsWith(p));
}

function withBearer(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isApi = req.url.startsWith('/api/');
  const isPublic = isPublicAuth(req.url) || req.url.startsWith('/api/public/');

  const outgoing = isApi && !isPublic ? withBearer(req, auth.accessToken()) : req;

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || !isApi) return throwError(() => err);

      // 401 em rota autenticada → um refresh compartilhado e repete a requisição.
      if (err.status === 401 && !isPublic && auth.hasRefreshToken()) {
        return auth.refreshOnce().pipe(
          catchError((refreshErr: unknown) => {
            if (isBlockedError(refreshErr)) {
              auth.markBlocked();
            } else {
              auth.expireSession();
            }
            return throwError(() => err);
          }),
          switchMap((token) =>
            next(withBearer(req, token)).pipe(
              catchError((retryErr: unknown) => {
                if (isBlockedError(retryErr)) auth.markBlocked();
                else if (retryErr instanceof HttpErrorResponse && retryErr.status === 401) {
                  auth.expireSession();
                }
                return throwError(() => retryErr);
              }),
            ),
          ),
        );
      }

      if (err.status === 401 && !isPublic && !auth.hasRefreshToken() && auth.isAuthenticated()) {
        auth.expireSession();
      }

      // Conta bloqueada: qualquer rota autenticada (o login mostra a mensagem inline).
      if (isBlockedError(err) && !req.url.startsWith('/api/auth/login') && !req.url.startsWith('/api/auth/webauthn/')) {
        auth.markBlocked();
      }
      return throwError(() => err);
    }),
  );
};
