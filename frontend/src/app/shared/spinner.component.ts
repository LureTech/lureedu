import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

/** Spinner inline (loader-circle girando). */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { role: 'status', '[attr.aria-label]': 'label()' },
  styles: [':host{display:inline-flex;line-height:0}'],
  template: `<app-icon name="loader-circle" [class]="'animate-spin ' + size()" />`,
})
export class SpinnerComponent {
  readonly size = input('h-4 w-4');
  readonly label = input('Carregando');
}

/** Tela/bloco de carregamento "Carregando…" do original. */
@Component({
  selector: 'app-loading-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  template: `
    <div class="flex items-center justify-center gap-2 text-sm text-muted-foreground" [class]="pad()">
      <app-spinner />
      {{ text() }}
    </div>
  `,
})
export class LoadingBlockComponent {
  readonly text = input('Carregando…');
  readonly pad = input('py-16');
}

/** Carregamento em tela cheia (guard/bootstrap). */
@Component({
  selector: 'app-loading-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-screen place-items-center bg-background">
      <div class="flex flex-col items-center gap-4">
        <div class="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></div>
        <p class="text-sm text-muted-foreground">Carregando…</p>
      </div>
    </div>
  `,
})
export class LoadingScreenComponent {}
