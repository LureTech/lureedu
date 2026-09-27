// Reorganiza o catálogo nas trilhas da LURE (uma vez só). Usa a API de admin do site publicado.
// Uso: npx tsx scripts/organizar-trilhas.mts <url-do-site> <email-admin> <senha-admin>
const [API, EMAIL, PASSWORD] = process.argv.slice(2);
if (!API || !EMAIL || !PASSWORD) throw new Error('Uso: organizar-trilhas.mts <url> <email> <senha>');

const login = await (await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, rememberMe: false }),
})).json();
const auth = { Authorization: `Bearer ${login.accessToken}` };

async function call(method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { ...auth } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers = { ...auth, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const r = await fetch(API + path, init);
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const TRILHAS = [
  { id: 'trilha-vendas', title: 'TRILHA VENDAS', subtitle: 'Do lead ao fechamento: princípios, agendamento, preço, estratégia e objeções' },
  { id: 'trilha-recuperacao', title: 'TRILHA RECUPERAÇÃO DE VENDAS', subtitle: 'Follow-ups: o lugar onde as vendas acontecem' },
  { id: 'trilha-fidelizacao', title: 'TRILHA FIDELIZAÇÃO', subtitle: 'Carteira de clientes, dados, acolhimento e reativação de base' },
  { id: 'trilha-lideranca', title: 'TRILHA LIDERANÇA', subtitle: 'Cultura, rituais de gestão e desenvolvimento do time' },
  { id: 'trilha-processos', title: 'TRILHA PROCESSOS OPERACIONAIS', subtitle: 'Fluxos e gestão à vista para a operação rodar' },
];

// título atual do módulo → [trilha, novo título, autor]
const MODULOS: Record<string, [string, string, string]> = {
  'MODULO 01': ['trilha-vendas', 'MÓDULO 01 — PRINCÍPIOS ESSENCIAIS', 'Anderson'],
  'MODULO 02': ['trilha-vendas', 'MÓDULO 02 — DO LEAD AO AGENDAMENTO', 'Samuel'],
  'MODULO 03': ['trilha-vendas', 'MÓDULO 03 — DO AGENDAMENTO AO COMPARECIMENTO', 'Samuel'],
  'MODULO 04': ['trilha-vendas', 'MÓDULO 04 — QUANTO COBRAR?', 'Samuel'],
  'MODULO 05': ['trilha-vendas', 'MÓDULO 05 — ESTRATÉGIA', 'Samuel e Anderson'],
  'MODULO 06': ['trilha-vendas', 'MÓDULO 06 — QUEBRA DE OBJEÇÕES', 'Anderson'],
  'TRILHA RECUPERAÇÃO DE VENDAS': ['trilha-recuperacao', 'MÓDULO 01 — FOLLOW UPS, O LUGAR DAS VENDAS', 'Samuel'],
  'TRILHA DE FIDELIZAÇÃO': ['trilha-fidelizacao', 'MÓDULO 01 — FIDELIZAÇÃO DE CLIENTES', 'Samuel'],
  'TRILHA LIDERANÇA': ['trilha-lideranca', 'MÓDULO 01 — LIDERANÇA NA PRÁTICA', 'Samuel'],
  'TRILHA PROCESSOS OPERACIONAIS': ['trilha-processos', 'MÓDULO 01 — PROCESSOS OPERACIONAIS', 'Theo'],
};

// correções de digitação nos títulos das aulas
const AULAS: Record<string, string> = {
  'PRINCIPIOS ESSENCIAIS': 'PRINCÍPIOS ESSENCIAIS',
  'PRINCIPIOS': 'PRINCÍPIOS',
  'PARA QUEM TRABALHA COM PERFOMANCE': 'PARA QUEM TRABALHA COM PERFORMANCE',
  'SCRIPTS': 'SCRIPT',
  'aprovação de OS': 'APROVAÇÃO DE OS',
  'FEEDBACK ANÔNIMO': 'FEEDBACK ANÔNIMO 24/7',
  'GESTÃO Á VISTA': 'GESTÃO À VISTA',
};

// 1. trilhas
const existing = new Set((await call('GET', '/api/sections')).map((s: any) => s.id));
for (const t of TRILHAS) {
  if (!existing.has(t.id)) await call('POST', '/api/admin/sections', t);
}
for (let i = 0; i < TRILHAS.length; i++) {
  const t = TRILHAS[i];
  await call('PUT', `/api/admin/sections/${t.id}`, { title: t.title, subtitle: t.subtitle, sortOrder: i + 1 });
}
console.log('trilhas ok');

// 2. módulos com vídeo: mover, renomear, corrigir aulas e pôr capa
const modules = await call('GET', '/api/admin/modules');
const order: Record<string, number> = {};
for (const [oldTitle, [sectionId, title, author]] of Object.entries(MODULOS)) {
  const m = modules.find((x: any) => x.title === oldTitle || x.title === title);
  if (!m) { console.log('  não achei o módulo', oldTitle); continue; }
  const detail = await call('GET', `/api/admin/modules/${m.id}`);
  order[sectionId] = (order[sectionId] ?? 0) + 1;
  await call('PUT', `/api/admin/modules/${m.id}`, {
    sectionId, title, description: detail.description, author, locked: detail.locked, sortOrder: order[sectionId],
  });
  for (const l of detail.lessons) {
    const fixed = AULAS[l.title];
    if (fixed) {
      await call('PUT', `/api/admin/lessons/${l.id}`, {
        title: fixed, description: l.description, videoUrl: l.videoUrl, durationSeconds: l.durationSeconds,
      });
    }
  }
  const first = detail.lessons.find((l: any) => /drive\.google\.com\/file\/d\//.test(l.videoUrl ?? ''));
  if (!detail.coverUrl && first) {
    const id = /\/file\/d\/([^/]+)/.exec(first.videoUrl)![1];
    const img = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w1280`);
    if (img.ok && (img.headers.get('content-type') ?? '').startsWith('image/jpeg')) {
      const fd = new FormData();
      fd.append('file', new Blob([await img.arrayBuffer()], { type: 'image/jpeg' }), 'capa.jpg');
      await call('POST', `/api/admin/modules/${m.id}/cover`, fd);
    } else {
      console.log('  sem miniatura no Drive para', title);
    }
  }
  console.log('  ok', title);
}

// 3. módulos de exemplo (sem nenhum vídeo) e seções antigas vazias
const after = await call('GET', '/api/admin/modules');
const trilhaIds = new Set(TRILHAS.map((t) => t.id));
for (const m of after) {
  if (!trilhaIds.has(m.sectionId) && m.lessonsWithVideo === 0) {
    await call('DELETE', `/api/admin/modules/${m.id}`);
    console.log('  apagado exemplo:', m.title);
  }
}
const remaining = await call('GET', '/api/admin/modules');
for (const s of await call('GET', '/api/sections')) {
  if (!trilhaIds.has(s.id) && !remaining.some((m: any) => m.sectionId === s.id)) {
    await call('DELETE', `/api/admin/sections/${s.id}`);
    console.log('  seção vazia apagada:', s.title);
  }
}
console.log('pronto');
