import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

/** Emite `inView` quando o elemento chega perto da tela (rolagem infinita). */
@Directive({ selector: '[appInView]' })
export class InViewDirective {
  /** Distância antes da borda da tela em que já conta como visível. */
  readonly inViewMargin = input('600px');
  readonly inView = output<void>();

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && this.inView.emit(), {
        rootMargin: this.inViewMargin(),
      });
      io.observe(el);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }
}
