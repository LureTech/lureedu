import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CommunityApi } from '../../core/api/community.api';
import { apiMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { CommentDto, PostDto } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { compactNumber, formatDateTime, timeShort } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';
import { SpinnerComponent } from '../../shared/spinner.component';
import { PostActionsComponent } from './post-actions.component';
import { CATEGORY_STYLE, PostTextComponent } from './post-text.component';

const MAX_COMMENT = 300;
const PREVIEW = 2;

/** Conversa aberta (estilo tweet expandido): post em destaque, resposta e todos os comentários. */
@Component({
  selector: 'app-community-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, SpinnerComponent, PostTextComponent, PostActionsComponent],
  template: `
    <article class="border-b border-border/60 px-4 pt-4 sm:px-5">
      <header class="flex items-center gap-3">
        <app-avatar [url]="post().author.avatarUrl" [name]="post().author.fullName" class="h-11 w-11" />
        <div class="min-w-0 flex-1 leading-tight">
          <div class="truncate text-[15px] font-bold">{{ post().author.fullName }}</div>
          <span class="mt-1 inline-block rounded-full px-2 py-px text-[10px] font-semibold" [class]="catStyle()">
            {{ post().category }}
          </span>
        </div>
        @if (post().canDelete) {
          <button
            type="button"
            (click)="remove.emit(post())"
            class="grid h-9 w-9 place-items-center rounded-full text-muted-foreground/70 transition hover:bg-red-500/10 hover:text-red-400"
            aria-label="Apagar publicação"
          >
            <app-icon name="trash-2" class="h-4 w-4" />
          </button>
        }
      </header>

      @if (post().body) {
        <app-post-text class="mt-3 text-[17px] leading-relaxed" [text]="post().body" (tag)="tag.emit($event)" />
      }
      @if (post().imageUrl) {
        <div class="mt-3 overflow-hidden rounded-2xl border border-border/80">
          <img
            [src]="post().imageUrl"
            alt="Imagem da publicação"
            decoding="async"
            [attr.width]="post().imageWidth"
            [attr.height]="post().imageHeight"
            class="h-auto w-full"
          />
        </div>
      }
      <time class="mt-4 block text-[14px] text-muted-foreground" [attr.datetime]="post().createdAt">{{ fullDate() }}</time>

      <div class="mt-3 flex gap-5 border-y border-border/60 py-3 text-[14px]">
        <span>
          <b class="font-bold tabular-nums">{{ compact(post().likesCount) }}</b>
          <span class="text-muted-foreground">{{ post().likesCount === 1 ? ' curtida' : ' curtidas' }}</span>
        </span>
        <span>
          <b class="font-bold tabular-nums">{{ compact(post().commentsCount) }}</b>
          <span class="text-muted-foreground">{{ post().commentsCount === 1 ? ' comentário' : ' comentários' }}</span>
        </span>
      </div>
      <app-post-actions class="block py-1" size="lg" [post]="post()" (comment)="focusReply()" (like)="like.emit(post())" />
    </article>

    <form class="flex gap-3 border-b border-border/60 px-4 py-3 sm:px-5" (submit)="send($event)">
      <app-avatar [url]="auth.user()?.avatarUrl" [name]="auth.user()?.fullName" [email]="auth.user()?.email" class="h-10 w-10" />
      <div class="min-w-0 flex-1">
        <div class="text-[13px] text-muted-foreground">
          Respondendo a <span class="text-primary">{{ firstName() }}</span>
        </div>
        <label for="thread-reply" class="sr-only">Escreva sua resposta</label>
        <textarea
          #reply
          id="thread-reply"
          rows="1"
          [value]="draft()"
          (input)="onDraft($event)"
          (keydown.control.enter)="send($event)"
          (keydown.meta.enter)="send($event)"
          [attr.maxlength]="maxComment"
          placeholder="Poste sua resposta"
          class="mt-1 block max-h-60 w-full resize-none bg-transparent py-1 text-[17px] leading-7 outline-none placeholder:text-muted-foreground/60"
        ></textarea>
        <div class="mt-2 flex items-center justify-end gap-3">
          @if (left() <= 60) {
            <span class="text-[12px] tabular-nums" [class]="left() <= 20 ? 'text-primary' : 'text-muted-foreground'">{{ left() }}</span>
          }
          <button
            type="submit"
            [disabled]="!draft().trim() || sending()"
            class="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-[14px] font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            @if (sending()) {
              <app-spinner size="h-3.5 w-3.5" />
            }
            Responder
          </button>
        </div>
        @if (error()) {
          <div class="mt-2 text-[12px] text-red-400" role="alert">{{ error() }}</div>
        }
      </div>
    </form>

    @if (loading()) {
      @for (i of [1, 2, 3]; track i) {
        <div class="flex gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
          <div class="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/[0.06]"></div>
          <div class="flex-1 space-y-2.5 pt-1">
            <div class="h-3 w-32 animate-pulse rounded bg-white/[0.06]"></div>
            <div class="h-3 w-full animate-pulse rounded bg-white/[0.06]"></div>
          </div>
        </div>
      }
    } @else {
      @for (c of newestFirst(); track c.id) {
        <div class="group/c flex gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
          <app-avatar [url]="c.author.avatarUrl" [name]="c.author.fullName" class="h-10 w-10" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 leading-5">
              <span class="truncate text-[15px] font-bold">{{ c.author.fullName }}</span>
              <span class="shrink-0 text-muted-foreground" aria-hidden="true">·</span>
              <time class="shrink-0 text-[14px] text-muted-foreground" [attr.datetime]="c.createdAt" [title]="dateOf(c.createdAt)">
                {{ short(c.createdAt) }}
              </time>
              @if (c.canDelete) {
                <button
                  type="button"
                  (click)="deleteComment(c)"
                  class="-my-1 -mr-2 ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground/70 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover/c:opacity-100 max-lg:opacity-100"
                  aria-label="Apagar comentário"
                >
                  <app-icon name="trash-2" class="h-3.5 w-3.5" />
                </button>
              }
            </div>
            <app-post-text class="mt-0.5 text-[15px] leading-[1.45] text-foreground/90" [text]="c.body" (tag)="tag.emit($event)" />
          </div>
        </div>
      } @empty {
        <div class="px-6 py-14 text-center">
          <div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <app-icon name="message-circle" class="h-5 w-5" />
          </div>
          <p class="mt-4 text-[15px] font-bold">Ninguém comentou ainda</p>
          <p class="mt-1 text-[14px] text-muted-foreground">Puxe a conversa — a primeira resposta é a que mais ajuda.</p>
        </div>
      }
    }
  `,
})
export class CommunityThreadComponent {
  readonly post = input.required<PostDto>();
  /** Veio do botão de comentar: já foca o campo de resposta. */
  readonly autofocus = input(false);
  readonly like = output<PostDto>();
  readonly remove = output<PostDto>();
  readonly tag = output<string>();
  /** Comentários mudaram: o feed atualiza a contagem e a prévia. */
  readonly comments = output<{ id: string; count: number; recent: CommentDto[] }>();

  protected readonly auth = inject(AuthService);
  private readonly api = inject(CommunityApi);
  private readonly confirm = inject(ConfirmService);
  private readonly replyBox = viewChild.required<ElementRef<HTMLTextAreaElement>>('reply');

  protected readonly maxComment = MAX_COMMENT;
  protected readonly list = signal<CommentDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly newestFirst = computed(() => [...this.list()].reverse());
  protected readonly left = computed(() => MAX_COMMENT - this.draft().length);
  protected readonly catStyle = computed(() => CATEGORY_STYLE[this.post().category] ?? CATEGORY_STYLE.Insight);
  protected readonly fullDate = computed(() => formatDateTime(this.post().createdAt));
  protected readonly firstName = computed(() => this.post().author.fullName.split(' ')[0]);

  constructor() {
    // recarrega os comentários só quando troca de post (não a cada curtida)
    let loadedFor: string | null = null;
    effect(() => {
      const id = this.post().id;
      if (id === loadedFor) return;
      loadedFor = id;
      untracked(() => this.load(id));
    });
    afterNextRender(() => {
      if (this.autofocus()) this.focusReply();
    });
  }

  protected focusReply(): void {
    const el = this.replyBox().nativeElement;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.comments(id).subscribe({
      next: (list) => {
        this.list.set(list);
        this.loading.set(false);
        this.emitChange();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiMessage(err, 'Não foi possível carregar os comentários.'));
      },
    });
  }

  protected onDraft(e: Event): void {
    const el = e.target as HTMLTextAreaElement;
    this.draft.set(el.value.slice(0, MAX_COMMENT));
    this.autosize(el);
  }

  private autosize(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  protected send(e: Event): void {
    e.preventDefault();
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    this.api.addComment(this.post().id, text).subscribe({
      next: (c) => {
        this.sending.set(false);
        this.draft.set('');
        this.replyBox().nativeElement.style.height = ''; // volta a 1 linha
        this.list.update((l) => [...l, c]);
        this.emitChange();
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(apiMessage(err, 'Não foi possível comentar.'));
      },
    });
  }

  protected async deleteComment(c: CommentDto): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Apagar comentário?', confirmLabel: 'Apagar', danger: true });
    if (!ok) return;
    const before = this.list();
    this.list.set(before.filter((x) => x.id !== c.id));
    this.emitChange();
    this.api.deleteComment(c.id).subscribe({
      error: (err) => {
        this.list.set(before);
        this.emitChange();
        this.error.set(apiMessage(err, 'Não foi possível apagar o comentário.'));
      },
    });
  }

  private emitChange(): void {
    const l = this.list();
    this.comments.emit({ id: this.post().id, count: l.length, recent: l.slice(-PREVIEW) });
  }

  protected short(iso: string): string {
    return timeShort(iso);
  }

  protected dateOf(iso: string): string {
    return formatDateTime(iso);
  }

  protected compact(n: number): string {
    return compactNumber(n);
  }
}
