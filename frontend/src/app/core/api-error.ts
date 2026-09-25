import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody } from './models';

export const BLOCKED_MESSAGE =
  'Sua conta está sem acesso no momento. Fale com o administrador para liberar.';

function body(err: unknown): Partial<ApiErrorBody> | null {
  if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
    return err.error as Partial<ApiErrorBody>;
  }
  return null;
}

/** Status HTTP do erro (0 = sem conexão, -1 = erro não-HTTP). */
export function apiStatus(err: unknown): number {
  return err instanceof HttpErrorResponse ? err.status : -1;
}

/** Mensagem legível (campo `message` do contrato) com fallbacks por status. */
export function apiMessage(err: unknown, fallback = 'Algo deu errado. Tente de novo.'): string {
  const b = body(err);
  if (b?.message && typeof b.message === 'string') return b.message;
  if (err instanceof HttpErrorResponse) {
    if (typeof err.error === 'string' && err.error.trim() && err.error.length < 300 && !err.error.trim().startsWith('<')) {
      return err.error.trim();
    }
    switch (err.status) {
      case 0:
        return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.';
      case 401:
        return 'Sua sessão expirou. Entre de novo.';
      case 403:
        return 'Você não tem permissão para fazer isso.';
      case 404:
        return 'Não encontrado.';
      case 413:
        return 'Arquivo grande demais.';
      case 429:
        return 'Muitas tentativas. Aguarde alguns instantes e tente de novo.';
      default:
        if (err.status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.';
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Erros de validação por campo (`fields`), se houver. */
export function apiFields(err: unknown): Record<string, string> | null {
  const b = body(err);
  return b?.fields && typeof b.fields === 'object' ? b.fields : null;
}

export function isBlockedError(err: unknown): boolean {
  if (!(err instanceof HttpErrorResponse) || err.status !== 403) return false;
  const msg = body(err)?.message ?? '';
  return msg === BLOCKED_MESSAGE || /sem acesso no momento/i.test(msg);
}
