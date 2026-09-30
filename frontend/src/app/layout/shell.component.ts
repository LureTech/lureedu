import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, ResolveEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { CatalogStore } from '../core/catalog.store';
import { NotificationsStore } from '../core/notifications.store';
import { ProgressStore } from '../core/progress.store';
import { UiService } from '../core/ui.service';
import { BenefitsModalComponent } from './benefits-modal.component';
import { SupportModalComponent } from './support-modal.component';
import { MobileDrawerComponent, MobileTabbarComponent, MobileTopbarComponent } from './mobile-bars.component';
import { ProfileModalComponent } from './profile-modal.component';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

function hasBare(root: ActivatedRouteSnapshot | null): boolean {
  let r = root;
  while (r) {
    if (r.data['bare']) return true;
    r = r.firstChild;
  }
  return false;
}

/**
 * Layout autenticado: sidebar (desktop) + top bar, ou top bar/drawer/tab bar (mobile).
 * Rotas com `data: { bare: true }` (página do curso) renderizam sem o "chrome", como no original.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    MobileTopbarComponent,
    MobileDrawerComponent,
    MobileTabbarComponent,
    ProfileModalComponent,
    BenefitsModalComponent,
    SupportModalComponent,
  ],
  template: `
    <div class="min-h-screen bg-background text-foreground">
      <div class="flex">
        @if (!bare()) {
          <app-sidebar />
        }
        <div class="min-w-0 flex-1">
          @if (!bare()) {
            <app-mobile-topbar />
            <div class="hidden lg:block">
              <app-topbar />
            </div>
          }
          <main id="conteudo" [class]="bare() ? '' : 'pb-32 lg:pb-24'">
            <router-outlet />
          </main>
          @if (!bare()) {
            <app-mobile-tabbar />
          }
        </div>
      </div>
      @if (!bare()) {
        <app-mobile-drawer />
      }
    </div>

    @if (ui.profileOpen()) {
      <app-profile-modal />
    }
    <app-benefits-modal />
    <app-support-modal />
  `,
})
export class ShellComponent {
  protected readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly progress = inject(ProgressStore);
  private readonly notifications = inject(NotificationsStore);
  private readonly catalog = inject(CatalogStore);

  protected readonly bare = signal(hasBare(inject(ActivatedRoute).snapshot));

  constructor() {
    this.notifications.start();
    this.progress.refresh(0);
    inject(DestroyRef).onDestroy(() => {
      this.notifications.stop();
      this.notifications.reset();
      this.progress.reset();
      this.catalog.reset();
    });

    this.router.events
      .pipe(
        filter((e): e is ResolveEnd => e instanceof ResolveEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => this.bare.set(hasBare(e.state.root)));

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.ui.drawerOpen.set(false);
        this.ui.mobileSearchOpen.set(false);
        this.progress.refresh();
      });
  }
}
