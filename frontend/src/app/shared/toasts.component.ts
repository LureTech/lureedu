import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-24 z-[150] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
      aria-live="polite"
      role="status"
    >
      @for (t of toast.toasts(); track t.id) {
        <div
          class="lure-toast-in dark-scope pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur"
          [class]="
            t.kind === 'error'
              ? 'border-red-500/30 bg-[#1a0f0f]/95 text-red-300'
              : t.kind === 'success'
                ? 'border-emerald-500/30 bg-[#0f1a14]/95 text-emerald-300'
                : 'border-primary/30 bg-surface-elevated/95 text-foreground'
          "
        >
          <app-icon
            [name]="t.kind === 'error' ? 'triangle-alert' : t.kind === 'success' ? 'circle-check' : 'sparkles'"
            class="mt-0.5 h-4 w-4 shrink-0"
          />
          <span class="min-w-0 flex-1 leading-relaxed">{{ t.text }}</span>
          <button
            type="button"
            (click)="toast.dismiss(t.id)"
            class="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-full opacity-60 transition hover:opacity-100"
            aria-label="Fechar aviso"
          >
            <app-icon name="x" class="h-3.5 w-3.5" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastsComponent {
  protected readonly toast = inject(ToastService);
}
