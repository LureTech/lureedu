import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '../../core/api/catalog.api';
import { apiMessage, apiStatus } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { CatalogSectionDto, ModuleCardDto } from '../../core/models';
import { ModuleLockService } from '../../core/module-lock.service';
import { IconComponent } from '../../shared/icon.component';
import { ModuleCardMobileComponent } from '../../shared/module-card-mobile.component';
import { ModuleCardComponent } from '../../shared/module-card.component';

/** /secao/:id — "Ver todos" de uma seção (no original o botão não levava a lugar nenhum). */
@Component({
  selector: 'app-section-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, ModuleCardComponent, ModuleCardMobileComponent],
  template: `
    <div class="mx-auto max-w-[1400px] px-4 pt-8 md:px-10 lg:pt-10">
      <a routerLink="/" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
        <app-icon name="chevron-left" class="h-4 w-4" /> Início
      </a>

      @if (loading()) {
        <div class="mt-6 h-3 w-32 animate-pulse rounded bg-surface-elevated"></div>
        <div class="mt-3 h-8 w-80 max-w-full animate-pulse rounded bg-surface-elevated"></div>
        <div class="mt-8 grid grid-cols-2 gap-3.5 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
          @for (c of [1, 2, 3, 4]; track c) {
            <div class="aspect-[9/16] animate-pulse rounded-2xl border border-border bg-surface lg:aspect-auto lg:h-[440px]"></div>
          }
        </div>
      } @else if (notFound()) {
        <div class="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <app-icon name="triangle-alert" class="h-6 w-6 text-muted-foreground" />
          <p class="text-sm font-semibold">Seção não encontrada</p>
          <p class="max-w-sm text-xs text-muted-foreground">Ela pode ter sido removida ou renomeada.</p>
          <a routerLink="/" class="mt-2 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/25">
            Explorar catálogo
          </a>
        </div>
      } @else if (error()) {
        <div class="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <p class="text-sm font-semibold">Não foi possível carregar a seção</p>
          <p class="text-xs text-muted-foreground">{{ error() }}</p>
          <button type="button" (click)="load(id())" class="mt-2 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary">
            Tentar de novo
          </button>
        </div>
      } @else if (data(); as d) {
        <header class="mt-6">
          <div class="flex items-center gap-2">
            <span class="h-3 w-[3px] shrink-0 rounded-full bg-[var(--nav)]" aria-hidden="true"></span>
            <span class="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--nav)]">{{ d.section.title }}</span>
          </div>
          <h1 class="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">{{ d.section.subtitle || d.section.title }}</h1>
          <p class="mt-2 text-sm text-muted-foreground">
            {{ d.modules.length }} {{ d.modules.length === 1 ? 'módulo' : 'módulos' }}
          </p>
        </header>

        @if (d.modules.length === 0) {
          <div class="mt-8 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-14 text-center text-sm text-muted-foreground">
            Nenhum módulo nesta seção por enquanto.
          </div>
        } @else {
          <div class="mt-8 grid grid-cols-2 gap-3.5 lg:hidden">
            @for (m of d.modules; track m.id; let i = $index) {
              <app-module-card-mobile [m]="m" [isAdmin]="auth.isAdmin()" [index]="i" (lockToggle)="toggleLock($event)" />
            }
          </div>
          <div class="mt-8 hidden gap-5 lg:grid lg:grid-cols-3 xl:grid-cols-4">
            @for (m of d.modules; track m.id) {
              <app-module-card [m]="m" [isAdmin]="auth.isAdmin()" (lockToggle)="toggleLock($event)" />
            }
          </div>
        }
      }
    </div>
  `,
})
export class SectionPage {
  readonly id = input.required<string>();

  protected readonly auth = inject(AuthService);
  private readonly api = inject(CatalogApi);
  private readonly lock = inject(ModuleLockService);
  private readonly title = inject(Title);

  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<CatalogSectionDto | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected load(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set(null);
    this.api.section(id).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
        this.title.setTitle(`${d.section.title} — AssessoriaLure`);
      },
      error: (err) => {
        if (apiStatus(err) === 404) this.notFound.set(true);
        else this.error.set(apiMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected toggleLock(m: ModuleCardDto): void {
    this.lock.toggle(m.id, m.locked, (locked) => {
      const d = this.data();
      if (d) this.data.set({ ...d, modules: d.modules.map((x) => (x.id === m.id ? { ...x, locked } : x)) });
    });
  }
}
