/**
 * DTOs espelhados de docs/API.md (contrato v1). Mantenha os nomes de campos idênticos.
 */

// ---------------------------------------------------------------- shared
export type Role = 'ADMIN' | 'MEMBER';

export interface UserDto {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** fullName nunca vazio (fallback: parte antes do @) */
export interface AuthorDto {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface SectionDto {
  id: string;
  title: string;
  subtitle: string;
  sortOrder: number;
}

/** Card de módulo (curso) no catálogo */
export interface ModuleCardDto {
  id: string;
  slug: string;
  sectionId: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  /** locked = "Em gravação" (membros veem como "Em breve", sem acesso) */
  locked: boolean;
  lessonCount: number;
  completedLessons: number;
  /** 0–100 do usuário atual */
  progress: number;
}

export interface MaterialDto {
  id: string;
  label: string;
  url: string;
  sizeBytes: number;
  contentType: string | null;
}

export interface LessonDto {
  id: string;
  position: number;
  title: string;
  description: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  completed: boolean;
  lastPosition: number;
  watchedSeconds: number;
  materials: MaterialDto[];
}

export interface CertificateDto {
  id: string;
  code: string;
  studentName: string;
  moduleTitle: string;
  sectionTitle: string;
  author: string | null;
  lessonCount: number;
  issuedAt: string;
  moduleSlug: string | null;
}

export interface CommentDto {
  id: string;
  body: string;
  createdAt: string;
  author: AuthorDto;
  canDelete: boolean;
}

/** Corpo padrão de erro (qualquer status ≥ 400) */
export interface ApiErrorBody {
  status: number;
  error: string;
  message: string;
  fields?: Record<string, string>;
}

// ---------------------------------------------------------------- 1. auth
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  /** segundos */
  expiresIn: number;
  user: UserDto;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ---------------------------------------------------------------- 2. perfil
export interface NotificationPrefsDto {
  community: boolean;
  replies: boolean;
  newContent: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ---------------------------------------------------------------- 3. catálogo e progresso
export interface CatalogSectionDto {
  section: SectionDto;
  modules: ModuleCardDto[];
}

export interface ContinueWatchingDto {
  moduleSlug: string;
  moduleTitle: string;
  coverUrl: string | null;
  lessonId: string;
  lessonTitle: string;
  lessonPosition: number;
  lastPosition: number;
}

export interface ProgressSummaryDto {
  totalLessons: number;
  completedLessons: number;
  percent: number;
  /** 0 < progress < 100 */
  inProgress: ModuleCardDto[];
  /** progress = 100 */
  completed: ModuleCardDto[];
  continueWatching: ContinueWatchingDto | null;
}

export interface SearchModuleHit {
  slug: string;
  title: string;
  sectionTitle: string;
  coverUrl: string | null;
  locked: boolean;
}

export interface SearchLessonHit {
  moduleSlug: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  position: number;
}

export interface SearchResultDto {
  modules: SearchModuleHit[];
  lessons: SearchLessonHit[];
}

// ---------------------------------------------------------------- 4. módulo, aulas, comentários
export interface ModuleQuizSummary {
  questionCount: number;
  unlocked: boolean;
  passed: boolean;
  bestScore: number | null;
  attempts: number;
}

export interface ModuleDetailDto {
  id: string;
  slug: string;
  sectionId: string;
  sectionTitle: string;
  title: string;
  description: string | null;
  author: string | null;
  coverUrl: string | null;
  locked: boolean;
  /** ordem por position */
  lessons: LessonDto[];
  progress: number;
  completedLessons: number;
  quiz: ModuleQuizSummary;
  /** se já emitido para o usuário */
  certificate: CertificateDto | null;
}

export interface ProgressUpdateRequest {
  completed?: boolean;
  watchedSeconds?: number;
  lastPosition?: number;
}

export interface ProgressUpdateDto {
  lessonId: string;
  completed: boolean;
  watchedSeconds: number;
  lastPosition: number;
  moduleProgress: number;
  completedLessons: number;
  /** preenchido quando ESTA chamada emitiu o certificado */
  certificate: CertificateDto | null;
}

// ---------------------------------------------------------------- 5. quiz
export interface QuizQuestionDto {
  id: string;
  text: string;
  options: string[];
}

export interface QuizDto {
  unlocked: boolean;
  /** 70 */
  passingScore: number;
  attempts: number;
  bestScore: number | null;
  passed: boolean;
  /** vazio se !unlocked */
  questions: QuizQuestionDto[];
}

export interface QuizAttemptRequest {
  answers: Record<string, number>;
}

export interface QuizQuestionResult {
  questionId: string;
  correct: boolean;
  correctIndex: number;
}

export interface QuizResultDto {
  /** 0–100 */
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  results: QuizQuestionResult[];
  certificate: CertificateDto | null;
}

// ---------------------------------------------------------------- 7. comunidade
export type Category = 'Conquista' | 'Dúvida' | 'Networking' | 'Case' | 'Insight';
export const CATEGORIES: Category[] = ['Conquista', 'Dúvida', 'Networking', 'Case', 'Insight'];

export interface PostDto {
  id: string;
  category: Category;
  body: string;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: string;
  author: AuthorDto;
  canDelete: boolean;
  /** 2 comentários mais novos (do mais antigo pro mais novo) — prévia da conversa no feed */
  recentComments: CommentDto[];
}

/** recent = cronológico · hot = em alta (engajamento com decaimento por idade) */
export type FeedSort = 'recent' | 'hot';

export interface NewPostsResponse {
  count: number;
  /** até 3 autores das publicações novas (mais recente primeiro) */
  authors: AuthorDto[];
}

export interface VoiceDto {
  author: AuthorDto;
  posts: number;
  comments: number;
}

export interface LikeResponse {
  liked: boolean;
  likesCount: number;
}

export interface TagCount {
  tag: string;
  n: number;
}

export interface CommunityStatsDto {
  members: number;
  postsToday: number;
  postsTotal: number;
  myPosts24h: number;
  remainingToday: number;
  /** top 6 hashtags dos últimos 30 dias */
  tags: TagCount[];
  /** quem mais postou/comentou nos últimos 7 dias */
  topVoices: VoiceDto[];
}

// ---------------------------------------------------------------- 8. notificações
export type NotificationType = 'LIKE' | 'COMMENT' | 'NEW_CONTENT' | 'COMMUNITY' | 'SYSTEM';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** rota do front, ex.: /comunidade */
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationListDto {
  items: NotificationDto[];
  unread: number;
}

// ---------------------------------------------------------------- 9. diagnóstico
export interface PillarOptionDto {
  score: number;
  label: string;
  text: string;
}

export interface PillarQuestionDto {
  id: string;
  text: string;
  options: PillarOptionDto[];
}

export interface PillarDto {
  id: string;
  name: string;
  questions: PillarQuestionDto[];
}

/** < 3 Crítico · < 4.2 Estável · senão Excelente */
export type Tone = 'critical' | 'stable' | 'excellent';

export interface DiagnosticPillarResult {
  id: string;
  name: string;
  avg: number;
  label: string;
  tone: Tone;
}

export interface DiagnosticPlanItem {
  pillarId: string;
  name: string;
  actions: string[];
  sections: { id: string; title: string }[];
}

export interface DiagnosticResultDto {
  id: string;
  createdAt: string;
  overall: number;
  overallLabel: string;
  overallTone: Tone;
  pillars: DiagnosticPillarResult[];
  /** ids dos 2 pilares com maior média */
  strengths: string[];
  /** ids dos 2 pilares com menor média */
  weaknesses: string[];
  /** para os 2 mais fracos */
  plan: DiagnosticPlanItem[];
  answers: Record<string, number>;
}

export interface DiagnosticSubmissionSummary {
  id: string;
  createdAt: string;
  overall: number;
  overallLabel: string;
}

export interface DiagnosticSubmitRequest {
  answers: Record<string, number>;
}

// ---------------------------------------------------------------- 10. admin
export interface AdminStatsDto {
  users: number;
  activeUsers: number;
  admins: number;
  modules: number;
  lessons: number;
  lessonsCompleted: number;
  certificates: number;
  postsTotal: number;
  postsToday: number;
  diagnostics: number;
}

export interface AdminCreateUserRequest {
  email: string;
  password: string;
  fullName?: string | null;
  role: Role;
}

export interface AdminUpdateUserRequest {
  fullName?: string | null;
  role?: Role;
  active?: boolean;
}

export interface SectionCreateRequest {
  id?: string | null;
  title: string;
  subtitle: string;
}

export interface SectionUpdateRequest {
  title: string;
  subtitle: string;
  sortOrder: number;
}

export interface ModuleInput {
  sectionId: string;
  title: string;
  description?: string | null;
  author?: string | null;
  locked: boolean;
}

export interface ModuleUpdateInput extends ModuleInput {
  sortOrder: number;
}

export interface AdminModuleDto {
  id: string;
  slug: string;
  sectionId: string;
  sectionTitle: string;
  title: string;
  description: string | null;
  author: string | null;
  coverUrl: string | null;
  locked: boolean;
  sortOrder: number;
  lessonCount: number;
  lessonsWithVideo: number;
  quizQuestionCount: number;
  createdAt: string;
}

export interface AdminQuizQuestionDto {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface AdminModuleDetailDto extends AdminModuleDto {
  lessons: LessonDto[];
  quiz: AdminQuizQuestionDto[];
}

export interface LessonInput {
  title: string;
  description?: string | null;
  videoUrl?: string | null;
  durationSeconds?: number | null;
}

export interface QuizQuestionInput {
  text: string;
  /** 2–6 */
  options: string[];
  correctIndex: number;
}

export interface QuizUpdateRequest {
  questions: QuizQuestionInput[];
}
