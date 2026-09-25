import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

let ringSeq = 0;

/**
 * Anel de progresso.
 * - variant "sidebar": anel 36×36 com traço #BB9A35 (lista de aulas)
 * - variant "pill": anel 40×40 com gradiente e brilho (pílula do topo)
 */
@Component({
  selector: 'app-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative grid shrink-0 place-items-center' },
  template: `
    @if (variant() === 'pill') {
      <svg viewBox="0 0 40 40" class="h-10 w-10 -rotate-90" aria-hidden="true">
        <circle cx="20" cy="20" r="15.5" fill="none" stroke-width="3.5" class="stroke-foreground/12" />
        <circle
          cx="20"
          cy="20"
          r="15.5"
          fill="none"
          [attr.stroke]="'url(#' + gradId + ')'"
          stroke-width="3.5"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circ"
          [attr.stroke-dashoffset]="offset()"
          style="transition: stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1); filter: drop-shadow(0 0 4px var(--primary))"
        />
        <defs>
          <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#EBDDA9" />
            <stop offset="100%" stop-color="#BB9A35" />
          </linearGradient>
        </defs>
      </svg>
      <span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-foreground">
        {{ clamped() }}%
      </span>
    } @else {
      <svg viewBox="0 0 36 36" class="h-11 w-11 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-border" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#BB9A35"
          stroke-width="3"
          stroke-linecap="round"
          [attr.stroke-dasharray]="(clamped() / 100) * 97.4 + ' 97.4'"
          class="transition-all duration-500"
        />
      </svg>
      <span class="absolute text-[11px] font-bold">{{ clamped() }}%</span>
    }
  `,
})
export class ProgressRingComponent {
  readonly value = input(0);
  readonly variant = input<'pill' | 'sidebar'>('sidebar');

  protected readonly gradId = `lureProgress${++ringSeq}`;
  protected readonly circ = 2 * Math.PI * 15.5;
  protected readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.value() || 0))));
  protected readonly offset = computed(() => this.circ - (this.clamped() / 100) * this.circ);
}
