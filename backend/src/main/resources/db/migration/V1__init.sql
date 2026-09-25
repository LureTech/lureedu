-- LURE Growth — schema inicial.
-- Escrito para rodar tanto no H2 (MODE=PostgreSQL) quanto no PostgreSQL 16:
-- apenas UUID, VARCHAR, BOOLEAN, INTEGER, BIGINT, DOUBLE PRECISION e TIMESTAMP WITH TIME ZONE.
-- JSON é guardado em VARCHAR e (de)serializado pela aplicação.

-- ---------------------------------------------------------------- usuários
CREATE TABLE users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(254) NOT NULL,
    password_hash   VARCHAR(100) NOT NULL,
    full_name       VARCHAR(80),
    avatar_path     VARCHAR(255),
    role            VARCHAR(10)  NOT NULL,
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    last_login_at   TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_email_lower CHECK (email = LOWER(email)),
    CONSTRAINT ck_users_role CHECK (role IN ('ADMIN', 'MEMBER'))
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    remember_me BOOLEAN NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at     TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_password_reset_tokens_hash UNIQUE (token_hash)
);
CREATE INDEX ix_password_reset_tokens_user ON password_reset_tokens (user_id);

CREATE TABLE notification_prefs (
    user_id     UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    community   BOOLEAN NOT NULL DEFAULT TRUE,
    replies     BOOLEAN NOT NULL DEFAULT TRUE,
    new_content BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------- catálogo
CREATE TABLE sections (
    id          VARCHAR(60)  PRIMARY KEY,
    title       VARCHAR(120) NOT NULL,
    subtitle    VARCHAR(255) NOT NULL,
    sort_order  INTEGER      NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL
);

-- "módulos" na API; a tabela se chama courses para não colidir com java.lang.Module
CREATE TABLE courses (
    id          UUID PRIMARY KEY,
    slug        VARCHAR(160) NOT NULL,
    section_id  VARCHAR(60)  NOT NULL REFERENCES sections (id),
    title       VARCHAR(160) NOT NULL,
    description VARCHAR(4000),
    author      VARCHAR(120),
    cover_path  VARCHAR(255),
    locked      BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INTEGER NOT NULL,
    created_by  UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_courses_slug UNIQUE (slug)
);
CREATE INDEX ix_courses_section ON courses (section_id, sort_order);

CREATE TABLE lessons (
    id               UUID PRIMARY KEY,
    course_id        UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    position         INTEGER NOT NULL,
    title            VARCHAR(200) NOT NULL,
    description      VARCHAR(4000),
    youtube_url      VARCHAR(255),
    duration_seconds INTEGER,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_lessons_course ON lessons (course_id, position);

CREATE TABLE lesson_materials (
    id           UUID PRIMARY KEY,
    lesson_id    UUID NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
    label        VARCHAR(255) NOT NULL,
    file_path    VARCHAR(255) NOT NULL,
    size_bytes   BIGINT NOT NULL,
    content_type VARCHAR(150),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_lesson_materials_lesson ON lesson_materials (lesson_id);

CREATE TABLE lesson_progress (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    lesson_id       UUID NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
    completed       BOOLEAN NOT NULL DEFAULT FALSE,
    watched_seconds INTEGER NOT NULL DEFAULT 0,
    last_position   INTEGER NOT NULL DEFAULT 0,
    completed_at    TIMESTAMP WITH TIME ZONE,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_lesson_progress_user_lesson UNIQUE (user_id, lesson_id)
);
CREATE INDEX ix_lesson_progress_lesson ON lesson_progress (lesson_id);
CREATE INDEX ix_lesson_progress_user_updated ON lesson_progress (user_id, updated_at);

CREATE TABLE module_comments (
    id          UUID PRIMARY KEY,
    course_id   UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body        VARCHAR(1000) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_module_comments_course ON module_comments (course_id, created_at);

CREATE TABLE quiz_questions (
    id             UUID PRIMARY KEY,
    course_id      UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    position       INTEGER NOT NULL,
    question_text  VARCHAR(1000) NOT NULL,
    options_json   VARCHAR(4000) NOT NULL,
    correct_index  INTEGER NOT NULL
);
CREATE INDEX ix_quiz_questions_course ON quiz_questions (course_id, position);

CREATE TABLE quiz_attempts (
    id           UUID PRIMARY KEY,
    course_id    UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    score        INTEGER NOT NULL,
    passed       BOOLEAN NOT NULL,
    answers_json VARCHAR(4000) NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_quiz_attempts_user_course ON quiz_attempts (user_id, course_id);

-- Certificados guardam um "retrato" do momento da emissão e sobrevivem à exclusão do módulo.
CREATE TABLE certificates (
    id            UUID PRIMARY KEY,
    code          VARCHAR(20)  NOT NULL,
    user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    course_id     UUID REFERENCES courses (id) ON DELETE SET NULL,
    student_name  VARCHAR(120) NOT NULL,
    module_title  VARCHAR(160) NOT NULL,
    section_title VARCHAR(120) NOT NULL,
    author        VARCHAR(120),
    lesson_count  INTEGER NOT NULL,
    issued_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_certificates_code UNIQUE (code),
    CONSTRAINT uq_certificates_user_course UNIQUE (user_id, course_id)
);

-- ---------------------------------------------------------------- comunidade
CREATE TABLE community_posts (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category     VARCHAR(20) NOT NULL,
    body         VARCHAR(500) NOT NULL,
    image_path   VARCHAR(255),
    image_width  INTEGER,
    image_height INTEGER,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_community_posts_created ON community_posts (created_at);
CREATE INDEX ix_community_posts_category_created ON community_posts (category, created_at);
CREATE INDEX ix_community_posts_user_created ON community_posts (user_id, created_at);

CREATE TABLE post_likes (
    id          UUID PRIMARY KEY,
    post_id     UUID NOT NULL REFERENCES community_posts (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_post_likes_post_user UNIQUE (post_id, user_id)
);
CREATE INDEX ix_post_likes_user ON post_likes (user_id);

CREATE TABLE post_comments (
    id          UUID PRIMARY KEY,
    post_id     UUID NOT NULL REFERENCES community_posts (id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body        VARCHAR(300) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_post_comments_post ON post_comments (post_id, created_at);

-- ---------------------------------------------------------------- notificações
CREATE TABLE notifications (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type        VARCHAR(20)  NOT NULL,
    title       VARCHAR(200) NOT NULL,
    body        VARCHAR(500),
    link        VARCHAR(255),
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_notifications_user_created ON notifications (user_id, created_at);

-- ---------------------------------------------------------------- diagnóstico
CREATE TABLE diagnostic_submissions (
    id            UUID PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    answers_json  VARCHAR(2000) NOT NULL,
    overall       DOUBLE PRECISION NOT NULL,
    overall_label VARCHAR(20) NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_diagnostic_submissions_user_created ON diagnostic_submissions (user_id, created_at);
