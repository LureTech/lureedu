import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { UiService } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { IconComponent } from '../shared/icon.component';

/** Menu do perfil no rodapé da sidebar (Editar perfil / Administração / Sair). */
@Component({
  selector: 'app-profile-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AvatarComponent, IconComponent],
  host: {
    class: 'relative block w-full',
    '(document:mousedown)': 'onOutside($event)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
  template: `
    @if (open()) {
      <button
        type="button"
        (click)="menuOpen.set(!menuOpen())"
        [attr.aria-expanded]="menuOpen()"
        aria-haspopup="menu"
        class="flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition"
        [class]="menuOpen() ? 'border-primary/40 bg-surface-elevated' : 'border-border bg-surface hover:bg-surface-elevated'"
      >
        <app-avatar [url]="user()?.avatarUrl" [name]="user()?.fullName" [email]="user()?.email" class="h-10 w-10" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold">{{ auth.displayName() }}</div>
          <div class="truncate text-xs text-muted-foreground">{{ auth.isAdmin() ? 'Administrador' : 'Membro' }}</div>
        </div>
        <app-icon
          name="chevron-right"
          class="h-4 w-4 shrink-0 text-muted-foreground transition"
          [class.rotate-90]="menuOpen()"
        />
      </button>
    } @else {
      <button
        type="button"
        (click)="menuOpen.set(!menuOpen())"
        [title]="auth.displayName()"
        aria-label="Abrir menu do perfil"
        [attr.aria-expanded]="menuOpen()"
        aria-haspopup="menu"
        class="relative flex h-11 w-11 items-center justify-center rounded-full ring-2 ring-transparent transition hover:ring-primary/40"
      >
        <app-avatar [url]="user()?.avatarUrl" [name]="user()?.fullName" [email]="user()?.email" class="h-10 w-10" />
        <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-surface"></span>
      </button>
    }

    @if (menuOpen()) {
      <div
        role="menu"
        class="lure-pop-in absolute z-50 w-56 overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-2xl"
        [class]="open() ? 'bottom-full left-0 right-0 mb-2 w-auto' : 'bottom-0 left-full ml-3'"
      >
        <div class="border-b border-border px-3 py-3">
          <div class="truncate text-sm font-semibold">{{ auth.displayName() }}</div>
          <div class="truncate text-xs text-muted-foreground">{{ user()?.email }}</div>
        </div>
        <div class="p-1.5">
          <button
            type="button"
            role="menuitem"
            (click)="editProfile()"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/90 transition hover:bg-muted"
          >
            <app-icon name="settings" class="h-4 w-4" />
            Editar perfil
          </button>
          @if (auth.isAdmin()) {
            <a
              routerLink="/admin"
              role="menuitem"
              (click)="menuOpen.set(false)"
              class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/90 transition hover:bg-muted"
            >
              <app-icon name="shield-check" class="h-4 w-4" />
              Administração
            </a>
          }
          <button
            type="button"
            role="menuitem"
            (click)="signOut()"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
          >
            <app-icon name="log-out" class="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    }
  `,
})
export class ProfileMenuComponent {
  readonly open = input(true);

  protected readonly auth = inject(AuthService);
  private readonly ui = inject(UiService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly user = this.auth.user;
  /** Público: a sidebar fica aberta enquanto o menu estiver aberto. */
  readonly menuOpen = signal(false);

  protected onOutside(e: MouseEvent): void {
    if (this.menuOpen() && !this.el.nativeElement.contains(e.target as Node)) this.menuOpen.set(false);
  }

  protected editProfile(): void {
    this.menuOpen.set(false);
    this.ui.openProfile();
  }

  protected signOut(): void {
    this.menuOpen.set(false);
    void this.auth.logout();
  }
}
