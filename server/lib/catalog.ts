import { randomInt } from 'node:crypto';
import { newId, now, type Db } from './db.js';
import { forbidden, Messages, notFound } from './errors.js';
import { isAdmin, type AuthUser } from './http.js';
import { fileUrl } from './storage.js';
import { displayName } from './users.js';

/** Utilitários do catálogo compartilhados pelas rotas de catálogo e de módulo (iguais ao Java). */

/** round(completed / total * 100); 0 quando não há aulas; só é 100 quando tudo foi concluído. */
export function percent(completed: number, total: number): number {
  if (total <= 0) return 0;
  const done = Math.min(completed, total);
  const value = Math.round((done * 100) / total);
  return done < total ? Math.min(value, 99) : 100;
}

// ------------------------------------------------------------------ módulos (cursos)

export interface CourseRow {
  id: string;
  slug: string;
  section_id: string;
  title: string;
  description: string | null;
  author: string | null;
  cover_path: string | null;
  locked: boolean;
}

/** Módulos trancados ("Em gravação") só para admins. */
export function checkAccess<T extends { locked: boolean }>(course: T, user: AuthUser): T {
  if (course.locked && !isAdmin(user)) {
    throw forbidden(Messages.MODULE_LOCKED);
  }
  return course;
}

export async function requireCourseBySlug(sql: Db, slug: string, user: AuthUser): Promise<CourseRow> {
  const rows = await sql<CourseRow[]>`
    SELECT id, slug, section_id, title, description, author, cover_path, locked
    FROM courses WHERE slug = ${slug}`;
  if (!rows.length) throw notFound(Messages.MODULE_NOT_FOUND);
  return checkAccess(rows[0], user);
}

/** Cartão do módulo (ModuleCardDto). */
export function moduleCard(
  c: { id: string; slug: string; section_id: string; title: string; author: string | null; cover_path: string | null; locked: boolean },
  lessonCount: number,
  completed: number,
) {
  const done = Math.min(completed, lessonCount);
  return {
    id: c.id,
    slug: c.slug,
    sectionId: c.section_id,
    title: c.title,
    author: c.author,
    coverUrl: fileUrl(c.cover_path),
    locked: c.locked,
    lessonCount,
    completedLessons: done,
    progress: percent(done, lessonCount),
  };
}

export type ModuleCardDto = ReturnType<typeof moduleCard>;

// ------------------------------------------------------------------ certificados

export interface CertificateRow {
  id: string;
  code: string;
  student_name: string;
  module_title: string;
  section_title: string;
  author: string | null;
  lesson_count: number;
  issued_at: Date;
}

export function certificateDto(c: CertificateRow, moduleSlug: string | null) {
  return {
    id: c.id,
    code: c.code,
    studentName: c.student_name,
    moduleTitle: c.module_title,
    sectionTitle: c.section_title,
    author: c.author,
    lessonCount: c.lesson_count,
    issuedAt: c.issued_at,
    moduleSlug,
  };
}

export type CertificateDto = ReturnType<typeof certificateDto>;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomBlock(): string {
  let block = '';
  for (let i = 0; i < 5; i++) {
    block += ALPHABET[randomInt(ALPHABET.length)];
  }
  return block;
}

/**
 * Emite o certificado se: todas as aulas (≥ 1) concluídas E (sem prova OU prova aprovada) E ainda não emitido.
 * Deve rodar dentro de withUserLock. Devolve o certificado recém-emitido, ou null.
 */
export async function issueIfEligible(sql: Db, userId: string, course: CourseRow): Promise<CertificateDto | null> {
  const [s] = await sql<{
    lesson_count: number;
    completed: number;
    questions: number;
    passed: boolean;
    issued: boolean;
    section_title: string | null;
    email: string | null;
    full_name: string | null;
  }[]>`
    SELECT
      (SELECT count(*) FROM lessons WHERE course_id = ${course.id}) AS lesson_count,
      (SELECT count(*) FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id
        WHERE p.user_id = ${userId} AND p.completed = true AND l.course_id = ${course.id}) AS completed,
      (SELECT count(*) FROM quiz_questions WHERE course_id = ${course.id}) AS questions,
      EXISTS (SELECT 1 FROM quiz_attempts
        WHERE user_id = ${userId} AND course_id = ${course.id} AND passed = true) AS passed,
      EXISTS (SELECT 1 FROM certificates WHERE user_id = ${userId} AND course_id = ${course.id}) AS issued,
      (SELECT title FROM sections WHERE id = ${course.section_id}) AS section_title,
      u.email, u.full_name
    FROM (SELECT 1) AS one LEFT JOIN users u ON u.id = ${userId}`;
  if (s.lesson_count === 0 || s.completed < s.lesson_count) return null;
  if (s.questions > 0 && !s.passed) return null;
  if (s.issued) return null;
  if (s.email == null) throw new Error('Usuário não encontrado ao emitir certificado');

  const row: CertificateRow = {
    id: newId(),
    code: '',
    student_name: displayName({ email: s.email, full_name: s.full_name }),
    module_title: course.title,
    section_title: s.section_title ?? '',
    author: course.author,
    lesson_count: s.lesson_count,
    issued_at: now(),
  };
  // LURE-XXXXX-XXXXX; em caso de colisão do código, sorteia outro.
  for (;;) {
    row.code = `LURE-${randomBlock()}-${randomBlock()}`;
    const inserted = await sql`
      INSERT INTO certificates (id, code, user_id, course_id, student_name, module_title, section_title,
                                author, lesson_count, issued_at)
      SELECT ${row.id}, ${row.code}, ${userId}, ${course.id}, ${row.student_name}, ${row.module_title},
             ${row.section_title}, ${row.author}, ${row.lesson_count}, ${row.issued_at}
      WHERE NOT EXISTS (SELECT 1 FROM certificates WHERE code = ${row.code})`;
    if (inserted.count > 0) break;
  }
  return certificateDto(row, course.slug);
}
