import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { UiService } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { NotificationsBellComponent } from './notifications-bell.component';
import { ProgressPillComponent } from './progress-pill.component';
import { SearchBoxComponent } from './search-box.component';

/** Barra superior do desktop: busca, progresso, sino e perfil. */
@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchBoxComponent, ProgressPillComponent, NotificationsBellComponent, AvatarComponent],
  template: `
    <header
      class="dark-scope sticky top-0 z-30 flex h-18 items-center justify-between gap-4 border-b border-border/50 bg-background px-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.6)] md:px-10"
    >
      <app-search-box />
      <div class="flex items-center gap-3">
        <app-progress-pill />
        <app-notifications-bell />
        <button
          type="button"
          (click)="ui.openProfile()"
          title="Editar perfil"
          class="flex items-center gap-3 rounded-full border border-border bg-surface py-1 pl-1 pr-4 transition hover:border-primary/40"
        >
          <div class="relative h-8 w-8">
            <app-avatar
              [url]="auth.user()?.avatarUrl"
              [name]="auth.user()?.fullName"
              [email]="auth.user()?.email"
              class="h-8 w-8"
            />
            <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-surface"></span>
          </div>
          <div class="text-left text-sm">
            <div class="max-w-[160px] truncate font-medium leading-tight">{{ auth.displayName() }}</div>
            <div class="text-[11px] leading-tight text-muted-foreground">{{ auth.isAdmin() ? 'Administrador' : 'Membro' }}</div>
          </div>
        </button>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly ui = inject(UiService);
}
