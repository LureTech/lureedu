import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { PostDto } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { compactNumber } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';

/**
 * Comentar / curtir / compartilhar, estilo Twitter. `sm` (feed) mostra as contagens ao lado;
 * `lg` (conversa aberta) espalha os botões e deixa as contagens para a linha de estatísticas.
 */
@Component({
  selector: 'app-post-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="flex items-center" [class]="size() === 'lg' ? 'justify-around' : '-ml-2 max-w-[440px] justify-between'">
      <button
        type="button"
        (click)="$event.stopPropagation(); comment.emit()"
        class="group/a flex items-center text-muted-foreground transition-colors hover:text-primary"
        [attr.aria-label]="'Comentar (' + post().commentsCount + ')'"
      >
        <span class="grid place-items-center rounded-full transition-colors group-hover/a:bg-primary/10" [class]="btn()">
          <app-icon name="message-circle" [class]="ico()" />
        </span>
        @if (size() === 'sm') {
          <span class="min-w-6 text-[13px] tabular-nums">{{ post().commentsCount ? compact(post().commentsCount) : '' }}</span>
        }
      </button>

      <button
        type="button"
        (click)="$event.stopPropagation(); onLike()"
        class="group/a flex items-center transition-colors"
        [class]="post().likedByMe ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500'"
        [attr.aria-pressed]="post().likedByMe"
        [attr.aria-label]="(post().likedByMe ? 'Descurtir' : 'Curtir') + ' (' + post().likesCount + ')'"
      >
        <span
          class="relative grid place-items-center rounded-full transition-colors group-hover/a:bg-rose-500/10"
          [class]="btn()"
          [class.like-burst]="burst()"
        >
          <app-icon name="heart" [filled]="post().likedByMe" [class]="ico()" />
        </span>
        @if (size() === 'sm') {
          <span class="min-w-6 text-[13px] tabular-nums">{{ post().likesCount ? compact(post().likesCount) : '' }}</span>
        }
      </button>

      <button
        type="button"
        (click)="$event.stopPropagation(); share()"
        class="group/a flex items-center text-muted-foreground transition-colors hover:text-emerald-400"
        aria-label="Compartilhar"
        title="Copiar link"
      >
        <span class="grid place-items-center rounded-full transition-colors group-hover/a:bg-emerald-400/10" [class]="btn()">
          <app-icon name="share" [class]="ico()" />
        </span>
      </button>
    </div>
  `,
})
export class PostActionsComponent {
  readonly post = input.required<PostDto>();
  readonly size = input<'sm' | 'lg'>('sm');
  readonly comment = output<void>();
  readonly like = output<void>();

  private readonly toast = inject(ToastService);
  protected readonly burst = signal(false);
  private burstTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.burstTimer));
  }

  protected btn(): string {
    return this.size() === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  }

  protected ico(): string {
    return this.size() === 'lg' ? 'h-[22px] w-[22px]' : 'h-[18px] w-[18px]';
  }

  protected onLike(): void {
    if (!this.post().likedByMe) {
      clearTimeout(this.burstTimer);
      this.burst.set(false);
      // próximo frame: reinicia a animação mesmo em cliques seguidos
      requestAnimationFrame(() => this.burst.set(true));
      this.burstTimer = setTimeout(() => this.burst.set(false), 700);
    }
    this.like.emit();
  }

  /** Celular: folha de compartilhar do sistema. Desktop: copia o link da conversa. */
  protected async share(): Promise<void> {
    const url = `${location.origin}/comunidade?post=${this.post().id}`;
    if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: 'Comunidade LURE', text: this.post().body.slice(0, 120), url });
      } catch {
        // cancelado pelo usuário
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Link da publicação copiado.');
    } catch {
      this.toast.error('Não foi possível copiar o link.');
    }
  }

  protected compact(n: number): string {
    return compactNumber(n);
  }
}
