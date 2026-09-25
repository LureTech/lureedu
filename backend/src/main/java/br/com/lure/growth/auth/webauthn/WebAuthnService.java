package br.com.lure.growth.auth.webauthn;

import br.com.lure.growth.auth.AuthDtos.AuthResponse;
import br.com.lure.growth.auth.AuthService;
import br.com.lure.growth.auth.TokenHasher;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.Messages;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.user.User;
import br.com.lure.growth.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.AuthenticatorAttachment;
import com.yubico.webauthn.data.AuthenticatorSelectionCriteria;
import com.yubico.webauthn.data.PublicKeyCredential;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.UserIdentity;
import com.yubico.webauthn.data.UserVerificationRequirement;
import com.yubico.webauthn.exception.AssertionFailedException;
import com.yubico.webauthn.exception.RegistrationFailedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cadastro e login por passkey. A API é stateless, então o desafio de cada cerimônia fica em memória
 * por alguns minutos (cadastro: por usuário; login: por um id aleatório devolvido ao navegador).
 */
@Service
public class WebAuthnService {

    private static final Logger log = LoggerFactory.getLogger(WebAuthnService.class);
    private static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);
    private static final int MAX_CREDENTIALS = 10;
    private static final String EXPIRED = "O pedido de Face ID expirou. Tente de novo.";
    private static final String NOT_RECOGNIZED = "Não reconhecemos esse Face ID. Entre com e-mail e senha.";

    private record Pending(String json, Instant expiresAt) {
    }

    public record CredentialDto(UUID id, String label, Instant createdAt, Instant lastUsedAt) {
        static CredentialDto from(WebAuthnCredential c) {
            return new CredentialDto(c.getId(), c.getLabel(), c.getCreatedAt(), c.getLastUsedAt());
        }
    }

    public record LoginOptions(String requestId, String publicKey) {
    }

    private final RelyingParty rp;
    private final WebAuthnCredentialRepository credentials;
    private final UserRepository users;
    private final AuthService auth;
    private final Map<String, Pending> pending = new ConcurrentHashMap<>();

    public WebAuthnService(RelyingParty rp, WebAuthnCredentialRepository credentials, UserRepository users,
                           AuthService auth) {
        this.rp = rp;
        this.credentials = credentials;
        this.users = users;
        this.auth = auth;
    }

    // ------------------------------------------------------------ cadastro

    @Transactional(readOnly = true)
    public List<CredentialDto> list(UUID userId) {
        return credentials.findByUserIdOrderByCreatedAtAsc(userId).stream().map(CredentialDto::from).toList();
    }

    /** Devolve o JSON de {@code navigator.credentials.create()} (formato {"publicKey": {...}}). */
    @Transactional(readOnly = true)
    public String startRegistration(UUID userId) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound(Messages.USER_NOT_FOUND));
        if (credentials.findByUserIdOrderByCreatedAtAsc(userId).size() >= MAX_CREDENTIALS) {
            throw ApiException.badRequest("Você já tem " + MAX_CREDENTIALS + " aparelhos cadastrados. Remova um antes.");
        }
        PublicKeyCredentialCreationOptions options = rp.startRegistration(StartRegistrationOptions.builder()
                .user(UserIdentity.builder()
                        .name(user.getEmail())
                        .displayName(user.displayName())
                        .id(JpaCredentialRepository.userHandle(user.getId()))
                        .build())
                .authenticatorSelection(AuthenticatorSelectionCriteria.builder()
                        .authenticatorAttachment(AuthenticatorAttachment.PLATFORM)
                        .residentKey(ResidentKeyRequirement.REQUIRED)
                        .userVerification(UserVerificationRequirement.REQUIRED)
                        .build())
                .timeout(CHALLENGE_TTL.toMillis())
                .build());
        try {
            put("reg:" + userId, options.toJson());
            return options.toCredentialsCreateJson();
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    @Transactional
    public CredentialDto finishRegistration(UUID userId, String responseJson, String label) {
        String requestJson = take("reg:" + userId);
        try {
            PublicKeyCredentialCreationOptions request = PublicKeyCredentialCreationOptions.fromJson(requestJson);
            RegistrationResult result = rp.finishRegistration(FinishRegistrationOptions.builder()
                    .request(request)
                    .response(PublicKeyCredential.parseRegistrationResponseJson(responseJson))
                    .build());
            String credentialId = result.getKeyId().getId().getBase64Url();
            if (credentials.findByCredentialId(credentialId).isPresent()) {
                throw ApiException.badRequest("Este aparelho já está cadastrado.");
            }
            String name = label == null || label.isBlank() ? "Meu aparelho" : label.strip();
            if (name.length() > 100) {
                name = name.substring(0, 100);
            }
            WebAuthnCredential saved = credentials.save(new WebAuthnCredential(userId, credentialId,
                    result.getPublicKeyCose().getBase64Url(), result.getSignatureCount(), name, TimeUtils.now()));
            return CredentialDto.from(saved);
        } catch (RegistrationFailedException | IOException e) {
            log.info("Cadastro de passkey recusado para {}: {}", userId, e.getMessage());
            throw ApiException.badRequest("Não foi possível confirmar o Face ID. Tente de novo.");
        }
    }

    @Transactional
    public void delete(UUID userId, UUID credentialId) {
        WebAuthnCredential c = credentials.findByIdAndUserId(credentialId, userId)
                .orElseThrow(() -> ApiException.notFound("Aparelho não encontrado."));
        credentials.delete(c);
    }

    // ------------------------------------------------------------ login

    /** Login sem e-mail: o aparelho mostra as passkeys guardadas para este site. */
    public LoginOptions startLogin() {
        AssertionRequest request = rp.startAssertion(StartAssertionOptions.builder()
                .userVerification(UserVerificationRequirement.REQUIRED)
                .timeout(CHALLENGE_TTL.toMillis())
                .build());
        String requestId = TokenHasher.newToken();
        try {
            put("login:" + requestId, request.toJson());
            return new LoginOptions(requestId, request.toCredentialsGetJson());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    @Transactional
    public AuthResponse finishLogin(String requestId, String responseJson, boolean rememberMe) {
        String requestJson = take("login:" + requestId);
        AssertionResult result;
        try {
            result = rp.finishAssertion(FinishAssertionOptions.builder()
                    .request(AssertionRequest.fromJson(requestJson))
                    .response(PublicKeyCredential.parseAssertionResponseJson(responseJson))
                    .build());
        } catch (AssertionFailedException | IOException e) {
            log.info("Login por passkey recusado: {}", e.getMessage());
            throw ApiException.unauthorized(NOT_RECOGNIZED);
        }
        if (!result.isSuccess()) {
            throw ApiException.unauthorized(NOT_RECOGNIZED);
        }
        WebAuthnCredential c = credentials.findByCredentialId(result.getCredential().getCredentialId().getBase64Url())
                .orElseThrow(() -> ApiException.unauthorized(NOT_RECOGNIZED));
        c.markUsed(result.getSignatureCount(), TimeUtils.now());
        return auth.loginWithPasskey(c.getUserId(), rememberMe);
    }

    // ------------------------------------------------------------ desafios

    private void put(String key, String json) {
        Instant now = TimeUtils.now();
        pending.values().removeIf(p -> p.expiresAt().isBefore(now));
        pending.put(key, new Pending(json, now.plus(CHALLENGE_TTL)));
    }

    private String take(String key) {
        Pending p = key == null ? null : pending.remove(key);
        if (p == null || p.expiresAt().isBefore(TimeUtils.now())) {
            throw ApiException.badRequest(EXPIRED);
        }
        return p.json();
    }
}
