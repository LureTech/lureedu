import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="flex min-h-[70vh] items-center justify-center px-4">
      <div class="max-w-md text-center">
        <div class="font-display text-7xl font-bold text-foreground">404</div>
        <h1 class="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h1>
        <p class="mt-2 text-sm text-muted-foreground">A página que você procura não existe ou foi movida.</p>
        <div class="mt-6">
          <a
            routerLink="/"
            class="inline-flex items-center justify-center rounded-xl gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  `,
})
export class NotFoundPage {}
