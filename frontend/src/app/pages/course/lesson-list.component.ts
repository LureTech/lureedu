import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LessonDto, ModuleQuizSummary } from '../../core/models';
import { formatDuration } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';

/** Lista de aulas (sidebar desktop e bloco mobile) + item da Prova Final. */
@Component({
  selector: 'app-lesson-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'block' },
  template: `
    <ul class="space-y-1" aria-label="Aulas do curso">
      @for (l of lessons(); track l.id) {
        @let current = view() === 'lesson' && l.id === currentId();
        <li class="relative">
          <button
            type="button"
            (click)="select.emit(l)"
            [attr.aria-current]="current ? 'true' : null"
            class="group relative flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors"
            [class]="current ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'"
          >
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
              [class]="
                l.completed
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : current
                    ? 'bg-primary/15 text-primary'
                    : 'bg-white/[0.04] text-muted-foreground'
              "
            >
              @if (l.completed) {
                <app-icon name="circle-check" class="h-5 w-5" />
              } @else if (current) {
                <app-icon name="play" [filled]="true" class="h-4 w-4" />
              } @else {
                {{ l.position }}
              }
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm" [class]="current ? 'font-bold text-foreground' : 'font-semibold'">{{ l.title }}</div>
              <div class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <app-icon name="clock" class="h-3 w-3" />
                {{ duration(l.durationSeconds) }}
                @if (l.videoUrl) {
                  <app-icon name="play" class="ml-1 h-3 w-3 text-primary" />
                } @else {
                  <span class="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">em breve</span>
                }
                @if (l.materials.length) {
                  <app-icon name="file-text" class="ml-1 h-3 w-3" />
                }
              </div>
            </div>
          </button>
        </li>
      }

      @if (quiz(); as q) {
        @if (q.questionCount > 0) {
          @let quizActive = view() === 'quiz';
          <li class="relative">
            <button
              type="button"
              (click)="quizUnlocked() && openQuiz.emit()"
              [disabled]="!quizUnlocked()"
              [attr.aria-current]="quizActive ? 'true' : null"
              [title]="quizUnlocked() ? 'Abrir prova final' : 'Conclua todas as aulas para liberar a prova'"
              class="group relative flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors"
              [class]="
                (quizActive ? 'bg-white/[0.06] ' : 'hover:bg-white/[0.03] ') + (quizUnlocked() ? '' : 'cursor-not-allowed opacity-60')
              "
            >
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                [class]="
                  q.passed ? 'bg-emerald-500/15 text-emerald-400' : quizUnlocked() ? 'bg-primary/15 text-primary' : 'bg-white/[0.04] text-muted-foreground'
                "
              >
                @if (!quizUnlocked()) {
                  <app-icon name="lock" class="h-4 w-4" />
                } @else if (q.passed) {
                  <app-icon name="circle-check" class="h-5 w-5" />
                } @else {
                  <app-icon name="award" class="h-5 w-5" />
                }
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm" [class]="quizActive ? 'font-bold text-foreground' : 'font-semibold'">
                  Prova Final — Certificado de Conclusão
                </div>
                <div class="mt-0.5 text-xs text-muted-foreground">
                  @if (!quizUnlocked()) {
                    Conclua todas as aulas para liberar
                  } @else if (q.passed) {
                    Aprovado{{ q.bestScore !== null ? ' · ' + q.bestScore + '%' : '' }}
                  } @else {
                    {{ q.questionCount }} {{ q.questionCount === 1 ? 'pergunta' : 'perguntas' }}
                    @if (q.attempts > 0) {
                      · melhor nota {{ q.bestScore ?? 0 }}%
                    }
                  }
                </div>
              </div>
            </button>
          </li>
        }
      }
    </ul>
  `,
})
export class LessonListComponent {
  readonly lessons = input.required<LessonDto[]>();
  readonly currentId = input<string | null>(null);
  readonly view = input<'lesson' | 'quiz'>('lesson');
  readonly quiz = input<ModuleQuizSummary | null>(null);
  readonly quizUnlocked = input(false);

  readonly select = output<LessonDto>();
  readonly openQuiz = output<void>();

  protected duration(s: number | null): string {
    return formatDuration(s) ?? '—';
  }
}
