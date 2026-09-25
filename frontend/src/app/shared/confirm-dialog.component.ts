import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from '../core/confirm.service';
import { IconComponent } from './icon.component';
import { ModalComponent } from './modal.component';

/** Host global do diálogo de confirmação (montado no App). */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, IconComponent],
  template: `
    @if (confirm.pending(); as p) {
      <app-modal [label]="p.title" panelClass="max-w-sm" zClass="z-[140]" (closed)="confirm.settle(false)">
        <div class="p-6">
          <div class="flex items-start gap-3">
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              [class]="p.danger ? 'bg-red-500/10 text-red-400' : 'bg-primary/15 text-primary'"
            >
              <app-icon [name]="p.danger ? 'triangle-alert' : 'circle-check'" class="h-5 w-5" />
            </span>
            <div class="min-w-0">
              <h2 class="font-display text-lg font-bold leading-snug">{{ p.title }}</h2>
              @if (p.message) {
                <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ p.message }}</p>
              }
            </div>
          </div>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              (click)="confirm.settle(false)"
              class="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              {{ p.cancelLabel || 'Cancelar' }}
            </button>
            <button
              type="button"
              autofocus
              (click)="confirm.settle(true)"
              class="rounded-xl px-4 py-2.5 text-sm font-semibold transition"
              [class]="
                p.danger
                  ? 'border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25'
                  : 'gradient-gold text-primary-foreground hover:brightness-110'
              "
            >
              {{ p.confirmLabel || 'Confirmar' }}
            </button>
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);
}
