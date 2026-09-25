import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CertificatesApi } from '../../core/api/certificates.api';
import { apiMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { CertificateDto, ModuleCardDto } from '../../core/models';
import { ProgressStore } from '../../core/progress.store';
import { ToastService } from '../../core/toast.service';
import { downloadCertificate } from '../../shared/certificate-canvas';
import { formatDateShort } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';
import { ModuleCardMobileComponent } from '../../shared/module-card-mobile.component';
import { SpinnerComponent } from '../../shared/spinner.component';

type Tab = 'andamento' | 'concluidos' | 'certificados';

/** /meus-cursos?tab=andamento|concluidos|certificados */
@Component({
  selector: 'app-my-courses-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SpinnerComponent, ModuleCardMobileComponent, NgTemplateOutlet],
  template: `
    <div class="mx-auto max-w-[1400px] px-4 pt-8 md:px-10 lg:pt-10">
      <header>
        <h1 class="font-display text-3xl font-bold tracking-tight md:text-4xl">Meus cursos</h1>
        <p class="mt-2 max-w-2xl text-sm text-muted-foreground">Seu dashboard — veja o progresso e baixe seus certificados.</p>
      </header>

      <div class="mt-6 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtro de cursos">
        @for (t of tabs; track t.id) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="tab() === t.id"
            (click)="go(t.id)"
            class="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition"
            [class]="tab() === t.id ? 'bg-foreground text-background' : 'border border-border bg-surface text-muted-foreground hover:text-foreground'"
          >
            @if (t.id === 'certificados') {
              <app-icon name="award" class="mr-1 h-3.5 w-3.5" />
            }
            {{ t.label }}
            <span class="ml-1.5 rounded-full bg-black/10 px-1.5 text-[10px] opacity-70">{{ count(t.id) }}</span>
          </button>
        }
      </div>

      <section class="mt-8" role="tabpanel">
        @if (tab() === 'certificados') {
          @if (certsLoading()) {
            <div class="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><app-spinner /> Carregando certificados…</div>
          } @else if (certsError()) {
            <div class="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-6 text-sm text-red-400">
              {{ certsError() }}
              <button type="button" (click)="loadCerts()" class="ml-2 font-semibold underline">Tentar de novo</button>
            </div>
          } @else if (certs().length === 0) {
            <ng-container [ngTemplateOutlet]="empty" />
          } @else {
            <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
              @for (c of certs(); track c.id; let i = $index) {
                <div class="lure-rise group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card" [style.--d]="i * 60 + 'ms'">
                  <div class="relative aspect-[16/10] w-full overflow-hidden bg-black">
                    <div
                      class="pointer-events-none absolute inset-0 opacity-70"
                      style="background: radial-gradient(ellipse 90% 60% at 50% 100%, rgba(187, 154, 53, 0.35), transparent 65%)"
                    ></div>
                    <div class="absolute inset-3 rounded-xl border border-primary/40"></div>
                    <div class="absolute inset-5 rounded-lg border border-primary/20"></div>
                    <div class="relative flex h-full flex-col items-center justify-center p-5 text-center">
                      <div class="text-[9px] font-bold uppercase tracking-[0.32em] text-primary">AssessoriaLure</div>
                      <div class="mt-1.5 font-serif text-2xl italic leading-tight text-white">Certificado</div>
                      <div class="mt-2 line-clamp-2 max-w-[85%] text-xs text-white/80">{{ c.moduleTitle }}</div>
                      <div class="mt-2.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.24em] text-white/60">
                        <app-icon name="sparkles" class="h-2.5 w-2.5" /> {{ c.studentName }}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center justify-between gap-3 p-4">
                    <div class="min-w-0">
                      <div class="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{{ c.sectionTitle }}</div>
                      <div class="mt-1 truncate font-display text-sm font-bold">{{ c.moduleTitle }}</div>
                      <div class="mt-0.5 truncate text-[11px] text-muted-foreground">
                        Emitido em {{ date(c.issuedAt) }} · <span class="font-mono">{{ c.code }}</span>
                      </div>
                    </div>
                    <div class="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        (click)="download(c)"
                        [disabled]="downloading() === c.id"
                        class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/25 disabled:opacity-60"
                      >
                        @if (downloading() === c.id) {
                          <app-spinner size="h-3.5 w-3.5" />
                        } @else {
                          <app-icon name="download" class="h-3.5 w-3.5" />
                        }
                        Baixar
                      </button>
                      <a
                        [routerLink]="['/certificado', c.code]"
                        class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                      >
                        <app-icon name="shield-check" class="h-3 w-3" /> Verificar
                      </a>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        } @else {
          @if (!summary()) {
            @if (progress.error()) {
              <div class="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-6 text-sm text-red-400">
                Não foi possível carregar seu progresso.
                <button type="button" (click)="progress.refresh(0)" class="ml-2 font-semibold underline">Tentar de novo</button>
              </div>
            } @else {
              <div class="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><app-spinner /> Carregando…</div>
            }
          } @else if (list().length === 0) {
            <ng-container [ngTemplateOutlet]="empty" />
          } @else {
            <div class="grid grid-cols-2 gap-3.5 lg:hidden">
              @for (m of list(); track m.id; let i = $index) {
                <app-module-card-mobile [m]="m" [index]="i" />
              }
            </div>
            <div class="hidden gap-5 lg:grid lg:grid-cols-3 xl:grid-cols-4">
              @for (m of list(); track m.id) {
                @let done = m.progress >= 100;
                <a
                  [routerLink]="['/curso', m.slug]"
                  class="group relative flex h-[440px] flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:border-[var(--nav)]/50 hover:shadow-[var(--shadow-card)]"
                  [attr.aria-label]="m.title"
                >
                  @if (m.coverUrl) {
                    <img
                      [src]="m.coverUrl"
                      [alt]="m.title"
                      loading="lazy"
                      decoding="async"
                      class="pointer-events-none absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  } @else {
                    <div class="pointer-events-none absolute inset-0 bg-black"></div>
                    <div class="pointer-events-none absolute inset-0 grid place-items-center">
                      <img src="/lure-logo-large.png" alt="" class="h-20 w-20 object-contain opacity-90 transition duration-500 group-hover:scale-105" />
                    </div>
                    <div
                      class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_70%_90%_at_50%_100%,rgba(187,154,53,0.28),transparent_70%)]"
                    ></div>
                  }
                  <div
                    class="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/70 opacity-0 backdrop-blur transition group-hover:opacity-100"
                  >
                    <app-icon name="play" [filled]="true" class="h-4 w-4 text-[var(--nav)]" />
                  </div>
                  <div class="relative flex flex-1 flex-col p-6">
                    <span
                      class="mb-4 inline-flex w-fit items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur"
                      [class]="done ? 'bg-emerald-500/90 text-white' : 'bg-background/70 text-foreground'"
                    >
                      @if (done) {
                        <app-icon name="circle-check" class="h-3 w-3" /> Concluído
                      } @else {
                        {{ m.progress }}% concluído
                      }
                    </span>
                    @if (!m.coverUrl) {
                      <h3 class="font-display text-xl font-bold leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{{ m.title }}</h3>
                    }
                    <div class="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-muted-foreground">
                      <span class="truncate">{{ m.author || 'Time LURE' }}</span>
                      <span class="flex shrink-0 items-center gap-1">
                        <app-icon name="play" class="h-3 w-3" /> {{ m.completedLessons }}/{{ m.lessonCount }}
                        {{ m.lessonCount === 1 ? 'aula' : 'aulas' }}
                      </span>
                    </div>
                  </div>
                  <div class="relative h-1.5 w-full bg-background/70">
                    <div class="h-full" [class]="done ? 'bg-emerald-400' : 'bg-[var(--nav)]'" [style.width.%]="m.progress"></div>
                  </div>
                </a>
              }
            </div>
          }
        }
      </section>
    </div>

    <ng-template #empty>
      <div class="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <div class="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted-foreground">
          <app-icon name="ph-book-open-text" class="h-5 w-5" />
        </div>
        <p class="text-sm font-semibold">{{ emptyTitle() }}</p>
        <p class="max-w-sm text-xs text-muted-foreground">{{ emptyDesc() }}</p>
        <a
          routerLink="/"
          class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/25"
        >
          Explorar catálogo
        </a>
      </div>
    </ng-template>
  `,
})
export class MyCoursesPage {
  /** ?tab= (withComponentInputBinding) */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly progress = inject(ProgressStore);
  private readonly certsApi = inject(CertificatesApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'andamento', label: 'Em andamento' },
    { id: 'concluidos', label: 'Concluídos' },
    { id: 'certificados', label: 'Certificados' },
  ];

  protected readonly tab = computed<Tab>(() => {
    const t = this.tabParam();
    return t === 'concluidos' || t === 'certificados' ? t : 'andamento';
  });
  protected readonly summary = this.progress.summary;
  protected readonly inProgress = computed<ModuleCardDto[]>(() => this.summary()?.inProgress ?? []);
  protected readonly completed = computed<ModuleCardDto[]>(() => this.summary()?.completed ?? []);
  protected readonly list = computed(() => (this.tab() === 'concluidos' ? this.completed() : this.inProgress()));

  protected readonly certs = signal<CertificateDto[]>([]);
  protected readonly certsLoading = signal(true);
  protected readonly certsError = signal<string | null>(null);
  protected readonly downloading = signal<string | null>(null);

  protected readonly emptyTitle = computed(() =>
    this.tab() === 'andamento'
      ? 'Você ainda não começou nenhum curso'
      : this.tab() === 'certificados'
        ? 'Nenhum certificado ainda'
        : 'Nenhum curso concluído ainda',
  );
  protected readonly emptyDesc = computed(() =>
    this.tab() === 'andamento'
      ? 'Explore o catálogo e comece sua jornada.'
      : 'Finalize um curso para desbloquear seu certificado.',
  );

  constructor() {
    this.progress.refresh(0);
    this.loadCerts();
  }

  protected count(t: Tab): number {
    if (t === 'andamento') return this.inProgress().length;
    if (t === 'concluidos') return this.completed().length;
    return this.certs().length;
  }

  protected go(t: Tab): void {
    void this.router.navigate([], { queryParams: { tab: t }, replaceUrl: true });
  }

  protected loadCerts(): void {
    this.certsLoading.set(true);
    this.certsError.set(null);
    this.certsApi.mine().subscribe({
      next: (list) => {
        this.certs.set(list);
        this.certsLoading.set(false);
      },
      error: (err) => {
        this.certsError.set(apiMessage(err, 'Não foi possível carregar seus certificados.'));
        this.certsLoading.set(false);
      },
    });
  }

  protected date(iso: string): string {
    return formatDateShort(iso);
  }

  protected async download(c: CertificateDto): Promise<void> {
    this.downloading.set(c.id);
    try {
      await downloadCertificate(c);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o certificado.');
    } finally {
      this.downloading.set(null);
    }
  }
}
