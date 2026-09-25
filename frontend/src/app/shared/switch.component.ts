import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Interruptor dourado (portado do original). */
@Component({
  selector: 'app-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      (click)="changed.emit(!checked())"
      class="relative h-6 w-11 shrink-0 rounded-full border transition disabled:opacity-50"
      [class]="checked() ? 'border-primary/50 gradient-gold' : 'border-border bg-surface'"
    >
      <span
        class="absolute top-0.5 rounded-full bg-white shadow transition-all"
        [class]="checked() ? 'left-[22px]' : 'left-0.5'"
        style="height: 18px; width: 18px"
      ></span>
    </button>
  `,
})
export class SwitchComponent {
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly label = input<string | null>(null);
  readonly changed = output<boolean>();
}
