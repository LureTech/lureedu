import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BLOCKED_MESSAGE } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { WHATSAPP_SUPPORT } from '../../core/ui.service';
import { IconComponent } from '../../shared/icon.component';

/** Tela "Acesso bloqueado" (403 com a mensagem de conta bloqueada). */
@Component({
  selector: 'app-blocked-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="grid min-h-screen place-items-center bg-background px-4">
      <div class="max-w-sm text-center" role="alert">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-red-400">
          <app-icon name="ban" class="h-6 w-6" />
        </div>
        <h1 class="mt-5 font-display text-xl font-bold">Acesso bloqueado</h1>
        <p class="mt-2 text-sm text-muted-foreground">{{ message }}</p>
        <div class="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button
            type="button"
            (click)="signOut()"
            class="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Sair
          </button>
          <a
            [href]="support"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-primary transition hover:underline"
          >
            Fale com o administrador
          </a>
        </div>
      </div>
    </div>
  `,
})
export class BlockedScreenComponent {
  private readonly auth = inject(AuthService);
  protected readonly message = BLOCKED_MESSAGE;
  protected readonly support = WHATSAPP_SUPPORT;

  protected signOut(): void {
    void this.auth.logout();
  }
}
