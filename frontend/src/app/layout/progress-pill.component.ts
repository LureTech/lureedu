import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgressStore } from '../core/progress.store';
import { ProgressRingComponent } from '../shared/progress-ring.component';

/** Pílula "Seu progresso" do topo (dados de /api/progress/summary). */
@Component({
  selector: 'app-progress-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressRingComponent, RouterLink],
  template: `
    <a
      routerLink="/meus-cursos"
      [queryParams]="{ tab: 'andamento' }"
      [title]="done() + ' de ' + total() + ' aulas concluídas'"
      [attr.aria-label]="'Seu progresso: ' + done() + ' de ' + total() + ' aulas concluídas'"
      class="group relative hidden items-center gap-3 overflow-hidden rounded-full border border-primary/25 bg-surface/80 py-1.5 pl-1.5 pr-4 shadow-sm backdrop-blur-md transition hover:border-primary/55 hover:shadow-[0_0_24px_-8px_var(--primary)] sm:flex"
    >
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-primary/22 to-transparent transition-all duration-700"
        [style.width.%]="barWidth()"
      ></span>
      <app-progress-ring variant="pill" [value]="pct()" class="relative h-10 w-10" />
      <div class="relative flex flex-col leading-tight">
        <span class="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Seu progresso</span>
        <span class="text-[12px] font-semibold tabular-nums text-foreground">
          {{ done() }}<span class="text-muted-foreground">/{{ total() }} aulas</span>
        </span>
      </div>
    </a>
  `,
})
export class ProgressPillComponent {
  private readonly store = inject(ProgressStore);
  protected readonly done = computed(() => this.store.summary()?.completedLessons ?? 0);
  protected readonly total = computed(() => this.store.summary()?.totalLessons ?? 0);
  protected readonly pct = computed(() => this.store.summary()?.percent ?? 0);
  protected readonly barWidth = computed(() => Math.max(this.pct(), 8));
}
