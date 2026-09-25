package br.com.lure.growth.auth;

import br.com.lure.growth.common.ApiException;

import java.nio.charset.StandardCharsets;

/** Regras de senha compartilhadas (o BCrypt só considera 72 bytes). */
public final class PasswordRules {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_BYTES = 72;

    private PasswordRules() {
    }

    public static void validate(String password) {
        if (password == null || password.length() < MIN_LENGTH) {
            throw ApiException.badRequest("A senha precisa ter pelo menos 8 caracteres.");
        }
        if (!fitsBcrypt(password)) {
            throw ApiException.badRequest("A senha pode ter no máximo 72 caracteres.");
        }
    }

    public static boolean fitsBcrypt(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES;
    }

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.strip().toLowerCase(java.util.Locale.ROOT);
    }
}
