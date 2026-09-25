import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CourseApi } from '../../core/api/course.api';
import { apiMessage } from '../../core/api-error';
import { CertificateDto, QuizDto, QuizResultDto } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UiService } from '../../core/ui.service';
import { downloadCertificate } from '../../shared/certificate-canvas';
import { IconComponent } from '../../shared/icon.component';
import { SpinnerComponent } from '../../shared/spinner.component';

/** Prova final: carrega o quiz, responde, envia tentativa e mostra o resultado por questão. */
@Component({
  selector: 'app-course-quiz',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent],
  template: `
    <section class="relative overflow-hidden border-b border-border px-4 py-6 sm:px-6 lg:px-8 lg:py-8" aria-labelledby="quiz-title">
      <div
        class="pointer-events-none absolute inset-x-0 -top-24 h-56"
        style="background: radial-gradient(ellipse 60% 70% at 50% 0%, rgba(187, 154, 53, 0.18), transparent 70%)"
      ></div>
      <div class="relative">
        <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          <span class="h-1 w-5 rounded-full bg-primary"></span>{{ moduleTitle() }}
        </div>
        <h1 id="quiz-title" class="mt-2 font-display text-[22px] font-bold leading-snug sm:text-3xl">
          Prova Final — Certificado de Conclusão
        </h1>

        @if (loading()) {
          <div class="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><app-spinner /> Carregando a prova…</div>
        } @else if (loadError()) {
          <div class="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {{ loadError() }}
            <button type="button" (click)="load()" class="ml-2 font-semibold underline">Tentar de novo</button>
          </div>
        } @else if (quiz(); as q) {
          <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-muted-foreground">
              <app-icon name="list-checks" class="h-3.5 w-3.5" /> {{ q.questions.length }} perguntas
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-muted-foreground">
              <app-icon name="target" class="h-3.5 w-3.5" /> Nota mínima {{ q.passingScore }}%
            </span>
            @if (q.attempts > 0) {
              <span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-muted-foreground">
                {{ q.attempts }} {{ q.attempts === 1 ? 'tentativa' : 'tentativas' }} · melhor nota {{ q.bestScore ?? 0 }}%
              </span>
            }
            @if (q.passed) {
              <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400">
                <app-icon name="circle-check" class="h-3.5 w-3.5" /> Aprovado
              </span>
            }
          </div>

          @if (!q.unlocked) {
            <div class="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface/60 px-6 py-12 text-center">
              <div class="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
                <app-icon name="lock" class="h-5 w-5" />
              </div>
              <p class="text-sm font-semibold">Prova bloqueada</p>
              <p class="max-w-sm text-xs text-muted-foreground">Conclua todas as aulas do módulo para liberar a prova final.</p>
            </div>
          } @else {
            @if (result(); as r) {
              <div
                class="mt-6 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center"
                [class]="r.passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'"
                role="status"
              >
                <div class="font-display text-5xl font-bold tabular-nums" [class]="r.passed ? 'text-emerald-400' : 'text-red-400'">
                  {{ r.score }}%
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold">
                    {{ r.passed ? 'Parabéns, você foi aprovado!' : 'Não foi dessa vez.' }}
                  </div>
                  <div class="mt-0.5 text-xs text-muted-foreground">
                    {{ r.correct }} de {{ r.total }} respostas certas ·
                    {{ r.passed ? 'Seu certificado está garantido.' : 'Você precisa de ' + q.passingScore + '% para passar. Revise as aulas e tente de novo.' }}
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  @if (certificate(); as c) {
                    <button
                      type="button"
                      (click)="download(c)"
                      [disabled]="downloading()"
                      class="inline-flex items-center gap-2 rounded-xl gradient-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-70"
                    >
                      @if (downloading()) {
                        <app-spinner />
                      } @else {
                        <app-icon name="download" class="h-4 w-4" />
                      }
                      Baixar certificado
                    </button>
                  }
                  @if (!r.passed) {
                    <button
                      type="button"
                      (click)="retry()"
                      class="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-primary/40"
                    >
                      <app-icon name="rotate-ccw" class="h-4 w-4" /> Tentar de novo
                    </button>
                  }
                </div>
              </div>
            }

            <ol class="mt-6 space-y-4">
              @for (question of q.questions; track question.id; let qi = $index) {
                @let res = resultFor(question.id);
                <li class="rounded-2xl border border-border bg-surface/50 p-4 sm:p-5">
                  <div class="flex items-start gap-3">
                    <span
                      class="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold"
                      [class]="
                        res ? (res.correct ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400') : 'bg-primary/15 text-primary'
                      "
                    >
                      {{ qi + 1 }}
                    </span>
                    <p class="pt-0.5 text-[15px] font-semibold leading-snug">{{ question.text }}</p>
                  </div>
                  <div class="mt-4 grid gap-2" role="radiogroup" [attr.aria-label]="'Pergunta ' + (qi + 1)">
                    @for (opt of question.options; track $index; let oi = $index) {
                      @let chosen = answers()[question.id] === oi;
                      @let isCorrect = !!res && res.correctIndex === oi;
                      @let isWrongPick = !!res && chosen && !res.correct;
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="chosen"
                        [disabled]="!!result() || submitting()"
                        (click)="choose(question.id, oi)"
                        class="flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition disabled:cursor-default"
                        [class]="
                          isCorrect
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                            : isWrongPick
                              ? 'border-red-500/50 bg-red-500/10 text-red-200'
                              : chosen
                                ? 'border-primary/60 bg-primary/10 text-foreground'
                                : 'border-border/60 bg-background/40 text-foreground/85 hover:border-primary/40'
                        "
                      >
                        <span
                          class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold"
                          [class]="
                            isCorrect
                              ? 'border-emerald-400 bg-emerald-400 text-black'
                              : isWrongPick
                                ? 'border-red-400 bg-red-400 text-black'
                                : chosen
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-white/25 text-muted-foreground'
                          "
                        >
                          @if (isCorrect) {
                            <app-icon name="check" class="h-3 w-3" [strokeWidth]="3" />
                          } @else if (isWrongPick) {
                            <app-icon name="x" class="h-3 w-3" [strokeWidth]="3" />
                          } @else {
                            {{ letter(oi) }}
                          }
                        </span>
                        <span class="leading-relaxed">{{ opt }}</span>
                      </button>
                    }
                  </div>
                </li>
              }
            </ol>

            @if (!result()) {
              @if (submitError()) {
                <div class="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
                  {{ submitError() }}
                </div>
              }
              <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
                <span class="text-xs text-muted-foreground">{{ answeredCount() }}/{{ q.questions.length }} respondidas</span>
                <button
                  type="button"
                  (click)="submit()"
                  [disabled]="!allAnswered() || submitting()"
                  class="inline-flex items-center gap-2 rounded-xl gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  @if (submitting()) {
                    <app-spinner /> Corrigindo…
                  } @else {
                    <app-icon name="send" class="h-4 w-4" /> Enviar respostas
                  }
                </button>
              </div>
            }
          }
        }
      </div>
    </section>
  `,
})
export class CourseQuizComponent {
  readonly slug = input.required<string>();
  readonly moduleTitle = input('');
  /** Certificado já emitido (se houver). */
  readonly existingCertificate = input<CertificateDto | null>(null);
  readonly finished = output<QuizResultDto>();

  private readonly api = inject(CourseApi);
  private readonly toast = inject(ToastService);
  private readonly ui = inject(UiService);

  protected readonly quiz = signal<QuizDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly answers = signal<Record<string, number>>({});
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly result = signal<QuizResultDto | null>(null);
  protected readonly downloading = signal(false);

  protected readonly answeredCount = computed(() => Object.keys(this.answers()).length);
  protected readonly allAnswered = computed(() => {
    const q = this.quiz();
    return !!q && q.questions.length > 0 && q.questions.every((x) => this.answers()[x.id] !== undefined);
  });
  protected readonly certificate = computed(() => this.result()?.certificate ?? this.existingCertificate());

  constructor() {
    effect(() => {
      this.slug();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.result.set(null);
    this.answers.set({});
    this.api.quiz(this.slug()).subscribe({
      next: (q) => {
        this.quiz.set(q);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(apiMessage(err, 'Não foi possível carregar a prova.'));
        this.loading.set(false);
      },
    });
  }

  protected choose(questionId: string, index: number): void {
    if (this.result()) return;
    this.answers.update((a) => ({ ...a, [questionId]: index }));
  }

  protected resultFor(questionId: string) {
    return this.result()?.results.find((r) => r.questionId === questionId) ?? null;
  }

  protected letter(i: number): string {
    return String.fromCharCode(65 + i);
  }

  protected submit(): void {
    if (!this.allAnswered() || this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    this.api.submitQuiz(this.slug(), this.answers()).subscribe({
      next: (r) => {
        this.submitting.set(false);
        this.result.set(r);
        const q = this.quiz();
        if (q) {
          this.quiz.set({
            ...q,
            attempts: q.attempts + 1,
            bestScore: Math.max(q.bestScore ?? 0, r.score),
            passed: q.passed || r.passed,
          });
        }
        if (r.certificate) this.ui.celebrateCertificate(r.certificate);
        this.finished.emit(r);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(apiMessage(err, 'Não foi possível enviar suas respostas.'));
      },
    });
  }

  protected retry(): void {
    this.result.set(null);
    this.answers.set({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected async download(c: CertificateDto): Promise<void> {
    this.downloading.set(true);
    try {
      await downloadCertificate(c);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o certificado.');
    } finally {
      this.downloading.set(false);
    }
  }
}
