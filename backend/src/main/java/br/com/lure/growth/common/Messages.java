package br.com.lure.growth.common;

/**
 * Mensagens fixas do contrato (docs/API.md) usadas em mais de um lugar.
 */
public final class Messages {

    public static final String ACCOUNT_BLOCKED =
            "Sua conta está sem acesso no momento. Fale com o administrador para liberar.";
    public static final String BAD_CREDENTIALS = "E-mail ou senha incorretos.";
    public static final String TOO_MANY_LOGIN_ATTEMPTS = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    public static final String SESSION_EXPIRED = "Sua sessão expirou. Entre novamente.";
    public static final String LOGIN_REQUIRED = "Faça login para continuar.";
    public static final String NO_PERMISSION = "Você não tem permissão para fazer isso.";
    public static final String MODULE_LOCKED = "Este módulo ainda está em gravação. Em breve ele será liberado.";
    public static final String MODULE_NOT_FOUND = "Módulo não encontrado.";
    public static final String LESSON_NOT_FOUND = "Aula não encontrada.";
    public static final String SECTION_NOT_FOUND = "Seção não encontrada.";
    public static final String USER_NOT_FOUND = "Usuário não encontrado.";
    public static final String POST_NOT_FOUND = "Publicação não encontrada.";
    public static final String COMMENT_NOT_FOUND = "Comentário não encontrado.";
    public static final String UNEXPECTED = "Erro inesperado. Tente novamente.";

    private Messages() {
    }
}
