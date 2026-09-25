import { Injectable, computed, inject, signal } from '@angular/core';
import { NotificationsApi } from './api/notifications.api';
import { NotificationDto } from './models';

const POLL_MS = 60_000;

/** Notificações in-app com polling a cada 60 s (enquanto o shell estiver montado). */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly api = inject(NotificationsApi);
  private timer: ReturnType<typeof setInterval> | null = null;
  private users = 0;

  readonly items = signal<NotificationDto[]>([]);
  readonly unread = signal(0);
  readonly loaded = signal(false);
  readonly hasUnread = computed(() => this.unread() > 0);

  start(): void {
    this.users++;
    if (this.timer) return;
    this.load();
    this.timer = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) this.load();
    }, POLL_MS);
  }

  stop(): void {
    this.users = Math.max(0, this.users - 1);
    if (this.users === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  load(): void {
    this.api.list(20).subscribe({
      next: (res) => {
        this.items.set(res.items ?? []);
        this.unread.set(res.unread ?? 0);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  markRead(n: NotificationDto): void {
    if (n.read) return;
    this.items.update((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    this.unread.update((u) => Math.max(0, u - 1));
    this.api.markRead(n.id).subscribe({ error: () => this.load() });
  }

  markAllRead(): void {
    if (this.unread() === 0) return;
    this.items.update((list) => list.map((x) => ({ ...x, read: true })));
    this.unread.set(0);
    this.api.markAllRead().subscribe({ error: () => this.load() });
  }

  reset(): void {
    this.items.set([]);
    this.unread.set(0);
    this.loaded.set(false);
  }
}
