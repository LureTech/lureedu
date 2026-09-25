-- A aula aceita link do YouTube ou link direto de vídeo (MP4/WebM hospedado fora do banco, ex.: Cloudflare R2).
ALTER TABLE lessons RENAME COLUMN youtube_url TO video_url;
ALTER TABLE lessons ALTER COLUMN video_url SET DATA TYPE VARCHAR(1000);
