/** Mensagens fixas do contrato (docs/API.md) usadas em mais de um lugar. */
export const Messages = {
  ACCOUNT_BLOCKED: 'Sua conta está sem acesso no momento. Fale com o administrador para liberar.',
  BAD_CREDENTIALS: 'E-mail ou senha incorretos.',
  TOO_MANY_LOGIN_ATTEMPTS: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  SESSION_EXPIRED: 'Sua sessão expirou. Entre novamente.',
  LOGIN_REQUIRED: 'Faça login para continuar.',
  NO_PERMISSION: 'Você não tem permissão para fazer isso.',
  MODULE_LOCKED: 'Este módulo ainda está em gravação. Em breve ele será liberado.',
  MODULE_NOT_FOUND: 'Módulo não encontrado.',
  LESSON_NOT_FOUND: 'Aula não encontrada.',
  SECTION_NOT_FOUND: 'Seção não encontrada.',
  USER_NOT_FOUND: 'Usuário não encontrado.',
  POST_NOT_FOUND: 'Publicação não encontrada.',
  COMMENT_NOT_FOUND: 'Comentário não encontrado.',
  UNEXPECTED: 'Erro inesperado. Tente novamente.',
  VALIDATION: 'Verifique os campos destacados.',
} as const;

const REASONS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/** Erro de negócio com status HTTP e mensagem para o usuário (PT-BR). */
export class ApiException extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }

  body() {
    return {
      status: this.status,
      error: REASONS[this.status] ?? 'Error',
      message: this.message,
      ...(this.fields ? { fields: this.fields } : {}),
    };
  }
}

export const badRequest = (m: string) => new ApiException(400, m);
export const unauthorized = (m: string) => new ApiException(401, m);
export const forbidden = (m: string) => new ApiException(403, m);
export const notFound = (m: string) => new ApiException(404, m);
export const conflict = (m: string) => new ApiException(409, m);
export const payloadTooLarge = (m: string) => new ApiException(413, m);
export const tooManyRequests = (m: string) => new ApiException(429, m);

/** 400 de validação: com um campo só, a mensagem dele; com vários, a genérica. */
export function validationError(fields: Record<string, string>): ApiException {
  const values = Object.values(fields);
  return new ApiException(400, values.length === 1 ? values[0] : Messages.VALIDATION, fields);
}

export function errorBody(status: number, message: string) {
  return new ApiException(status, message).body();
}
