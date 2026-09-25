import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  input,
  output,
  viewChild,
} from '@angular/core';
import { isTopLayer, lockScroll, popLayer, pushLayer, unlockScroll } from './overlay';

/**
 * Modal base (bottom-sheet no mobile, centralizado no desktop).
 * Renderize com @if no pai; fecha com Esc / clique no fundo emitindo `closed`.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape($event)' },
  template: `
    <div
      class="dark-scope fixed inset-0 flex items-end justify-center sm:items-center"
      [class]="zClass()"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="label()"
    >
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="onBackdrop()"></div>
      <div
        #panel
        tabindex="-1"
        class="lure-pop-in relative z-10 max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-card shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)] outline-none sm:max-h-[88vh] sm:rounded-3xl"
        [class]="panelClass()"
      >
        <ng-content />
      </div>
    </div>
  `,
})
export class ModalComponent implements AfterViewInit, OnDestroy {
  readonly label = input('Janela');
  readonly panelClass = input('max-w-md');
  readonly zClass = input('z-[100]');
  /** Quando true, Esc/fundo não fecham (ex.: salvando). */
  readonly locked = input(false);
  readonly closed = output<void>();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly layer = pushLayer();
  private readonly previouslyFocused =
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  constructor() {
    lockScroll();
  }

  ngAfterViewInit(): void {
    const el = this.panel().nativeElement;
    const first = el.querySelector<HTMLElement>('[autofocus]');
    (first ?? el).focus({ preventScroll: true });
  }

  ngOnDestroy(): void {
    popLayer(this.layer);
    unlockScroll();
    this.previouslyFocused?.focus?.({ preventScroll: true });
  }

  protected onEscape(e: Event): void {
    if (!isTopLayer(this.layer) || this.locked()) return;
    e.stopPropagation();
    this.closed.emit();
  }

  protected onBackdrop(): void {
    if (!this.locked()) this.closed.emit();
  }
}
