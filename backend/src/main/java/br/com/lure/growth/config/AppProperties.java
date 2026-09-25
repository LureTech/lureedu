package br.com.lure.growth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;
import java.util.List;

/**
 * Propriedades {@code app.*} (veja application.properties).
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        Cors cors,
        @DefaultValue("http://localhost:4200") String frontendUrl,
        Storage storage,
        Admin admin,
        Seed seed,
        Mail mail,
        @DefaultValue Webauthn webauthn
) {

    public record Jwt(
            String secret,
            @DefaultValue("lure-growth") String issuer,
            @DefaultValue("15m") Duration accessTokenTtl,
            @DefaultValue("12h") Duration refreshTokenTtl,
            @DefaultValue("30d") Duration refreshTokenRememberTtl
    ) {
    }

    public record Cors(@DefaultValue("http://localhost:4200") List<String> allowedOrigins) {
    }

    public record Storage(@DefaultValue("./data/uploads") String dir) {
    }

    public record Admin(
            @DefaultValue("admin@lure.com.br") String email,
            @DefaultValue("Lure@2026") String password
    ) {
    }

    public record Seed(@DefaultValue("false") boolean demo) {
    }

    public record Mail(@DefaultValue("AssessoriaLure <nao-responda@lure.com.br>") String from) {
    }

    /** Passkeys / Face ID: domínio (RP ID) e origens exatas do frontend. */
    public record Webauthn(
            @DefaultValue("localhost") String rpId,
            @DefaultValue("AssessoriaLure") String rpName,
            @DefaultValue("http://localhost:4200") List<String> origins
    ) {
    }
}
