package br.com.lure.growth.auth;

import br.com.lure.growth.common.TimeUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/** Remove diariamente refresh tokens e links de redefinição vencidos há mais de 1 dia. */
@Component
public class TokenCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(TokenCleanupJob.class);

    private final RefreshTokenRepository refreshTokens;
    private final PasswordResetTokenRepository resetTokens;

    public TokenCleanupJob(RefreshTokenRepository refreshTokens, PasswordResetTokenRepository resetTokens) {
        this.refreshTokens = refreshTokens;
        this.resetTokens = resetTokens;
    }

    @Scheduled(cron = "0 17 3 * * *", zone = "America/Sao_Paulo")
    @Transactional
    public void purgeExpired() {
        Instant cutoff = TimeUtils.now().minus(Duration.ofDays(1));
        int refresh = refreshTokens.deleteExpiredBefore(cutoff);
        int reset = resetTokens.deleteExpiredBefore(cutoff);
        if (refresh + reset > 0) {
            log.info("Limpeza: {} refresh tokens e {} links de redefinição vencidos removidos.", refresh, reset);
        }
    }
}
