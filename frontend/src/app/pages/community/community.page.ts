import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommunityApi, FeedQuery } from '../../core/api/community.api';
import { apiMessage } from '../../core/api-error';
import { ConfirmService } from '../../core/confirm.service';
import { CATEGORIES, Category, CommentDto, CommunityStatsDto, NewPostsResponse, PostDto } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { compactNumber, splitRichText } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';
import { InViewDirective } from '../../shared/in-view.directive';
import { SpinnerComponent } from '../../shared/spinner.component';
import { CommunityAsideComponent } from './community-aside.component';
import { CommunityComposerComponent } from './community-composer.component';
import { CommunityPostComponent } from './community-post.component';
import { CommunityThreadComponent } from './community-thread.component';

type Tab = 'hot' | 'recent' | 'unanswered';
const TABS: { id: Tab; label: string }[] = [
  { id: 'hot', label: 'Em alta' },
  { id: 'recent', label: 'Recentes' },
  { id: 'unanswered', label: 'Sem resposta' },
];
const PAGE = 20;
const POLL_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 350;

/** "#Growth" / "growth" → "growth"; formato inválido → null (evita 400 do servidor). */
function normalizeTag(raw: string | null): string | null {
  const t = (raw ?? '').trim().replace(/^#/, '').toLowerCase();
  return /^[\p{L}\p{N}_]{1,50}$/u.test(t) ? t : null;
}

/**
 * Comunidade estilo Twitter: abas Em alta / Recentes / Sem resposta, busca, hashtags clicáveis,
 * prévia dos comentários no feed e conversa aberta em `?post=<id>` (link compartilhável e das notificações).
 * `?tag=<hashtag>` filtra o feed.
 */
@Component({
  selector: 'app-community-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    IconComponent,
    SpinnerComponent,
    InViewDirective,
    CommunityAsideComponent,
    CommunityComposerComponent,
    CommunityPostComponent,
    CommunityThreadComponent,
  ],
  template: `
    <div class="mx-auto flex w-full max-w-[1060px] justify-center gap-8 xl:px-6">
      <div class="min-h-screen w-full min-w-0 max-w-[640px] border-border/60 sm:border-x">
        <!-- Cabeçalho fixo (no celular fica logo abaixo da barra do app) -->
        <div
          class="sticky top-[calc(env(safe-area-inset-top)+4rem)] z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl lg:top-0"
        >
          @if (postId()) {
            <div class="flex h-[53px] items-center gap-5 px-2 sm:px-3">
              <button
                type="button"
                (click)="closeThread()"
                class="grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/10"
                aria-label="Voltar para o feed"
              >
                <app-icon name="arrow-left" class="h-5 w-5" />
              </button>
              <h1 class="text-[19px] font-bold tracking-tight">Conversa</h1>
            </div>
          } @else {
            <div class="px-4 pt-3 sm:px-5">
              <h1 class="text-[20px] font-extrabold tracking-tight">Comunidade</h1>
              <p class="mt-0.5 flex h-5 items-center gap-1.5 text-[13px] text-muted-foreground">
                @if (stats(); as s) {
                  <span>{{ compact(s.members) }} membros</span>
                  <span aria-hidden="true">·</span>
                  <span class="relative flex h-2 w-2" aria-hidden="true">
                    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
                    <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
                  </span>
                  <span>{{ s.postsToday === 1 ? '1 post hoje' : s.postsToday + ' posts hoje' }}</span>
                }
              </p>
            </div>
            <div class="mt-1 flex" role="tablist" aria-label="Feed">
              @for (t of tabs; track t.id) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="tab() === t.id"
                  (click)="setTab(t.id)"
                  class="relative flex-1 py-3.5 text-[15px] transition-colors hover:bg-white/[0.04]"
                  [class]="tab() === t.id ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'"
                >
                  {{ t.label }}
                  @if (tab() === t.id) {
                    <span class="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-primary"></span>
                  }
                </button>
              }
            </div>
            @if (fresh(); as f) {
              <button
                type="button"
                (click)="showFresh()"
                class="lure-pop-in absolute left-1/2 top-full mt-3 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-primary py-1.5 pl-2.5 pr-4 text-[14px] font-semibold text-primary-foreground shadow-[0_8px_30px_-6px_rgba(187,154,53,0.65)] transition hover:brightness-110"
              >
                <app-icon name="arrow-up" class="h-4 w-4" [strokeWidth]="2.5" />
                @if (f.authors.length) {
                  <span class="flex -space-x-2">
                    @for (a of f.authors; track a.id) {
                      <app-avatar [url]="a.avatarUrl" [name]="a.fullName" class="h-6 w-6 ring-2 ring-primary" />
                    }
                  </span>
                }
                {{ f.count === 1 ? '1 post novo' : f.count + ' posts novos' }}
              </button>
            }
          }
        </div>

        <!-- Conversa aberta -->
        @if (postId()) {
          @if (thread(); as t) {
            <app-community-thread
              [post]="t"
              [autofocus]="focusReply()"
              (like)="toggleLike($event)"
              (remove)="removePost($event)"
              (tag)="setTag($event)"
              (comments)="onComments($event)"
            />
          } @else if (threadError()) {
            <div class="px-6 py-20 text-center">
              <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/[0.06] text-muted-foreground">
                <app-icon name="message-square" class="h-5 w-5" />
              </div>
              <p class="mt-4 text-[17px] font-bold">{{ threadError() }}</p>
              <p class="mt-1 text-[14px] text-muted-foreground">Ela pode ter sido apagada pelo autor.</p>
              <button
                type="button"
                (click)="closeThread()"
                class="mt-6 rounded-full bg-foreground px-5 py-2 text-[14px] font-bold text-background transition hover:opacity-90"
              >
                Voltar para o feed
              </button>
            </div>
          } @else {
            <div class="space-y-3 px-4 py-5 sm:px-5" aria-label="Carregando">
              <div class="flex items-center gap-3">
                <div class="h-11 w-11 animate-pulse rounded-full bg-white/[0.06]"></div>
                <div class="h-3 w-40 animate-pulse rounded bg-white/[0.06]"></div>
              </div>
              <div class="h-4 w-full animate-pulse rounded bg-white/[0.06]"></div>
              <div class="h-4 w-4/5 animate-pulse rounded bg-white/[0.06]"></div>
            </div>
          }
        }

        <!-- Feed: continua montado com a conversa aberta, para voltar no mesmo ponto da rolagem -->
        <div [class.hidden]="!!postId()">
          <!-- Busca e assuntos (telas sem a coluna da direita) -->
          <div class="border-b border-border/60 px-4 py-3 sm:px-5 xl:hidden">
            <label
              class="group flex items-center gap-3 rounded-full border border-transparent bg-white/[0.06] px-4 py-2 transition focus-within:border-primary/70 focus-within:bg-transparent"
            >
              <app-icon name="search" class="h-4 w-4 shrink-0 text-muted-foreground group-focus-within:text-primary" />
              <input
                type="search"
                [value]="searchText()"
                (input)="searchText.set($any($event.target).value)"
                (keydown.escape)="searchText.set('')"
                placeholder="Buscar posts ou pessoas"
                aria-label="Buscar na comunidade"
                class="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
            </label>
            @if (stats()?.tags?.length) {
              <div class="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:-mx-5 sm:px-5" aria-label="Em alta">
                <span class="flex shrink-0 items-center gap-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <app-icon name="trending-up" class="h-3.5 w-3.5 text-primary" /> Em alta
                </span>
                @for (t of stats()!.tags; track t.tag) {
                  <button
                    type="button"
                    (click)="setTag(tag() === t.tag ? null : t.tag)"
                    class="shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold transition"
                    [class]="tag() === t.tag ? 'bg-primary text-primary-foreground' : 'bg-white/[0.06] text-foreground hover:bg-white/[0.1]'"
                  >
                    #{{ t.tag }}
                  </button>
                }
              </div>
            }
          </div>

          <app-community-composer [remainingToday]="stats()?.remainingToday ?? null" (published)="onPublished($event)" />

          <!-- Filtros: hashtag/busca ativas + categorias -->
          <div class="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-border/60 px-4 py-2.5 sm:px-5">
            @if (tag()) {
              <button
                type="button"
                (click)="setTag(null)"
                class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary py-1 pl-3 pr-2 text-[13px] font-semibold text-primary-foreground"
                aria-label="Remover filtro de hashtag"
              >
                #{{ tag() }} <app-icon name="x" class="h-3.5 w-3.5" [strokeWidth]="2.5" />
              </button>
            }
            @if (q()) {
              <button
                type="button"
                (click)="searchText.set('')"
                class="inline-flex max-w-[60%] shrink-0 items-center gap-1 rounded-full border border-primary/60 py-1 pl-3 pr-2 text-[13px] font-semibold text-primary"
                aria-label="Limpar busca"
              >
                <app-icon name="search" class="h-3.5 w-3.5 shrink-0" />
                <span class="truncate">{{ q() }}</span>
                <app-icon name="x" class="h-3.5 w-3.5 shrink-0" [strokeWidth]="2.5" />
              </button>
            }
            @for (c of categoryFilters; track c) {
              <button
                type="button"
                (click)="setCategory(c === 'Todos' ? null : c)"
                [attr.aria-pressed]="(category() ?? 'Todos') === c"
                class="shrink-0 rounded-full border px-3 py-1 text-[13px] font-medium transition"
                [class]="
                  (category() ?? 'Todos') === c
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                "
              >
                {{ c }}
              </button>
            }
          </div>

          @if (error()) {
            <div class="m-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400" role="alert">
              {{ error() }}
              <button type="button" (click)="load()" class="ml-2 font-semibold underline">Tentar de novo</button>
            </div>
          }

          @if (loading()) {
            @for (i of skeletons; track i) {
              <div class="flex gap-3 border-b border-border/60 px-4 py-4 sm:px-5" aria-hidden="true">
                <div class="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/[0.06]"></div>
                <div class="flex-1 space-y-2.5 pt-1">
                  <div class="h-3 w-44 animate-pulse rounded bg-white/[0.06]"></div>
                  <div class="h-3 w-full animate-pulse rounded bg-white/[0.06]"></div>
                  <div class="h-3 animate-pulse rounded bg-white/[0.06]" [style.width.%]="55 + i * 7"></div>
                </div>
              </div>
            }
          } @else {
            @for (p of posts(); track p.id) {
              <app-community-post
                [post]="p"
                (open)="openPost($event)"
                (comment)="openPost($event, true)"
                (like)="toggleLike($event)"
                (remove)="removePost($event)"
                (tag)="setTag($event)"
              />
            } @empty {
              @if (!error()) {
                <div class="px-8 py-20 text-center">
                  <div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                    <app-icon [name]="empty().icon" class="h-6 w-6" />
                  </div>
                  <p class="mt-5 text-[20px] font-extrabold tracking-tight">{{ empty().title }}</p>
                  <p class="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">{{ empty().text }}</p>
                </div>
              }
            }
            @if (loadingMore()) {
              <div class="flex justify-center py-8"><app-spinner /></div>
            } @else if (!exhausted() && posts().length) {
              <div appInView (inView)="loadMore()" class="h-px"></div>
            } @else if (exhausted() && posts().length > 3) {
              <p class="py-10 text-center text-[13px] text-muted-foreground/70">Você chegou ao fim. Que tal puxar um assunto novo?</p>
            }
          }
        </div>
      </div>

      <!-- Grudada no topo; se for mais alta que a tela, rola por dentro -->
      <aside
        class="no-scrollbar sticky top-0 hidden max-h-dvh w-[340px] shrink-0 self-start overflow-y-auto pb-6 pt-3 xl:block"
        aria-label="Assuntos e pessoas"
      >
        <app-community-aside
          [stats]="stats()"
          [searchText]="searchText()"
          [activeTag]="tag()"
          (search)="searchText.set($event)"
          (tag)="setTag($event)"
        />
      </aside>
    </div>
  `,
})
export class CommunityPage {
  private readonly api = inject(CommunityApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  protected readonly tabs = TABS;
  protected readonly categoryFilters: (Category | 'Todos')[] = ['Todos', ...CATEGORIES];
  protected readonly skeletons = [0, 1, 2, 3, 4];

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly tag = computed(() => normalizeTag(this.params().get('tag')));
  protected readonly postId = computed(() => this.params().get('post'));

  protected readonly tab = signal<Tab>('hot');
  protected readonly category = signal<Category | null>(null);
  /** O que está digitado na busca; `q` é o valor com debounce que vai pro servidor. */
  protected readonly searchText = signal('');
  protected readonly q = signal('');

  protected readonly posts = signal<PostDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly exhausted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly stats = signal<CommunityStatsDto | null>(null);
  protected readonly fresh = signal<NewPostsResponse | null>(null);

  protected readonly thread = signal<PostDto | null>(null);
  protected readonly threadError = signal<string | null>(null);
  protected readonly focusReply = signal(false);

  protected readonly empty = computed(() => {
    if (this.q()) return { icon: 'search', title: `Nada encontrado para “${this.q()}”`, text: 'Tente outras palavras ou o nome de alguém.' };
    if (this.tag()) return { icon: 'trending-up', title: `Ninguém falou de #${this.tag()} ainda`, text: 'Que tal ser a primeira pessoa a puxar esse assunto?' };
    if (this.tab() === 'unanswered')
      return { icon: 'circle-check', title: 'Nenhuma pergunta no vácuo', text: 'Todo post já recebeu pelo menos uma resposta. A galera tá ligada.' };
    if (this.category())
      return { icon: 'message-circle', title: `Nada em “${this.category()}” por enquanto`, text: 'Publique o primeiro post dessa categoria.' };
    return { icon: 'message-circle', title: 'Ninguém publicou ainda', text: 'Comece a conversa: conte uma conquista, uma dúvida ou um insight.' };
  });

  /** Cursor do aviso "N posts novos". */
  private since = new Date().toISOString();
  /** Descarta respostas de buscas antigas quando os filtros mudam rápido. */
  private seq = 0;
  private feedScroll = 0;
  /** A conversa foi aberta a partir do feed (voltar = histórico) ou por link direto. */
  private openedFromFeed = false;

  constructor() {
    effect(() => {
      this.tab();
      this.category();
      this.tag();
      this.q();
      untracked(() => this.load());
    });

    let debounce: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const text = this.searchText().trim();
      clearTimeout(debounce);
      debounce = setTimeout(() => this.q.set(text), text ? SEARCH_DEBOUNCE_MS : 0);
    });

    let prevPost: string | null = null;
    let firstRun = true;
    effect(() => {
      const id = this.postId();
      untracked(() => this.syncThread(prevPost, id, firstRun));
      prevPost = id;
      firstRun = false;
    });

    this.loadStats();
    const timer = setInterval(() => {
      if (!document.hidden) this.pollNew();
    }, POLL_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      clearTimeout(debounce);
    });
  }

  // ------------------------------------------------------------------ feed

  private query(extra: Partial<FeedQuery> = {}): FeedQuery {
    const tab = this.tab();
    return {
      sort: tab === 'hot' ? 'hot' : 'recent',
      unanswered: tab === 'unanswered',
      category: this.category(),
      tag: this.tag(),
      q: this.q() || null,
      limit: PAGE,
      ...extra,
    };
  }

  protected load(): void {
    const seq = ++this.seq;
    this.loading.set(true);
    this.loadingMore.set(false);
    this.error.set(null);
    this.fresh.set(null);
    const startedAt = new Date().toISOString();
    this.api.posts(this.query()).subscribe({
      next: (list) => {
        if (seq !== this.seq) return;
        this.posts.set(list);
        this.exhausted.set(list.length < PAGE);
        // no cronológico o 1º post dá a hora do servidor; nos outros, a hora da busca
        this.since = this.tab() !== 'hot' && list[0] ? list[0].createdAt : startedAt;
        this.loading.set(false);
      },
      error: (err) => {
        if (seq !== this.seq) return;
        this.error.set(apiMessage(err, 'Não foi possível carregar o feed.'));
        this.loading.set(false);
      },
    });
  }

  protected loadMore(): void {
    const list = this.posts();
    if (!list.length || this.loading() || this.loadingMore() || this.exhausted()) return;
    const seq = this.seq;
    this.loadingMore.set(true);
    const page = this.tab() === 'hot' ? { offset: list.length } : { before: list[list.length - 1].createdAt };
    this.api.posts(this.query(page)).subscribe({
      next: (more) => {
        if (seq !== this.seq) return;
        const ids = new Set(this.posts().map((p) => p.id));
        this.posts.update((cur) => [...cur, ...more.filter((p) => !ids.has(p.id))]);
        if (more.length < PAGE) this.exhausted.set(true);
        this.loadingMore.set(false);
      },
      error: (err) => {
        if (seq !== this.seq) return;
        this.loadingMore.set(false);
        this.toast.error(apiMessage(err, 'Não foi possível carregar mais publicações.'));
      },
    });
  }

  private loadStats(): void {
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => undefined });
  }

  private pollNew(): void {
    if (this.loading()) return;
    this.api.newCount(this.since, this.category()).subscribe({
      next: (r) => this.fresh.set(r.count > 0 ? r : null),
      error: () => undefined,
    });
  }

  /** "N posts novos": vai para Recentes (sem hashtag/busca) e volta ao topo. */
  protected showFresh(): void {
    this.fresh.set(null);
    const changed = this.tab() !== 'recent' || !!this.q() || !!this.tag();
    this.searchText.set('');
    this.q.set('');
    this.tab.set('recent');
    if (this.tag()) this.setTag(null);
    else if (!changed) this.load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected setTab(t: Tab): void {
    if (this.tab() === t) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.tab.set(t);
    window.scrollTo({ top: 0 });
  }

  protected setCategory(c: Category | null): void {
    this.category.set(c);
  }

  protected setTag(t: string | null): void {
    this.feedScroll = 0;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag: t ? normalizeTag(t) : null, post: null },
      queryParamsHandling: 'merge',
    });
    window.scrollTo({ top: 0 });
  }

  protected onPublished(p: PostDto): void {
    const tag = this.tag();
    const cat = this.category();
    const fits =
      !this.q() &&
      (!cat || p.category === cat) &&
      (!tag || splitRichText(p.body).some((x) => x.kind === 'tag' && x.value === tag));
    if (fits) this.posts.update((list) => [p, ...list]);
    else this.toast.success('Publicado! Seu post já está no feed.');
    this.loadStats();
  }

  // ------------------------------------------------------------------ conversa

  protected openPost(p: PostDto, focusReply = false): void {
    this.focusReply.set(focusReply);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { post: p.id }, queryParamsHandling: 'merge' });
  }

  protected closeThread(): void {
    if (this.openedFromFeed) this.location.back();
    else void this.router.navigate([], { relativeTo: this.route, queryParams: { post: null }, queryParamsHandling: 'merge' });
  }

  private syncThread(prev: string | null, id: string | null, firstRun: boolean): void {
    if (!id) {
      if (prev) {
        this.thread.set(null);
        this.threadError.set(null);
        this.focusReply.set(false);
        const y = this.feedScroll;
        requestAnimationFrame(() => window.scrollTo({ top: y }));
      }
      return;
    }
    if (!prev) {
      this.feedScroll = window.scrollY;
      this.openedFromFeed = !firstRun;
    }
    // mostra na hora o que já temos no feed e atualiza com a versão do servidor
    this.thread.set(this.posts().find((p) => p.id === id) ?? null);
    this.threadError.set(null);
    window.scrollTo({ top: 0 });
    this.api.post(id).subscribe({
      next: (p) => {
        if (this.postId() === id) this.thread.set(p);
      },
      error: (err) => {
        if (this.postId() !== id) return;
        this.thread.set(null);
        this.threadError.set(apiMessage(err, 'Não foi possível abrir essa publicação.'));
      },
    });
  }

  protected onComments(e: { id: string; count: number; recent: CommentDto[] }): void {
    this.patch(e.id, (x) => ({ ...x, commentsCount: e.count, recentComments: e.recent }));
  }

  // ------------------------------------------------------------------ ações

  /** Aplica a mudança no feed e na conversa aberta. */
  private patch(id: string, fn: (p: PostDto) => PostDto): void {
    this.posts.update((list) => list.map((x) => (x.id === id ? fn(x) : x)));
    this.thread.update((t) => (t && t.id === id ? fn(t) : t));
  }

  protected toggleLike(p: PostDto): void {
    const wasLiked = p.likedByMe;
    const apply = (liked: boolean, count: number) =>
      this.patch(p.id, (x) => ({ ...x, likedByMe: liked, likesCount: Math.max(0, count) }));
    apply(!wasLiked, p.likesCount + (wasLiked ? -1 : 1));
    (wasLiked ? this.api.unlike(p.id) : this.api.like(p.id)).subscribe({
      next: (r) => apply(r.liked, r.likesCount),
      error: (err) => {
        apply(wasLiked, p.likesCount);
        this.toast.error(apiMessage(err, 'Não foi possível curtir agora.'));
      },
    });
  }

  protected async removePost(p: PostDto): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Apagar esta publicação?',
      message: 'Ela some do feed para todo mundo, junto com os comentários.',
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (!ok) return;
    const before = this.posts();
    this.posts.set(before.filter((x) => x.id !== p.id));
    if (this.postId() === p.id) this.closeThread();
    this.api.delete(p.id).subscribe({
      next: () => this.loadStats(),
      error: (err) => {
        this.posts.set(before);
        this.toast.error(apiMessage(err, 'Não foi possível apagar a publicação.'));
      },
    });
  }

  protected compact(n: number): string {
    return compactNumber(n);
  }
}
