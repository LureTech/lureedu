import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { UiService } from '../core/ui.service';
import { IconComponent } from '../shared/icon.component';
import { ADMIN_ITEMS, GENERAL_ITEMS, MENU_ITEMS, NavItem, injectUrlState, isNavActive, navIcon } from './nav';
import { ProfileMenuComponent } from './profile-menu.component';

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Animação temática de cada ícone no hover (keyframes `nav-ico-*` em styles.css). */
const ICON_ANIM: Record<string, string> = {
  home: 'hop',
  courses: 'flip',
  certs: 'swing',
  community: 'pop',
  diagnostic: 'beat',
  support: 'ring',
  settings: 'spin',
  accounts: 'stamp',
  modules: 'turn',
};

/**
 * Sidebar do desktop: recolhida (76px) e abre (260px) por cima do conteúdo ao passar o mouse
 * (ou Tab / toque no logo). Fecha ao tirar o mouse, clicar no logo, escolher um item ou Esc.
 */
@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, ProfileMenuComponent, NgTemplateOutlet],
  host: {
    class: 'contents',
    '(document:keydown)': 'onKey($event)',
    '(document:pointerdown)': 'onDocPointer($event)',
  },
  template: `
    <!-- Reserva os 76px no layout; a aside expandida sobrepõe o conteúdo. -->
    <div class="sticky top-0 z-40 hidden h-screen w-[76px] shrink-0 lg:block">
      <aside
        #aside
        class="dark-scope absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-border/60 bg-background bg-gradient-to-b from-surface/80 to-background px-4 py-5 transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        [class]="open() ? 'w-[260px] shadow-[24px_0_60px_-20px_rgba(0,0,0,0.85)]' : 'w-[76px]'"
        aria-label="Menu principal"
        (pointerenter)="onPointer($event, true)"
        (pointerleave)="onPointer($event, false)"
        (focusin)="onFocusIn()"
        (focusout)="onFocusOut($event)"
      >
        <button
          type="button"
          (click)="toggle()"
          class="group mb-8 flex w-full items-center gap-3 rounded-xl px-0.5 text-left"
          [title]="open() ? 'Fechar menu' : 'Abrir menu'"
          [attr.aria-label]="open() ? 'Fechar menu' : 'Abrir menu'"
          [attr.aria-expanded]="open()"
        >
          <div class="relative shrink-0">
            <div class="absolute inset-0 rounded-full bg-primary/25 opacity-0 blur-md transition group-hover:opacity-100"></div>
            <img src="/lure-logo-large.png" alt="Lure Digital" class="relative h-10 w-10 shrink-0 rounded-full object-contain" />
          </div>
          <div class="whitespace-nowrap leading-tight" [class]="reveal()">
            <div class="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Assessoria</div>
            <div class="font-display text-[15px] font-bold tracking-[0.14em]">LURE</div>
          </div>
        </button>

        <nav class="no-scrollbar flex min-h-0 w-full flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden">
          @for (g of groups(); track g.label) {
            <div class="flex w-full flex-col gap-1">
              <div class="relative mb-1 flex h-4 items-center px-3">
                <span
                  class="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/60"
                  [class]="reveal()"
                >
                  {{ g.label }}
                </span>
                <span
                  aria-hidden="true"
                  class="absolute left-2.5 top-1/2 h-px w-6 bg-border/60 transition-opacity duration-200"
                  [class.opacity-0]="open()"
                ></span>
              </div>
              @for (item of g.items; track item.key) {
                @let active = isActive(item);
                @let cls =
                  'nav-item group relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[13px] transition-colors ' +
                  (active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground hover:bg-white/[0.03] hover:text-foreground');
                @if (item.href) {
                  <a [href]="item.href" target="_blank" rel="noopener noreferrer" [class]="cls" (click)="close()">
                    <ng-container [ngTemplateOutlet]="content" [ngTemplateOutletContext]="{ $implicit: item, active }" />
                  </a>
                } @else if (item.to) {
                  <a
                    [routerLink]="item.to"
                    [queryParams]="item.query ?? null"
                    [class]="cls"
                    [attr.aria-current]="active ? 'page' : null"
                    (click)="close()"
                  >
                    <ng-container [ngTemplateOutlet]="content" [ngTemplateOutletContext]="{ $implicit: item, active }" />
                  </a>
                } @else {
                  <button type="button" (click)="close(); item.action === 'support' ? ui.openSupport() : ui.openProfile()" [class]="cls">
                    <ng-container [ngTemplateOutlet]="content" [ngTemplateOutletContext]="{ $implicit: item, active }" />
                  </button>
                }
              }
            </div>
          }
        </nav>

        <div class="mt-6 flex w-full flex-col">
          <!-- Largura fixa: o perfil é "revelado" pela aside enquanto ela expande, sem refluir o texto. -->
          <div [class]="open() ? 'sidebar-reveal w-[228px]' : 'w-11'">
            <app-profile-menu [open]="open()" />
          </div>
        </div>
      </aside>
    </div>

    <ng-template #content let-item let-active="active">
      @if (active) {
        <span class="absolute inset-0 rounded-xl bg-white/[0.06]"></span>
      }
      <app-icon
        [name]="icon(item, active)"
        [strokeWidth]="1.7"
        class="nav-ico relative h-[19px] w-[19px] shrink-0"
        [class.text-primary]="active"
        [attr.data-anim]="anim(item)"
      />
      <span class="relative whitespace-nowrap" [class]="reveal()">{{ item.label }}</span>
    </ng-template>
  `,
})
export class SidebarComponent {
  protected readonly ui = inject(UiService);
  private readonly auth = inject(AuthService);
  private readonly url = injectUrlState();
  private readonly profile = viewChild(ProfileMenuComponent);
  private readonly aside = viewChild.required<ElementRef<HTMLElement>>('aside');

  private readonly hovered = signal(false);
  /** Foco chegou por Tab (não por clique nem por foco devolvido ao fechar um modal). */
  private readonly tabFocus = signal(false);
  /** Aberta pelo logo sem hover (toque). */
  private readonly toggled = signal(false);
  /** Fechada com o mouse em cima: ignora o hover até o mouse sair e voltar. */
  private readonly suppressed = signal(false);
  private hoverTimer?: ReturnType<typeof setTimeout>;
  private lastKeyWasTab = false;

  protected readonly open = computed(
    () =>
      !!this.profile()?.menuOpen() ||
      this.toggled() ||
      (!this.suppressed() && (this.hovered() || this.tabFocus())),
  );
  /** Textos entram deslizando quando abre; somem na hora quando fecha (a largura já esconde). */
  protected readonly reveal = computed(() => (this.open() ? 'sidebar-reveal' : 'opacity-0'));

  protected readonly groups = computed<NavGroup[]>(() => {
    const g: NavGroup[] = [
      { label: 'Menu', items: MENU_ITEMS },
      { label: 'Geral', items: GENERAL_ITEMS },
    ];
    if (this.auth.isAdmin()) g.push({ label: 'Admin', items: ADMIN_ITEMS });
    return g;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.hoverTimer));
  }

  protected toggle(): void {
    if (this.open()) this.close();
    else this.toggled.set(true);
  }

  protected close(): void {
    clearTimeout(this.hoverTimer);
    this.hovered.set(false);
    this.tabFocus.set(false);
    this.toggled.set(false);
    this.suppressed.set(true);
  }

  /** Pequeno atraso ao abrir (evita abrir só de cruzar a borda) e ao fechar (evita piscar). */
  protected onPointer(e: PointerEvent, enter: boolean): void {
    this.suppressed.set(false);
    if (e.pointerType === 'touch') return;
    if (!enter) this.toggled.set(false);
    clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => this.hovered.set(enter), enter ? 90 : 180);
  }

  protected onKey(e: KeyboardEvent): void {
    this.lastKeyWasTab = e.key === 'Tab';
    if (e.key === 'Escape' && this.open() && !this.profile()?.menuOpen()) this.close();
  }

  protected onDocPointer(e: PointerEvent): void {
    this.lastKeyWasTab = false;
    if (this.toggled() && !this.aside().nativeElement.contains(e.target as Node)) this.toggled.set(false);
  }

  protected onFocusIn(): void {
    if (!this.lastKeyWasTab) return;
    this.suppressed.set(false);
    this.tabFocus.set(true);
  }

  protected onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (!next || !(e.currentTarget as HTMLElement).contains(next)) this.tabFocus.set(false);
  }

  protected isActive(item: NavItem): boolean {
    return isNavActive(item.key, this.url());
  }

  protected icon(item: NavItem, active: boolean): string {
    return navIcon(item.icon, active, 'duotone');
  }

  protected anim(item: NavItem): string {
    return ICON_ANIM[item.key] ?? 'pop';
  }
}
