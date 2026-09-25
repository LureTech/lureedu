package br.com.lure.growth.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class ProfileDtos {

    private ProfileDtos() {
    }

    public record UpdateProfileRequest(
            @Size(max = 80, message = "O nome pode ter no máximo 80 caracteres.") String fullName
    ) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Informe a senha atual.") String currentPassword,
            @NotBlank(message = "Informe a nova senha.")
            @Size(min = 8, message = "A senha precisa ter pelo menos 8 caracteres.")
            @Size(max = 72, message = "A senha pode ter no máximo 72 caracteres.")
            String newPassword
    ) {
    }
}
