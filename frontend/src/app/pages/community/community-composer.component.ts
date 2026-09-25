import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { CommunityApi } from '../../core/api/community.api';
import { apiMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { CATEGORIES, Category, PostDto } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { formatBytes } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';
import { CompressedImage, compressImage, validateCommunityImage } from '../../shared/image-compress';
import { SpinnerComponent } from '../../shared/spinner.component';
import { CATEGORY_STYLE } from './post-text.component';

const MAX_BODY = 500;
/** Circunferência do anel do contador (r = 9). */
const RING = 2 * Math.PI * 9;

/** Caixa de publicação estilo Twitter (texto que cresce, categoria, imagem comprimida, contador em anel). */
@Component({
  selector: 'app-community-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, SpinnerComponent],
  template: `
    <div class="flex gap-3 border-b border-border/60 px-4 pb-2 pt-3 sm:px-5">
      <app-avatar [url]="auth.user()?.avatarUrl" [name]="auth.user()?.fullName" [email]="auth.user()?.email" class="h-10 w-10" />
      <div class="min-w-0 flex-1">
        <label for="composer-body" class="sr-only">Escreva uma publicação</label>
        <textarea
          #area
          id="composer-body"
          rows="1"
          [value]="body()"
          (input)="onInput($event)"
          (focus)="active.set(true)"
          (keydown.control.enter)="submit()"
          (keydown.meta.enter)="submit()"
          [placeholder]="placeholder()"
          class="block max-h-[50vh] w-full resize-none bg-transparent py-1.5 text-[19px] leading-7 outline-none placeholder:text-muted-foreground/70"
        ></textarea>

        @if (image(); as img) {
          <div class="relative mt-3 overflow-hidden rounded-2xl border border-border/80">
            <img [src]="previewUrl()" alt="Pré-visualização da imagem" class="max-h-80 w-full object-cover" />
            <button
              type="button"
              (click)="removeImage()"
              class="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white backdrop-blur transition hover:bg-black"
              aria-label="Remover imagem"
            >
              <app-icon name="x" class="h-4 w-4" />
            </button>
            <div class="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white/90">
              {{ bytes(img.originalBytes) }} → {{ bytes(img.bytes) }}
            </div>
          </div>
        }
        @if (compressing()) {
          <div class="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
            <app-spinner size="h-3.5 w-3.5" /> Comprimindo a imagem…
          </div>
        }

        @if (active() || body() || image()) {
          <div class="lure-pop-in mt-2 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Categoria">
            @for (c of categories; track c) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="category() === c"
                (click)="category.set(c)"
                class="rounded-full px-2.5 py-1 text-[12px] font-semibold transition"
                [class]="category() === c ? catStyle(c) + ' ring-1 ring-current/40' : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground'"
              >
                {{ c }}
              </button>
            }
          </div>
        }

        <div class="mt-2 flex items-center justify-between gap-3 border-t border-border/60 pt-2">
          <div class="-ml-2 flex items-center">
            <button
              type="button"
              (click)="pick()"
              [disabled]="!!image() || compressing()"
              class="grid h-9 w-9 place-items-center rounded-full text-primary transition hover:bg-primary/10 disabled:opacity-40"
              [title]="image() ? 'Uma imagem por post' : 'Adicionar imagem'"
              [attr.aria-label]="image() ? 'Uma imagem por post' : 'Adicionar imagem'"
            >
              <app-icon name="image" class="h-[18px] w-[18px]" />
            </button>
            <input #file type="file" accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onFile($event)" />
          </div>
          <div class="flex items-center gap-3">
            @if (remainingToday() !== null && remainingToday()! <= 3) {
              <span class="text-[12px] text-muted-foreground">
                {{ remainingToday() === 0 ? 'Limite de hoje atingido' : remainingToday() + ' restantes hoje' }}
              </span>
            }
            @if (body().length) {
              <div class="flex items-center gap-2" aria-live="polite">
                @if (remaining() <= 20) {
                  <span class="text-[12px] tabular-nums" [class]="over() ? 'text-red-400' : 'text-primary'">{{ remaining() }}</span>
                }
                <svg viewBox="0 0 24 24" class="h-6 w-6 -rotate-90" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" class="text-border" />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke-width="2"
                    stroke-linecap="round"
                    [attr.stroke]="over() ? '#f87171' : 'var(--primary)'"
                    [attr.stroke-dasharray]="ring"
                    [attr.stroke-dashoffset]="ringOffset()"
                    class="transition-[stroke-dashoffset] duration-150"
                  />
                </svg>
                <span class="h-6 w-px bg-border" aria-hidden="true"></span>
              </div>
            }
            <button
              type="button"
              (click)="submit()"
              [disabled]="!canSubmit() || limitReached()"
              class="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-[14px] font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              @if (sending()) {
                <app-spinner size="h-3.5 w-3.5" />
              }
              Postar
            </button>
          </div>
        </div>
        @if (error()) {
          <div class="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] leading-relaxed text-red-400" role="alert">
            {{ error() }}
          </div>
        }
      </div>
    </div>
  `,
})
export class CommunityComposerComponent {
  readonly remainingToday = input<number | null>(null);
  readonly published = output<PostDto>();

  protected readonly auth = inject(AuthService);
  private readonly api = inject(CommunityApi);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');
  private readonly area = viewChild.required<ElementRef<HTMLTextAreaElement>>('area');

  protected readonly categories = CATEGORIES;
  protected readonly ring = RING;
  protected readonly body = signal('');
  protected readonly category = signal<Category>('Insight');
  protected readonly active = signal(false);
  protected readonly image = signal<CompressedImage | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly compressing = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly placeholder = computed(() => {
    const first = (this.auth.user()?.fullName ?? '').trim().split(/\s+/)[0];
    return first ? `O que está rolando, ${first}?` : 'O que está rolando?';
  });
  protected readonly remaining = computed(() => MAX_BODY - this.body().length);
  protected readonly over = computed(() => this.remaining() < 0);
  protected readonly ringOffset = computed(() => RING * (1 - Math.min(1, this.body().length / MAX_BODY)));
  protected readonly limitReached = computed(() => this.remainingToday() !== null && this.remainingToday()! <= 0);
  protected readonly canSubmit = computed(
    () => (this.body().trim().length > 0 || !!this.image()) && !this.over() && !this.sending() && !this.compressing(),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  protected onInput(e: Event): void {
    const el = e.target as HTMLTextAreaElement;
    this.body.set(el.value);
    this.autosize();
  }

  private autosize(): void {
    const el = this.area().nativeElement;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  protected pick(): void {
    this.fileInput().nativeElement.click();
  }

  protected async onFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const invalid = validateCommunityImage(f);
    if (invalid) {
      this.error.set(invalid);
      return;
    }
    this.error.set(null);
    this.compressing.set(true);
    try {
      const img = await compressImage(f);
      this.revoke();
      this.image.set(img);
      this.previewUrl.set(URL.createObjectURL(img.file));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Não foi possível preparar essa imagem.');
    } finally {
      this.compressing.set(false);
    }
  }

  protected removeImage(): void {
    this.revoke();
    this.image.set(null);
  }

  private revoke(): void {
    const u = this.previewUrl();
    if (u) URL.revokeObjectURL(u);
    this.previewUrl.set(null);
  }

  protected submit(): void {
    if (!this.canSubmit() || this.limitReached()) return;
    this.sending.set(true);
    this.error.set(null);
    const img = this.image();
    this.api
      .create({
        body: this.body().trim(),
        category: this.category(),
        image: img?.file ?? null,
        imageWidth: img?.width ?? null,
        imageHeight: img?.height ?? null,
      })
      .subscribe({
        next: (post) => {
          this.sending.set(false);
          this.body.set('');
          this.active.set(false);
          this.removeImage();
          this.area().nativeElement.style.height = ''; // volta a 1 linha
          this.published.emit(post);
        },
        error: (err) => {
          this.sending.set(false);
          this.error.set(apiMessage(err, 'Não foi possível publicar.'));
        },
      });
  }

  protected catStyle(c: Category): string {
    return CATEGORY_STYLE[c];
  }

  protected bytes(n: number): string {
    return formatBytes(n);
  }
}
