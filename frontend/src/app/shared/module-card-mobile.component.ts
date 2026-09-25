import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModuleCardDto } from '../core/models';
import { IconComponent } from './icon.component';

/** Card de módulo do mobile (capa 9/16) — portado do original. */
@Component({
  selector: 'app-module-card-mobile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, NgTemplateOutlet],
  host: { class: 'block h-full' },
  template: `
    <div class="lure-rise group relative h-full" [style.--d]="index() * 70 + 'ms'">
      @if (blocked()) {
        <div
          role="link"
          aria-disabled="true"
          [attr.aria-label]="m().title + ' — em breve'"
          class="relative flex h-full cursor-not-allowed flex-col overflow-hidden rounded-2xl border border-primary/25 bg-surface/60 transition"
        >
          <ng-container [ngTemplateOutlet]="inner" />
        </div>
      } @else {
        <a
          [routerLink]="['/curso', m().slug]"
          [attr.aria-label]="m().title"
          class="relative flex h-full flex-col overflow-hidden rounded-2xl border border-primary/25 bg-surface/60 transition active:scale-[0.98]"
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
          class="absolute right-2.5 top-2.5 z-30 grid h-8 w-8 place-items-center rounded-lg backdrop-blur transition active:scale-90"
          [class]="m().locked ? 'bg-primary/25 text-primary' : 'bg-black/60 text-white/70'"
        >
          <app-icon [name]="m().locked ? 'lock' : 'lock-open'" class="h-3.5 w-3.5" />
        </button>
      }
    </div>

    <ng-template #inner>
      <div class="relative aspect-[9/16] w-full overflow-hidden bg-black">
        @if (m().coverUrl) {
          <img
            [src]="m().coverUrl"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            class="absolute inset-0 h-full w-full object-cover"
          />
        } @else {
          <div class="absolute inset-0 grid place-items-center bg-black">
            <img src="/lure-logo-large.png" alt="" aria-hidden="true" class="h-12 w-12 object-contain opacity-90" />
          </div>
        }
        <div class="compat-scrim-y absolute inset-0 bg-gradient-to-t from-black/45 to-transparent"></div>
        @if (m().locked) {
          <div class="absolute inset-0 bg-background/45"></div>
        }
        @if (blocked()) {
          <span
            class="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-lg bg-black/70 text-white/85 backdrop-blur"
          >
            <app-icon name="lock" class="h-3.5 w-3.5" />
          </span>
          <span
            class="absolute inset-x-2.5 bottom-2.5 flex flex-col items-center gap-0.5 rounded-lg bg-black/70 px-2 py-1.5 text-center backdrop-blur"
          >
            <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">Em gravação...</span>
            <span class="text-[9px] text-white/70">Novo módulo em breve</span>
          </span>
        }
      </div>
      <div class="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        @if (!m().coverUrl) {
          <h3 class="line-clamp-2 text-[15px] font-medium leading-snug text-foreground">{{ m().title }}</h3>
        }
        <div class="mt-auto flex items-center gap-2.5 pt-2">
          <span class="shrink-0 text-[12px] tabular-nums text-muted-foreground">{{ progress() }}%</span>
          <span class="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <span class="block h-full rounded-full gradient-gold transition-all duration-700" [style.width.%]="progress()"></span>
          </span>
        </div>
      </div>
    </ng-template>
  `,
})
export class ModuleCardMobileComponent {
  readonly m = input.required<ModuleCardDto>();
  readonly isAdmin = input(false);
  readonly index = input(0);
  readonly lockToggle = output<ModuleCardDto>();

  protected readonly blocked = computed(() => this.m().locked && !this.isAdmin());
  protected readonly progress = computed(() => Math.max(0, Math.min(100, Math.round(this.m().progress || 0))));
}
