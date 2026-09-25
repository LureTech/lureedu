package br.com.lure.growth.auth.webauthn;

import br.com.lure.growth.config.AppProperties;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.data.RelyingPartyIdentity;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.LinkedHashSet;
import java.util.Set;

@Configuration
class WebAuthnConfig {

    /**
     * O RP ID é o domínio do site (sem porta/protocolo) e as origens são as URLs exatas do frontend.
     * Em produção: WEBAUTHN_RP_ID=seudominio.com.br e WEBAUTHN_ORIGINS=https://seudominio.com.br.
     */
    @Bean
    RelyingParty relyingParty(AppProperties props, JpaCredentialRepository credentialRepository) {
        AppProperties.Webauthn cfg = props.webauthn();
        Set<String> origins = new LinkedHashSet<>();
        cfg.origins().stream().map(String::strip).filter(s -> !s.isEmpty())
                .map(s -> s.endsWith("/") ? s.substring(0, s.length() - 1) : s)
                .forEach(origins::add);
        return RelyingParty.builder()
                .identity(RelyingPartyIdentity.builder().id(cfg.rpId()).name(cfg.rpName()).build())
                .credentialRepository(credentialRepository)
                .origins(origins)
                .build();
    }
}
