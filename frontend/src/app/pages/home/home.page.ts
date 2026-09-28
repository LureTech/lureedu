import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CatalogStore } from '../../core/catalog.store';
import { ProgressStore } from '../../core/progress.store';
import { formatClock } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';

const HERO = {
  eyebrow: 'Bem-vindo ao',
  title: 'AssessoriaLure',
  lines: [
    'A plataforma oficial da agência que já rodou +R$100M em mídia.',
    'Trilhas guiadas, mentorias ao vivo e a comunidade que cresce junto com você.',
  ],
  cta: 'Explorar agora',
};

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <!-- Hero mobile com vídeo -->
    <section class="relative overflow-hidden lg:hidden">
      <video
        #video
        src="/banner-boas-vindas.mp4"
        poster="/banner-boas-vindas.jpg"
        muted
        loop
        playsinline
        preload="none"
        aria-hidden="true"
        class="absolute inset-y-0 -right-px h-full w-[calc(66%_+_2px)] object-cover object-[58%_center]"
        style="-webkit-mask-image: linear-gradient(to right, transparent 0%, #000 16%); mask-image: linear-gradient(to right, transparent 0%, #000 16%)"
      ></video>
      <div
        class="compat-scrim-x pointer-events-none absolute inset-0"
        style="background: linear-gradient(100deg, rgba(10,10,10,0.96) 0%, rgba(10,10,10,0.8) 34%, rgba(10,10,10,0.2) 58%, rgba(10,10,10,0) 78%)"
        aria-hidden="true"
      ></div>
      <div
        class="pointer-events-none absolute inset-0"
        style="background: radial-gradient(ellipse 65% 60% at 88% 65%, rgba(187,154,53,0.22), transparent 70%)"
        aria-hidden="true"
      ></div>
      <div class="relative flex min-h-[300px] max-w-[55%] flex-col justify-center py-8 pl-5 pr-1">
        <p class="text-[12px] font-normal text-white/85">{{ hero.eyebrow }}</p>
        <h1 class="mt-0.5 font-display text-[23px] font-bold leading-[1.08] tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
          {{ hero.title }}
        </h1>
        <div class="mt-2.5 space-y-1.5">
          @for (l of hero.lines; track l) {
            <p class="text-[11px] leading-relaxed text-white/70">{{ l }}</p>
          }
        </div>
        <a
          routerLink="/meus-cursos"
          [queryParams]="{ tab: 'andamento' }"
          class="group relative mt-4 inline-flex w-fit items-center gap-2 overflow-hidden rounded-full gradient-gold px-4 py-2.5 text-[12px] font-semibold text-primary-foreground shadow-[0_10px_26px_-10px_var(--nav)] transition active:scale-95"
        >
          <span class="diag-sweep pointer-events-none absolute inset-y-0 -left-6 w-12 bg-white/30 blur-md" aria-hidden="true"></span>
          <span class="relative">{{ hero.cta }}</span>
          <app-icon name="arrow-right" class="relative h-3.5 w-3.5" />
        </a>
      </div>
    </section>

    <!-- Banner desktop -->
    <section class="relative hidden overflow-hidden border-b border-primary/30 lg:block">
      <div class="relative w-full">
        <img
          src="/banner-principal.jpg"
          alt="Assessoria Lure"
          fetchpriority="high"
          decoding="async"
          class="block h-auto w-full"
        />
      </div>
    </section>

    <div class="mx-auto max-w-[1400px] px-4 md:px-10">
      @if (continueWatching(); as cw) {
        <a
          [routerLink]="['/curso', cw.moduleSlug]"
          [queryParams]="{ aula: cw.lessonId }"
          class="lure-rise group relative mt-8 flex items-center gap-4 overflow-hidden rounded-2xl border border-primary/30 bg-surface/60 p-3 pr-4 transition hover:border-primary/60 hover:shadow-[var(--shadow-card)] sm:p-4 lg:mt-10"
          style="--d: 60ms"
        >
          <div
            class="pointer-events-none absolute inset-0"
            style="background: radial-gradient(ellipse 60% 120% at 0% 50%, rgba(187, 154, 53, 0.16), transparent 70%)"
          ></div>
          <div class="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-black sm:w-40">
            @if (cw.coverUrl) {
              <img [src]="cw.coverUrl" alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover" />
            } @else {
              <img src="/lure-logo-large.png" alt="" class="absolute inset-0 m-auto h-10 w-10 object-contain opacity-90" />
            }
            <span class="absolute inset-0 grid place-items-center bg-black/35 opacity-90 transition group-hover:bg-black/20">
              <span class="grid h-9 w-9 place-items-center rounded-full bg-primary/95 shadow-[var(--shadow-glow)]">
                <app-icon name="play" [filled]="true" class="ml-0.5 h-4 w-4 text-primary-foreground" />
              </span>
            </span>
          </div>
          <div class="relative min-w-0 flex-1">
            <div class="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Continue de onde parou</div>
            <div class="mt-1 truncate font-display text-[15px] font-bold leading-snug sm:text-lg">{{ cw.moduleTitle }}</div>
            <div class="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
              Aula {{ cw.lessonPosition }} · {{ cw.lessonTitle }}
              @if (cw.lastPosition > 5) {
                <span class="text-muted-foreground/70"> · parou em {{ clock(cw.lastPosition) }}</span>
              }
            </div>
          </div>
          <span
            class="relative hidden shrink-0 items-center gap-2 rounded-xl gradient-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition group-hover:brightness-110 sm:inline-flex"
          >
            Continuar <app-icon name="arrow-right" class="h-4 w-4" />
          </span>
          <app-icon name="chevron-right" class="relative h-5 w-5 shrink-0 text-muted-foreground sm:hidden" />
        </a>
      }

      @if (loading()) {
        @for (s of skeleton; track s) {
          <section class="mt-10 lg:mt-14" aria-hidden="true">
            <div class="h-3 w-28 animate-pulse rounded bg-surface-elevated"></div>
            <div class="mt-3 h-5 w-64 animate-pulse rounded bg-surface-elevated"></div>
            <div class="mt-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-5">
              @for (c of [1, 2, 3, 4]; track c) {
                <div class="aspect-[9/16] animate-pulse rounded-2xl border border-border bg-surface lg:aspect-auto lg:h-[440px]"></div>
              }
            </div>
          </section>
        }
      } @else if (error()) {
        <div class="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <app-icon name="triangle-alert" class="h-6 w-6 text-red-400" />
          <p class="text-sm font-semibold">Não foi possível carregar o catálogo</p>
          <p class="max-w-sm text-xs text-muted-foreground">{{ error() }}</p>
          <button
            type="button"
            (click)="load()"
            class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/25"
          >
            <app-icon name="refresh-cw" class="h-3.5 w-3.5" /> Tentar de novo
          </button>
        </div>
      } @else if (sections().length === 0) {
        <div class="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <div class="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted-foreground">
            <app-icon name="ph-book-open-text" class="h-6 w-6" />
          </div>
          <p class="text-sm font-semibold">Nenhum módulo publicado ainda</p>
          <p class="max-w-sm text-xs text-muted-foreground">Os primeiros conteúdos estão sendo gravados. Volte em breve!</p>
          @if (auth.isAdmin()) {
            <a
              routerLink="/admin/modulos"
              class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/25"
            >
              <app-icon name="plus" class="h-3.5 w-3.5" /> Criar módulo
            </a>
          }
        </div>
      } @else {
        <!-- Trilhas lado a lado: cada capa leva aos módulos da trilha (/secao/:id) -->
        <section class="mt-10 lg:mt-14" aria-labelledby="trilhas-title">
          <div class="flex items-center gap-2">
            <span class="h-3 w-[3px] shrink-0 rounded-full bg-primary" aria-hidden="true"></span>
            <span class="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">Escolha sua trilha</span>
          </div>
          <h2 id="trilhas-title" class="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Trilhas LURE</h2>
          <!-- Carrossel: arrasta no celular, setas no computador -->
          <div class="relative mt-6">
            <button
              type="button"
              aria-label="Trilha anterior"
              (click)="scrollTrilhas(-1)"
              class="absolute -left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:border-primary/50 hover:text-primary md:flex"
            >
              <app-icon name="chevron-left" class="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Próxima trilha"
              (click)="scrollTrilhas(1)"
              class="absolute -right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:border-primary/50 hover:text-primary md:flex"
            >
              <app-icon name="chevron-right" class="h-5 w-5" />
            </button>
          <ul #trilhasTrack class="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-3 pt-2">
            @for (t of trilhas(); track t.id; let i = $index) {
              <li
                data-trilha
                class="lure-rise w-[80%] shrink-0 snap-start sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)]"
                [style.--d]="i * 60 + 'ms'"
              >
                <a
                  [routerLink]="['/secao', t.id]"
                  class="group relative flex aspect-[3/4] flex-col overflow-hidden rounded-2xl border border-primary/30 bg-black transition duration-200 hover:-translate-y-1 hover:border-primary/70 hover:shadow-[var(--shadow-card)]"
                >
                  @if (t.cover) {
                    <img
                      [src]="t.cover"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      class="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-700 group-hover:scale-105 group-hover:opacity-70"
                    />
                  }
                  <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10"></div>
                  <div
                    class="absolute inset-x-0 bottom-0 h-2/3"
                    style="background: radial-gradient(ellipse 80% 70% at 50% 100%, rgba(187, 154, 53, 0.22), transparent 70%)"
                  ></div>
                  <div class="relative flex items-center justify-between p-5 md:p-6">
                    <span class="font-display text-5xl font-bold leading-none text-primary/90 md:text-6xl">{{ pad(i + 1) }}</span>
                    <img src="/lure-logo-large.png" alt="" class="h-9 w-9 object-contain opacity-90" />
                  </div>
                  <div class="relative mt-auto p-5 pt-0 md:p-6 md:pt-0">
                    <span class="mb-4 block h-1.5 w-12 rounded-full bg-primary transition-all duration-300 group-hover:w-20"></span>
                    <h3 class="font-display text-2xl font-bold uppercase leading-[1.1] tracking-tight text-white md:text-[26px]">{{ t.title }}</h3>
                    <p class="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/65 md:text-[13px]">
                      {{ t.modules }} {{ t.modules === 1 ? 'módulo' : 'módulos' }} · {{ t.lessons }} aulas
                    </p>
                    @if (t.progress > 0) {
                      <div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                        <div class="h-full rounded-full gradient-gold" [style.width.%]="t.progress"></div>
                      </div>
                    }
                    <span class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary opacity-80 transition group-hover:opacity-100">
                      Ver módulos <app-icon name="arrow-right" class="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </a>
              </li>
            }
          </ul>
          </div>
        </section>
      }
    </div>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly catalog = inject(CatalogStore);
  private readonly progress = inject(ProgressStore);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly trilhasTrack = viewChild<ElementRef<HTMLElement>>('trilhasTrack');

  protected readonly hero = HERO;
  protected readonly skeleton = [1, 2];
  protected readonly sections = this.catalog.sections;
  protected readonly error = this.catalog.error;
  /** Só na primeira carga: com catálogo em memória, a Home abre pronta e revalida por baixo. */
  protected readonly loading = computed(() => !this.catalog.loaded() && !this.catalog.error());
  protected readonly continueWatching = computed(() => this.progress.summary()?.continueWatching ?? null);
  /** Capa de cada trilha: nome, foto do primeiro módulo com capa, totais e progresso do aluno. */
  protected readonly trilhas = computed(() =>
    this.sections().map((s) => {
      const lessons = s.modules.reduce((n, m) => n + m.lessonCount, 0);
      const done = s.modules.reduce((n, m) => n + m.completedLessons, 0);
      return {
        id: s.section.id,
        title: s.section.title,
        cover: s.modules.find((m) => m.coverUrl)?.coverUrl ?? null,
        modules: s.modules.length,
        lessons,
        progress: lessons ? Math.round((done / lessons) * 100) : 0,
      };
    }),
  );

  constructor() {
    this.catalog.load();
    afterNextRender(() => this.startHeroVideo());
  }

  protected load(): void {
    this.catalog.load(true);
  }

  protected clock(s: number): string {
    return formatClock(s);
  }

  /** Setas do carrossel: anda uma capa por clique. */
  protected scrollTrilhas(dir: number): void {
    const el = this.trilhasTrack()?.nativeElement;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-trilha]');
    el.scrollBy({ left: dir * (card ? card.offsetWidth + 20 : el.clientWidth * 0.8), behavior: 'smooth' });
  }

  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  /** Só baixa/toca o vídeo do hero no mobile (o bloco é lg:hidden). */
  private startHeroVideo(): void {
    const v = this.video()?.nativeElement;
    if (!v || !window.matchMedia('(max-width: 1023px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.muted = true;
    const play = () => v.play().catch(() => undefined);
    if (document.readyState === 'complete') setTimeout(play, 200);
    else window.addEventListener('load', play, { once: true });
  }
}
