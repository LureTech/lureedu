import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Category } from '../../core/models';
import { splitRichText } from '../../shared/format';

/** Cor do selo de cada categoria (texto + fundo). */
export const CATEGORY_STYLE: Record<Category, string> = {
  Conquista: 'bg-amber-400/10 text-amber-300',
  Dúvida: 'bg-sky-400/10 text-sky-300',
  Networking: 'bg-violet-400/10 text-violet-300',
  Case: 'bg-emerald-400/10 text-emerald-300',
  Insight: 'bg-primary/10 text-primary',
};

/** Texto de post/comentário com #hashtags clicáveis (filtram o feed) e links. */
@Component({
  selector: 'app-post-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block whitespace-pre-line break-words' },
  template: `@for (p of parts(); track $index) {@switch (p.kind) {@case ('tag') {<button type="button" class="font-medium text-primary hover:underline" (click)="$event.stopPropagation(); tag.emit(p.value!)">{{ p.text }}</button>} @case ('url') {<a [href]="p.value" target="_blank" rel="noopener noreferrer nofollow" class="text-primary hover:underline" (click)="$event.stopPropagation()">{{ p.text }}</a>} @default {<ng-container>{{ p.text }}</ng-container>}}}`,
})
export class PostTextComponent {
  readonly text = input.required<string>();
  readonly tag = output<string>();

  protected readonly parts = computed(() => splitRichText(this.text()));
}
