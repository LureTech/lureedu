import { db, newId, now, transaction, type Db } from '../lib/db.js';
import { badRequest, conflict, Messages, notFound } from '../lib/errors.js';
import {
  Check,
  INVALID_BODY,
  created,
  isUuid,
  me,
  noContent,
  optBoolean,
  optInt,
  optString,
  readForm,
  readJson,
  uuidParam,
  type App,
  type Ctx,
} from '../lib/http.js';
import { deleteFile, deleteFiles, fileUrl, storeImage, storeMaterial } from '../lib/storage.js';
import { slugify, trimToEmpty, trimToNull, uniqueSlug } from '../lib/text.js';
import { normalizeVideoUrl, VIDEO_URL_INVALID } from '../lib/video-urls.js';
import { notifyNewContent } from './notifications.js';

/** CRUD de seções, módulos, aulas, materiais e prova (somente ADMIN — o filtro já garante). */

const COVER_MAX_BYTES = 10 * 1024 * 1024;
const MATERIAL_MAX_BYTES = 50 * 1024 * 1024;
const MAX_QUIZ_QUESTIONS = 50;

// ------------------------------------------------------------------ linhas do banco

interface SectionRow {
  id: string;
  title: string;
  subtitle: string;
  sort_order: number;
}

interface ModuleRow {
  id: string;
  slug: string;
  section_id: string;
  section_title: string | null;
  title: string;
  description: string | null;
  author: string | null;
  cover_path: string | null;
  locked: boolean;
  sort_order: number;
  created_at: Date;
  lesson_count: number;
  with_video: number;
  question_count: number;
}

interface CourseRow {
  id: string;
  slug: string;
  section_id: string;
  title: string;
  description: string | null;
  author: string | null;
  cover_path: string | null;
  locked: boolean;
  sort_order: number;
}

interface LessonRow {
  id: string;
  course_id: string;
  position: number;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_seconds: number | null;
}

interface MaterialRow {
  id: string;
  lesson_id: string;
  label: string;
  file_path: string;
  size_bytes: number;
  content_type: string | null;
}

interface QuizRow {
  id: string;
  question_text: string;
  options_json: string;
  correct_index: number;
}

// ------------------------------------------------------------------ DTOs

function sectionDto(s: SectionRow) {
  return { id: s.id, title: s.title, subtitle: s.subtitle, sortOrder: s.sort_order };
}

function moduleDto(m: ModuleRow) {
  return {
    id: m.id,
    slug: m.slug,
    sectionId: m.section_id,
    sectionTitle: m.section_title ?? '',
    title: m.title,
    description: m.description,
    author: m.author,
    coverUrl: fileUrl(m.cover_path),
    locked: m.locked,
    sortOrder: m.sort_order,
    lessonCount: m.lesson_count,
    lessonsWithVideo: m.with_video,
    quizQuestionCount: m.question_count,
    createdAt: m.created_at,
  };
}

function materialDto(m: MaterialRow) {
  return { id: m.id, label: m.label, url: fileUrl(m.file_path), sizeBytes: m.size_bytes, contentType: m.content_type };
}

function quizDto(q: QuizRow) {
  return { id: q.id, text: q.question_text, options: JSON.parse(q.options_json) as string[], correctIndex: q.correct_index };
}

/** LessonDto (igual ao do aluno) com materiais e o progresso de {@code userId}: 2 consultas para N aulas. */
async function lessonDtos(sql: Db, lessons: LessonRow[], userId: string) {
  if (lessons.length === 0) return [];
  const ids = lessons.map((l) => l.id);
  const mats = await sql<MaterialRow[]>`
    SELECT id, lesson_id, label, file_path, size_bytes, content_type FROM lesson_materials
    WHERE lesson_id IN ${sql(ids)} ORDER BY created_at ASC`;
  const progs = await sql<{ lesson_id: string; completed: boolean; last_position: number; watched_seconds: number }[]>`
    SELECT lesson_id, completed, last_position, watched_seconds FROM lesson_progress
    WHERE user_id = ${userId} AND lesson_id IN ${sql(ids)}`;
  const matsByLesson = new Map<string, ReturnType<typeof materialDto>[]>();
  for (const m of mats) {
    const list = matsByLesson.get(m.lesson_id) ?? [];
    list.push(materialDto(m));
    matsByLesson.set(m.lesson_id, list);
  }
  const progByLesson = new Map(progs.map((p) => [p.lesson_id, p]));
  return lessons.map((l) => {
    const p = progByLesson.get(l.id);
    return {
      id: l.id,
      position: l.position,
      title: l.title,
      description: l.description,
      videoUrl: l.video_url,
      durationSeconds: l.duration_seconds,
      completed: p != null && p.completed,
      lastPosition: p != null ? p.last_position : 0,
      watchedSeconds: p != null ? p.watched_seconds : 0,
      materials: matsByLesson.get(l.id) ?? [],
    };
  });
}

// ------------------------------------------------------------------ consultas

/** Módulos com seção e contagens agregadas (um ou todos) numa consulta só. */
async function loadModules(sql: Db, id: string | null): Promise<ModuleRow[]> {
  return sql<ModuleRow[]>`
    SELECT c.id, c.slug, c.section_id, s.title AS section_title, c.title, c.description, c.author, c.cover_path,
           c.locked, c.sort_order, c.created_at,
           coalesce(lc.lessons, 0) AS lesson_count, coalesce(lc.with_video, 0) AS with_video,
           coalesce(qc.questions, 0) AS question_count
    FROM courses c
    LEFT JOIN sections s ON s.id = c.section_id
    LEFT JOIN (
      SELECT course_id, count(*) AS lessons, count(video_url) AS with_video FROM lessons
      ${id ? sql`WHERE course_id = ${id}` : sql``}
      GROUP BY course_id
    ) lc ON lc.course_id = c.id
    LEFT JOIN (
      SELECT course_id, count(*) AS questions FROM quiz_questions
      ${id ? sql`WHERE course_id = ${id}` : sql``}
      GROUP BY course_id
    ) qc ON qc.course_id = c.id
    ${id ? sql`WHERE c.id = ${id}` : sql``}
    ORDER BY coalesce(s.sort_order, 2147483647) ASC, c.sort_order ASC, c.created_at ASC`;
}

async function moduleDtoById(sql: Db, id: string) {
  const rows = await loadModules(sql, id);
  if (rows.length === 0) throw notFound(Messages.MODULE_NOT_FOUND);
  return moduleDto(rows[0]);
}

async function requireCourse(sql: Db, id: string, forUpdate = false): Promise<CourseRow> {
  const rows = await sql<CourseRow[]>`
    SELECT id, slug, section_id, title, description, author, cover_path, locked, sort_order
    FROM courses WHERE id = ${id} ${forUpdate ? sql`FOR UPDATE` : sql``}`;
  if (rows.length === 0) throw notFound(Messages.MODULE_NOT_FOUND);
  return rows[0];
}

async function requireLesson(sql: Db, id: string): Promise<LessonRow> {
  const rows = await sql<LessonRow[]>`
    SELECT id, course_id, position, title, description, video_url, duration_seconds FROM lessons WHERE id = ${id}`;
  if (rows.length === 0) throw notFound(Messages.LESSON_NOT_FOUND);
  return rows[0];
}

async function requireSection(sql: Db, id: string): Promise<SectionRow> {
  const rows = await sql<SectionRow[]>`SELECT id, title, subtitle, sort_order FROM sections WHERE id = ${id}`;
  if (rows.length === 0) throw notFound(Messages.SECTION_NOT_FOUND);
  return rows[0];
}

/** Seção escolhida no formulário do módulo: inexistente → 400. */
async function sectionForInput(sql: Db, sectionId: string): Promise<SectionRow> {
  const rows = await sql<SectionRow[]>`
    SELECT id, title, subtitle, sort_order FROM sections WHERE id = ${sectionId.trim()}`;
  if (rows.length === 0) throw badRequest(Messages.SECTION_NOT_FOUND);
  return rows[0];
}

async function maxSortOrderInSection(sql: Db, sectionId: string): Promise<number> {
  const [r] = await sql<{ m: number }[]>`SELECT coalesce(max(sort_order), 0) AS m FROM courses WHERE section_id = ${sectionId}`;
  return r.m;
}

async function notifyModuleReleased(sql: Db, actorId: string, title: string, slug: string, section: SectionRow | null) {
  const where = section != null ? ` já está disponível em ${section.title}.` : ' já está disponível.';
  await notifyNewContent(sql, actorId, 'Novo conteúdo liberado', `"${title}"${where}`, `/curso/${slug}`);
}

// ------------------------------------------------------------------ corpo da requisição

/** Corpo JSON obrigatório (vazio → 400, igual ao @RequestBody do Spring). */
async function readBody(c: Ctx): Promise<Record<string, unknown>> {
  const text = await c.req.text();
  if (text.trim() === '') {
    throw badRequest(INVALID_BODY);
  }
  return readJson(c);
}

/** Integer do Jackson: aceita número com casas decimais (trunca) ou texto numérico. */
function javaInt(body: Record<string, unknown>, key: string): number | undefined {
  const v = body[key];
  if (typeof v === 'number' && Number.isFinite(v) && !Number.isInteger(v)) {
    const t = Math.trunc(v);
    if (Math.abs(t) <= 2_147_483_647) return t;
    throw badRequest(INVALID_BODY);
  }
  return optInt(body, key);
}

function checkOrder(check: Check, field: string, value: number | undefined): void {
  if (value !== undefined && (value < 0 || value > 100_000)) {
    check.fail(field, 'Ordem inválida.');
  }
}

interface ModuleInput {
  sectionId: string;
  title: string;
  description: string | undefined;
  author: string | undefined;
  locked: boolean | undefined;
  sortOrder: number | undefined;
}

function readModuleInput(body: Record<string, unknown>): ModuleInput {
  const sectionId = optString(body, 'sectionId');
  const title = optString(body, 'title');
  const description = optString(body, 'description');
  const author = optString(body, 'author');
  const locked = optBoolean(body, 'locked');
  const sortOrder = javaInt(body, 'sortOrder');
  const check = new Check()
    .notBlank('sectionId', sectionId, 'Escolha a seção.')
    .notBlank('title', title, 'Informe o título.')
    .maxLength('title', title, 160, 'O título pode ter no máximo 160 caracteres.')
    .maxLength('description', description, 4000, 'A descrição pode ter no máximo 4000 caracteres.')
    .maxLength('author', author, 120, 'O autor pode ter no máximo 120 caracteres.');
  checkOrder(check, 'sortOrder', sortOrder);
  check.done();
  return { sectionId: sectionId!, title: title!, description, author, locked, sortOrder };
}

interface LessonInput {
  title: string;
  description: string | undefined;
  videoUrl: string | undefined;
  durationSeconds: number | undefined;
}

function readLessonInput(body: Record<string, unknown>): LessonInput {
  const title = optString(body, 'title');
  const description = optString(body, 'description');
  const videoUrl = optString(body, 'videoUrl');
  const durationSeconds = javaInt(body, 'durationSeconds');
  const check = new Check()
    .notBlank('title', title, 'Informe o título da aula.')
    .maxLength('title', title, 200, 'O título pode ter no máximo 200 caracteres.')
    .maxLength('description', description, 4000, 'A descrição pode ter no máximo 4000 caracteres.')
    .maxLength('videoUrl', videoUrl, 1000, VIDEO_URL_INVALID);
  if (durationSeconds !== undefined && (durationSeconds < 0 || durationSeconds > 172_800)) {
    check.fail('durationSeconds', 'Duração inválida.');
  }
  check.done();
  return { title: title!, description, videoUrl, durationSeconds };
}

/** Converte os valores da aula como o applyLessonInput do Java (vídeo inválido → 400). */
function lessonValues(input: LessonInput) {
  return {
    title: input.title.trim(),
    description: trimToNull(input.description),
    video_url: normalizeVideoUrl(input.videoUrl),
    duration_seconds: input.durationSeconds ?? null,
  };
}

interface QuizQuestionInput {
  text: string | undefined;
  options: string[] | null;
  correctIndex: number | undefined;
}

/** Desserializa as perguntas (tipos errados → 400 "Requisição inválida", igual ao Jackson). */
function readQuizInput(body: Record<string, unknown>): (QuizQuestionInput | null)[] {
  const raw = body.questions;
  if (raw === undefined || raw === null) {
    new Check().fail('questions', 'Envie as perguntas.').done();
  }
  if (!Array.isArray(raw)) throw badRequest(INVALID_BODY);
  return raw.map((q) => {
    if (q === null) return null;
    if (typeof q !== 'object' || Array.isArray(q)) throw badRequest(INVALID_BODY);
    const obj = q as Record<string, unknown>;
    const text = optString(obj, 'text');
    let options: string[] | null = null;
    if (obj.options !== undefined && obj.options !== null) {
      if (!Array.isArray(obj.options)) throw badRequest(INVALID_BODY);
      options = obj.options.map((o) => {
        if (o === null || o === undefined) return null as unknown as string;
        if (typeof o === 'string') return o;
        if (typeof o === 'number' || typeof o === 'boolean') return String(o);
        throw badRequest(INVALID_BODY);
      });
    }
    return { text, options, correctIndex: javaInt(obj, 'correctIndex') };
  });
}

/** Arquivo do multipart: parte ausente → 400 já na leitura (o vazio só é recusado depois, no serviço). */
function filePart(form: Record<string, string | File>): File {
  const f = form.file;
  if (!(f instanceof File)) throw badRequest('Selecione um arquivo para enviar.');
  return f;
}

function requireNonEmpty(file: File): void {
  if (file.size === 0) throw badRequest('Selecione um arquivo para enviar.');
}

// ------------------------------------------------------------------ rotas

export function registerAdminCatalog(app: App) {
  // ---------------------------------------------------------------- seções

  app.post('/api/admin/sections', async (c) => {
    const body = await readBody(c);
    const reqId = optString(body, 'id');
    const title = optString(body, 'title');
    const subtitle = optString(body, 'subtitle');
    new Check()
      .maxLength('id', reqId, 60, 'O identificador pode ter no máximo 60 caracteres.')
      .notBlank('title', title, 'Informe o título.')
      .maxLength('title', title, 120, 'O título pode ter no máximo 120 caracteres.')
      .maxLength('subtitle', subtitle, 255, 'O subtítulo pode ter no máximo 255 caracteres.')
      .done();

    const section = await transaction(async (tx) => {
      const cleanTitle = title!.trim();
      const exists = async (candidate: string) =>
        (await tx`SELECT 1 FROM sections WHERE id = ${candidate}`).length > 0;
      let id: string;
      if (reqId != null && reqId.trim() !== '') {
        id = slugify(reqId, 60);
        if (id === '') {
          throw badRequest('Identificador inválido. Use letras, números e hífens.');
        }
        if (await exists(id)) {
          throw conflict('Já existe uma seção com esse identificador.');
        }
      } else {
        id = await uniqueSlug(cleanTitle, 60, 'secao', exists);
      }
      const [m] = await tx<{ m: number }[]>`SELECT coalesce(max(sort_order), 0) AS m FROM sections`;
      const [row] = await tx<SectionRow[]>`
        INSERT INTO sections (id, title, subtitle, sort_order, created_at)
        VALUES (${id}, ${cleanTitle}, ${trimToEmpty(subtitle)}, ${m.m + 1}, ${now()})
        RETURNING id, title, subtitle, sort_order`;
      return row;
    });
    return created(c, sectionDto(section));
  });

  app.put('/api/admin/sections/:id', async (c) => {
    const id = c.req.param('id');
    const body = await readBody(c);
    const title = optString(body, 'title');
    const subtitle = optString(body, 'subtitle');
    const sortOrder = javaInt(body, 'sortOrder');
    const check = new Check()
      .notBlank('title', title, 'Informe o título.')
      .maxLength('title', title, 120, 'O título pode ter no máximo 120 caracteres.')
      .maxLength('subtitle', subtitle, 255, 'O subtítulo pode ter no máximo 255 caracteres.');
    checkOrder(check, 'sortOrder', sortOrder);
    check.done();

    const section = await transaction(async (tx) => {
      const current = await requireSection(tx, id);
      const [row] = await tx<SectionRow[]>`
        UPDATE sections SET title = ${title!.trim()}, subtitle = ${trimToEmpty(subtitle)},
               sort_order = ${sortOrder ?? current.sort_order}
        WHERE id = ${id}
        RETURNING id, title, subtitle, sort_order`;
      return row;
    });
    return c.json(sectionDto(section));
  });

  app.delete('/api/admin/sections/:id', async (c) => {
    const id = c.req.param('id');
    await transaction(async (tx) => {
      await requireSection(tx, id);
      const used = await tx`SELECT 1 FROM courses WHERE section_id = ${id} LIMIT 1`;
      if (used.length > 0) {
        throw conflict('Esta seção tem módulos. Mova ou apague os módulos antes.');
      }
      await tx`DELETE FROM sections WHERE id = ${id}`;
    });
    return noContent(c);
  });

  // ---------------------------------------------------------------- módulos

  app.get('/api/admin/modules', async (c) => {
    const rows = await loadModules(db(), null);
    return c.json(rows.map(moduleDto));
  });

  app.get('/api/admin/modules/:id', async (c) => {
    const id = uuidParam(c, 'id');
    const sql = db();
    const base = await moduleDtoById(sql, id);
    const [lessons, quiz] = await Promise.all([
      sql<LessonRow[]>`
        SELECT id, course_id, position, title, description, video_url, duration_seconds
        FROM lessons WHERE course_id = ${id} ORDER BY position ASC`,
      sql<QuizRow[]>`
        SELECT id, question_text, options_json, correct_index FROM quiz_questions
        WHERE course_id = ${id} ORDER BY position ASC`,
    ]);
    return c.json({ ...base, lessons: await lessonDtos(sql, lessons, me(c).id), quiz: quiz.map(quizDto) });
  });

  app.post('/api/admin/modules', async (c) => {
    const input = readModuleInput(await readBody(c));
    const user = me(c);
    const dto = await transaction(async (tx) => {
      const section = await sectionForInput(tx, input.sectionId);
      const title = input.title.trim();
      const slug = await uniqueSlug(title, 160, 'modulo', async (candidate) =>
        (await tx`SELECT 1 FROM courses WHERE slug = ${candidate}`).length > 0);
      const sortOrder = (await maxSortOrderInSection(tx, section.id)) + 1;
      const locked = input.locked === true;
      const id = newId();
      const t = now();
      await tx`
        INSERT INTO courses (id, slug, section_id, title, description, author, cover_path, locked, sort_order,
                             created_by, created_at, updated_at)
        VALUES (${id}, ${slug}, ${section.id}, ${title}, ${trimToNull(input.description)}, ${trimToNull(input.author)},
                NULL, ${locked}, ${sortOrder}, ${user.id}, ${t}, ${t})`;
      if (!locked) {
        await notifyModuleReleased(tx, user.id, title, slug, section);
      }
      return moduleDtoById(tx, id);
    });
    return created(c, dto);
  });

  // Atualiza dados do módulo (o slug nunca muda). Trancado → liberado dispara NEW_CONTENT.
  app.put('/api/admin/modules/:id', async (c) => {
    const id = uuidParam(c, 'id');
    const input = readModuleInput(await readBody(c));
    const user = me(c);
    const dto = await transaction(async (tx) => {
      const course = await requireCourse(tx, id, true);
      const section = await sectionForInput(tx, input.sectionId);
      const wasLocked = course.locked;
      let sectionId = course.section_id;
      let sortOrder = course.sort_order;
      if (section.id !== course.section_id) {
        sectionId = section.id;
        if (input.sortOrder === undefined) {
          sortOrder = (await maxSortOrderInSection(tx, section.id)) + 1;
        }
      }
      const title = input.title.trim();
      const description = trimToNull(input.description);
      const author = trimToNull(input.author);
      const locked = input.locked !== undefined ? input.locked : course.locked;
      if (input.sortOrder !== undefined) {
        sortOrder = input.sortOrder;
      }
      const dirty =
        sectionId !== course.section_id ||
        sortOrder !== course.sort_order ||
        title !== course.title ||
        description !== course.description ||
        author !== course.author ||
        locked !== course.locked;
      if (dirty) {
        await tx`
          UPDATE courses SET section_id = ${sectionId}, sort_order = ${sortOrder}, title = ${title},
                 description = ${description}, author = ${author}, locked = ${locked}, updated_at = ${now()}
          WHERE id = ${id}`;
      }
      if (wasLocked && !locked) {
        await notifyModuleReleased(tx, user.id, title, course.slug, section);
      }
      return moduleDtoById(tx, id);
    });
    return c.json(dto);
  });

  app.patch('/api/admin/modules/:id/lock', async (c) => {
    const id = uuidParam(c, 'id');
    const body = await readBody(c);
    const locked = optBoolean(body, 'locked');
    new Check().notNull('locked', locked, 'Informe se o módulo está trancado.').done();
    const user = me(c);
    const dto = await transaction(async (tx) => {
      const course = await requireCourse(tx, id, true);
      const wasLocked = course.locked;
      if (locked !== course.locked) {
        await tx`UPDATE courses SET locked = ${locked!}, updated_at = ${now()} WHERE id = ${id}`;
      }
      if (wasLocked && !locked) {
        const rows = await tx<SectionRow[]>`
          SELECT id, title, subtitle, sort_order FROM sections WHERE id = ${course.section_id}`;
        await notifyModuleReleased(tx, user.id, course.title, course.slug, rows[0] ?? null);
      }
      return moduleDtoById(tx, id);
    });
    return c.json(dto);
  });

  app.post('/api/admin/modules/:id/cover', async (c) => {
    const form = await readForm(c);
    const id = uuidParam(c, 'id');
    const file = filePart(form);
    const dto = await transaction(async (tx) => {
      const course = await requireCourse(tx, id, true);
      requireNonEmpty(file);
      const stored = await storeImage(tx, file, 'covers', COVER_MAX_BYTES, 'A capa deve ter no máximo 10 MB.');
      await deleteFile(tx, course.cover_path);
      await tx`UPDATE courses SET cover_path = ${stored.path}, updated_at = ${now()} WHERE id = ${id}`;
      return moduleDtoById(tx, id);
    });
    return c.json(dto);
  });

  app.delete('/api/admin/modules/:id/cover', async (c) => {
    const id = uuidParam(c, 'id');
    const dto = await transaction(async (tx) => {
      const course = await requireCourse(tx, id, true);
      if (course.cover_path != null) {
        await deleteFile(tx, course.cover_path);
        await tx`UPDATE courses SET cover_path = NULL, updated_at = ${now()} WHERE id = ${id}`;
      }
      return moduleDtoById(tx, id);
    });
    return c.json(dto);
  });

  // Apaga módulo, aulas, progresso, materiais, comentários e prova (CASCADE); certificados continuam válidos.
  app.delete('/api/admin/modules/:id', async (c) => {
    const id = uuidParam(c, 'id');
    await transaction(async (tx) => {
      const course = await requireCourse(tx, id, true);
      const paths = await tx<{ file_path: string }[]>`
        SELECT m.file_path FROM lesson_materials m JOIN lessons l ON l.id = m.lesson_id WHERE l.course_id = ${id}`;
      await deleteFiles(tx, [...paths.map((p) => p.file_path), course.cover_path]);
      await tx`DELETE FROM courses WHERE id = ${id}`;
    });
    return noContent(c);
  });

  // ---------------------------------------------------------------- aulas

  // Mais específica antes de /api/admin/modules/:moduleId/lessons.
  app.put('/api/admin/modules/:moduleId/lessons/order', async (c) => {
    const moduleId = uuidParam(c, 'moduleId');
    const body = await readBody(c);
    const raw = body.lessonIds;
    if (raw === undefined || raw === null) {
      new Check().fail('lessonIds', 'Envie a nova ordem das aulas.').done();
    }
    if (!Array.isArray(raw)) throw badRequest(INVALID_BODY);
    const lessonIds: (string | null)[] = raw.map((v) => {
      if (v === null) return null;
      if (typeof v === 'string' && isUuid(v)) return v.toLowerCase();
      throw badRequest(INVALID_BODY);
    });

    await transaction(async (tx) => {
      await requireCourse(tx, moduleId, true);
      const current = await tx<{ id: string; position: number }[]>`
        SELECT id, position FROM lessons WHERE course_id = ${moduleId} ORDER BY position ASC`;
      const currentIds = new Set(current.map((l) => l.id));
      const given = new Set(lessonIds);
      const sameSet = given.size === currentIds.size && [...given].every((x) => x != null && currentIds.has(x));
      if (lessonIds.length !== current.length || !sameSet) {
        throw badRequest('A lista de aulas não corresponde às aulas do módulo.');
      }
      const positionById = new Map(current.map((l) => [l.id, l.position]));
      const changedIds: string[] = [];
      const changedPositions: number[] = [];
      lessonIds.forEach((lessonId, i) => {
        if (positionById.get(lessonId!) !== i + 1) {
          changedIds.push(lessonId!);
          changedPositions.push(i + 1);
        }
      });
      if (changedIds.length > 0) {
        await tx`
          UPDATE lessons l SET position = v.pos, updated_at = ${now()}
          FROM unnest(${tx.array(changedIds)}::uuid[], ${tx.array(changedPositions)}::int[]) AS v(id, pos)
          WHERE l.id = v.id`;
      }
    });
    return noContent(c);
  });

  app.post('/api/admin/modules/:moduleId/lessons', async (c) => {
    const moduleId = uuidParam(c, 'moduleId');
    const input = readLessonInput(await readBody(c));
    const lesson = await transaction(async (tx) => {
      const course = await requireCourse(tx, moduleId, true);
      const [m] = await tx<{ m: number }[]>`
        SELECT coalesce(max(position), 0) AS m FROM lessons WHERE course_id = ${course.id}`;
      const values = lessonValues(input);
      const t = now();
      const [row] = await tx<LessonRow[]>`
        INSERT INTO lessons (id, course_id, position, title, description, video_url, duration_seconds, created_at, updated_at)
        VALUES (${newId()}, ${course.id}, ${m.m + 1}, ${values.title}, ${values.description}, ${values.video_url},
                ${values.duration_seconds}, ${t}, ${t})
        RETURNING id, course_id, position, title, description, video_url, duration_seconds`;
      return row;
    });
    // Aula nova: sem materiais nem progresso.
    const [dto] = await lessonDtos(db(), [lesson], me(c).id);
    return created(c, dto);
  });

  app.put('/api/admin/lessons/:id', async (c) => {
    const id = uuidParam(c, 'id');
    const input = readLessonInput(await readBody(c));
    const user = me(c);
    const dto = await transaction(async (tx) => {
      const lesson = await requireLesson(tx, id);
      const values = lessonValues(input);
      const dirty =
        values.title !== lesson.title ||
        values.description !== lesson.description ||
        values.video_url !== lesson.video_url ||
        values.duration_seconds !== lesson.duration_seconds;
      let row = lesson;
      if (dirty) {
        [row] = await tx<LessonRow[]>`
          UPDATE lessons SET title = ${values.title}, description = ${values.description},
                 video_url = ${values.video_url}, duration_seconds = ${values.duration_seconds}, updated_at = ${now()}
          WHERE id = ${id}
          RETURNING id, course_id, position, title, description, video_url, duration_seconds`;
      }
      const [out] = await lessonDtos(tx, [row], user.id);
      return out;
    });
    return c.json(dto);
  });

  app.delete('/api/admin/lessons/:id', async (c) => {
    const id = uuidParam(c, 'id');
    await transaction(async (tx) => {
      const lesson = await requireLesson(tx, id);
      const paths = await tx<{ file_path: string }[]>`SELECT file_path FROM lesson_materials WHERE lesson_id = ${id}`;
      await deleteFiles(tx, paths.map((p) => p.file_path));
      await tx`DELETE FROM lessons WHERE id = ${id}`;
      // Renumera 1..n para não deixar buracos.
      await tx`
        UPDATE lessons l SET position = r.rn, updated_at = ${now()}
        FROM (SELECT id, row_number() OVER (ORDER BY position ASC) AS rn FROM lessons WHERE course_id = ${lesson.course_id}) r
        WHERE l.id = r.id AND l.position <> r.rn`;
    });
    return noContent(c);
  });

  // ---------------------------------------------------------------- materiais

  app.post('/api/admin/lessons/:lessonId/materials', async (c) => {
    const form = await readForm(c);
    const lessonId = uuidParam(c, 'lessonId');
    const file = filePart(form);
    // @RequestParam: a query string vem antes dos campos do formulário.
    const label = c.req.query('label') ?? (typeof form.label === 'string' ? form.label : undefined);
    const material = await transaction(async (tx) => {
      await requireLesson(tx, lessonId);
      requireNonEmpty(file);
      const stored = await storeMaterial(tx, file, MATERIAL_MAX_BYTES, 'O material deve ter no máximo 50 MB.');
      let finalLabel = trimToNull(label) ?? trimToNull(stored.originalFilename) ?? 'Material';
      if (finalLabel.length > 255) {
        finalLabel = finalLabel.substring(0, 255);
      }
      const [row] = await tx<MaterialRow[]>`
        INSERT INTO lesson_materials (id, lesson_id, label, file_path, size_bytes, content_type, created_at)
        VALUES (${newId()}, ${lessonId}, ${finalLabel}, ${stored.path}, ${stored.sizeBytes}, ${stored.contentType}, ${now()})
        RETURNING id, lesson_id, label, file_path, size_bytes, content_type`;
      return row;
    });
    return created(c, materialDto(material));
  });

  app.delete('/api/admin/materials/:id', async (c) => {
    const id = uuidParam(c, 'id');
    await transaction(async (tx) => {
      const rows = await tx<{ file_path: string }[]>`SELECT file_path FROM lesson_materials WHERE id = ${id}`;
      if (rows.length === 0) throw notFound('Material não encontrado.');
      await deleteFile(tx, rows[0].file_path);
      await tx`DELETE FROM lesson_materials WHERE id = ${id}`;
    });
    return noContent(c);
  });

  // ---------------------------------------------------------------- prova

  // Substitui todas as perguntas da prova do módulo (lista vazia remove a prova).
  app.put('/api/admin/modules/:moduleId/quiz', async (c) => {
    const moduleId = uuidParam(c, 'moduleId');
    const input = readQuizInput(await readBody(c));
    const result = await transaction(async (tx) => {
      const course = await requireCourse(tx, moduleId, true);
      if (input.length > MAX_QUIZ_QUESTIONS) {
        throw badRequest('A prova pode ter no máximo 50 perguntas.');
      }
      const toSave = input.map((q, i) => {
        const prefix = `Pergunta ${i + 1}: `;
        if (q == null) throw badRequest(prefix + 'dados inválidos.');
        const text = trimToNull(q.text);
        if (text == null) throw badRequest(prefix + 'escreva o enunciado.');
        if (text.length > 1000) throw badRequest(prefix + 'o enunciado pode ter no máximo 1000 caracteres.');
        const options = q.options == null ? [] : q.options.map((o) => (o == null ? '' : o.trim()));
        if (options.length < 2 || options.length > 6) throw badRequest(prefix + 'informe de 2 a 6 alternativas.');
        if (options.some((o) => o === '')) throw badRequest(prefix + 'preencha todas as alternativas.');
        if (options.some((o) => o.length > 300)) {
          throw badRequest(prefix + 'cada alternativa pode ter no máximo 300 caracteres.');
        }
        if (q.correctIndex == null || q.correctIndex < 0 || q.correctIndex >= options.length) {
          throw badRequest(prefix + 'marque a alternativa correta.');
        }
        return {
          id: newId(),
          course_id: course.id,
          position: i + 1,
          question_text: text,
          options_json: JSON.stringify(options),
          correct_index: q.correctIndex,
        };
      });
      await tx`DELETE FROM quiz_questions WHERE course_id = ${course.id}`;
      if (toSave.length > 0) {
        await tx`INSERT INTO quiz_questions ${tx(toSave)}`;
      }
      return toSave.map((q) => quizDto(q));
    });
    return c.json(result);
  });
}
