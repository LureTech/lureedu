import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { CatalogApi } from '../core/api/catalog.api';
import { AuthService } from '../core/auth.service';
import { SearchLessonHit, SearchModuleHit, SearchResultDto } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { SpinnerComponent } from '../shared/spinner.component';

type Hit = { kind: 'module'; m: SearchModuleHit } | { kind: 'lesson'; l: SearchLessonHit };

/** Busca do topo: debounce → GET /api/search, dropdown com módulos + aulas, teclado ↑↓/Enter/Esc. */
@Component({
  selector: 'app-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent],
  host: {
    class: 'relative block',
    '(document:mousedown)': 'onOutside($event)',
  },
  template: `
    <div
      class="flex items-center gap-3 rounded-full border bg-surface px-4 py-2.5 text-sm text-foreground shadow-sm transition focus-within:border-primary/40"
      [class]="variant() === 'mobile' ? 'border-border w-full' : 'border-border'"
    >
      <app-icon name="search" class="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        #input
        type="search"
        role="combobox"
        aria-label="Buscar cursos e aulas"
        aria-autocomplete="list"
        [attr.aria-expanded]="showPanel()"
        aria-controls="lure-search-results"
        [attr.aria-activedescendant]="active() >= 0 ? 'lure-hit-' + active() : null"
        placeholder="Buscar cursos, aulas, mentores..."
        autocomplete="off"
        [value]="query()"
        (input)="onInput($event)"
        (focus)="focused.set(true)"
        (keydown)="onKey($event)"
        class="min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
        [class]="variant() === 'mobile' ? 'flex-1' : 'w-56 md:w-80'"
      />
      @if (loading()) {
        <app-spinner class="text-muted-foreground" />
      } @else if (query()) {
        <button type="button" (click)="clear()" class="text-muted-foreground transition hover:text-foreground" aria-label="Limpar busca">
          <app-icon name="x" class="h-4 w-4" />
        </button>
      }
    </div>

    @if (showPanel()) {
      <div
        id="lure-search-results"
        role="listbox"
        class="lure-pop-in dark-scope z-50 overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
        [class]="
          variant() === 'mobile'
            ? 'mt-3 max-h-[65vh] overflow-y-auto'
            : 'absolute left-0 top-full mt-2 max-h-[70vh] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto'
        "
      >
        @if (query().trim().length < 2) {
          <p class="px-4 py-5 text-sm text-muted-foreground">Digite pelo menos 2 letras para buscar.</p>
        } @else if (!results() && loading()) {
          <p class="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground"><app-spinner /> Buscando…</p>
        } @else if (error()) {
          <p class="px-4 py-5 text-sm text-red-400">Não foi possível buscar agora.</p>
        } @else if (hits().length === 0) {
          <p class="px-4 py-5 text-sm text-muted-foreground">Nada encontrado para “{{ query().trim() }}”.</p>
        } @else {
          @if (moduleHits().length) {
            <div class="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
              Módulos
            </div>
            @for (m of moduleHits(); track m.slug; let i = $index) {
              <button
                type="button"
                role="option"
                [id]="'lure-hit-' + i"
                [attr.aria-selected]="active() === i"
                (mouseenter)="active.set(i)"
                (click)="select(i)"
                class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition"
                [class]="active() === i ? 'bg-primary/10' : 'hover:bg-muted/60'"
              >
                <span class="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-black">
                  @if (m.coverUrl) {
                    <img [src]="m.coverUrl" alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover" />
                  } @else {
                    <img src="/lure-logo-large.png" alt="" class="absolute inset-0 m-auto h-6 w-6 object-contain opacity-80" />
                  }
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold" [class.text-primary]="active() === i">{{ m.title }}</span>
                  <span class="block truncate text-[11px] uppercase tracking-wider text-muted-foreground">{{ m.sectionTitle }}</span>
                </span>
                @if (m.locked) {
                  <span class="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <app-icon name="lock" class="h-3 w-3" /> Trancado
                  </span>
                }
              </button>
            }
          }
          @if (lessonHits().length) {
            <div class="border-t border-border/60 px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
              Aulas
            </div>
            @for (l of lessonHits(); track l.lessonId; let j = $index) {
              @let i = moduleHits().length + j;
              <button
                type="button"
                role="option"
                [id]="'lure-hit-' + i"
                [attr.aria-selected]="active() === i"
                (mouseenter)="active.set(i)"
                (click)="select(i)"
                class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition"
                [class]="active() === i ? 'bg-primary/10' : 'hover:bg-muted/60'"
              >
                <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-muted-foreground">
                  <app-icon name="play" class="h-3.5 w-3.5" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold" [class.text-primary]="active() === i">{{ l.lessonTitle }}</span>
                  <span class="block truncate text-xs text-muted-foreground">Aula {{ l.position }} · {{ l.moduleTitle }}</span>
                </span>
              </button>
            }
          }
          <div class="border-t border-border/60 px-4 py-2 text-[10px] text-muted-foreground/60">
            ↑ ↓ para navegar · Enter para abrir · Esc para fechar
          </div>
        }
      </div>
    }
  `,
})
export class SearchBoxComponent implements AfterViewInit {
  readonly variant = input<'desktop' | 'mobile'>('desktop');
  readonly autofocus = input(false);
  readonly navigated = output<void>();

  private readonly api = inject(CatalogApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly query = signal('');
  protected readonly focused = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly results = signal<SearchResultDto | null>(null);
  protected readonly active = signal(-1);

  protected readonly moduleHits = computed(() => {
    const r = this.results();
    if (!r) return [];
    // Membros não recebem trancados (regra do servidor); filtra por garantia.
    return this.auth.isAdmin() ? r.modules : r.modules.filter((m) => !m.locked);
  });
  protected readonly lessonHits = computed(() => this.results()?.lessons ?? []);
  protected readonly hits = computed<Hit[]>(() => [
    ...this.moduleHits().map((m) => ({ kind: 'module' as const, m })),
    ...this.lessonHits().map((l) => ({ kind: 'lesson' as const, l })),
  ]);
  protected readonly showPanel = computed(
    () => this.variant() === 'mobile' || (this.focused() && this.query().length > 0),
  );

  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((q) => {
          this.error.set(false);
          if (q.length < 2) {
            this.results.set(null);
            this.loading.set(false);
          } else {
            this.loading.set(true);
          }
        }),
        switchMap((q) =>
          q.length < 2
            ? of(null)
            : this.api.search(q).pipe(
                catchError(() => {
                  this.error.set(true);
                  return of(null);
                }),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.loading.set(false);
        this.results.set(r);
        this.active.set(r && (r.modules.length || r.lessons.length) ? 0 : -1);
      });
  }

  ngAfterViewInit(): void {
    if (this.autofocus()) setTimeout(() => this.inputEl().nativeElement.focus(), 30);
  }

  protected onInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.query.set(v);
    this.focused.set(true);
    this.search$.next(v.trim());
  }

  protected clear(): void {
    this.query.set('');
    this.results.set(null);
    this.search$.next('');
    this.inputEl().nativeElement.focus();
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.hits().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (n) this.active.set((this.active() + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) this.active.set((this.active() - 1 + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (n) this.select(Math.max(0, this.active()));
    } else if (e.key === 'Escape') {
      if (this.query()) {
        e.stopPropagation();
      }
      this.focused.set(false);
      this.inputEl().nativeElement.blur();
      if (this.variant() === 'mobile') this.navigated.emit();
    }
  }

  protected select(i: number): void {
    const hit = this.hits()[i];
    if (!hit) return;
    if (hit.kind === 'module') {
      void this.router.navigate(['/curso', hit.m.slug]);
    } else {
      void this.router.navigate(['/curso', hit.l.moduleSlug], { queryParams: { aula: hit.l.lessonId } });
    }
    this.focused.set(false);
    this.query.set('');
    this.results.set(null);
    this.search$.next('');
    this.inputEl().nativeElement.blur();
    this.navigated.emit();
  }

  protected onOutside(e: MouseEvent): void {
    if (this.variant() === 'desktop' && !this.el.nativeElement.contains(e.target as Node)) {
      this.focused.set(false);
    }
  }
}
