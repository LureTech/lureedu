import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { CourseApi } from '../../core/api/course.api';
import { apiMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { CommentDto } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { SpinnerComponent } from '../../shared/spinner.component';
import { TimeAgoPipe } from '../../shared/time-ago.pipe';

/** Comentários do módulo (mais novos primeiro). */
@Component({
  selector: 'app-course-comments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, SpinnerComponent, TimeAgoPipe],
  template: `
    <section class="px-4 py-6 sm:px-6 lg:px-8" aria-labelledby="comments-title">
      <h2 id="comments-title" class="font-display text-lg font-bold">
        Comentários {{ loading() ? '' : '(' + comments().length + ')' }}
      </h2>
      <form class="mt-6 rounded-xl border border-border bg-surface p-5" (submit)="send($event)">
        <label for="comment-body" class="mb-3 block text-sm font-semibold">Deixe sua dúvida ou feedback:</label>
        <div class="flex gap-3">
          <app-avatar
            [url]="auth.user()?.avatarUrl"
            [name]="auth.user()?.fullName"
            [email]="auth.user()?.email"
            class="hidden h-10 w-10 sm:grid"
          />
          <textarea
            id="comment-body"
            rows="3"
            maxlength="1000"
            [value]="body()"
            (input)="body.set($any($event.target).value)"
            placeholder="Escreva seu comentário aqui..."
            class="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          ></textarea>
        </div>
        <div class="mt-3 flex items-center justify-between gap-3">
          <span class="text-[11px] tabular-nums text-muted-foreground/60">{{ body().length }}/1000</span>
          <button
            type="submit"
            [disabled]="sending() || !body().trim()"
            class="inline-flex items-center gap-2 rounded-lg gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            @if (sending()) {
              <app-spinner size="h-3.5 w-3.5" />
            } @else {
              <app-icon name="send" class="h-3.5 w-3.5" />
            }
            Enviar
          </button>
        </div>
      </form>

      <div class="mt-6 space-y-4">
        @if (loading()) {
          <div class="flex items-center gap-2 py-6 text-sm text-muted-foreground"><app-spinner /> Carregando comentários…</div>
        } @else if (loadError()) {
          <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {{ loadError() }}
            <button type="button" (click)="load(slug())" class="ml-2 font-semibold underline">Tentar de novo</button>
          </div>
        } @else if (comments().length === 0) {
          <div class="rounded-xl border border-dashed border-border bg-surface/50 py-10 text-center">
            <app-icon name="message-circle" class="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p class="mt-2 text-sm text-muted-foreground">Ainda não há comentários. Seja o primeiro!</p>
          </div>
        } @else {
          @for (c of comments(); track c.id) {
            <div class="flex gap-4">
              <app-avatar [url]="c.author.avatarUrl" [name]="c.author.fullName" class="h-10 w-10" />
              <div class="min-w-0 flex-1 rounded-xl border border-border bg-surface p-4">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-baseline gap-2">
                    <span class="truncate text-sm font-semibold text-primary">{{ c.author.fullName }}</span>
                    <span class="shrink-0 text-[11px] text-muted-foreground/70">{{ c.createdAt | timeAgo }}</span>
                  </div>
                  @if (c.canDelete) {
                    <button
                      type="button"
                      (click)="remove(c)"
                      class="text-muted-foreground transition hover:text-red-400"
                      title="Apagar comentário"
                      aria-label="Apagar comentário"
                    >
                      <app-icon name="trash-2" class="h-3.5 w-3.5" />
                    </button>
                  }
                </div>
                <p class="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{{ c.body }}</p>
              </div>
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class CourseCommentsComponent {
  readonly slug = input.required<string>();

  protected readonly auth = inject(AuthService);
  private readonly api = inject(CourseApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly comments = signal<CommentDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly body = signal('');
  protected readonly sending = signal(false);

  constructor() {
    effect(() => {
      const s = this.slug();
      untracked(() => this.load(s));
    });
  }

  protected load(slug: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.comments(slug).subscribe({
      next: (list) => {
        this.comments.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(apiMessage(err, 'Não foi possível carregar os comentários.'));
        this.loading.set(false);
      },
    });
  }

  protected send(e: Event): void {
    e.preventDefault();
    const text = this.body().trim();
    if (!text || this.sending()) return;
    this.sending.set(true);
    this.api.addComment(this.slug(), text).subscribe({
      next: (c) => {
        this.comments.update((list) => [c, ...list]);
        this.body.set('');
        this.sending.set(false);
      },
      error: (err) => {
        this.sending.set(false);
        this.toast.error(apiMessage(err, 'Não foi possível enviar o comentário.'));
      },
    });
  }

  protected async remove(c: CommentDto): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Apagar comentário?',
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (!ok) return;
    const before = this.comments();
    this.comments.set(before.filter((x) => x.id !== c.id));
    this.api.deleteComment(c.id).subscribe({
      error: (err) => {
        this.comments.set(before);
        this.toast.error(apiMessage(err, 'Não foi possível apagar o comentário.'));
      },
    });
  }
}
