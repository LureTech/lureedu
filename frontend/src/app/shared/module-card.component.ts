import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModuleCardDto } from '../core/models';
import { IconComponent } from './icon.component';

/** Card de módulo do desktop (h-[440px]) — portado do original. */
@Component({
  selector: 'app-module-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, NgTemplateOutlet],
  host: { class: 'block' },
  template: `
    <div class="group relative h-[440px] transition-transform duration-200 hover:-translate-y-1">
      @if (blocked()) {
        <div
          role="link"
          aria-disabled="true"
          [attr.aria-label]="m().title + ' — em breve'"
          class="relative flex h-full cursor-not-allowed flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card transition-[border-color] duration-200 group-hover:border-primary/60 group-hover:shadow-[var(--shadow-card)]"
          tabindex="0"
        >
          <ng-container [ngTemplateOutlet]="inner" />
        </div>
      } @else {
        <a
          [routerLink]="['/curso', m().slug]"
          [attr.aria-label]="m().title"
          class="relative flex h-full flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card transition-[border-color] duration-200 group-hover:border-primary/60 group-hover:shadow-[var(--shadow-card)]"
        >
          <ng-container [ngTemplateOutlet]="inner" />
        </a>
      }

      @if (isAdmin()) {
        <button
          type="button"
          (click)="lockToggle.emit(m())"
          [title]="m().locked ? 'Liberar módulo para os alunos' : 'Trancar módulo'"
          [attr.aria-label]="m().locked ? 'Liberar módulo para os alunos' : 'Trancar módulo'"
          class="absolute right-5 top-5 z-30 flex h-10 w-10 items-center justify-center rounded-full border transition focus:opacity-100"
          [class]="
            m().locked
              ? 'border-primary/40 bg-background/85 text-primary opacity-100'
              : 'border-border bg-background/70 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100'
          "
        >
          <app-icon [name]="m().locked ? 'lock' : 'lock-open'" class="h-4 w-4" />
        </button>
      }
    </div>

    <ng-template #inner>
      @if (m().coverUrl) {
        <img
          [src]="m().coverUrl"
          [alt]="m().title"
          loading="lazy"
          decoding="async"
          class="pointer-events-none absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      } @else {
        <div class="pointer-events-none absolute inset-0 bg-black"></div>
        <div class="pointer-events-none absolute inset-0 grid place-items-center">
          <img
            src="/lure-logo-large.png"
            alt=""
            class="h-20 w-20 object-contain opacity-90 transition duration-500 group-hover:scale-105"
          />
        </div>
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
          style="background: radial-gradient(ellipse 70% 90% at 50% 100%, rgba(187, 154, 53, 0.1), transparent 70%)"
        ></div>
        <div
          class="pointer-events-none absolute -right-4 bottom-32 h-2 w-3/5 origin-right -rotate-[26deg] bg-gradient-to-r from-transparent via-primary/30 to-primary/70 blur-md"
        ></div>
        <div
          class="pointer-events-none absolute -right-4 bottom-32 h-[2px] w-3/5 origin-right -rotate-[26deg] bg-gradient-to-r from-transparent via-primary/70 to-[#F4D67A]"
        ></div>
        <div
          class="pointer-events-none absolute -right-4 bottom-[6.75rem] h-px w-2/5 origin-right -rotate-[26deg] bg-gradient-to-r from-transparent to-primary/50"
        ></div>
      }

      @if (m().locked) {
        <div class="pointer-events-none absolute inset-0 bg-background/45"></div>
      }
      @if (!m().locked && !isAdmin()) {
        <div
          class="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/70 opacity-0 transition group-hover:opacity-100 group-hover:backdrop-blur"
        >
          <app-icon name="play" [filled]="true" class="h-4 w-4 text-primary" />
        </div>
      }
      @if (blocked()) {
        <div
          class="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground"
        >
          <app-icon name="lock" class="h-4 w-4" />
        </div>
      }

      @if (m().coverUrl) {
        <!-- Capa é foto (não arte com o nome): degradê para o título ficar legível -->
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/70 to-transparent"></div>
      }
      <div class="relative flex flex-1 flex-col p-6">
        @if (!m().coverUrl) {
          <h3 class="font-display text-xl font-bold leading-snug">{{ m().title }}</h3>
        } @else {
          <h3 class="mt-auto font-display text-xl font-bold uppercase leading-tight text-white">{{ m().title }}</h3>
        }
        <div
          class="flex items-center justify-between gap-3 pt-3 text-xs"
          [class]="m().coverUrl ? 'text-white/75' : 'mt-auto pt-4 text-muted-foreground'"
        >
          <span class="truncate">{{ m().author || 'Time LURE' }}</span>
          <span class="flex shrink-0 items-center gap-1">
            <app-icon name="play" class="h-3 w-3" />
            {{ m().lessonCount }} {{ m().lessonCount === 1 ? 'aula' : 'aulas' }}
          </span>
        </div>
      </div>
      <div class="relative h-1.5 w-full bg-background/70">
        <div class="h-full bg-foreground/70 transition-all duration-700" [style.width.%]="progress()"></div>
      </div>

      @if (m().locked) {
        <div
          class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/70 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <div
            class="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-5 py-3 text-center backdrop-blur"
          >
            <span class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              <span class="relative flex h-2 w-2">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span class="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
              </span>
              Em gravação...
            </span>
            <span class="text-[11px] text-muted-foreground">
              {{ isAdmin() ? 'Clique no cadeado para liberar' : 'Novo módulo em breve' }}
            </span>
          </div>
        </div>
      }
    </ng-template>
  `,
})
export class ModuleCardComponent {
  readonly m = input.required<ModuleCardDto>();
  readonly isAdmin = input(false);
  readonly lockToggle = output<ModuleCardDto>();

  protected readonly blocked = computed(() => this.m().locked && !this.isAdmin());
  protected readonly progress = computed(() => Math.max(0, Math.min(100, this.m().progress || 0)));
}
