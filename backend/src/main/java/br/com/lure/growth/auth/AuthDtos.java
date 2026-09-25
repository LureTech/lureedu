package br.com.lure.growth.auth;

import br.com.lure.growth.user.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = "Informe o e-mail.") @Email(message = "E-mail inválido.") String email,
            @NotBlank(message = "Informe a senha.") String password,
            boolean rememberMe
    ) {
    }

    public record RefreshRequest(@NotBlank(message = "Refresh token ausente.") String refreshToken) {
    }

    public record LogoutRequest(String refreshToken) {
    }

    public record ForgotPasswordRequest(
            @NotBlank(message = "Informe o e-mail.") @Email(message = "E-mail inválido.") String email
    ) {
    }

    public record ResetPasswordRequest(
            @NotBlank(message = "Link de redefinição inválido ou expirado.") String token,
            @NotBlank(message = "Informe a nova senha.")
            @Size(min = 8, message = "A senha precisa ter pelo menos 8 caracteres.")
            @Size(max = 72, message = "A senha pode ter no máximo 72 caracteres.")
            String newPassword
    ) {
    }

    public record AuthResponse(String accessToken, String refreshToken, long expiresIn, UserDto user) {
    }
}
