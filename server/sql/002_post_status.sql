-- Moderação da comunidade: posts de membros entram como PENDING e só aparecem para todos depois que
-- um admin aprova. Posts que já existiam continuam publicados (APPROVED).
ALTER TABLE lure.community_posts ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'APPROVED';
CREATE INDEX IF NOT EXISTS ix_community_posts_status_created ON lure.community_posts (status, created_at);
