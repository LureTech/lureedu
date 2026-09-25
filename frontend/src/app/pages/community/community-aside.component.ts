import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommunityStatsDto } from '../../core/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { compactNumber } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';

/** Coluna da direita (desktop largo): busca, assuntos em alta e quem mais movimentou na semana. */
@Component({
  selector: 'app-community-aside',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent],
  template: `
    <div class="flex flex-col gap-4">
      <label
        class="group flex items-center gap-3 rounded-full border border-transparent bg-white/[0.06] px-4 py-2.5 transition focus-within:border-primary/70 focus-within:bg-transparent"
      >
        <app-icon name="search" class="h-4 w-4 shrink-0 text-muted-foreground group-focus-within:text-primary" />
        <input
          type="search"
          [value]="searchText()"
          (input)="search.emit($any($event.target).value)"
          (keydown.escape)="search.emit('')"
          placeholder="Buscar na comunidade"
          aria-label="Buscar na comunidade"
          class="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        @if (searchText()) {
          <button
            type="button"
            (click)="search.emit('')"
            class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            aria-label="Limpar busca"
          >
            <app-icon name="x" class="h-3 w-3" [strokeWidth]="3" />
          </button>
        }
      </label>

      <section class="overflow-hidden rounded-2xl border border-border/60" aria-labelledby="aside-trends">
        <h2 id="aside-trends" class="px-4 pb-1 pt-3 text-[19px] font-extrabold tracking-tight">O que está rolando</h2>
        @for (t of trends(); track t.tag; let i = $index) {
          <button
            type="button"
            (click)="tag.emit(t.tag)"
            class="block w-full px-4 py-2 text-left transition"
            [class]="activeTag() === t.tag ? 'bg-primary/[0.06]' : 'hover:bg-white/[0.03]'"
          >
            <div class="text-[12px] text-muted-foreground">{{ i + 1 }} · Em alta na comunidade</div>
            <div class="text-[15px] font-bold" [class.text-primary]="activeTag() === t.tag">#{{ t.tag }}</div>
            <div class="text-[12px] text-muted-foreground">
              {{ t.n === 1 ? '1 publicação' : compact(t.n) + ' publicações' }}
            </div>
          </button>
        } @empty {
          <p class="px-4 pb-4 pt-1 text-[13px] leading-relaxed text-muted-foreground">
            Use #hashtags nos posts e os assuntos do mês aparecem aqui.
          </p>
        }
      </section>

      @if (stats()?.topVoices?.length) {
        <section class="overflow-hidden rounded-2xl border border-border/60" aria-labelledby="aside-voices">
          <div class="px-4 pb-1 pt-3">
            <h2 id="aside-voices" class="text-[19px] font-extrabold tracking-tight">Quem está movimentando</h2>
            <p class="text-[12px] text-muted-foreground">Mais posts e comentários nos últimos 7 dias</p>
          </div>
          @for (v of stats()!.topVoices; track v.author.id; let i = $index) {
            <button
              type="button"
              (click)="search.emit(v.author.fullName)"
              class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.03]"
              [title]="'Ver o que ' + v.author.fullName + ' anda falando'"
            >
              <div class="relative shrink-0">
                <app-avatar [url]="v.author.avatarUrl" [name]="v.author.fullName" class="h-10 w-10" />
                @if (i === 0) {
                  <span class="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                    <app-icon name="crown" class="h-3 w-3" [strokeWidth]="2.5" />
                  </span>
                }
              </div>
              <div class="min-w-0 flex-1 leading-tight">
                <div class="truncate text-[15px] font-bold">{{ v.author.fullName }}</div>
                <div class="mt-0.5 text-[13px] text-muted-foreground">
                  {{ v.posts === 1 ? '1 post' : v.posts + ' posts' }} ·
                  {{ v.comments === 1 ? '1 comentário' : v.comments + ' comentários' }}
                </div>
              </div>
              <span class="text-[13px] font-semibold tabular-nums text-muted-foreground/60">{{ i + 1 }}º</span>
            </button>
          }
        </section>
      }

      <footer class="px-4 text-[12px] leading-relaxed text-muted-foreground/70">
        @if (stats(); as s) {
          <p>{{ compact(s.members) }} membros · {{ s.postsToday }} posts hoje · {{ compact(s.postsTotal) }} no total</p>
        }
        <p class="mt-1">Até 500 caracteres e 1 imagem por post · 10 posts por dia. Respeito acima de tudo, zero spam.</p>
      </footer>
    </div>
  `,
})
export class CommunityAsideComponent {
  readonly stats = input<CommunityStatsDto | null>(null);
  protected readonly trends = computed(() => (this.stats()?.tags ?? []).slice(0, 5));
  readonly searchText = input('');
  readonly activeTag = input<string | null>(null);
  readonly search = output<string>();
  readonly tag = output<string>();

  protected compact(n: number): string {
    return compactNumber(n);
  }
}
