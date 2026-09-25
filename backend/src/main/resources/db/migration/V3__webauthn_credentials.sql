-- Passkeys (WebAuthn): login com Face ID / Windows Hello / digital.
-- Só a chave pública fica no servidor; a biometria nunca sai do aparelho.
CREATE TABLE webauthn_credentials (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    credential_id   VARCHAR(1400) NOT NULL,
    public_key_cose VARCHAR(4000) NOT NULL,
    signature_count BIGINT NOT NULL,
    label           VARCHAR(100) NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at    TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_webauthn_credentials_credential UNIQUE (credential_id)
);
CREATE INDEX ix_webauthn_credentials_user ON webauthn_credentials (user_id);
