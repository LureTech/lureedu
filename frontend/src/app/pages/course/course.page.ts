import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { CourseApi } from '../../core/api/course.api';
import { apiMessage, apiStatus } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { LessonDto, ModuleDetailDto, ProgressUpdateDto, QuizResultDto } from '../../core/models';
import { ProgressStore } from '../../core/progress.store';
import { ToastService } from '../../core/toast.service';
import { UiService } from '../../core/ui.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { downloadCertificate } from '../../shared/certificate-canvas';
import { formatBytes, formatDuration } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';
import { LurePlayerComponent } from '../../shared/lure-player.component';
import { ProgressRingComponent } from '../../shared/progress-ring.component';
import { SpinnerComponent } from '../../shared/spinner.component';
import { isPlayableVideo, videoThumb } from '../../shared/youtube';
import { CourseCommentsComponent } from './course-comments.component';
import { CourseQuizComponent } from './course-quiz.component';
import { LessonListComponent } from './lesson-list.component';

type PageState = 'loading' | 'ready' | 'locked' | 'notfound' | 'error';

interface Tracker {
  lessonId: string;
  playing: boolean;
  watched: number;
  pos: number;
  lastT: number;
  dirty: boolean;
}

const QUIZ_PARAM = 'prova';
/** ?aula=todas: aulas do módulo em cards (botão "Todas as aulas"). */
const ALL_PARAM = 'todas';

/** /curso/:slug — player, aula atual, materiais, comentários, lista de aulas e prova final. */
@Component({
  selector: 'app-course-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    AvatarComponent,
    SpinnerComponent,
    ProgressRingComponent,
    LurePlayerComponent,
    LessonListComponent,
    CourseCommentsComponent,
    CourseQuizComponent,
    NgTemplateOutlet,
  ],
  template: `
    <div class="min-h-screen bg-background text-foreground">
      <header
        class="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-3 pb-3 backdrop-blur-xl safe-top md:px-10"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2.5 md:gap-4">
          <a
            routerLink="/"
            aria-label="Voltar"
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-foreground transition active:scale-95 md:flex md:h-9 md:w-auto md:gap-2 md:rounded-lg md:border-0 md:bg-transparent md:px-0 md:text-sm md:text-muted-foreground md:hover:text-foreground"
          >
            <app-icon name="chevron-left" class="h-5 w-5 md:h-4 md:w-4" />
            <span class="hidden md:inline">Voltar</span>
          </a>
          <div class="hidden h-6 w-px bg-border md:block"></div>
          <a routerLink="/" class="hidden items-center gap-2 md:flex">
            <img src="/lure-logo-large.png" alt="" class="h-6 w-6 object-contain" />
            <span class="text-sm font-semibold tracking-wider">AssessoriaLure</span>
          </a>
          <div class="min-w-0 flex-1 md:hidden">
            <div class="truncate text-[13px] font-semibold leading-tight">{{ module()?.title ?? 'Carregando…' }}</div>
            @if (view() === 'overview') {
              <div class="text-[11px] leading-tight text-muted-foreground">{{ lessons().length }} aulas</div>
            } @else if (current(); as l) {
              <div class="text-[11px] leading-tight text-muted-foreground">
                @if (view() === 'quiz') {
                  Prova final
                } @else {
                  Aula {{ l.position }} de {{ lessons().length }}
                }
              </div>
            }
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          @if (auth.isAdmin() && module(); as m) {
            <a
              [routerLink]="['/admin/modulos', m.id]"
              class="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
              title="Editar módulo"
            >
              <app-icon name="pencil" class="h-3.5 w-3.5" />
              <span class="hidden sm:inline">Editar módulo</span>
            </a>
          }
          <button
            type="button"
            (click)="ui.openProfile()"
            title="Editar perfil"
            class="flex shrink-0 items-center gap-3 rounded-full py-1 pl-3 pr-1 text-xs text-muted-foreground transition hover:bg-surface"
          >
            <span class="hidden md:inline">{{ auth.displayName() }} · {{ auth.isAdmin() ? 'Admin' : 'Membro' }}</span>
            <app-avatar
              [url]="auth.user()?.avatarUrl"
              [name]="auth.user()?.fullName"
              [email]="auth.user()?.email"
              class="h-9 w-9"
            />
          </button>
        </div>
      </header>

      @switch (state()) {
        @case ('loading') {
          <div class="mx-auto grid w-full max-w-[1500px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
            <div class="min-w-0">
              <div class="aspect-video w-full animate-pulse bg-surface"></div>
              <div class="space-y-3 px-4 py-6 sm:px-6 lg:px-8">
                <div class="h-3 w-32 animate-pulse rounded bg-surface-elevated"></div>
                <div class="h-7 w-2/3 animate-pulse rounded bg-surface-elevated"></div>
                <div class="h-4 w-1/2 animate-pulse rounded bg-surface-elevated"></div>
              </div>
            </div>
            <div class="hidden border-l border-border bg-surface/40 lg:block"></div>
          </div>
        }
        @case ('locked') {
          <div class="grid min-h-[70vh] place-items-center px-4 text-center">
            <div class="max-w-sm">
              <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                <app-icon name="lock" class="h-6 w-6" />
              </div>
              <div class="mt-5 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                <span class="relative flex h-2 w-2">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span class="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </span>
                Em gravação...
              </div>
              <h1 class="mt-3 font-display text-xl font-bold">Módulo em gravação</h1>
              <p class="mt-2 text-sm text-muted-foreground">Este módulo ainda não foi liberado. Você será avisado assim que ele estiver disponível.</p>
              <a routerLink="/" class="mt-6 inline-flex rounded-xl gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground">
                Voltar ao início
              </a>
            </div>
          </div>
        }
        @case ('notfound') {
          <div class="grid min-h-[70vh] place-items-center px-4 text-center">
            <div class="max-w-sm">
              <div class="font-display text-6xl font-bold">404</div>
              <h1 class="mt-3 font-display text-xl font-bold">Módulo não encontrado</h1>
              <p class="mt-2 text-sm text-muted-foreground">O link pode estar errado ou o módulo foi removido.</p>
              <a routerLink="/" class="mt-6 inline-flex rounded-xl gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground">
                Voltar ao início
              </a>
            </div>
          </div>
        }
        @case ('error') {
          <div class="grid min-h-[70vh] place-items-center px-4 text-center">
            <div class="max-w-sm">
              <app-icon name="triangle-alert" class="mx-auto h-7 w-7 text-red-400" />
              <h1 class="mt-3 font-display text-xl font-bold">Não foi possível carregar o módulo</h1>
              <p class="mt-2 text-sm text-muted-foreground">{{ errorMsg() }}</p>
              <button
                type="button"
                (click)="load(slug())"
                class="mt-6 inline-flex rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition hover:border-primary/40"
              >
                Tentar de novo
              </button>
            </div>
          </div>
        }
        @case ('ready') {
          @if (module(); as m) {
            @if (view() === 'overview') {
              <!-- Entrada do módulo: capa, progresso e as aulas em cards -->
              <section class="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
                <div class="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
                  <div class="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-black md:w-[440px]">
                    @if (m.coverUrl) {
                      <img [src]="m.coverUrl" [alt]="m.title" class="h-full w-full object-cover" />
                    } @else {
                      <div class="grid h-full w-full place-items-center">
                        <img src="/lure-logo-large.png" alt="" class="h-16 w-16 object-contain opacity-80" />
                      </div>
                    }
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                      <span class="h-1 w-5 rounded-full bg-primary"></span>{{ m.sectionTitle }}
                    </div>
                    <h1 class="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">{{ m.title }}</h1>
                    @if (m.author) {
                      <p class="mt-2 text-sm text-muted-foreground">com <span class="font-semibold text-foreground">{{ m.author }}</span></p>
                    }
                    @if (m.description) {
                      <p class="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{{ m.description }}</p>
                    }
                    <div class="mt-5 flex flex-wrap items-center gap-4">
                      @if (resumeLesson(); as r) {
                        <button
                          type="button"
                          (click)="selectLesson(r)"
                          class="inline-flex items-center gap-2 rounded-xl gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110"
                        >
                          <app-icon name="play" [filled]="true" class="h-4 w-4" />
                          {{ completedCount() === 0 ? 'Começar' : allDone() ? 'Assistir de novo' : 'Continuar: aula ' + r.position }}
                        </button>
                      }
                      <div class="flex items-center gap-3">
                        <app-progress-ring [value]="percent()" class="h-11 w-11" />
                        <div class="text-sm">
                          <div class="font-semibold">{{ completedCount() }} de {{ lessons().length }} concluídas</div>
                          <div class="text-xs text-muted-foreground">{{ totalDuration() }}</div>
                        </div>
                      </div>
                    </div>
                    @if (m.certificate) {
                      <div class="max-w-sm"><ng-container [ngTemplateOutlet]="certBox" /></div>
                    }
                  </div>
                </div>

                <div class="mt-10 flex items-center justify-between gap-3">
                  <h2 class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <app-icon name="list-checks" class="h-3.5 w-3.5" /> Aulas do módulo
                  </h2>
                  <span class="text-xs tabular-nums text-muted-foreground">{{ lessons().length }} aulas</span>
                </div>
                <ul class="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Aulas do módulo">
                  @for (l of lessons(); track l.id) {
                    <li>
                      <button type="button" (click)="selectLesson(l)" class="group block w-full text-left">
                        <div
                          class="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black transition duration-200 group-hover:-translate-y-1 group-hover:border-primary/60 group-hover:shadow-[var(--shadow-card)]"
                          [class]="l.completed ? 'border-emerald-500/40' : 'border-border'"
                        >
                          @if (lessonThumb(l); as src) {
                            <img
                              [src]="src"
                              alt=""
                              loading="lazy"
                              decoding="async"
                              class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                              (error)="hideThumb($event)"
                            />
                          } @else {
                            <div class="grid h-full w-full place-items-center">
                              <img src="/lure-logo-large.png" alt="" class="h-12 w-12 object-contain opacity-70" />
                            </div>
                          }
                          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>
                          <span class="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
                            Aula {{ l.position }}
                          </span>
                          @if (l.completed) {
                            <span class="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[11px] font-bold text-white">
                              <app-icon name="circle-check" class="h-3.5 w-3.5" /> Concluída
                            </span>
                          }
                          <span class="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                            <span class="grid h-14 w-14 place-items-center rounded-full bg-primary/95 shadow-[var(--shadow-glow)]">
                              <app-icon name="play" [filled]="true" class="ml-1 h-6 w-6 text-primary-foreground" />
                            </span>
                          </span>
                          @if (l.durationSeconds) {
                            <span class="absolute bottom-3 right-3 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                              {{ duration(l) }}
                            </span>
                          }
                          @if (!l.videoUrl) {
                            <span class="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                              Em breve
                            </span>
                          }
                        </div>
                        <div class="mt-3 px-1">
                          <div class="line-clamp-2 font-display text-base font-bold leading-snug transition group-hover:text-primary">{{ l.title }}</div>
                          @if (l.description) {
                            <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ l.description }}</p>
                          }
                        </div>
                      </button>
                    </li>
                  }
                  @if (hasQuiz()) {
                    <li>
                      <button
                        type="button"
                        (click)="openQuiz()"
                        [disabled]="!quizUnlocked()"
                        class="group flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center transition enabled:hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span class="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
                          <app-icon [name]="quizUnlocked() ? 'award' : 'lock'" class="h-6 w-6" />
                        </span>
                        <span class="font-display text-base font-bold">Prova final — Certificado</span>
                        <span class="text-xs text-muted-foreground">
                          {{ quizUnlocked() ? (m.quiz.passed ? 'Aprovado' : 'Liberada: faça a prova') : 'Conclua todas as aulas para liberar' }}
                        </span>
                      </button>
                    </li>
                  }
                </ul>
                @if (lessons().length === 0) {
                  <div class="mt-4 rounded-2xl border border-border bg-surface/40 px-6 py-10 text-center">
                    <p class="text-sm font-semibold">Nenhuma aula publicada ainda</p>
                    <p class="mt-1 text-xs text-muted-foreground">As aulas deste módulo estão chegando.</p>
                  </div>
                }
              </section>
              <div class="mx-auto w-full max-w-[1500px]">
                <app-course-comments [slug]="m.slug" />
              </div>
            } @else {
            <div
              class="mx-auto grid w-full max-w-[1500px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]"
            >
              <div class="min-w-0">
                @if (view() === 'quiz') {
                  <app-course-quiz
                    [slug]="m.slug"
                    [moduleTitle]="m.title"
                    [existingCertificate]="m.certificate"
                    (finished)="onQuizFinished($event)"
                  />
                } @else if (current(); as l) {
                  <!-- Player: fica parado no topo enquanto o resto da aula rola por baixo (.course-sticky) -->
                  <div class="course-sticky z-20 flex w-full justify-center bg-black">
                    <div class="course-video relative aspect-video w-full overflow-hidden">
                      @if (hasVideo(l)) {
                        @for (pl of [l]; track pl.id) {
                          <app-lure-player
                            class="absolute inset-0 h-full w-full"
                            [videoUrl]="pl.videoUrl!"
                            [startAt]="pl.lastPosition"
                            (timeUpdate)="onTime(pl.id, $event)"
                            (playingChange)="onPlaying(pl.id, $event)"
                            (durationChange)="onDuration(pl, $event)"
                            (ended)="onEnded(pl.id)"
                          />
                        }
                        <div
                          class="pointer-events-none absolute left-4 top-4 z-[45] inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur"
                        >
                          Aula {{ l.position }} · {{ duration(l) }}
                        </div>
                        @if (auth.isAdmin()) {
                          <a
                            [routerLink]="['/admin/modulos', m.id]"
                            class="absolute right-4 top-4 z-[45] inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur transition hover:bg-black/80"
                          >
                            <app-icon name="pencil" class="h-3.5 w-3.5" /> Trocar vídeo
                          </a>
                        }
                      } @else {
                        <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center">
                          <img src="/lure-logo-large.png" alt="" class="h-20 w-20 object-contain opacity-90" />
                          <div>
                            <p class="text-sm font-semibold text-white/90">Vídeo em breve</p>
                            <p class="mt-1 text-xs text-white/50">Aula {{ l.position }} · {{ duration(l) }}</p>
                          </div>
                          @if (auth.isAdmin()) {
                            <a
                              [routerLink]="['/admin/modulos', m.id]"
                              class="mt-1 inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
                            >
                              <app-icon name="video" class="h-4 w-4" /> Adicionar vídeo
                            </a>
                          }
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Cabeçalho da aula -->
                  <div class="border-b border-border px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                        <span class="h-1 w-5 shrink-0 rounded-full bg-primary"></span><span class="truncate">{{ m.title }}</span>
                      </div>
                      <button
                        type="button"
                        (click)="showOverview()"
                        class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                      >
                        <app-icon name="layout-grid" class="h-3.5 w-3.5" /> Todas as aulas
                      </button>
                    </div>
                    <h1 class="mt-2 font-display text-[19px] font-bold leading-snug sm:text-2xl lg:text-3xl">
                      <span class="mr-1.5 hidden text-muted-foreground sm:inline">Aula {{ l.position }}:</span>{{ l.title }}
                    </h1>
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
                        <app-icon name="clock" class="h-3.5 w-3.5" /> {{ duration(l) }}
                      </span>
                      <span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
                        <app-icon name="play" [filled]="true" class="h-3 w-3" /> Aula {{ l.position }} de {{ lessons().length }}
                      </span>
                      @if (l.completed) {
                        <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 sm:text-xs">
                          <app-icon name="circle-check" class="h-3.5 w-3.5" /> Concluída
                        </span>
                      }
                    </div>
                    <div class="mt-3.5 text-[13.5px] leading-relaxed sm:text-sm">
                      <p class="max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{{
                        l.description || 'Assista à aula e marque como concluída quando terminar.'
                      }}</p>
                    </div>
                    <div class="mt-5 flex flex-row flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        (click)="toggleCompleted(l)"
                        [disabled]="toggling()"
                        class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold transition disabled:opacity-70 sm:flex-none sm:text-sm"
                        [class]="l.completed ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15' : 'border-border bg-surface hover:bg-muted'"
                        [attr.aria-pressed]="l.completed"
                      >
                        @if (l.completed) {
                          <app-icon name="circle-check" class="h-4 w-4" /> Concluída
                        } @else {
                          <app-icon name="circle" class="h-4 w-4" /> Marcar como concluída
                        }
                      </button>
                      @if (nextLesson(); as n) {
                        <button
                          type="button"
                          (click)="selectLesson(n)"
                          class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl gradient-gold px-4 py-3 text-[13px] font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 sm:flex-none sm:text-sm"
                        >
                          Próxima aula <app-icon name="arrow-right" class="h-4 w-4" />
                        </button>
                      } @else if (hasQuiz() && quizUnlocked() && !m.quiz.passed) {
                        <button
                          type="button"
                          (click)="openQuiz()"
                          class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl gradient-gold px-4 py-3 text-[13px] font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 sm:flex-none sm:text-sm"
                        >
                          Fazer a prova final <app-icon name="award" class="h-4 w-4" />
                        </button>
                      }
                    </div>

                    @if (l.materials.length) {
                      <div class="mt-5">
                        <div class="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          <app-icon name="file-text" class="h-3.5 w-3.5" /> Materiais da aula
                        </div>
                        <ul class="flex flex-col gap-2">
                          @for (mat of l.materials; track mat.id) {
                            <li>
                              <a
                                [href]="mat.url"
                                target="_blank"
                                rel="noopener noreferrer"
                                [attr.download]="mat.label"
                                class="flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                              >
                                <app-icon name="download" class="h-4 w-4 shrink-0 text-primary" />
                                <span class="min-w-0 flex-1 truncate">{{ mat.label }}</span>
                                <span class="shrink-0 text-[11px] text-muted-foreground">{{ bytes(mat.sizeBytes) }}</span>
                              </a>
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center">
                    <img src="/lure-logo-large.png" alt="" class="h-16 w-16 object-contain opacity-80" />
                    <p class="text-sm font-semibold text-white/90">Nenhuma aula publicada ainda</p>
                    <p class="text-xs text-white/50">As aulas deste módulo estão chegando.</p>
                  </div>
                }

                <!-- Conteúdo do curso (mobile) -->
                <section class="border-b border-border px-4 py-5 sm:px-6 lg:hidden">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <app-icon name="list-checks" class="h-3.5 w-3.5" /> Conteúdo do curso
                    </div>
                    <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {{ completedCount() }}/{{ lessons().length }} concluídas
                    </span>
                  </div>
                  <div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                    <div class="h-full rounded-full gradient-gold transition-all duration-500" [style.width.%]="percent()"></div>
                  </div>
                  @if (m.certificate) {
                    <ng-container [ngTemplateOutlet]="certBox" />
                  }
                  <app-lesson-list
                    class="mt-3"
                    [lessons]="lessons()"
                    [currentId]="currentId()"
                    [view]="view() === 'quiz' ? 'quiz' : 'lesson'"
                    [quiz]="m.quiz"
                    [quizUnlocked]="quizUnlocked()"
                    (select)="selectLesson($event)"
                    (openQuiz)="openQuiz()"
                  />
                </section>

                <app-course-comments [slug]="m.slug" />
              </div>

              <!-- Sidebar desktop -->
              <aside
                class="course-aside hidden flex-col border-border bg-surface/40 lg:flex lg:border-l"
                aria-label="Conteúdo do curso"
              >
                <div class="shrink-0 border-b border-border p-4 lg:p-5">
                  <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <app-icon name="list-checks" class="h-3.5 w-3.5" /> Conteúdo do curso
                  </div>
                  <h2 class="mt-2 font-display text-base font-bold leading-tight">{{ m.title }}</h2>
                  <div class="mt-3.5 flex items-center gap-3">
                    <app-progress-ring [value]="percent()" class="h-11 w-11" />
                    <div class="text-sm">
                      <div class="font-semibold">{{ completedCount() }} de {{ lessons().length }} concluídas</div>
                      <div class="text-xs text-muted-foreground">
                        {{ percent() === 100 ? 'Módulo concluído!' : 'Continue de onde parou' }}
                      </div>
                    </div>
                  </div>
                  @if (m.certificate) {
                    <ng-container [ngTemplateOutlet]="certBox" />
                  }
                </div>
                <app-lesson-list
                  class="flex-1 overflow-y-auto p-2.5"
                  [lessons]="lessons()"
                  [currentId]="currentId()"
                  [view]="view() === 'quiz' ? 'quiz' : 'lesson'"
                  [quiz]="m.quiz"
                  [quizUnlocked]="quizUnlocked()"
                  (select)="selectLesson($event)"
                  (openQuiz)="openQuiz()"
                />
                <div class="shrink-0 border-t border-border p-4">
                  <button
                    type="button"
                    (click)="ui.openSupport()"
                    class="flex w-full items-center gap-3 rounded-xl border border-border bg-background/60 p-3 text-left transition hover:border-primary/40"
                  >
                    <div class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                      <app-icon name="life-buoy" class="h-4 w-4" />
                    </div>
                    <div class="min-w-0">
                      <div class="text-sm font-semibold">Dúvidas sobre a aula?</div>
                      <div class="text-xs text-muted-foreground">Fale com o Head do seu projeto</div>
                    </div>
                    <app-icon name="arrow-right" class="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </div>
              </aside>
            </div>
            }

            <ng-template #certBox>
              <button
                type="button"
                (click)="downloadCert()"
                [disabled]="downloading()"
                class="mt-3.5 flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-left transition hover:bg-primary/15 disabled:opacity-70"
              >
                <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg gradient-gold text-primary-foreground">
                  @if (downloading()) {
                    <app-spinner />
                  } @else {
                    <app-icon name="award" class="h-4 w-4" />
                  }
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-primary">Certificado emitido</span>
                  <span class="block text-xs text-muted-foreground">Toque para baixar o PNG</span>
                </span>
                <app-icon name="download" class="h-4 w-4 shrink-0 text-primary" />
              </button>
            </ng-template>
          }
        }
      }
    </div>
  `,
})
export class CoursePage {
  readonly slug = input.required<string>();
  /** ?aula=<lessonId> | ?aula=prova | ?aula=todas */
  readonly aula = input<string | undefined>(undefined);

  protected readonly auth = inject(AuthService);
  protected readonly ui = inject(UiService);
  private readonly api = inject(CourseApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly progressStore = inject(ProgressStore);
  private readonly title = inject(Title);

  protected readonly state = signal<PageState>('loading');
  protected readonly errorMsg = signal('');
  protected readonly module = signal<ModuleDetailDto | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  /** lesson = player (padrão ao abrir o módulo); overview = aulas em cards (?aula=todas); quiz = prova final. */
  protected readonly view = signal<'overview' | 'lesson' | 'quiz'>('lesson');
  protected readonly toggling = signal(false);
  protected readonly downloading = signal(false);

  protected readonly lessons = computed(() => this.module()?.lessons ?? []);
  protected readonly currentId = computed(() => this.current()?.id ?? null);
  protected readonly current = computed<LessonDto | null>(() => {
    const ls = this.lessons();
    const id = this.selectedId();
    return ls.find((l) => l.id === id) ?? ls[0] ?? null;
  });
  protected readonly nextLesson = computed<LessonDto | null>(() => {
    const ls = this.lessons();
    const cur = this.current();
    if (!cur) return null;
    const i = ls.findIndex((l) => l.id === cur.id);
    return i >= 0 && i < ls.length - 1 ? ls[i + 1] : null;
  });
  protected readonly completedCount = computed(() => this.lessons().filter((l) => l.completed).length);
  protected readonly percent = computed(() => {
    const n = this.lessons().length;
    return n ? Math.round((this.completedCount() / n) * 100) : 0;
  });
  protected readonly allDone = computed(() => this.lessons().length > 0 && this.lessons().every((l) => l.completed));
  /** Aula do botão "Começar/Continuar" da entrada do módulo: a primeira não concluída. */
  protected readonly resumeLesson = computed(() => {
    const m = this.module();
    return m ? (this.firstIncomplete(m) ?? null) : null;
  });
  protected readonly totalDuration = computed(() => {
    const ls = this.lessons();
    if (!ls.length || ls.some((l) => !l.durationSeconds)) return `${ls.length} aulas`;
    return `${ls.length} aulas · ${formatDuration(ls.reduce((s, l) => s + (l.durationSeconds ?? 0), 0))}`;
  });
  protected readonly hasQuiz = computed(() => (this.module()?.quiz.questionCount ?? 0) > 0);
  /** A prova libera quando todas as aulas estão concluídas (o original travava para sempre). */
  protected readonly quizUnlocked = computed(() => this.allDone() || (!!this.module()?.quiz.unlocked && this.lessons().length === 0));

  // ---------------------------------------------------------------- progresso
  private tracker: Tracker | null = null;
  private readonly reportedDurations = new Set<string>();
  private loadedSlug: string | null = null;

  constructor() {
    // Carrega o módulo quando o slug muda.
    effect(() => {
      const s = this.slug();
      untracked(() => this.load(s));
    });

    // Aplica ?aula= (ou escolhe a primeira não concluída) quando o módulo/param mudam.
    effect(() => {
      const m = this.module();
      const aula = this.aula();
      if (!m) return;
      untracked(() => this.applySelection(m, aula));
    });

    const interval = setInterval(() => {
      if (this.tracker?.playing) this.flush();
    }, 6000);
    const onPageHide = () => this.flush(true);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(interval);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      this.flush();
      this.progressStore.refresh(0);
    });
  }

  protected load(slug: string): void {
    this.flush();
    this.state.set('loading');
    this.module.set(null);
    this.selectedId.set(null);
    this.tracker = null;
    this.api.module(slug).subscribe({
      next: (m) => {
        this.loadedSlug = slug;
        this.module.set(m);
        this.state.set('ready');
        this.title.setTitle(`${m.title} — AssessoriaLure`);
      },
      error: (err) => {
        const st = apiStatus(err);
        if (st === 403) this.state.set('locked');
        else if (st === 404) this.state.set('notfound');
        else {
          this.errorMsg.set(apiMessage(err));
          this.state.set('error');
        }
      },
    });
  }

  /** Recarrega o módulo sem mostrar skeleton (após certificado/prova). */
  private refreshModule(): void {
    const slug = this.loadedSlug;
    if (!slug) return;
    this.api.module(slug).subscribe({
      next: (m) => {
        // Preserva posições locais das aulas já em andamento.
        this.module.set(m);
      },
    });
  }

  private applySelection(m: ModuleDetailDto, aula: string | undefined): void {
    if (aula === QUIZ_PARAM && m.quiz.questionCount > 0) {
      this.flush();
      if (this.tracker) this.tracker.playing = false;
      this.view.set('quiz');
      if (!this.selectedId()) this.selectedId.set(this.firstIncomplete(m)?.id ?? null);
      return;
    }
    if (aula === ALL_PARAM) {
      this.flush();
      if (this.tracker) this.tracker.playing = false;
      this.view.set('overview');
      return;
    }
    // Sem ?aula=: abre direto na primeira aula não concluída.
    const byParam = aula ? m.lessons.find((l) => l.id === aula) : undefined;
    this.view.set('lesson');
    const target = byParam ?? (this.selectedId() ? m.lessons.find((l) => l.id === this.selectedId()) : undefined) ?? this.firstIncomplete(m);
    if (!target) return;
    if (target.id !== this.selectedId() || !this.tracker || this.tracker.lessonId !== target.id) {
      this.flush();
      this.selectedId.set(target.id);
      this.resetTracker(target);
    }
  }

  private firstIncomplete(m: ModuleDetailDto): LessonDto | undefined {
    return m.lessons.find((l) => !l.completed) ?? m.lessons[0];
  }

  protected selectLesson(l: LessonDto): void {
    if (this.view() === 'lesson' && l.id === this.selectedId()) return;
    void this.router.navigate([], {
      queryParams: { aula: l.id },
      queryParamsHandling: 'merge',
      // Saindo dos cards entra no histórico: o "voltar" do navegador volta para as aulas.
      replaceUrl: this.view() !== 'overview',
    });
  }

  /** Mostra todas as aulas do módulo em cards. */
  protected showOverview(): void {
    void this.router.navigate([], { queryParams: { aula: ALL_PARAM }, queryParamsHandling: 'merge' });
  }

  protected openQuiz(): void {
    if (!this.quizUnlocked()) return;
    void this.router.navigate([], {
      queryParams: { aula: QUIZ_PARAM },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // ---------------------------------------------------------------- player → progresso
  private resetTracker(l: LessonDto): void {
    this.tracker = {
      lessonId: l.id,
      playing: false,
      watched: l.watchedSeconds || 0,
      pos: l.lastPosition || 0,
      lastT: l.lastPosition || 0,
      dirty: false,
    };
  }

  protected onTime(lessonId: string, t: number): void {
    const tr = this.tracker;
    if (!tr || tr.lessonId !== lessonId) return;
    if (tr.playing) {
      const delta = t - tr.lastT;
      if (delta > 0 && delta < 2) {
        tr.watched += delta;
        tr.dirty = true;
      }
    }
    tr.lastT = t;
    tr.pos = t;
  }

  protected onPlaying(lessonId: string, playing: boolean): void {
    const tr = this.tracker;
    if (!tr || tr.lessonId !== lessonId) return;
    tr.playing = playing;
    if (!playing) {
      tr.dirty = true;
      this.flush();
    }
  }

  protected onDuration(l: LessonDto, seconds: number): void {
    const d = Math.round(seconds);
    if (d <= 0 || l.durationSeconds || this.reportedDurations.has(l.id)) return;
    this.reportedDurations.add(l.id);
    this.api.reportDuration(l.id, d).subscribe({
      next: () => this.patchLesson(l.id, { durationSeconds: d }),
      error: () => this.reportedDurations.delete(l.id),
    });
  }

  protected onEnded(lessonId: string): void {
    const tr = this.tracker;
    if (tr && tr.lessonId === lessonId) tr.playing = false;
    const lesson = this.lessons().find((l) => l.id === lessonId);
    if (!lesson) return;
    if (lesson.completed) {
      if (tr) tr.dirty = true;
      this.flush();
      return;
    }
    const body = {
      completed: true,
      ...(tr && tr.lessonId === lessonId
        ? { watchedSeconds: Math.round(tr.watched), lastPosition: Math.round(tr.pos) }
        : {}),
    };
    if (tr) tr.dirty = false;
    this.patchLesson(lessonId, { completed: true });
    this.api.updateProgress(lessonId, body).subscribe({
      next: (res) => {
        this.applyProgress(res);
        this.toast.success('Aula concluída!');
      },
      error: (err) => {
        this.patchLesson(lessonId, { completed: false });
        this.toast.error(apiMessage(err, 'Não foi possível marcar a aula como concluída.'));
      },
    });
  }

  /** Envia watchedSeconds/lastPosition se houver mudanças. */
  private flush(keepalive = false): void {
    const tr = this.tracker;
    if (!tr || !tr.dirty) return;
    tr.dirty = false;
    const body = { watchedSeconds: Math.max(0, Math.round(tr.watched)), lastPosition: Math.max(0, Math.round(tr.pos)) };
    const lessonId = tr.lessonId;
    this.patchLesson(lessonId, { watchedSeconds: body.watchedSeconds, lastPosition: body.lastPosition });
    if (keepalive) {
      const token = this.auth.accessToken();
      try {
        void fetch(`/api/lessons/${lessonId}/progress`, {
          method: 'PUT',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        }).catch(() => undefined);
      } catch {
        /* ignora */
      }
      return;
    }
    this.api.updateProgress(lessonId, body).subscribe({
      next: (res) => this.applyProgress(res),
      error: () => {
        /* silencioso: próxima tentativa reenviará o acumulado */
        const cur = this.tracker;
        if (cur && cur.lessonId === lessonId) cur.dirty = true;
      },
    });
  }

  private applyProgress(res: ProgressUpdateDto): void {
    const m = this.module();
    if (!m) return;
    const lessons = m.lessons.map((l) =>
      l.id === res.lessonId
        ? {
            ...l,
            completed: res.completed,
            // Não sobrescreve a posição local mais recente com um valor antigo.
            watchedSeconds: Math.max(l.watchedSeconds, res.watchedSeconds),
            lastPosition: this.tracker?.lessonId === l.id ? l.lastPosition : res.lastPosition,
          }
        : l,
    );
    const allDone = lessons.length > 0 && lessons.every((l) => l.completed);
    this.module.set({
      ...m,
      lessons,
      progress: res.moduleProgress,
      completedLessons: res.completedLessons,
      certificate: res.certificate ?? m.certificate,
      // Regra do servidor: a prova libera quando todas as aulas estão concluídas.
      quiz: { ...m.quiz, unlocked: allDone },
    });
    if (res.certificate) {
      this.ui.celebrateCertificate(res.certificate);
      this.refreshModule();
    }
  }

  private patchLesson(id: string, patch: Partial<LessonDto>): void {
    const m = this.module();
    if (!m) return;
    this.module.set({ ...m, lessons: m.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  }

  protected toggleCompleted(l: LessonDto): void {
    if (this.toggling()) return;
    const next = !l.completed;
    this.toggling.set(true);
    this.patchLesson(l.id, { completed: next });
    const tr = this.tracker;
    const extra =
      tr && tr.lessonId === l.id && tr.dirty
        ? { watchedSeconds: Math.round(tr.watched), lastPosition: Math.round(tr.pos) }
        : {};
    if (tr && tr.lessonId === l.id) tr.dirty = false;
    this.api.updateProgress(l.id, { completed: next, ...extra }).subscribe({
      next: (res) => {
        this.toggling.set(false);
        this.applyProgress(res);
      },
      error: (err) => {
        this.toggling.set(false);
        this.patchLesson(l.id, { completed: !next });
        this.toast.error(apiMessage(err, 'Não foi possível atualizar a aula.'));
      },
    });
  }

  protected onQuizFinished(r: QuizResultDto): void {
    const m = this.module();
    if (!m) return;
    this.module.set({
      ...m,
      quiz: {
        ...m.quiz,
        attempts: m.quiz.attempts + 1,
        bestScore: Math.max(m.quiz.bestScore ?? 0, r.score),
        passed: m.quiz.passed || r.passed,
      },
      certificate: r.certificate ?? m.certificate,
    });
    if (r.certificate) this.refreshModule();
  }

  protected async downloadCert(): Promise<void> {
    const c = this.module()?.certificate;
    if (!c) return;
    this.downloading.set(true);
    try {
      await downloadCertificate(c);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o certificado.');
    } finally {
      this.downloading.set(false);
    }
  }

  // ---------------------------------------------------------------- helpers de template
  protected hasVideo(l: LessonDto): boolean {
    return isPlayableVideo(l.videoUrl);
  }

  protected duration(l: LessonDto): string {
    return formatDuration(l.durationSeconds) ?? '—';
  }

  protected bytes(n: number): string {
    return formatBytes(n);
  }

  protected lessonThumb(l: LessonDto): string | null {
    return videoThumb(l.videoUrl, 640);
  }

  /** Miniatura indisponível (arquivo privado no Drive, vídeo removido): fica o fundo preto. */
  protected hideThumb(e: Event): void {
    (e.target as HTMLImageElement).style.visibility = 'hidden';
  }
}
