import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { UiService, WHATSAPP_SUPPORT } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';
import { lockScroll, unlockScroll } from '../shared/overlay';
import { NavItem, injectUrlState, isNavActive, navIcon } from './nav';
import { NotificationsBellComponent } from './notifications-bell.component';
import { SearchBoxComponent } from './search-box.component';

/** Barra superior do mobile (menu, logo, busca, sino, avatar). */
@Component({
  selector: 'app-mobile-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, AvatarComponent, NotificationsBellComponent, SearchBoxComponent, ModalComponent],
  template: `
    <header class="sticky top-0 z-40 flex items-center justify-between bg-background px-4 pb-3 safe-top lg:hidden">
      <button
        type="button"
        (click)="ui.drawerOpen.set(true)"
        aria-label="Abrir menu"
        class="grid h-10 w-10 place-items-center rounded-xl text-foreground transition active:scale-95"
      >
        <app-icon name="menu" class="h-6 w-6" [strokeWidth]="1.8" />
      </button>
      <a routerLink="/" class="flex items-center gap-2" aria-label="AssessoriaLure — início">
        <img src="/lure-logo-large.png" alt="" class="h-7 w-7 object-contain" />
        <span class="font-display text-[17px] leading-none tracking-tight">
          <span class="font-normal">Assessoria</span><span class="font-bold">Lure</span>
        </span>
      </a>
      <div class="flex items-center gap-0.5">
        <button
          type="button"
          (click)="ui.mobileSearchOpen.set(true)"
          aria-label="Buscar"
          class="grid h-10 w-10 place-items-center rounded-xl text-foreground transition active:scale-95"
        >
          <app-icon name="search" class="h-[21px] w-[21px]" [strokeWidth]="1.8" />
        </button>
        <app-notifications-bell variant="mobile" />
        <button
          type="button"
          (click)="ui.openProfile()"
          aria-label="Editar perfil"
          class="relative ml-1 h-10 w-10 shrink-0 rounded-full ring-2 ring-white/15 transition active:scale-95"
        >
          <app-avatar
            [url]="auth.user()?.avatarUrl"
            [name]="auth.user()?.fullName"
            [email]="auth.user()?.email"
            class="h-10 w-10"
          />
          <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background"></span>
        </button>
      </div>
    </header>

    @if (ui.mobileSearchOpen()) {
      <app-modal label="Buscar" panelClass="mx-2 mt-[calc(env(safe-area-inset-top)+0.5rem)] max-w-lg self-start rounded-b-3xl p-4 sm:mx-0 sm:mt-0 sm:self-center" zClass="z-[90]" (closed)="ui.mobileSearchOpen.set(false)">
        <div class="flex items-center gap-2">
          <app-search-box class="min-w-0 flex-1" variant="mobile" [autofocus]="true" (navigated)="ui.mobileSearchOpen.set(false)" />
          <button
            type="button"
            (click)="ui.mobileSearchOpen.set(false)"
            class="grid h-10 w-10 shrink-0 place-items-center self-start rounded-full text-muted-foreground transition hover:text-foreground"
            aria-label="Fechar busca"
          >
            <app-icon name="x" class="h-5 w-5" />
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class MobileTopbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly ui = inject(UiService);
}

/** Drawer lateral do mobile. */
@Component({
  selector: 'app-mobile-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, AvatarComponent],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="lg:hidden" [class.pointer-events-none]="!open()" [attr.aria-hidden]="!open()">
      <div
        (click)="close()"
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        [class]="open() ? 'opacity-100' : 'opacity-0'"
      ></div>
      <aside
        class="dark-scope fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-[320px] flex-col overflow-y-auto border-r border-border/60 bg-gradient-to-b from-surface to-background shadow-2xl transition-transform duration-300 ease-out"
        [class]="open() ? 'translate-x-0' : '-translate-x-full'"
        style="padding-top: calc(env(safe-area-inset-top) + 1rem)"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        [attr.inert]="open() ? null : ''"
      >
        <div class="flex items-center justify-between px-5">
          <div class="flex items-center gap-2.5">
            <img src="/lure-logo-large.png" alt="LURE" class="h-9 w-9 object-contain" />
            <span class="font-display text-[17px] leading-none tracking-tight">
              <span class="font-normal">Assessoria</span><span class="font-bold">Lure</span>
            </span>
          </div>
          <button
            type="button"
            (click)="close()"
            aria-label="Fechar menu"
            class="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition active:scale-95"
          >
            <app-icon name="x" class="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          (click)="ui.openProfile()"
          class="mx-4 mt-6 flex items-center gap-3 rounded-2xl border border-border/60 bg-surface-elevated/60 p-3 text-left transition active:scale-[0.99]"
        >
          <app-avatar [url]="auth.user()?.avatarUrl" [name]="auth.user()?.fullName" [email]="auth.user()?.email" class="h-11 w-11" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold">{{ auth.displayName() }}</div>
            <div class="truncate text-[11px] text-muted-foreground">{{ auth.isAdmin() ? 'Administrador' : 'Membro' }}</div>
          </div>
          <app-icon name="chevron-right" class="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        <nav class="mt-6 flex flex-col gap-1 px-3" aria-label="Navegação">
          @for (item of items; track item.key) {
            @let active = isActive(item);
            <a
              [routerLink]="item.to"
              [queryParams]="item.query ?? null"
              (click)="close()"
              [attr.aria-current]="active ? 'page' : null"
              class="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition active:bg-muted/60"
              [class]="active ? 'bg-primary/10 text-primary' : 'text-foreground/90'"
            >
              <app-icon
                [name]="icon(item.icon, active)"
                [strokeWidth]="1.7"
                class="h-5 w-5"
                [class]="active ? 'text-primary' : 'text-muted-foreground'"
              />
              {{ item.label }}
            </a>
          }
        </nav>
        <div class="mx-3 my-4 h-px bg-border/50"></div>
        <div class="flex flex-col gap-1 px-3">
          <a
            [href]="support"
            target="_blank"
            rel="noopener noreferrer"
            (click)="close()"
            class="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-foreground/90 transition active:bg-muted/60"
          >
            <app-icon name="ph-headset" class="h-5 w-5 text-muted-foreground" /> Suporte
          </a>
          <button
            type="button"
            (click)="ui.openProfile()"
            class="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-medium text-foreground/90 transition active:bg-muted/60"
          >
            <app-icon name="ph-gear-six" class="h-5 w-5 text-muted-foreground" /> Configurações
          </button>
          @if (auth.isAdmin()) {
            <a
              routerLink="/admin"
              (click)="close()"
              class="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-foreground/90 transition active:bg-muted/60"
            >
              <app-icon name="ph-shield-star" class="h-5 w-5 text-muted-foreground" /> Administração
            </a>
            <a
              routerLink="/admin/modulos"
              (click)="close()"
              class="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-foreground/90 transition active:bg-muted/60"
            >
              <app-icon name="layout-grid" [strokeWidth]="1.7" class="h-5 w-5 text-muted-foreground" /> Módulos
            </a>
          }
        </div>
        <div class="mt-auto px-3 pt-4" style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)">
          <button
            type="button"
            (click)="signOut()"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-red-400 transition active:bg-red-500/10"
          >
            <app-icon name="ph-sign-out" class="h-5 w-5" /> Sair
          </button>
        </div>
      </aside>
    </div>
  `,
})
export class MobileDrawerComponent {
  protected readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);
  private readonly url = injectUrlState();
  protected readonly open = this.ui.drawerOpen;
  protected readonly support = WHATSAPP_SUPPORT;
  protected readonly items: NavItem[] = [
    { key: 'home', label: 'Início', icon: 'ph-house-simple', to: '/' },
    { key: 'courses', label: 'Meus cursos', icon: 'ph-book-open-text', to: '/meus-cursos', query: { tab: 'andamento' } },
    { key: 'community', label: 'Comunidade', icon: 'ph-users-three', to: '/comunidade' },
    { key: 'certs', label: 'Certificados', icon: 'ph-certificate', to: '/meus-cursos', query: { tab: 'certificados' } },
  ];

  constructor() {
    // Trava a rolagem do body enquanto o drawer está aberto.
    effect((onCleanup) => {
      if (!this.open()) return;
      lockScroll();
      onCleanup(() => unlockScroll());
    });
  }

  protected isActive(item: NavItem): boolean {
    return isNavActive(item.key, this.url());
  }

  protected icon(icon: string, active: boolean): string {
    return navIcon(icon, active, 'fill');
  }

  protected close(): void {
    if (this.open()) this.ui.drawerOpen.set(false);
  }

  protected signOut(): void {
    this.close();
    void this.auth.logout();
  }
}

/** Barra de abas inferior do mobile. */
@Component({
  selector: 'app-mobile-tabbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-[#0A0A0A] lg:hidden" aria-label="Navegação inferior">
      <ul class="flex items-stretch safe-bottom-nav">
        @for (t of tabs; track t.key) {
          @let active = activeKey() === t.key;
          <li class="flex-1">
            <a
              [routerLink]="t.to"
              [queryParams]="t.query ?? null"
              [attr.aria-current]="active ? 'page' : null"
              class="flex w-full flex-col items-center gap-1 pb-1.5 pt-2.5"
              [class]="active ? 'text-[var(--nav)]' : 'text-muted-foreground'"
            >
              <app-icon [name]="active ? t.icon + '-fill' : t.icon" class="h-[21px] w-[21px]" />
              <span class="text-[10px] font-medium leading-none tracking-tight">{{ t.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class MobileTabbarComponent {
  private readonly url = injectUrlState();
  protected readonly tabs: NavItem[] = [
    { key: 'home', label: 'Início', icon: 'ph-house-simple', to: '/' },
    { key: 'courses', label: 'Cursos', icon: 'ph-book-open-text', to: '/meus-cursos', query: { tab: 'andamento' } },
    { key: 'community', label: 'Comunidade', icon: 'ph-users-three', to: '/comunidade' },
  ];
  protected readonly activeKey = computed(() => {
    const p = this.url().path;
    if (p === '/' || p.startsWith('/secao/')) return 'home';
    if (p.startsWith('/meus-cursos')) return 'courses';
    if (p.startsWith('/comunidade')) return 'community';
    return null;
  });
}
