import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PostDto } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { formatDateTime, timeShort } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';
import { PostActionsComponent } from './post-actions.component';
import { CATEGORY_STYLE, PostTextComponent } from './post-text.component';

/**
 * Publicação no feed, estilo Twitter. Os 2 comentários mais novos aparecem embaixo, ligados ao
 * post por uma linha (thread); clicar no card abre a conversa inteira.
 */
@Component({
  selector: 'app-community-post',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AvatarComponent, IconComponent, PostTextComponent, PostActionsComponent],
  template: `
    <article
      class="group/post cursor-pointer border-b border-border/60 px-4 pt-3 transition-colors hover:bg-white/[0.02] sm:px-5"
      (click)="onCardClick()"
    >
      <div class="flex gap-3">
        <div class="flex w-10 shrink-0 flex-col items-center">
          <app-avatar [url]="post().author.avatarUrl" [name]="post().author.fullName" class="h-10 w-10" />
          @if (previews().length) {
            <span class="mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden="true"></span>
          }
        </div>
        <div class="min-w-0 flex-1 pb-2">
          <header class="flex items-center gap-1.5 leading-5">
            <span class="truncate text-[15px] font-bold text-foreground">{{ post().author.fullName }}</span>
            <span class="shrink-0 rounded-full px-2 py-px text-[10px] font-semibold" [class]="catStyle()">
              {{ post().category }}
            </span>
            <span class="shrink-0 text-muted-foreground" aria-hidden="true">·</span>
            <a
              [routerLink]="[]"
              [queryParams]="{ post: post().id }"
              queryParamsHandling="merge"
              (click)="$event.stopPropagation()"
              class="shrink-0 text-[14px] text-muted-foreground hover:underline"
              [title]="fullDate()"
            >
              <time [attr.datetime]="post().createdAt">{{ short(post().createdAt) }}</time>
            </a>
            @if (post().canDelete) {
              <button
                type="button"
                (click)="$event.stopPropagation(); remove.emit(post())"
                class="-my-1 -mr-2 ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground/70 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover/post:opacity-100 max-lg:opacity-100"
                aria-label="Apagar publicação"
              >
                <app-icon name="trash-2" class="h-4 w-4" />
              </button>
            }
          </header>

          @if (post().body) {
            <app-post-text
              class="mt-0.5 text-[15px] leading-[1.45] text-foreground/95"
              [text]="post().body"
              (tag)="tag.emit($event)"
            />
          }
          @if (post().imageUrl) {
            <div class="mt-3 overflow-hidden rounded-2xl border border-border/80">
              <img
                [src]="post().imageUrl"
                alt="Imagem da publicação"
                loading="lazy"
                decoding="async"
                [attr.width]="post().imageWidth"
                [attr.height]="post().imageHeight"
                [style.aspect-ratio]="ratio()"
                class="max-h-[520px] w-full object-cover"
              />
            </div>
          }

          <app-post-actions
            class="mt-1 block"
            [post]="post()"
            (comment)="comment.emit(post())"
            (like)="like.emit(post())"
          />
        </div>
      </div>

      @for (c of previews(); track c.id; let last = $last) {
        <div class="flex gap-3">
          <div class="flex w-10 shrink-0 flex-col items-center">
            <app-avatar [url]="c.author.avatarUrl" [name]="c.author.fullName" class="h-8 w-8" />
            @if (!last || more() > 0) {
              <span class="mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden="true"></span>
            }
          </div>
          <div class="min-w-0 flex-1 pb-3">
            <div class="flex items-center gap-1.5 text-[13px] leading-5">
              <span class="truncate font-bold text-foreground">{{ c.author.fullName }}</span>
              <span class="shrink-0 text-muted-foreground" aria-hidden="true">·</span>
              <time class="shrink-0 text-muted-foreground" [attr.datetime]="c.createdAt">{{ short(c.createdAt) }}</time>
            </div>
            <app-post-text
              class="line-clamp-3 text-[14px] leading-snug text-foreground/85"
              [text]="c.body"
              (tag)="tag.emit($event)"
            />
          </div>
        </div>
      }
      @if (more() > 0) {
        <div class="-mt-1 flex items-center gap-3 pb-3">
          <div class="flex w-10 shrink-0 justify-center" aria-hidden="true">
            <span class="flex gap-0.5">
              <span class="h-1 w-1 rounded-full bg-border"></span>
              <span class="h-1 w-1 rounded-full bg-border"></span>
              <span class="h-1 w-1 rounded-full bg-border"></span>
            </span>
          </div>
          <span class="text-[13px] font-medium text-primary group-hover/post:underline">
            {{ more() === 1 ? 'Ver mais 1 comentário' : 'Ver mais ' + more() + ' comentários' }}
          </span>
        </div>
      }
    </article>
  `,
})
export class CommunityPostComponent {
  readonly post = input.required<PostDto>();
  readonly open = output<PostDto>();
  readonly comment = output<PostDto>();
  readonly like = output<PostDto>();
  readonly remove = output<PostDto>();
  readonly tag = output<string>();

  protected readonly previews = computed(() => this.post().recentComments ?? []);
  protected readonly more = computed(() => Math.max(0, this.post().commentsCount - this.previews().length));
  protected readonly catStyle = computed(() => CATEGORY_STYLE[this.post().category] ?? CATEGORY_STYLE.Insight);
  protected readonly fullDate = computed(() => formatDateTime(this.post().createdAt));
  protected readonly ratio = computed(() => {
    const p = this.post();
    return p.imageWidth && p.imageHeight ? `${p.imageWidth} / ${p.imageHeight}` : null;
  });

  /** Abre a conversa — a não ser que a pessoa esteja só selecionando texto. */
  protected onCardClick(): void {
    if (window.getSelection()?.toString()) return;
    this.open.emit(this.post());
  }

  protected short(iso: string): string {
    return timeShort(iso);
  }
}
