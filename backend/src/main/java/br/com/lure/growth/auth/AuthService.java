package br.com.lure.growth.auth;

import br.com.lure.growth.auth.AuthDtos.AuthResponse;
import br.com.lure.growth.common.ApiException;
import br.com.lure.growth.common.MailService;
import br.com.lure.growth.common.Messages;
import br.com.lure.growth.common.TimeUtils;
import br.com.lure.growth.config.AppProperties;
import br.com.lure.growth.user.User;
import br.com.lure.growth.user.UserDto;
import br.com.lure.growth.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final Duration RESET_TOKEN_TTL = Duration.ofHours(1);
    private static final Duration RESET_REQUEST_COOLDOWN = Duration.ofSeconds(60);
    private static final String INVALID_RESET = "Link de redefinição inválido ou expirado. Peça um novo.";

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordResetTokenRepository resetTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final LoginAttemptService loginAttempts;
    private final MailService mail;
    private final AppProperties props;
    /** Hash "de mentira" para igualar o tempo de resposta quando o e-mail não existe. */
    private final String dummyHash;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens,
                       PasswordResetTokenRepository resetTokens, PasswordEncoder passwordEncoder,
                       JwtEncoder jwtEncoder, LoginAttemptService loginAttempts, MailService mail,
                       AppProperties props) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.resetTokens = resetTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.loginAttempts = loginAttempts;
        this.mail = mail;
        this.props = props;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public AuthResponse login(String rawEmail, String password, boolean rememberMe) {
        String email = PasswordRules.normalizeEmail(rawEmail);
        if (loginAttempts.isBlocked(email)) {
            throw ApiException.tooManyRequests(Messages.TOO_MANY_LOGIN_ATTEMPTS);
        }
        User user = users.findByEmail(email).orElse(null);
        boolean passwordOk = password != null && PasswordRules.fitsBcrypt(password)
                && passwordEncoder.matches(password, user != null ? user.getPasswordHash() : dummyHash);
        if (user == null || !passwordOk) {
            loginAttempts.recordFailure(email);
            throw ApiException.unauthorized(Messages.BAD_CREDENTIALS);
        }
        if (!user.isActive()) {
            throw ApiException.forbidden(Messages.ACCOUNT_BLOCKED);
        }
        loginAttempts.reset(email);
        user.setLastLoginAt(TimeUtils.now());
        return issueTokens(user, rememberMe);
    }

    /** Login já provado por passkey (Face ID / Windows Hello): só confere a conta e emite os tokens. */
    @Transactional
    public AuthResponse loginWithPasskey(UUID userId, boolean rememberMe) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized(Messages.BAD_CREDENTIALS));
        if (!user.isActive()) {
            throw ApiException.forbidden(Messages.ACCOUNT_BLOCKED);
        }
        user.setLastLoginAt(TimeUtils.now());
        return issueTokens(user, rememberMe);
    }

    /** Troca um refresh token válido por um novo par (o antigo é revogado). */
    @Transactional
    public AuthResponse refresh(String rawToken) {
        Instant now = TimeUtils.now();
        RefreshToken token = refreshTokens.findByTokenHash(TokenHasher.sha256(rawToken))
                .filter(t -> t.isUsable(now))
                .orElseThrow(() -> ApiException.unauthorized(Messages.SESSION_EXPIRED));
        User user = users.findById(token.getUserId())
                .orElseThrow(() -> ApiException.unauthorized(Messages.SESSION_EXPIRED));
        if (!user.isActive()) {
            throw ApiException.forbidden(Messages.ACCOUNT_BLOCKED);
        }
        token.revoke();
        return issueTokens(user, token.isRememberMe());
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        refreshTokens.findByTokenHash(TokenHasher.sha256(rawToken)).ifPresent(RefreshToken::revoke);
    }

    @Transactional(readOnly = true)
    public UserDto me(UUID userId) {
        return users.findById(userId).map(UserDto::from)
                .orElseThrow(() -> ApiException.notFound(Messages.USER_NOT_FOUND));
    }

    /** Sempre "sucesso" para quem chama: não revela se o e-mail existe. */
    @Transactional
    public void forgotPassword(String rawEmail) {
        String email = PasswordRules.normalizeEmail(rawEmail);
        User user = users.findByEmail(email).orElse(null);
        if (user == null || !user.isActive()) {
            return;
        }
        Instant now = TimeUtils.now();
        if (resetTokens.existsByUserIdAndCreatedAtAfter(user.getId(), now.minus(RESET_REQUEST_COOLDOWN))) {
            return; // evita spam de e-mails
        }
        String token = TokenHasher.newToken();
        resetTokens.save(new PasswordResetToken(user.getId(), TokenHasher.sha256(token), now, now.plus(RESET_TOKEN_TTL)));

        String base = props.frontendUrl().endsWith("/")
                ? props.frontendUrl().substring(0, props.frontendUrl().length() - 1)
                : props.frontendUrl();
        String link = base + "/redefinir-senha?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
        String text = """
                Olá, %s!

                Recebemos um pedido para redefinir a sua senha no AssessoriaLure.
                Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):

                %s

                Se não foi você, ignore este e-mail — sua senha continua a mesma.

                Time LURE
                """.formatted(user.displayName(), link);
        if (!mail.isEnabled()) {
            log.info("Link de redefinição de senha para {}: {}", email, link);
        }
        mail.send(email, "Redefinição de senha — AssessoriaLure", text);
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        PasswordRules.validate(newPassword);
        Instant now = TimeUtils.now();
        PasswordResetToken token = resetTokens.findByTokenHash(TokenHasher.sha256(rawToken))
                .filter(t -> t.isUsable(now))
                .orElseThrow(() -> ApiException.badRequest(INVALID_RESET));
        User user = users.findById(token.getUserId())
                .orElseThrow(() -> ApiException.badRequest(INVALID_RESET));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        token.markUsed(now);
        resetTokens.invalidateAllForUser(user.getId(), now);
        refreshTokens.revokeAllForUser(user.getId());
        loginAttempts.reset(user.getEmail());
    }

    private AuthResponse issueTokens(User user, boolean rememberMe) {
        Instant now = TimeUtils.now();
        Duration accessTtl = props.jwt().accessTokenTtl();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(props.jwt().issuer())
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(now.plus(accessTtl))
                .claim("role", user.getRole().name())
                .claim("email", user.getEmail())
                .build();
        String accessToken = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();

        String refreshToken = TokenHasher.newToken();
        Duration refreshTtl = rememberMe ? props.jwt().refreshTokenRememberTtl() : props.jwt().refreshTokenTtl();
        refreshTokens.save(new RefreshToken(user.getId(), TokenHasher.sha256(refreshToken), rememberMe, now,
                now.plus(refreshTtl)));
        return new AuthResponse(accessToken, refreshToken, accessTtl.toSeconds(), UserDto.from(user));
    }
}
