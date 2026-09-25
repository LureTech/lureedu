import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { BlockedScreenComponent } from './pages/blocked/blocked-screen.component';
import { CertificateCelebrationComponent } from './shared/certificate-celebration.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog.component';
import { ToastsComponent } from './shared/toasts.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastsComponent, ConfirmDialogComponent, CertificateCelebrationComponent, BlockedScreenComponent],
  template: `
    <a
      href="#conteudo"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
    >
      Pular para o conteúdo
    </a>
    @if (auth.blocked()) {
      <app-blocked-screen />
    } @else {
      <router-outlet />
    }
    <app-certificate-celebration />
    <app-confirm-dialog />
    <app-toasts />
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
}
