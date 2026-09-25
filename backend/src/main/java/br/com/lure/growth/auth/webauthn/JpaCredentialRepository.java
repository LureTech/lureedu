package br.com.lure.growth.auth.webauthn;

import br.com.lure.growth.user.User;
import br.com.lure.growth.user.UserRepository;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
import com.yubico.webauthn.data.exception.Base64UrlException;
import org.springframework.stereotype.Component;

import java.nio.ByteBuffer;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Ponte entre a biblioteca WebAuthn (Yubico) e o banco. O "username" é o e-mail e o
 * "user handle" são os 16 bytes do id do usuário.
 */
@Component
class JpaCredentialRepository implements CredentialRepository {

    private final WebAuthnCredentialRepository credentials;
    private final UserRepository users;

    JpaCredentialRepository(WebAuthnCredentialRepository credentials, UserRepository users) {
        this.credentials = credentials;
        this.users = users;
    }

    static ByteArray userHandle(UUID id) {
        ByteBuffer buf = ByteBuffer.allocate(16);
        buf.putLong(id.getMostSignificantBits());
        buf.putLong(id.getLeastSignificantBits());
        return new ByteArray(buf.array());
    }

    static Optional<UUID> userId(ByteArray handle) {
        if (handle == null || handle.size() != 16) {
            return Optional.empty();
        }
        ByteBuffer buf = ByteBuffer.wrap(handle.getBytes());
        return Optional.of(new UUID(buf.getLong(), buf.getLong()));
    }

    static ByteArray decode(String base64Url) {
        try {
            return ByteArray.fromBase64Url(base64Url);
        } catch (Base64UrlException e) {
            throw new IllegalStateException("Credencial corrompida no banco", e);
        }
    }

    @Override
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
        return users.findByEmail(username)
                .map(u -> credentials.findByUserIdOrderByCreatedAtAsc(u.getId()).stream()
                        .map(c -> PublicKeyCredentialDescriptor.builder().id(decode(c.getCredentialId())).build())
                        .collect(Collectors.toSet()))
                .orElse(Set.of());
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        return users.findByEmail(username).map(u -> userHandle(u.getId()));
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        return userId(userHandle).flatMap(users::findById).map(User::getEmail);
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        return credentials.findByCredentialId(credentialId.getBase64Url())
                .filter(c -> userHandle(c.getUserId()).equals(userHandle))
                .map(JpaCredentialRepository::toRegistered);
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return credentials.findByCredentialId(credentialId.getBase64Url())
                .map(JpaCredentialRepository::toRegistered)
                .map(Set::of)
                .orElse(Set.of());
    }

    private static RegisteredCredential toRegistered(WebAuthnCredential c) {
        return RegisteredCredential.builder()
                .credentialId(decode(c.getCredentialId()))
                .userHandle(userHandle(c.getUserId()))
                .publicKeyCose(decode(c.getPublicKeyCose()))
                .signatureCount(c.getSignatureCount())
                .build();
    }
}
