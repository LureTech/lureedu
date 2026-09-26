import { certificateDto, moduleCard, type CertificateRow, type ModuleCardDto } from '../lib/catalog.js';
import { db, type Db } from '../lib/db.js';
import { Messages, notFound } from '../lib/errors.js';
import { isAdmin, me, type App } from '../lib/http.js';
import { fileUrl } from '../lib/storage.js';
import { normalize } from '../lib/text.js';
import { percent } from '../lib/catalog.js';

/** Catálogo, seções, resumo de progresso, certificados e busca (seções 3–6 do contrato). */

interface SectionRow {
  id: string;
  title: string;
  subtitle: string;
  sort_order: number;
}

interface CardRow {
  id: string;
  slug: string;
  section_id: string;
  title: string;
  author: string | null;
  cover_path: string | null;
  locked: boolean;
  lesson_count: number;
  completed: number;
  last_activity: Date | null;
}

function sectionDto(s: SectionRow) {
  return { id: s.id, title: s.title, subtitle: s.subtitle, sortOrder: s.sort_order };
}

function allSections(sql: Db) {
  return sql<SectionRow[]>`SELECT id, title, subtitle, sort_order FROM sections ORDER BY sort_order ASC, title ASC`;
}

/**
 * Módulos (de uma seção ou todos) com contagem de aulas, aulas concluídas e última atividade
 * do usuário — uma consulta só, independente de quantos módulos existem.
 */
function cardRows(sql: Db, userId: string, sectionId: string | null) {
  return sql<CardRow[]>`
    SELECT c.id, c.slug, c.section_id, c.title, c.author, c.cover_path, c.locked,
           COALESCE(lc.n, 0) AS lesson_count, COALESCE(pc.n, 0) AS completed, pc.last_activity
    FROM courses c
    LEFT JOIN (SELECT course_id, count(*) AS n FROM lessons GROUP BY course_id) lc ON lc.course_id = c.id
    LEFT JOIN (
      SELECT l.course_id, count(*) FILTER (WHERE p.completed = true) AS n, max(p.updated_at) AS last_activity
      FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id
      WHERE p.user_id = ${userId}
      GROUP BY l.course_id
    ) pc ON pc.course_id = c.id
    ${sectionId === null ? sql`` : sql`WHERE c.section_id = ${sectionId}`}
    ORDER BY c.sort_order ASC, c.created_at ASC`;
}

function card(r: CardRow): ModuleCardDto {
  return moduleCard(r, r.lesson_count, r.completed);
}

export function registerCatalog(app: App) {
  app.get('/api/catalog', async (c) => {
    const user = me(c);
    const sql = db();
    const [sections, courses] = await Promise.all([allSections(sql), cardRows(sql, user.id, null)]);
    const bySection = new Map<string, ModuleCardDto[]>();
    for (const r of courses) {
      const list = bySection.get(r.section_id) ?? [];
      list.push(card(r));
      bySection.set(r.section_id, list);
    }
    return c.json(
      sections
        .filter((s) => bySection.has(s.id))
        .map((s) => ({ section: sectionDto(s), modules: bySection.get(s.id)! })),
    );
  });

  app.get('/api/sections', async (c) => {
    const rows = await allSections(db());
    return c.json(rows.map(sectionDto));
  });

  app.get('/api/sections/:id', async (c) => {
    const user = me(c);
    const id = c.req.param('id');
    const sql = db();
    const [section, courses] = await Promise.all([
      sql<SectionRow[]>`SELECT id, title, subtitle, sort_order FROM sections WHERE id = ${id}`,
      cardRows(sql, user.id, id),
    ]);
    if (!section.length) throw notFound(Messages.SECTION_NOT_FOUND);
    return c.json({ section: sectionDto(section[0]), modules: courses.map(card) });
  });

  /** Resumo "Meus cursos": considera só módulos liberados. */
  app.get('/api/progress/summary', async (c) => {
    const user = me(c);
    const sql = db();
    const [courses, candidates] = await Promise.all([
      cardRows(sql, user.id, null),
      sql<{
        slug: string;
        course_title: string;
        cover_path: string | null;
        lesson_id: string;
        lesson_title: string;
        position: number;
        last_position: number;
      }[]>`
        SELECT c.slug, c.title AS course_title, c.cover_path, l.id AS lesson_id, l.title AS lesson_title,
               l.position, p.last_position
        FROM lesson_progress p
          JOIN lessons l ON l.id = p.lesson_id
          JOIN courses c ON c.id = l.course_id
        WHERE p.user_id = ${user.id} AND c.locked = false
          AND (p.last_position > 0 OR p.completed = false)
        ORDER BY p.updated_at DESC
        LIMIT 1`,
    ]);

    let totalLessons = 0;
    let completedLessons = 0;
    const inProgress: { card: ModuleCardDto; activity: number }[] = [];
    const completed: { card: ModuleCardDto; activity: number }[] = [];
    for (const r of courses) {
      if (r.locked) continue;
      const cd = card(r);
      totalLessons += cd.lessonCount;
      completedLessons += cd.completedLessons;
      const entry = { card: cd, activity: r.last_activity ? r.last_activity.getTime() : 0 };
      if (cd.progress >= 100) {
        completed.push(entry);
      } else if (cd.progress > 0) {
        inProgress.push(entry);
      }
    }
    // Mais recentes primeiro (ordenação estável para empates).
    const recentFirst = (a: { activity: number }, b: { activity: number }) => b.activity - a.activity;
    inProgress.sort(recentFirst);
    completed.sort(recentFirst);

    const p = candidates[0];
    const continueWatching = p
      ? {
          moduleSlug: p.slug,
          moduleTitle: p.course_title,
          coverUrl: fileUrl(p.cover_path),
          lessonId: p.lesson_id,
          lessonTitle: p.lesson_title,
          lessonPosition: p.position,
          lastPosition: p.last_position,
        }
      : null;

    return c.json({
      totalLessons,
      completedLessons,
      percent: percent(completedLessons, totalLessons),
      inProgress: inProgress.map((e) => e.card),
      completed: completed.map((e) => e.card),
      continueWatching,
    });
  });

  app.get('/api/certificates', async (c) => {
    const user = me(c);
    const rows = await db()<(CertificateRow & { slug: string | null })[]>`
      SELECT ce.id, ce.code, ce.student_name, ce.module_title, ce.section_title, ce.author, ce.lesson_count,
             ce.issued_at, co.slug
      FROM certificates ce LEFT JOIN courses co ON co.id = ce.course_id
      WHERE ce.user_id = ${user.id}
      ORDER BY ce.issued_at DESC`;
    return c.json(rows.map((r) => certificateDto(r, r.slug)));
  });

  /** Público: página de verificação /certificado/{code}. */
  app.get('/api/public/certificates/:code', async (c) => {
    const code = (c.req.param('code') ?? '').trim().toUpperCase();
    const rows = await db()<(CertificateRow & { slug: string | null })[]>`
      SELECT ce.id, ce.code, ce.student_name, ce.module_title, ce.section_title, ce.author, ce.lesson_count,
             ce.issued_at, co.slug
      FROM certificates ce LEFT JOIN courses co ON co.id = ce.course_id
      WHERE ce.code = ${code}`;
    if (!rows.length) throw notFound('Certificado não encontrado. Confira o código.');
    return c.json(certificateDto(rows[0], rows[0].slug));
  });

  /**
   * Busca sem acento e sem diferenciar maiúsculas, feita em memória (o catálogo é pequeno).
   * Ranking: título que começa com o termo → título que contém → descrição/autor. Até 8 de cada.
   * Membros não recebem módulos trancados (nem as aulas deles). q com menos de 2 caracteres → listas vazias.
   */
  app.get('/api/search', async (c) => {
    const user = me(c);
    const q = normalize((c.req.query('q') ?? '').trim());
    if (q.length < 2) {
      return c.json({ modules: [], lessons: [] });
    }
    const sql = db();
    const [sections, courses, lessons] = await Promise.all([
      sql<{ id: string; title: string; sort_order: number }[]>`SELECT id, title, sort_order FROM sections`,
      sql<CourseSearchRow[]>`
        SELECT id, slug, section_id, title, description, author, cover_path, locked
        FROM courses ORDER BY sort_order ASC, created_at ASC`,
      sql<{ id: string; course_id: string; title: string; description: string | null; position: number }[]>`
        SELECT id, course_id, title, description, position FROM lessons`,
    ]);
    const sectionById = new Map(sections.map((s) => [s.id, s]));
    const sectionOrder = (co: CourseSearchRow) => sectionById.get(co.section_id)?.sort_order ?? 2_147_483_647;
    const visible = courses
      .filter((co) => isAdmin(user) || !co.locked)
      .sort((a, b) => sectionOrder(a) - sectionOrder(b));
    const catalogOrder = new Map<string, number>();
    visible.forEach((co, i) => catalogOrder.set(co.id, i));
    const courseById = new Map(visible.map((co) => [co.id, co]));

    const modules = rank(
      visible.map((co) => ({ item: co, score: score(q, co.title, co.description, co.author), order: catalogOrder.get(co.id)! })),
    ).map((co) => ({
      slug: co.slug,
      title: co.title,
      sectionTitle: sectionById.get(co.section_id)?.title ?? '',
      coverUrl: fileUrl(co.cover_path),
      locked: co.locked,
    }));

    const lessonHits = rank(
      lessons
        .filter((l) => courseById.has(l.course_id))
        .map((l) => ({
          item: l,
          score: score(q, l.title, l.description, null),
          order: catalogOrder.get(l.course_id)! * 10_000 + l.position,
        })),
    ).map((l) => {
      const co = courseById.get(l.course_id)!;
      return { moduleSlug: co.slug, moduleTitle: co.title, lessonId: l.id, lessonTitle: l.title, position: l.position };
    });

    return c.json({ modules, lessons: lessonHits });
  });
}

interface CourseSearchRow {
  id: string;
  slug: string;
  section_id: string;
  title: string;
  description: string | null;
  author: string | null;
  cover_path: string | null;
  locked: boolean;
}

const MAX_RESULTS = 8;

function rank<T>(scored: { item: T; score: number; order: number }[]): T[] {
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, MAX_RESULTS)
    .map((s) => s.item);
}

/** 3 = título começa com o termo, 2 = título contém, 1 = descrição/autor contém, 0 = não casa. */
function score(q: string, title: string, description: string | null, author: string | null): number {
  const t = normalize(title);
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  if (normalize(description).includes(q) || normalize(author).includes(q)) return 1;
  return 0;
}
