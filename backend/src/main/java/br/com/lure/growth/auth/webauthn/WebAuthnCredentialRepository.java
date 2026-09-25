package br.com.lure.growth.auth.webauthn;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WebAuthnCredentialRepository extends JpaRepository<WebAuthnCredential, UUID> {

    List<WebAuthnCredential> findByUserIdOrderByCreatedAtAsc(UUID userId);

    Optional<WebAuthnCredential> findByCredentialId(String credentialId);

    Optional<WebAuthnCredential> findByIdAndUserId(UUID id, UUID userId);
}
