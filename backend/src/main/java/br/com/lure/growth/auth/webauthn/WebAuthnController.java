package br.com.lure.growth.auth.webauthn;

import br.com.lure.growth.auth.AuthDtos.AuthResponse;
import br.com.lure.growth.auth.AuthUser;
import br.com.lure.growth.auth.webauthn.WebAuthnService.CredentialDto;
import br.com.lure.growth.auth.webauthn.WebAuthnService.LoginOptions;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Face ID / passkeys. Login: rotas públicas em {@code /api/auth/webauthn/login/*}.
 * Cadastro e gestão dos aparelhos: {@code /api/me/webauthn} (usuário logado).
 */
@RestController
public class WebAuthnController {

    public record RegisterFinishRequest(@NotNull JsonNode credential, @Size(max = 100) String label) {
    }

    public record LoginFinishRequest(@NotBlank String requestId, @NotNull JsonNode credential, boolean rememberMe) {
    }

    private final WebAuthnService webauthn;

    public WebAuthnController(WebAuthnService webauthn) {
        this.webauthn = webauthn;
    }

    @GetMapping("/api/me/webauthn")
    public List<CredentialDto> list(@AuthenticationPrincipal AuthUser me) {
        return webauthn.list(me.id());
    }

    @PostMapping(value = "/api/me/webauthn/register/options", produces = MediaType.APPLICATION_JSON_VALUE)
    public String registerOptions(@AuthenticationPrincipal AuthUser me) {
        return webauthn.startRegistration(me.id());
    }

    @PostMapping("/api/me/webauthn/register/verify")
    public CredentialDto registerVerify(@AuthenticationPrincipal AuthUser me,
                                        @Valid @RequestBody RegisterFinishRequest req) {
        return webauthn.finishRegistration(me.id(), req.credential().toString(), req.label());
    }

    @DeleteMapping("/api/me/webauthn/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        webauthn.delete(me.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/auth/webauthn/login/options")
    public LoginOptions loginOptions() {
        return webauthn.startLogin();
    }

    @PostMapping("/api/auth/webauthn/login/verify")
    public AuthResponse loginVerify(@Valid @RequestBody LoginFinishRequest req) {
        return webauthn.finishLogin(req.requestId(), req.credential().toString(), req.rememberMe());
    }
}
