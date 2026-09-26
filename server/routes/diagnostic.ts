import { db, newId, now, type Db } from '../lib/db.js';
import { badRequest, forbidden, Messages, notFound } from '../lib/errors.js';
import { Check, INVALID_BODY, created, isAdmin, me, noContent, readJson, uuidParam, type App } from '../lib/http.js';
import { PILLARS, QUESTION_IDS, type Pillar } from '../lib/pillars.js';

/**
 * Diagnóstico de maturidade: médias por pilar, nota geral, forças/fraquezas e plano de ação.
 * Faixas: < 3 Crítico · < 4.2 Estável · senão Excelente (calculadas sobre a média sem arredondar).
 */

const INVALID_ANSWERS = 'Responda todas as 42 perguntas com notas de 1 a 5.';

type Answers = Record<string, number>;

interface SubmissionRow {
  id: string;
  user_id: string;
  answers_json: string;
  overall: number;
  overall_label: string;
  created_at: Date;
}

interface PillarResultDto {
  id: string;
  name: string;
  avg: number;
  label: string;
  tone: string;
}

interface Computed {
  overall: number;
  overallLabel: string;
  overallTone: string;
  pillars: PillarResultDto[];
  strengths: string[];
  weaknesses: string[];
  weakestPillars: Pillar[];
}

function band(avg: number): { label: string; tone: string } {
  if (avg < 3) return { label: 'Crítico', tone: 'critical' };
  return avg < 4.2 ? { label: 'Estável', tone: 'stable' } : { label: 'Excelente', tone: 'excellent' };
}

/** Igual a BigDecimal.valueOf(v).setScale(2, HALF_UP): arredonda a representação decimal mais curta. */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return value;
  const neg = value < 0;
  // Mesma representação mais curta do Double.toString (Java 19+)
  const s = String(Math.abs(value));
  if (s.includes('e')) return Math.round(value * 100) / 100;
  const [int, frac = ''] = s.split('.');
  let digits = int + (frac + '000').substring(0, 3);
  // HALF_UP no terceiro decimal
  const third = Number(digits[digits.length - 1]);
  digits = digits.substring(0, digits.length - 1);
  let n = BigInt(digits);
  if (third >= 5) n += 1n;
  const result = Number(n) / 100;
  return neg ? -result : result;
}

/** Média com soma compensada (Kahan), igual ao DoubleStream.average() do Java 21. */
function javaAverage(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  let comp = 0;
  for (const v of values) {
    const tmp = v - comp;
    const velvel = sum + tmp;
    comp = velvel - sum - tmp;
    sum = velvel;
  }
  return (sum - comp) / values.length;
}

/** Converte o valor como o Jackson faria para Integer (null, número, texto numérico). */
function jacksonInteger(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') {
    const n = Math.trunc(v);
    if (!Number.isFinite(n) || Math.abs(n) > 2_147_483_647) throw badRequest(INVALID_BODY);
    return n;
  }
  if (typeof v === 'string') {
    if (v === '') return null;
    if (!/^[+-]?\d+$/.test(v)) throw badRequest(INVALID_BODY);
    const n = Number(v);
    if (Math.abs(n) > 2_147_483_647) throw badRequest(INVALID_BODY);
    return n;
  }
  throw badRequest(INVALID_BODY);
}

/** Exige exatamente as 42 perguntas, notas inteiras de 1 a 5; devolve na ordem do questionário. */
function validate(raw: Record<string, number | null>): Answers {
  if (Object.keys(raw).length !== QUESTION_IDS.length) {
    throw badRequest(INVALID_ANSWERS);
  }
  const ordered: Answers = {};
  for (const qid of QUESTION_IDS) {
    const value = Object.hasOwn(raw, qid) ? raw[qid] : null;
    if (value == null || value < 1 || value > 5) {
      throw badRequest(INVALID_ANSWERS);
    }
    ordered[qid] = value;
  }
  return ordered;
}

export function compute(answers: Answers): Computed {
  const scores = PILLARS.map((p) => {
    let sum = 0;
    for (const q of p.questions) {
      sum += Object.hasOwn(answers, q.id) ? answers[q.id] : 0;
    }
    return { pillar: p, avg: sum / p.questions.length };
  });
  const overallRaw = javaAverage(scores.map((s) => s.avg));
  const overallBand = band(overallRaw);

  // Uma única ordenação estável (empates mantêm a ordem dos pilares): fortes = 2 primeiros,
  // fracos = 2 últimos. Assim um pilar nunca aparece como forte e fraco ao mesmo tempo.
  const byBest = [...scores].sort((a, b) => b.avg - a.avg);
  const byWorst = [...byBest].reverse();

  const pillars = scores.map((s) => {
    const b = band(s.avg);
    return { id: s.pillar.id, name: s.pillar.name, avg: round2(s.avg), label: b.label, tone: b.tone };
  });
  const weakest = byWorst.slice(0, 2);
  return {
    overall: round2(overallRaw),
    overallLabel: overallBand.label,
    overallTone: overallBand.tone,
    pillars,
    strengths: byBest.slice(0, 2).map((s) => s.pillar.id),
    weaknesses: weakest.map((s) => s.pillar.id),
    weakestPillars: weakest.map((s) => s.pillar),
  };
}

async function toResult(sql: Db, id: string, createdAt: Date, answers: Answers, c: Computed) {
  const sections = await sql<{ id: string; title: string }[]>`SELECT id, title FROM sections`;
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const plan = c.weakestPillars.map((p) => ({
    pillarId: p.id,
    name: p.name,
    actions: p.actions ?? [],
    sections: (p.recommendedSections ?? [])
      .map((sid) => sectionById.get(sid))
      .filter((s) => s !== undefined)
      .map((s) => ({ id: s.id, title: s.title })),
  }));
  return {
    id,
    createdAt,
    overall: c.overall,
    overallLabel: c.overallLabel,
    overallTone: c.overallTone,
    pillars: c.pillars,
    strengths: c.strengths,
    weaknesses: c.weaknesses,
    plan,
    answers,
  };
}

function fromJson(json: string): Answers {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const out: Answers = {};
  for (const [k, v] of Object.entries(parsed)) {
    out[k] = v as number;
  }
  return out;
}

function submissionResult(sql: Db, s: SubmissionRow) {
  const answers = fromJson(s.answers_json);
  return toResult(sql, s.id, s.created_at, answers, compute(answers));
}

export function registerDiagnostic(app: App) {
  app.get('/api/diagnostic/pillars', (c) =>
    c.json(
      PILLARS.map((p) => ({
        id: p.id,
        name: p.name,
        questions: p.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options.map((o) => ({ score: o.score, label: o.label, text: o.text })),
        })),
      })),
    ),
  );

  app.post('/api/diagnostic/submissions', async (c) => {
    const user = me(c);
    const body = await readJson(c);
    const rawAnswers = body.answers;
    let raw: Record<string, number | null> | null = null;
    if (rawAnswers !== undefined && rawAnswers !== null) {
      if (typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) {
        throw badRequest(INVALID_BODY);
      }
      raw = {};
      for (const [k, v] of Object.entries(rawAnswers as Record<string, unknown>)) {
        raw[k] = jacksonInteger(v);
      }
    }
    new Check().notNull('answers', raw, 'Envie as respostas.').done();

    const answers = validate(raw!);
    const computed = compute(answers);
    const sql = db();
    const id = newId();
    const createdAt = now();
    await sql`
      INSERT INTO diagnostic_submissions (id, user_id, answers_json, overall, overall_label, created_at)
      VALUES (${id}, ${user.id}, ${JSON.stringify(answers)}, ${computed.overall}, ${computed.overallLabel}, ${createdAt})`;
    return created(c, await toResult(sql, id, createdAt, answers, computed));
  });

  app.get('/api/diagnostic/submissions', async (c) => {
    const rows = await db()<SubmissionRow[]>`
      SELECT id, created_at, overall, overall_label FROM diagnostic_submissions
      WHERE user_id = ${me(c).id} ORDER BY created_at DESC`;
    return c.json(rows.map((s) => ({ id: s.id, createdAt: s.created_at, overall: s.overall, overallLabel: s.overall_label })));
  });

  /** 204 se o usuário nunca fez o diagnóstico. */
  app.get('/api/diagnostic/submissions/latest', async (c) => {
    const sql = db();
    const rows = await sql<SubmissionRow[]>`
      SELECT * FROM diagnostic_submissions WHERE user_id = ${me(c).id} ORDER BY created_at DESC LIMIT 1`;
    if (rows.length === 0) return noContent(c);
    return c.json(await submissionResult(sql, rows[0]));
  });

  /** Só o dono ou um admin. */
  app.get('/api/diagnostic/submissions/:id', async (c) => {
    const id = uuidParam(c, 'id');
    const user = me(c);
    const sql = db();
    const rows = await sql<SubmissionRow[]>`SELECT * FROM diagnostic_submissions WHERE id = ${id}`;
    if (rows.length === 0) throw notFound('Diagnóstico não encontrado.');
    const s = rows[0];
    if (!isAdmin(user) && s.user_id !== user.id) throw forbidden(Messages.NO_PERMISSION);
    return c.json(await submissionResult(sql, s));
  });
}
