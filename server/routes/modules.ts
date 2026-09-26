import {
  certificateDto,
  checkAccess,
  issueIfEligible,
  percent,
  requireCourseBySlug,
  type CertificateDto,
  type CertificateRow,
  type CourseRow,
} from '../lib/catalog.js';
import { db, newId, now, withUserLock, type Db } from '../lib/db.js';
import { badRequest, conflict, forbidden, Messages, notFound } from '../lib/errors.js';
import {
  Check,
  INVALID_BODY,
  created,
  isAdmin,
  me,
  noContent,
  optBoolean,
  optInt,
  optString,
  readJson,
  uuidParam,
  type App,
  type AuthUser,
  type Ctx,
} from '../lib/http.js';
import { fileUrl } from '../lib/storage.js';
import { authorDto, unknownAuthor } from '../lib/users.js';

/** Módulo (curso), aulas/progresso, comentários do módulo e prova final. */

const PASSING_SCORE = 70;
const COMMENT_MAX_LENGTH = 1000;

/** @RequestBody obrigatório: corpo vazio → 400 "Requisição inválida" (igual ao Spring). */
async function requiredBody(c: Ctx): Promise<Record<string, unknown>> {
  const text = await c.req.text();
  if (text.trim() === '') throw badRequest(INVALID_BODY);
  return readJson(c);
}

interface LessonProgressRow {
  id: string;
  position: number;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  completed: boolean | null;
  last_position: number | null;
  watched_seconds: number | null;
}

interface MaterialRow {
  id: string;
  lesson_id: string;
  label: string;
  file_path: string;
  size_bytes: number;
  content_type: string | null;
}

interface AttemptStats {
  attempts: number;
  best_score: number | null;
  passed_count: number | null;
}

/** Aulas liberadas para a prova: todas (≥ 1) concluídas. */
function unlockAndStats(sql: Db, userId: string, courseId: string) {
  return sql<(AttemptStats & { lesson_count: number; completed: number; questions: number })[]>`
    SELECT
      (SELECT count(*) FROM lessons WHERE course_id = ${courseId}) AS lesson_count,
      (SELECT count(*) FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id
        WHERE p.user_id = ${userId} AND p.completed = true AND l.course_id = ${courseId}) AS completed,
      (SELECT count(*) FROM quiz_questions WHERE course_id = ${courseId}) AS questions,
      a.attempts, a.best_score, a.passed_count
    FROM (
      SELECT count(*) AS attempts, max(score) AS best_score,
             sum(CASE WHEN passed = true THEN 1 ELSE 0 END) AS passed_count
      FROM quiz_attempts WHERE user_id = ${userId} AND course_id = ${courseId}
    ) a`;
}

function isUnlocked(s: { lesson_count: number; completed: number }): boolean {
  return s.lesson_count > 0 && s.completed >= s.lesson_count;
}

function passed(s: AttemptStats): boolean {
  return s.passed_count != null && s.passed_count > 0;
}

interface QuestionRow {
  id: string;
  question_text: string;
  options_json: string;
  correct_index: number;
}

function questionsOf(sql: Db, courseId: string) {
  return sql<QuestionRow[]>`
    SELECT id, question_text, options_json, correct_index
    FROM quiz_questions WHERE course_id = ${courseId} ORDER BY position ASC`;
}

function parseOptions(json: string | null): string[] {
  if (json == null || json.trim() === '') return [];
  return JSON.parse(json) as string[];
}

interface CommentRow {
  id: string;
  body: string;
  created_at: Date;
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_path: string | null;
}

function commentDto(r: CommentRow, user: AuthUser) {
  const author =
    r.email != null
      ? authorDto({ id: r.user_id, email: r.email, full_name: r.full_name, avatar_path: r.avatar_path })
      : unknownAuthor(r.user_id);
  return {
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    author,
    canDelete: isAdmin(user) || r.user_id === user.id,
  };
}

/** Aula + módulo dela (404 sem aula, 403 módulo trancado para membros). */
async function requireLessonCourse(sql: Db, lessonId: string, user: AuthUser, withProgress: boolean) {
  const rows = await sql<(CourseRow & {
    lesson_duration: number | null;
    p_id: string | null;
    p_completed: boolean | null;
    p_watched: number | null;
    p_last: number | null;
    p_completed_at: Date | null;
  })[]>`
    SELECT c.id, c.slug, c.section_id, c.title, c.description, c.author, c.cover_path, c.locked,
           l.duration_seconds AS lesson_duration,
           p.id AS p_id, p.completed AS p_completed, p.watched_seconds AS p_watched,
           p.last_position AS p_last, p.completed_at AS p_completed_at
    FROM lessons l
      LEFT JOIN courses c ON c.id = l.course_id
      LEFT JOIN lesson_progress p ON ${withProgress} AND p.lesson_id = l.id AND p.user_id = ${user.id}
    WHERE l.id = ${lessonId}`;
  if (!rows.length) throw notFound(Messages.LESSON_NOT_FOUND);
  const r = rows[0];
  if (r.id == null) throw notFound(Messages.MODULE_NOT_FOUND);
  checkAccess(r, user);
  return r;
}

export function registerModules(app: App) {
  /** Página do módulo com aulas, progresso, prova e certificado. */
  app.get('/api/modules/:slug', async (c) => {
    const user = me(c);
    const sql = db();
    const rows = await sql<(CourseRow & { section_title: string | null })[]>`
      SELECT c.id, c.slug, c.section_id, c.title, c.description, c.author, c.cover_path, c.locked,
             s.title AS section_title
      FROM courses c LEFT JOIN sections s ON s.id = c.section_id
      WHERE c.slug = ${c.req.param('slug')}`;
    if (!rows.length) throw notFound(Messages.MODULE_NOT_FOUND);
    const course = checkAccess(rows[0], user);

    const [lessons, materials, statsRows, certificates] = await Promise.all([
      sql<LessonProgressRow[]>`
        SELECT l.id, l.position, l.title, l.description, l.video_url, l.duration_seconds,
               p.completed, p.last_position, p.watched_seconds
        FROM lessons l LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = ${user.id}
        WHERE l.course_id = ${course.id}
        ORDER BY l.position ASC`,
      sql<MaterialRow[]>`
        SELECT m.id, m.lesson_id, m.label, m.file_path, m.size_bytes, m.content_type
        FROM lesson_materials m JOIN lessons l ON l.id = m.lesson_id
        WHERE l.course_id = ${course.id}
        ORDER BY m.created_at ASC`,
      sql<(AttemptStats & { questions: number })[]>`
        SELECT (SELECT count(*) FROM quiz_questions WHERE course_id = ${course.id}) AS questions,
               count(*) AS attempts, max(score) AS best_score,
               sum(CASE WHEN passed = true THEN 1 ELSE 0 END) AS passed_count
        FROM quiz_attempts WHERE user_id = ${user.id} AND course_id = ${course.id}`,
      sql<CertificateRow[]>`
        SELECT id, code, student_name, module_title, section_title, author, lesson_count, issued_at
        FROM certificates WHERE user_id = ${user.id} AND course_id = ${course.id}`,
    ]);

    const materialsByLesson = new Map<string, object[]>();
    for (const m of materials) {
      const list = materialsByLesson.get(m.lesson_id) ?? [];
      list.push({ id: m.id, label: m.label, url: fileUrl(m.file_path), sizeBytes: m.size_bytes, contentType: m.content_type });
      materialsByLesson.set(m.lesson_id, list);
    }
    const lessonDtos = lessons.map((l) => ({
      id: l.id,
      position: l.position,
      title: l.title,
      description: l.description,
      videoUrl: l.video_url,
      durationSeconds: l.duration_seconds,
      completed: l.completed === true,
      lastPosition: l.last_position ?? 0,
      watchedSeconds: l.watched_seconds ?? 0,
      materials: materialsByLesson.get(l.id) ?? [],
    }));
    const completed = lessonDtos.filter((l) => l.completed).length;
    const allDone = lessonDtos.length > 0 && completed === lessonDtos.length;
    const stats = statsRows[0];

    return c.json({
      id: course.id,
      slug: course.slug,
      sectionId: course.section_id,
      sectionTitle: course.section_title ?? '',
      title: course.title,
      description: course.description,
      author: course.author,
      coverUrl: fileUrl(course.cover_path),
      locked: course.locked,
      lessons: lessonDtos,
      progress: percent(completed, lessonDtos.length),
      completedLessons: completed,
      quiz: {
        questionCount: stats.questions,
        unlocked: allDone,
        passed: passed(stats),
        bestScore: stats.best_score,
        attempts: stats.attempts ?? 0,
      },
      certificate: certificates.length ? certificateDto(certificates[0], course.slug) : null,
    });
  });

  /**
   * Upsert do progresso: campos ausentes não mudam; watchedSeconds nunca diminui.
   * Se esta chamada completar o módulo (e não houver prova pendente), emite o certificado.
   */
  app.put('/api/lessons/:lessonId/progress', async (c) => {
    const user = me(c);
    const lessonId = uuidParam(c, 'lessonId');
    const body = await requiredBody(c);
    const completedReq = optBoolean(body, 'completed');
    const watchedReq = optInt(body, 'watchedSeconds');
    const lastReq = optInt(body, 'lastPosition');
    const check = new Check();
    for (const [field, value] of [['lastPosition', lastReq], ['watchedSeconds', watchedReq]] as const) {
      if (value !== undefined && (value < 0 || value > 1_000_000)) check.fail(field, 'Valor inválido.');
    }
    check.done();

    const result = await withUserLock(user.id, async (tx) => {
      const row = await requireLessonCourse(tx, lessonId, user, true);
      const course: CourseRow = row;
      const ts = now();

      const exists = row.p_id != null;
      let completed = row.p_completed === true;
      let watched = row.p_watched ?? 0;
      let lastPosition = row.p_last ?? 0;
      let completedAt = row.p_completed_at;
      if (watchedReq !== undefined) watched = Math.max(watched, watchedReq);
      if (lastReq !== undefined) lastPosition = lastReq;
      if (completedReq !== undefined) {
        if (completedReq && !completed) completedAt = ts;
        else if (!completedReq) completedAt = null;
        completed = completedReq;
      }
      if (exists) {
        await tx`
          UPDATE lesson_progress
          SET completed = ${completed}, watched_seconds = ${watched}, last_position = ${lastPosition},
              completed_at = ${completedAt}, updated_at = ${ts}
          WHERE id = ${row.p_id}`;
      } else {
        await tx`
          INSERT INTO lesson_progress (id, user_id, lesson_id, completed, watched_seconds, last_position,
                                       completed_at, updated_at)
          VALUES (${newId()}, ${user.id}, ${lessonId}, ${completed}, ${watched}, ${lastPosition},
                  ${completedAt}, ${ts})`;
      }

      const [counts] = await tx<{ lesson_count: number; completed: number }[]>`
        SELECT (SELECT count(*) FROM lessons WHERE course_id = ${course.id}) AS lesson_count,
               (SELECT count(*) FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id
                 WHERE p.user_id = ${user.id} AND p.completed = true AND l.course_id = ${course.id}) AS completed`;
      let certificate: CertificateDto | null = null;
      if (counts.lesson_count > 0 && counts.completed >= counts.lesson_count) {
        certificate = await issueIfEligible(tx, user.id, course);
      }
      return {
        lessonId,
        completed,
        watchedSeconds: watched,
        lastPosition,
        moduleProgress: percent(counts.completed, counts.lesson_count),
        completedLessons: Math.min(counts.completed, counts.lesson_count),
        certificate,
      };
    });
    return c.json(result);
  });

  /** Grava a duração detectada pelo player — só se ainda não houver (admins sempre podem sobrescrever). */
  app.post('/api/lessons/:lessonId/duration', async (c) => {
    const user = me(c);
    const lessonId = uuidParam(c, 'lessonId');
    const body = await requiredBody(c);
    const duration = optInt(body, 'durationSeconds');
    const check = new Check();
    if (duration === undefined) check.fail('durationSeconds', 'Informe a duração.');
    else if (duration < 1 || duration > 172_800) check.fail('durationSeconds', 'Duração inválida.');
    check.done();

    const sql = db();
    const row = await requireLessonCourse(sql, lessonId, user, false);
    if (row.lesson_duration == null || isAdmin(user)) {
      // Um único UPDATE atômico; só grava se o valor mudar (como o dirty checking do JPA).
      await sql`
        UPDATE lessons SET duration_seconds = ${duration!}, updated_at = ${now()}
        WHERE id = ${lessonId}
          AND (duration_seconds IS NULL OR ${isAdmin(user)})
          AND duration_seconds IS DISTINCT FROM ${duration!}`;
    }
    return noContent(c);
  });

  app.get('/api/modules/:slug/comments', async (c) => {
    const user = me(c);
    const sql = db();
    const course = await requireCourseBySlug(sql, c.req.param('slug'), user);
    const rows = await sql<CommentRow[]>`
      SELECT mc.id, mc.body, mc.created_at, mc.user_id, u.email, u.full_name, u.avatar_path
      FROM module_comments mc LEFT JOIN users u ON u.id = mc.user_id
      WHERE mc.course_id = ${course.id}
      ORDER BY mc.created_at DESC, mc.id DESC`;
    return c.json(rows.map((r) => commentDto(r, user)));
  });

  app.post('/api/modules/:slug/comments', async (c) => {
    const user = me(c);
    const input = await requiredBody(c);
    const check = new Check();
    const rawBody = optString(input, 'body');
    check.notBlank('body', rawBody, 'Escreva um comentário.');
    check.done();

    const sql = db();
    const course = await requireCourseBySlug(sql, c.req.param('slug'), user);
    const text = (rawBody ?? '').trim();
    if (text === '') throw badRequest('Escreva um comentário.');
    if (text.length > COMMENT_MAX_LENGTH) throw badRequest('O comentário pode ter no máximo 1000 caracteres.');

    // Insere e já devolve com o autor (uma instrução só, atômica).
    const [row] = await sql<CommentRow[]>`
      WITH ins AS (
        INSERT INTO module_comments (id, course_id, user_id, body, created_at)
        VALUES (${newId()}, ${course.id}, ${user.id}, ${text}, ${now()})
        RETURNING id, body, created_at, user_id
      )
      SELECT ins.id, ins.body, ins.created_at, ins.user_id, u.email, u.full_name, u.avatar_path
      FROM ins LEFT JOIN users u ON u.id = ins.user_id`;
    return created(c, commentDto(row, user));
  });

  app.delete('/api/module-comments/:id', async (c) => {
    const user = me(c);
    const id = uuidParam(c, 'id');
    const sql = db();
    const rows = await sql<{ user_id: string }[]>`SELECT user_id FROM module_comments WHERE id = ${id}`;
    if (!rows.length) throw notFound(Messages.COMMENT_NOT_FOUND);
    if (!isAdmin(user) && rows[0].user_id !== user.id) throw forbidden(Messages.NO_PERMISSION);
    await sql`DELETE FROM module_comments WHERE id = ${id}`;
    return noContent(c);
  });

  app.get('/api/modules/:slug/quiz', async (c) => {
    const user = me(c);
    const sql = db();
    const course = await requireCourseBySlug(sql, c.req.param('slug'), user);
    const [[stats], questions] = await Promise.all([unlockAndStats(sql, user.id, course.id), questionsOf(sql, course.id)]);
    const unlocked = isUnlocked(stats);
    return c.json({
      unlocked,
      passingScore: PASSING_SCORE,
      attempts: stats.attempts ?? 0,
      bestScore: stats.best_score,
      passed: passed(stats),
      questions: unlocked
        ? questions.map((q) => ({ id: q.id, text: q.question_text, options: parseOptions(q.options_json) }))
        : [],
    });
  });

  app.post('/api/modules/:slug/quiz/attempts', async (c) => {
    const user = me(c);
    const body = await requiredBody(c);
    const answers = parseAnswers(body.answers);
    if (answers === null) {
      new Check().fail('answers', 'Envie as respostas.').done();
    }

    const result = await withUserLock(user.id, async (tx) => {
      const course = await requireCourseBySlug(tx, c.req.param('slug'), user);
      const [questions, [stats]] = await Promise.all([questionsOf(tx, course.id), unlockAndStats(tx, user.id, course.id)]);
      if (!questions.length) throw conflict('Este módulo não tem prova final.');
      if (!isUnlocked(stats)) throw conflict('Conclua todas as aulas para liberar a prova.');

      const results: { questionId: string; correct: boolean; correctIndex: number }[] = [];
      const recorded: Record<string, number | null> = {};
      let correct = 0;
      for (const q of questions) {
        const chosen = Object.hasOwn(answers!, q.id) ? answers![q.id] : null;
        const ok = chosen != null && chosen === q.correct_index;
        if (ok) correct++;
        recorded[q.id] = chosen;
        results.push({ questionId: q.id, correct: ok, correctIndex: q.correct_index });
      }
      const score = Math.round((correct * 100) / questions.length);
      const passedNow = score >= PASSING_SCORE;
      await tx`
        INSERT INTO quiz_attempts (id, course_id, user_id, score, passed, answers_json, created_at)
        VALUES (${newId()}, ${course.id}, ${user.id}, ${score}, ${passedNow}, ${JSON.stringify(recorded)}, ${now()})`;
      const certificate = passedNow ? await issueIfEligible(tx, user.id, course) : null;
      return { score, correct, total: questions.length, passed: passedNow, results, certificate };
    });
    return c.json(result);
  });
}

/**
 * Map<String, Integer> do Jackson: null/ausente → null (vira erro "Envie as respostas.");
 * não-objeto ou valor não inteiro → 400 "Requisição inválida".
 */
function parseAnswers(value: unknown): Record<string, number | null> | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw badRequest(INVALID_BODY);
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = optInt({ v }, 'v') ?? null;
  }
  return out;
}
