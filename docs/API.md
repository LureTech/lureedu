# LURE Growth — Contrato da API (v1)

Backend: **Java 21 + Spring Boot 3.5** · Frontend: **Angular 22** · Banco: **H2 (dev) / PostgreSQL (prod)**

Este documento é a fonte da verdade entre backend e frontend. Qualquer mudança de contrato deve ser feita aqui primeiro.

---

## Convenções

- Base: `/api`. JSON em **camelCase**. Datas em ISO-8601 UTC (`2026-09-22T12:00:00Z`).
- IDs: UUID (string) para todas as entidades, exceto **seções**, cujo `id` é um slug (`intro`, `social`, …).
- Autenticação: `Authorization: Bearer <accessToken>` em todas as rotas, exceto as marcadas como **público**.
- Arquivos enviados são servidos publicamente em `/files/**` (ex.: `/files/avatars/9f2c….webp`). As URLs vêm **relativas** nas respostas (`/files/...`). Em dev o Angular faz proxy de `/api` e `/files` para `http://localhost:8085` (porta padrão do backend — a 8080 costuma estar ocupada por outros apps de dev); em produção o nginx faz o mesmo.
- Erro padrão (qualquer status ≥ 400):

```json
{ "status": 400, "error": "Bad Request", "message": "Mensagem legível em PT-BR", "fields": { "email": "E-mail inválido" } }
```

`fields` só aparece em erros de validação. `message` sempre existe e deve ser exibida ao usuário.

- Códigos usados: 400 validação/regra, 401 não autenticado/token inválido, 403 sem permissão ou conta bloqueada, 404 não encontrado, 409 conflito (duplicado/estado inválido), 413 arquivo grande demais, 429 limite de uso.
- Sucesso: `POST` que **cria** um recurso (usuário, seção, módulo, aula, material, post, comentário, diagnóstico) responde **201** com o corpo indicado; demais respostas com corpo são 200; as marcadas "204" não têm corpo.

---

## Tipos compartilhados

```ts
type Role = 'ADMIN' | 'MEMBER';

interface UserDto { id: string; email: string; fullName: string | null; avatarUrl: string | null;
  role: Role; active: boolean; createdAt: string; lastLoginAt: string | null; }

interface AuthorDto { id: string; fullName: string; avatarUrl: string | null; }   // fullName nunca vazio (fallback: parte antes do @)

interface SectionDto { id: string; title: string; subtitle: string; sortOrder: number; }

interface ModuleCardDto {            // card de módulo (curso) no catálogo
  id: string; slug: string; sectionId: string; title: string; author: string | null;
  coverUrl: string | null; locked: boolean;           // locked = "Em gravação" (membros veem como "Em breve", sem acesso)
  lessonCount: number; completedLessons: number; progress: number;   // progress 0–100 do usuário atual
}

interface MaterialDto { id: string; label: string; url: string; sizeBytes: number; contentType: string | null; }

interface LessonDto { id: string; position: number; title: string; description: string | null;
  videoUrl: string | null; durationSeconds: number | null;
  completed: boolean; lastPosition: number; watchedSeconds: number;   // do usuário atual
  materials: MaterialDto[]; }

interface CertificateDto { id: string; code: string; studentName: string; moduleTitle: string; sectionTitle: string;
  author: string | null; lessonCount: number; issuedAt: string; moduleSlug: string | null; }

interface CommentDto { id: string; body: string; createdAt: string; author: AuthorDto; canDelete: boolean; }
```

---

## 1. Autenticação

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/api/auth/login` **público** | `{ email, password, rememberMe }` | `AuthResponse` |
| POST | `/api/auth/refresh` **público** | `{ refreshToken }` | `AuthResponse` (rotação: o refresh antigo é revogado) |
| POST | `/api/auth/logout` **público** | `{ refreshToken }` | 204 |
| GET | `/api/auth/me` | — | `UserDto` |
| POST | `/api/auth/forgot-password` **público** | `{ email }` | 204 sempre (não revela se o e-mail existe) |
| POST | `/api/auth/reset-password` **público** | `{ token, newPassword }` | 204 · 400 token inválido/expirado |

```ts
interface AuthResponse { accessToken: string; refreshToken: string; expiresIn: number /* segundos */; user: UserDto; }
```

Regras:
- Access token (JWT HS256) vale **15 min**. Refresh token (opaco, guardado com hash no banco) vale **30 dias** se `rememberMe`, senão **12 h**.
- Login errado → 401 `"E-mail ou senha incorretos."`. Conta bloqueada → 403 `"Sua conta está sem acesso no momento. Fale com o administrador para liberar."`.
- 5 falhas seguidas para o mesmo e-mail em 15 min → 429 `"Muitas tentativas. Aguarde alguns minutos e tente de novo."`.
- Usuário bloqueado: refresh retorna 403 e qualquer requisição autenticada retorna 403 com a mesma mensagem.
- `forgot-password` gera token de 1 h e envia e-mail com link `{APP_FRONTEND_URL}/redefinir-senha?token=...` (se SMTP não estiver configurado, o link é escrito no log do servidor).
- `newPassword`: mínimo 8 caracteres. Redefinir senha revoga todos os refresh tokens do usuário.

Frontend: guarda os tokens em `localStorage` se `rememberMe`, senão em `sessionStorage`; o interceptor tenta `refresh` uma vez ao receber 401 e repete a requisição.

---

## 2. Perfil (usuário logado)

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| PUT | `/api/me` | `{ fullName }` (≤ 80) | `UserDto` |
| POST | `/api/me/avatar` | multipart `file` (jpeg/png/webp, ≤ 5 MB) | `UserDto` |
| DELETE | `/api/me/avatar` | — | `UserDto` |
| PUT | `/api/me/password` | `{ currentPassword, newPassword }` | 204 · 400 `"Senha atual incorreta."` |
| GET | `/api/me/notification-prefs` | — | `NotificationPrefsDto` |
| PUT | `/api/me/notification-prefs` | `NotificationPrefsDto` | `NotificationPrefsDto` |

```ts
interface NotificationPrefsDto { community: boolean; replies: boolean; newContent: boolean; }  // padrão: todos true
```

---

## 3. Catálogo e progresso

| Método | Rota | Resposta |
|---|---|---|
| GET | `/api/catalog` | `CatalogSectionDto[]` — todas as seções (ordem `sortOrder`) com seus módulos (ordem `sortOrder`, depois `createdAt`). Seções sem módulos são omitidas. |
| GET | `/api/sections` | `SectionDto[]` |
| GET | `/api/sections/{id}` | `CatalogSectionDto` (página "Ver todos") · 404 |
| GET | `/api/progress/summary` | `ProgressSummaryDto` |
| GET | `/api/search?q=` | `SearchResultDto` (q com ≥ 2 caracteres — menos que isso devolve listas vazias; busca sem acento e sem diferenciar maiúsculas; até 8 de cada) |

```ts
interface CatalogSectionDto { section: SectionDto; modules: ModuleCardDto[]; }

interface ProgressSummaryDto {
  totalLessons: number; completedLessons: number; percent: number;   // só módulos liberados
  inProgress: ModuleCardDto[];   // 0 < progress < 100
  completed: ModuleCardDto[];    // progress = 100
  continueWatching: { moduleSlug: string; moduleTitle: string; coverUrl: string | null;
                      lessonId: string; lessonTitle: string; lessonPosition: number; lastPosition: number } | null;
}

interface SearchResultDto {
  modules: { slug: string; title: string; sectionTitle: string; coverUrl: string | null; locked: boolean }[];
  lessons: { moduleSlug: string; moduleTitle: string; lessonId: string; lessonTitle: string; position: number }[];
}
```

Membros **não** recebem módulos trancados na busca; no catálogo recebem com `locked: true` (cartão "Em breve", sem link).

---

## 4. Módulo (curso), aulas, comentários

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/api/modules/{slug}` | — | `ModuleDetailDto` · 403 se trancado e não-admin · 404 |
| PUT | `/api/lessons/{lessonId}/progress` | `{ completed?, watchedSeconds?, lastPosition? }` | `ProgressUpdateDto` |
| POST | `/api/lessons/{lessonId}/duration` | `{ durationSeconds }` | 204 (só grava se a aula ainda não tem duração; admins sempre podem sobrescrever) |
| GET | `/api/modules/{slug}/comments` | — | `CommentDto[]` (mais novos primeiro) |
| POST | `/api/modules/{slug}/comments` | `{ body }` (1–1000) | `CommentDto` |
| DELETE | `/api/module-comments/{id}` | — | 204 (autor ou admin) |

```ts
interface ModuleDetailDto {
  id: string; slug: string; sectionId: string; sectionTitle: string; title: string; description: string | null;
  author: string | null; coverUrl: string | null; locked: boolean;
  lessons: LessonDto[];                 // ordem por position
  progress: number; completedLessons: number;
  quiz: { questionCount: number; unlocked: boolean; passed: boolean; bestScore: number | null; attempts: number };
  certificate: CertificateDto | null;   // se já emitido para o usuário
}

interface ProgressUpdateDto {
  lessonId: string; completed: boolean; watchedSeconds: number; lastPosition: number;
  moduleProgress: number; completedLessons: number;
  certificate: CertificateDto | null;   // preenchido quando ESTA chamada emitiu o certificado
}
```

Regras de progresso: `watchedSeconds` e `lastPosition` são inteiros ≥ 0; campos ausentes não mudam. `watchedSeconds` nunca diminui.

**Certificado** é emitido automaticamente quando: todas as aulas do módulo (≥ 1) estão concluídas **e** (o módulo não tem prova **ou** o aluno já passou na prova). Um por aluno por módulo. Código `LURE-XXXXX-XXXXX` único. Guarda nome do aluno/título no momento da emissão.

---

## 5. Prova final (quiz)

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/api/modules/{slug}/quiz` | — | `QuizDto` |
| POST | `/api/modules/{slug}/quiz/attempts` | `{ answers: { [questionId]: optionIndex } }` | `QuizResultDto` · 409 se a prova ainda não está liberada |

```ts
interface QuizDto { unlocked: boolean; passingScore: number /* 70 */; attempts: number; bestScore: number | null; passed: boolean;
  questions: { id: string; text: string; options: string[] }[];   // vazio se !unlocked (não revela perguntas antes)
}
interface QuizResultDto { score: number /* 0–100 */; correct: number; total: number; passed: boolean;
  results: { questionId: string; correct: boolean; correctIndex: number }[];
  certificate: CertificateDto | null; }
```

A prova é liberada quando todas as aulas estão concluídas.

---

## 6. Certificados

| Método | Rota | Resposta |
|---|---|---|
| GET | `/api/certificates` | `CertificateDto[]` do usuário |
| GET | `/api/public/certificates/{code}` **público** | `CertificateDto` · 404 — usada pela página de verificação `/certificado/{code}` |

---

## 7. Comunidade

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/api/community/posts?category=&before=&limit=20` | — | `PostDto[]` (mais novos primeiro; `before` = `createdAt` do último da página) |
| GET | `/api/community/posts/new-count?since=&category=` | — | `{ count }` posts de outras pessoas criados depois de `since` |
| POST | `/api/community/posts` | multipart: `body`, `category`, `image?`, `imageWidth?`, `imageHeight?` | `PostDto` |
| DELETE | `/api/community/posts/{id}` | — | 204 (autor ou admin) |
| POST | `/api/community/posts/{id}/like` | — | `{ liked: true, likesCount }` |
| DELETE | `/api/community/posts/{id}/like` | — | `{ liked: false, likesCount }` |
| GET | `/api/community/posts/{id}/comments` | — | `CommentDto[]` (mais antigos primeiro) |
| POST | `/api/community/posts/{id}/comments` | `{ body }` (1–300) | `CommentDto` |
| DELETE | `/api/community/comments/{id}` | — | 204 (autor do comentário, autor do post ou admin) |
| GET | `/api/community/stats` | — | `CommunityStatsDto` |

```ts
type Category = 'Conquista' | 'Dúvida' | 'Networking' | 'Case' | 'Insight';

interface PostDto { id: string; category: Category; body: string; imageUrl: string | null;
  imageWidth: number | null; imageHeight: number | null; likesCount: number; commentsCount: number;
  likedByMe: boolean; createdAt: string; author: AuthorDto; canDelete: boolean; }

interface CommunityStatsDto { members: number; postsToday: number; postsTotal: number;
  myPosts24h: number; remainingToday: number; tags: { tag: string; n: number }[] /* top 6 hashtags dos últimos 30 dias */; }
```

Regras (validadas no servidor):
- `body` ≤ 500 caracteres; precisa ter texto **ou** imagem → 400 `"Escreva alguma coisa ou anexe uma imagem."`.
- Imagem: jpeg/png/webp, ≤ 2 MB (o front comprime antes de enviar; GIF recusado).
- Máx. **10 posts por 24 h** → 429 `"Você atingiu o limite de 10 publicações por dia."`; **30 s** entre posts → 429 `"Aguarde alguns segundos antes de publicar de novo."`.
- Nome e foto do autor vêm sempre do perfil atual (não ficam desatualizados).

---

## 8. Notificações (in-app)

| Método | Rota | Resposta |
|---|---|---|
| GET | `/api/notifications?limit=20` | `{ items: NotificationDto[], unread: number }` |
| POST | `/api/notifications/{id}/read` | 204 |
| POST | `/api/notifications/read-all` | 204 |

```ts
interface NotificationDto { id: string; type: 'LIKE' | 'COMMENT' | 'NEW_CONTENT' | 'COMMUNITY' | 'SYSTEM';
  title: string; body: string | null; link: string | null /* rota do front, ex.: /comunidade */; read: boolean; createdAt: string; }
```

Geradas pelo servidor: curtida/comentário em post seu (pref `replies`, nunca para si mesmo); módulo liberado (trancado → liberado, ou criado já liberado) para todos os membros ativos (pref `newContent`, link `/curso/{slug}`); post publicado por um admin na comunidade (pref `community`).

---

## 9. Diagnóstico de maturidade

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/api/diagnostic/pillars` | — | `PillarDto[]` (6 pilares × 7 perguntas × 5 opções) |
| POST | `/api/diagnostic/submissions` | `{ answers: { "1.1": 3, … } }` (todas as 42, valores 1–5) | `DiagnosticResultDto` |
| GET | `/api/diagnostic/submissions` | — | `{ id, createdAt, overall, overallLabel }[]` (mais novos primeiro) |
| GET | `/api/diagnostic/submissions/latest` | — | `DiagnosticResultDto` · 204 se nunca fez |
| GET | `/api/diagnostic/submissions/{id}` | — | `DiagnosticResultDto` (só o dono ou admin) |

```ts
interface PillarDto { id: string; name: string; questions: { id: string; text: string; options: { score: number; label: string; text: string }[] }[]; }

type Tone = 'critical' | 'stable' | 'excellent';   // < 3 Crítico · < 4.2 Estável · senão Excelente
interface DiagnosticResultDto {
  id: string; createdAt: string; overall: number; overallLabel: string; overallTone: Tone;
  pillars: { id: string; name: string; avg: number; label: string; tone: Tone }[];
  strengths: string[];      // ids dos 2 pilares com maior média
  weaknesses: string[];     // ids dos 2 pilares com menor média
  plan: { pillarId: string; name: string; actions: string[]; sections: { id: string; title: string }[] }[];  // para os 2 mais fracos
  answers: Record<string, number>;
}
```

Seções recomendadas por pilar: gestao → intro, comercial · cultura → rh · marketing → marketing, trafego, conteudo · vendas → call, social, comercial · experiencia → comercial · ia → ia.

---

## 10. Administração (somente `ADMIN`; demais recebem 403)

### Visão geral e contas

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/api/admin/stats` | — | `AdminStatsDto` |
| GET | `/api/admin/users?q=` | — | `UserDto[]` (admins primeiro, depois por `createdAt`) |
| POST | `/api/admin/users` | `{ email, password, fullName?, role }` | `UserDto` · 409 `"Já existe uma conta com esse e-mail."` |
| POST | `/api/admin/users/{id}/avatar` | multipart `file` | `UserDto` |
| PATCH | `/api/admin/users/{id}` | `{ fullName?, role?, active? }` | `UserDto` · 400 ao tentar mudar o próprio `role`/`active` |
| POST | `/api/admin/users/{id}/reset-password` | `{ newPassword }` | 204 (revoga sessões dele) |

```ts
interface AdminStatsDto { users: number; activeUsers: number; admins: number; modules: number; lessons: number;
  lessonsCompleted: number; certificates: number; postsTotal: number; postsToday: number; diagnostics: number; }
```

### Seções

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/api/admin/sections` | `{ id?, title, subtitle }` (id gerado do título se vazio) | `SectionDto` |
| PUT | `/api/admin/sections/{id}` | `{ title, subtitle, sortOrder }` | `SectionDto` |
| DELETE | `/api/admin/sections/{id}` | — | 204 · 409 se tiver módulos |

### Módulos

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/api/admin/modules` | — | `AdminModuleDto[]` |
| GET | `/api/admin/modules/{id}` | — | `AdminModuleDetailDto` |
| POST | `/api/admin/modules` | `ModuleInput` | `AdminModuleDto` (slug gerado do título, único) |
| PUT | `/api/admin/modules/{id}` | `ModuleInput` + `sortOrder` | `AdminModuleDto` (slug não muda) |
| PATCH | `/api/admin/modules/{id}/lock` | `{ locked }` | `AdminModuleDto` (liberar dispara notificação `NEW_CONTENT`) |
| POST | `/api/admin/modules/{id}/cover` | multipart `file` (imagem ≤ 10 MB) | `AdminModuleDto` |
| DELETE | `/api/admin/modules/{id}/cover` | — | `AdminModuleDto` |
| DELETE | `/api/admin/modules/{id}` | — | 204 (apaga aulas, progresso, materiais, comentários e prova; certificados emitidos continuam válidos) |

```ts
interface ModuleInput { sectionId: string; title: string; description?: string | null; author?: string | null; locked: boolean; }
interface AdminModuleDto { id: string; slug: string; sectionId: string; sectionTitle: string; title: string; description: string | null;
  author: string | null; coverUrl: string | null; locked: boolean; sortOrder: number; lessonCount: number;
  lessonsWithVideo: number; quizQuestionCount: number; createdAt: string; }
interface AdminModuleDetailDto extends AdminModuleDto { lessons: LessonDto[]; quiz: AdminQuizQuestionDto[]; }
interface AdminQuizQuestionDto { id: string; text: string; options: string[]; correctIndex: number; }
```

### Aulas, materiais e prova

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/api/admin/modules/{moduleId}/lessons` | `LessonInput` | `LessonDto` (vai para o fim) |
| PUT | `/api/admin/lessons/{id}` | `LessonInput` | `LessonDto` |
| DELETE | `/api/admin/lessons/{id}` | — | 204 |
| PUT | `/api/admin/modules/{moduleId}/lessons/order` | `{ lessonIds: string[] }` | 204 |
| POST | `/api/admin/lessons/{lessonId}/materials` | multipart `file` (≤ 50 MB), `label?` | `MaterialDto` |
| DELETE | `/api/admin/materials/{id}` | — | 204 |
| PUT | `/api/admin/modules/{moduleId}/quiz` | `{ questions: { text, options: string[] /* 2–6 */, correctIndex }[] }` | `AdminQuizQuestionDto[]` (substitui tudo) |

```ts
interface LessonInput { title: string; description?: string | null; videoUrl?: string | null; durationSeconds?: number | null; }
```

`videoUrl` aceita:
- **YouTube** — ID de 11 caracteres, `youtu.be/…`, `youtube.com/watch?v=…`, `/embed/…`, `/shorts/…`, `/live/…`; gravado normalizado como `https://www.youtube.com/watch?v={id}`.
- **Arquivo direto** — `https://…/arquivo.mp4` (ou `.m4v`, `.webm`, `.mov`), até 1000 caracteres; gravado como veio. O arquivo fica fora do banco (ex.: Cloudflare R2); o banco guarda só o link.

Inválido → 400 `"Link de vídeo inválido. Use um link do YouTube ou um link direto terminando em .mp4."`. Vazio/`null` = aula sem vídeo.

---

## 11. Arquivos

`GET /files/{pasta}/{arquivo}` **público**. Pastas: `avatars`, `covers`, `community`, `materials`. Nomes aleatórios (UUID). Materiais guardam o nome original no `label`.
