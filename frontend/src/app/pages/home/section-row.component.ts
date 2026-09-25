import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogSectionDto, ModuleCardDto } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { ModuleCardMobileComponent } from '../../shared/module-card-mobile.component';
import { ModuleCardComponent } from '../../shared/module-card.component';

/** Linha de seção da Home: carrossel com setas (desktop) / grade 2 colunas (mobile). */
@Component({
  selector: 'app-section-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, ModuleCardComponent, ModuleCardMobileComponent],
  template: `
    <section class="mt-10 lg:mt-14" [attr.aria-labelledby]="'sec-' + data().section.id">
      <div class="mb-4 flex items-end justify-between gap-3 lg:mb-5">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="h-3 w-[3px] shrink-0 rounded-full bg-[var(--nav)]" aria-hidden="true"></span>
            <span class="truncate text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--nav)]">
              {{ data().section.title }}
            </span>
          </div>
          <h2
            [id]="'sec-' + data().section.id"
            class="mt-1.5 font-display text-[17px] font-semibold leading-snug tracking-tight text-foreground lg:text-[19px]"
          >
            {{ data().section.subtitle || data().section.title }}
          </h2>
        </div>
        <div class="flex shrink-0 items-center gap-4 text-sm text-muted-foreground">
          <span class="hidden lg:inline">
            {{ data().modules.length }} {{ data().modules.length === 1 ? 'módulo' : 'módulos' }}
          </span>
          <span class="hidden h-4 w-px bg-white/15 lg:block" aria-hidden="true"></span>
          <a
            [routerLink]="['/secao', data().section.id]"
            class="flex items-center gap-1 whitespace-nowrap text-[13px] text-[var(--nav)] transition hover:brightness-125 lg:text-sm"
          >
            Ver todos <app-icon name="chevron-right" class="h-4 w-4" />
          </a>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3.5 lg:hidden">
        @for (m of data().modules; track m.id; let i = $index) {
          <app-module-card-mobile [m]="m" [isAdmin]="isAdmin()" [index]="i" (lockToggle)="lockToggle.emit($event)" />
        }
      </div>

      <div class="relative hidden lg:block">
        <button
          type="button"
          aria-label="Anterior"
          (click)="scroll(-1)"
          class="absolute -left-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:border-primary/50 hover:text-primary lg:flex"
        >
          <app-icon name="chevron-left" class="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Próximo"
          (click)="scroll(1)"
          class="absolute -right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:border-primary/50 hover:text-primary lg:flex"
        >
          <app-icon name="chevron-right" class="h-5 w-5" />
        </button>
        <div
          #track
          class="no-scrollbar flex snap-x snap-proximity gap-5 overflow-x-auto overscroll-x-contain pb-2"
        >
          @for (m of data().modules; track m.id) {
            <div
              data-card
              class="w-[calc(100%-1rem)] shrink-0 snap-start sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.833rem)] xl:w-[calc(25%-0.9375rem)]"
            >
              <app-module-card [m]="m" [isAdmin]="isAdmin()" (lockToggle)="lockToggle.emit($event)" />
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class SectionRowComponent {
  readonly data = input.required<CatalogSectionDto>();
  readonly isAdmin = input(false);
  readonly lockToggle = output<ModuleCardDto>();

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected scroll(dir: number): void {
    const el = this.track().nativeElement;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const step = card ? card.offsetWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  }
}
