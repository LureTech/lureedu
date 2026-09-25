import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationDto, NotificationType } from '../core/models';
import { NotificationsStore } from '../core/notifications.store';
import { IconComponent } from '../shared/icon.component';
import { SpinnerComponent } from '../shared/spinner.component';
import { TimeAgoPipe } from '../shared/time-ago.pipe';

const TYPE_ICON: Record<NotificationType, string> = {
  LIKE: 'heart',
  COMMENT: 'message-circle',
  NEW_CONTENT: 'sparkles',
  COMMUNITY: 'users',
  SYSTEM: 'bell',
};

/** Sino com contador REAL de não lidas + dropdown (marcar uma/todas, clique navega). */
@Component({
  selector: 'app-notifications-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TimeAgoPipe, SpinnerComponent],
  host: {
    class: 'relative block',
    '(document:mousedown)': 'onOutside($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    @if (variant() === 'mobile') {
      <button
        type="button"
        (click)="toggle()"
        [attr.aria-label]="label()"
        [attr.aria-expanded]="open()"
        aria-haspopup="dialog"
        class="relative grid h-10 w-10 place-items-center rounded-xl text-foreground transition active:scale-95"
      >
        <app-icon name="bell" class="h-[22px] w-[22px]" [strokeWidth]="1.7" />
        @if (store.hasUnread()) {
          <span
            class="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--nav)] px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background"
          >
            {{ badge() }}
          </span>
        }
      </button>
    } @else {
      <button
        type="button"
        (click)="toggle()"
        [attr.aria-label]="label()"
        [attr.aria-expanded]="open()"
        aria-haspopup="dialog"
        class="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted-foreground transition hover:text-foreground"
        [class.text-foreground]="open()"
      >
        <app-icon name="bell" class="h-4 w-4" />
        @if (store.hasUnread()) {
          <span
            class="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background"
          >
            {{ badge() }}
          </span>
        }
      </button>
    }

    @if (open()) {
      <div
        role="dialog"
        aria-label="Notificações"
        class="lure-pop-in dark-scope z-50 overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
        [class]="
          variant() === 'mobile'
            ? 'fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.25rem)]'
            : 'absolute right-0 top-full mt-2 w-[380px]'
        "
      >
        <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="font-display text-sm font-bold">Notificações</span>
            @if (store.hasUnread()) {
              <span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                {{ store.unread() }} {{ store.unread() === 1 ? 'nova' : 'novas' }}
              </span>
            }
          </div>
          <button
            type="button"
            (click)="store.markAllRead()"
            [disabled]="!store.hasUnread()"
            class="text-xs font-medium text-primary transition hover:brightness-125 disabled:cursor-default disabled:text-muted-foreground/50"
          >
            Marcar todas como lidas
          </button>
        </div>
        <div class="max-h-[60vh] overflow-y-auto overscroll-contain">
          @if (!store.loaded()) {
            <div class="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <app-spinner /> Carregando…
            </div>
          } @else if (store.items().length === 0) {
            <div class="px-6 py-12 text-center">
              <app-icon name="bell-off" class="mx-auto h-6 w-6 text-muted-foreground/40" />
              <p class="mt-3 text-sm text-muted-foreground">Nenhuma notificação por aqui.</p>
            </div>
          } @else {
            <ul class="divide-y divide-border/60">
              @for (n of store.items(); track n.id) {
                <li>
                  <button
                    type="button"
                    (click)="openItem(n)"
                    class="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/60"
                    [class]="n.read ? '' : 'bg-primary/5'"
                  >
                    <span
                      class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                      [class]="n.read ? 'bg-background text-muted-foreground' : 'bg-primary/15 text-primary'"
                    >
                      <app-icon [name]="icon(n.type)" class="h-4 w-4" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm leading-snug" [class]="n.read ? 'text-foreground/80' : 'font-semibold text-foreground'">
                        {{ n.title }}
                      </span>
                      @if (n.body) {
                        <span class="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{{ n.body }}</span>
                      }
                      <span class="mt-1 block text-[11px] text-muted-foreground/70">{{ n.createdAt | timeAgo }}</span>
                    </span>
                    @if (!n.read) {
                      <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lida"></span>
                    }
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      </div>
    }
  `,
})
export class NotificationsBellComponent {
  readonly variant = input<'desktop' | 'mobile'>('desktop');

  protected readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly open = signal(false);

  protected badge(): string {
    const u = this.store.unread();
    return u > 9 ? '9+' : String(u);
  }

  protected label(): string {
    const u = this.store.unread();
    return u > 0 ? `Notificações (${u} não lidas)` : 'Notificações';
  }

  protected icon(t: NotificationType): string {
    return TYPE_ICON[t] ?? 'bell';
  }

  protected toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) this.store.load();
  }

  protected openItem(n: NotificationDto): void {
    this.store.markRead(n);
    this.open.set(false);
    const link = n.link?.trim();
    if (!link) return;
    if (link.startsWith('/')) void this.router.navigateByUrl(link);
    else window.open(link, '_blank', 'noopener');
  }

  protected onOutside(e: MouseEvent): void {
    if (this.open() && !this.el.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
