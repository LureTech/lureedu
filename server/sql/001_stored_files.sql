-- Arquivos enviados (avatares, capas, imagens da comunidade, materiais), servidos em /files/{path}.
-- Ficam no banco porque as funções da Vercel não têm disco persistente.
CREATE TABLE IF NOT EXISTS lure.stored_files (
    path         VARCHAR(255) PRIMARY KEY,
    content_type VARCHAR(150),
    size_bytes   BIGINT NOT NULL,
    data         BYTEA NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
