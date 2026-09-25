import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DiagnosticApi } from '../../core/api/diagnostic.api';
import { apiMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import {
  DiagnosticResultDto,
  DiagnosticSubmissionSummary,
  PillarDto,
  PillarOptionDto,
  Tone,
} from '../../core/models';
import { safeGetJson, safeRemove, safeSet } from '../../core/storage';
import { ToastService } from '../../core/toast.service';
import { formatDateShort } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';
import { SpinnerComponent } from '../../shared/spinner.component';
import { RadarComponent } from './radar.component';

interface FlatQuestion {
  id: string;
  text: string;
  options: PillarOptionDto[];
  catIndex: number;
  catId: string;
  catName: string;
  icon: string;
}

interface Draft {
  answers: Record<string, number>;
  step: number;
}

const PILLAR_ICONS: Record<string, string> = {
  gestao: 'layers',
  cultura: 'users',
  marketing: 'message-square',
  vendas: 'target',
  experiencia: 'thumbs-up',
  ia: 'sparkles',
};

@Component({
  selector: 'app-diagnostic-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SpinnerComponent, RadarComponent],
  host: { '(window:keydown)': 'onKey($event)' },
  template: `
    @if (loading()) {
      <div class="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground"><app-spinner /> Carregando o diagnóstico…</div>
    } @else if (loadError()) {
      <div class="mx-auto mt-16 max-w-md rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <app-icon name="triangle-alert" class="mx-auto h-6 w-6 text-red-400" />
        <p class="mt-3 text-sm font-semibold">Não foi possível carregar o diagnóstico</p>
        <p class="mt-1 text-xs text-muted-foreground">{{ loadError() }}</p>
        <button type="button" (click)="init()" class="mt-4 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary">
          Tentar de novo
        </button>
      </div>
    } @else {
      @switch (phase()) {
        @case ('intro') {
          <section class="relative flex-1 overflow-hidden px-6 py-14 md:px-14 md:py-20">
            <div class="lure-aurora lure-aurora-a -left-24 top-0 h-[420px] w-[420px]" style="background: rgba(187, 154, 53, 0.28)" aria-hidden="true"></div>
            <div class="lure-aurora lure-aurora-b right-0 top-40 h-[380px] w-[380px]" style="background: rgba(212, 184, 92, 0.2)" aria-hidden="true"></div>
            <div class="relative mx-auto grid max-w-6xl grid-cols-1 gap-14 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div>
                <div
                  class="lure-rise inline-flex items-center gap-2 rounded-full border border-[var(--nav)]/30 bg-[var(--nav)]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--nav)]"
                  style="--d: 0ms"
                >
                  <app-icon name="hexagon" class="h-3 w-3" /> Diagnóstico de Maturidade
                </div>
                <h1 class="lure-rise mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl" style="--d: 90ms">
                  Avalie as principais áreas
                  <span class="bg-gradient-to-r from-[#EBDDA9] to-[#BB9A35] bg-clip-text text-transparent">da sua empresa</span>
                </h1>
                <p class="lure-rise mt-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground" style="--d: 180ms">
                  Um raio-x completo do seu negócio em {{ pillars().length }} pilares. No final você recebe a Roda da Maturidade e um plano
                  de ação priorizado pelo método AssessoriaLure.
                </p>
                <div class="mt-8 flex flex-wrap gap-2">
                  @for (p of pillars(); track p.id; let i = $index) {
                    <span
                      class="lure-rise inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground"
                      [style.--d]="240 + i * 60 + 'ms'"
                    >
                      <app-icon [name]="icon(p.id)" class="h-3.5 w-3.5 text-[var(--nav)]" />
                      {{ p.name }}
                    </span>
                  }
                </div>
                <div class="lure-rise mt-10 flex flex-wrap items-center gap-4" style="--d: 640ms">
                  <button
                    type="button"
                    (click)="start()"
                    class="group relative inline-flex items-center gap-2 overflow-hidden rounded-full gradient-gold px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-12px_var(--nav)] transition hover:scale-[1.03]"
                  >
                    <span class="diag-sweep pointer-events-none absolute inset-y-0 -left-4 w-10 bg-white/25 blur-md" aria-hidden="true"></span>
                    <span class="relative">{{ answeredCount() > 0 ? 'Continuar diagnóstico' : latest() ? 'Refazer diagnóstico' : 'Iniciar diagnóstico' }}</span>
                    <app-icon name="arrow-right" class="relative h-4 w-4 transition group-hover:translate-x-0.5" />
                  </button>
                  @if (answeredCount() > 0) {
                    <span class="text-xs text-muted-foreground">
                      <span class="font-semibold tabular-nums text-foreground">{{ answeredCount() }}</span>/{{ questions().length }} respondidas
                    </span>
                    <button type="button" (click)="discardDraft()" class="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                      Recomeçar do zero
                    </button>
                  }
                </div>
                <div class="mt-10 grid max-w-lg grid-cols-3 gap-3">
                  @for (s of introStats(); track s.label; let i = $index) {
                    <div class="lure-rise rounded-2xl border border-border/60 bg-surface/40 px-4 py-3" [style.--d]="700 + i * 80 + 'ms'">
                      <app-icon [name]="s.icon" class="h-4 w-4 text-[var(--nav)]" />
                      <div class="mt-2 font-display text-xl font-bold tabular-nums">{{ s.value }}</div>
                      <div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{{ s.label }}</div>
                    </div>
                  }
                </div>
              </div>

              <div
                class="lure-rise relative overflow-hidden rounded-3xl border border-[var(--nav)]/25 bg-surface/40 p-6 shadow-[0_30px_80px_-40px_var(--nav)]"
                style="--d: 320ms"
              >
                <div class="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(ellipse_at_center,var(--nav),transparent_70%)] opacity-20"></div>
                <div class="relative flex items-center justify-between">
                  <div class="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Evolução do Diagnóstico</div>
                  <span class="rounded-full bg-[var(--nav)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--nav)]">360°</span>
                </div>
                <div class="relative mt-6 flex h-40 items-end gap-4">
                  @for (b of bars(); track $index; let i = $index; let last = $last) {
                    <div class="flex h-full flex-1 flex-col justify-end">
                      <div
                        class="diag-bar rounded-lg"
                        [class]="last ? 'gradient-gold shadow-[0_0_40px_-6px_var(--nav)]' : 'bg-gradient-to-t from-muted/40 to-[var(--nav)]/15'"
                        [style.--h]="b.pct + '%'"
                        [style.--d]="400 + i * 130 + 'ms'"
                        [style.height.%]="b.pct"
                        [title]="b.title"
                      ></div>
                      @if (b.label) {
                        <div class="mt-1.5 text-center text-[10px] tabular-nums text-muted-foreground">{{ b.label }}</div>
                      }
                    </div>
                  }
                </div>
                @if (latest(); as r) {
                  <div class="relative mt-8 rounded-2xl border border-border/60 bg-background/60 p-4">
                    <div class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Último diagnóstico · {{ date(r.createdAt) }}</div>
                    <div class="mt-2 flex items-baseline gap-3">
                      <span class="font-display text-3xl font-bold tabular-nums">{{ r.overall.toFixed(1) }}</span>
                      <span class="text-sm text-muted-foreground">/ 5.0</span>
                      <span class="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em]" [class]="toneClass(r.overallTone)">
                        {{ r.overallLabel }}
                      </span>
                    </div>
                    <button
                      type="button"
                      (click)="showResult(r)"
                      class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--nav)] transition hover:brightness-125"
                    >
                      Ver resultado completo <app-icon name="arrow-right" class="h-3.5 w-3.5" />
                    </button>
                  </div>
                } @else {
                  <div class="relative mt-8 grid grid-cols-2 gap-4">
                    <div class="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 transition hover:border-[var(--nav)]/40">
                      <div class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Visão em Gráfico</div>
                      <div class="mt-1 font-display text-sm font-semibold">Radar 360°</div>
                    </div>
                    <div class="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 transition hover:border-[var(--nav)]/40">
                      <div class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Dossiê</div>
                      <div class="mt-1 font-display text-sm font-semibold">Plano de Ação</div>
                    </div>
                  </div>
                }
              </div>
            </div>

            @if (history().length) {
              <div class="relative mx-auto mt-16 max-w-6xl">
                <div class="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  <app-icon name="clock" class="h-3.5 w-3.5" /> Histórico
                </div>
                <ul class="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-surface/40">
                  @for (h of history(); track h.id) {
                    <li>
                      <button
                        type="button"
                        (click)="openSubmission(h.id)"
                        [disabled]="opening() === h.id"
                        class="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-muted/60"
                      >
                        <span class="font-display text-lg font-bold tabular-nums">{{ h.overall.toFixed(1) }}</span>
                        <span class="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]" [class]="toneClass(toneOf(h.overall))">
                          {{ h.overallLabel }}
                        </span>
                        <span class="ml-auto text-xs text-muted-foreground">{{ date(h.createdAt) }}</span>
                        @if (opening() === h.id) {
                          <app-spinner size="h-3.5 w-3.5" />
                        } @else {
                          <app-icon name="chevron-right" class="h-4 w-4 text-muted-foreground" />
                        }
                      </button>
                    </li>
                  }
                </ul>
              </div>
            }
          </section>
        }
        @case ('quiz') {
          @if (currentQ(); as q) {
            <section class="relative flex-1 overflow-hidden px-4 py-8 md:px-10 md:py-12">
              <div class="lure-aurora lure-aurora-a left-1/4 top-0 h-[380px] w-[380px]" style="background: rgba(187, 154, 53, 0.18)" aria-hidden="true"></div>
              <div class="relative mx-auto max-w-3xl">
                <div class="flex items-center gap-1.5">
                  @for (p of pillars(); track p.id; let i = $index) {
                    @let active = i === q.catIndex;
                    <button
                      type="button"
                      (click)="goToPillar(i)"
                      [title]="p.name + ' — ' + pillarAnswered(p) + '/' + p.questions.length"
                      [attr.aria-label]="p.name + ': ' + pillarAnswered(p) + ' de ' + p.questions.length + ' respondidas'"
                      class="group flex-1"
                    >
                      <div class="h-1.5 overflow-hidden rounded-full transition" [class]="active ? 'bg-[var(--nav)]/25' : 'bg-muted/50 group-hover:bg-muted'">
                        <div class="h-full rounded-full bg-[var(--nav)] transition-all duration-500" [style.width.%]="(pillarAnswered(p) / p.questions.length) * 100"></div>
                      </div>
                      <div
                        class="mt-2 hidden truncate text-[10px] font-semibold uppercase tracking-[0.14em] transition md:block"
                        [class]="active ? 'text-[var(--nav)]' : 'text-muted-foreground/60 group-hover:text-muted-foreground'"
                      >
                        {{ p.name.split(' ')[0] }}
                      </div>
                    </button>
                  }
                </div>

                <div class="mt-8 flex items-center justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <div class="grid h-11 w-11 place-items-center rounded-xl border border-[var(--nav)]/30 bg-[var(--nav)]/10 text-[var(--nav)]">
                      <app-icon [name]="q.icon" class="h-5 w-5" />
                    </div>
                    <div>
                      <div class="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--nav)]">{{ q.catName }}</div>
                      <div class="text-[11px] tabular-nums text-muted-foreground">
                        Pergunta {{ step() + 1 }} de {{ questions().length }} · {{ answeredCount() }} respondidas
                      </div>
                    </div>
                  </div>
                  <div class="font-display text-3xl font-bold tabular-nums text-muted-foreground/30">{{ pad(step() + 1) }}</div>
                </div>

                @for (qq of [q]; track qq.id) {
                  <div [class]="dir() === 'fwd' ? 'diag-in-fwd' : 'diag-in-back'">
                    <h2 class="mt-8 font-display text-2xl font-semibold leading-snug tracking-tight md:text-[30px]" id="diag-q">{{ qq.text }}</h2>
                    <div class="mt-7 flex flex-col gap-2.5" role="radiogroup" aria-labelledby="diag-q">
                      @for (o of qq.options; track o.score; let oi = $index) {
                        @let picked = answers()[qq.id] === o.score;
                        <button
                          type="button"
                          role="radio"
                          [attr.aria-checked]="picked"
                          (click)="answer(o.score)"
                          class="diag-option group relative flex items-start gap-4 overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all duration-200"
                          [class]="
                            picked
                              ? 'diag-pick border-[var(--nav)]/70 bg-[var(--nav)]/12 shadow-[0_0_30px_-10px_var(--nav)]'
                              : 'border-border/50 bg-surface/40 hover:-translate-y-0.5 hover:border-[var(--nav)]/40 hover:bg-surface/70'
                          "
                          [style.--d]="oi * 70 + 'ms'"
                        >
                          @if (picked) {
                            <span
                              class="diag-ripple pointer-events-none absolute left-8 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--nav)]/30"
                              aria-hidden="true"
                            ></span>
                          }
                          <span
                            class="relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-bold tabular-nums transition"
                            [class]="picked ? 'gradient-gold text-primary-foreground' : 'bg-muted/60 text-muted-foreground group-hover:text-foreground'"
                          >
                            @if (picked) {
                              <app-icon name="check" class="h-4 w-4" />
                            } @else {
                              {{ o.score }}
                            }
                          </span>
                          <span class="relative text-[14px] leading-relaxed">
                            <span class="font-semibold" [class]="picked ? 'text-foreground' : 'text-foreground/90'">{{ o.label }}</span>
                            <span class="text-muted-foreground"> — {{ o.text }}</span>
                          </span>
                        </button>
                      }
                    </div>
                  </div>
                }

                <div class="mt-10 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    (click)="go(step() - 1, 'back')"
                    [disabled]="step() === 0"
                    class="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground transition hover:border-border hover:text-foreground disabled:opacity-30"
                  >
                    <app-icon name="arrow-left" class="h-4 w-4" /> Anterior
                  </button>
                  <div class="hidden text-[11px] text-muted-foreground sm:block">
                    Dica: use as teclas <kbd class="rounded bg-muted/60 px-1.5 py-0.5 font-mono">1</kbd>–<kbd class="rounded bg-muted/60 px-1.5 py-0.5 font-mono">5</kbd> para responder
                  </div>
                  @if (isLast()) {
                    <button
                      type="button"
                      (click)="submit()"
                      [disabled]="!allDone() || submitting()"
                      class="inline-flex items-center gap-2 rounded-full gradient-gold px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-12px_var(--nav)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                    >
                      @if (submitting()) {
                        <app-spinner /> Gerando…
                      } @else {
                        Gerar diagnóstico <app-icon name="sparkles" class="h-4 w-4" />
                      }
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="go(step() + 1, 'fwd')"
                      [disabled]="answers()[q.id] === undefined"
                      class="inline-flex items-center gap-2 rounded-full gradient-gold px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-12px_var(--nav)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                    >
                      Próxima <app-icon name="arrow-right" class="h-4 w-4" />
                    </button>
                  }
                </div>
                @if (isLast() && !allDone()) {
                  <p class="mt-3 text-right text-xs text-muted-foreground">
                    Faltam {{ questions().length - answeredCount() }} respostas.
                    <button type="button" (click)="goToFirstUnanswered()" class="font-semibold text-[var(--nav)] hover:underline">Ir para a próxima pendente</button>
                  </p>
                }

                <div class="mt-8">
                  <div class="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Progresso geral</span>
                    <span class="tabular-nums">{{ overallPct() }}%</span>
                  </div>
                  <div class="mt-2 h-2 overflow-hidden rounded-full bg-muted/50">
                    <div class="h-full rounded-full gradient-gold transition-all duration-700" [style.width.%]="overallPct()"></div>
                  </div>
                </div>
                <div class="mt-6 text-center">
                  <button type="button" (click)="phase.set('intro')" class="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                    Salvar e sair — continuo depois
                  </button>
                </div>
              </div>
            </section>
          }
        }
        @case ('result') {
          @if (result(); as r) {
            <section class="flex-1 px-4 py-10 md:px-10 md:py-14">
              <div class="mx-auto max-w-6xl">
                <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <button type="button" (click)="phase.set('intro')" class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
                      <app-icon name="chevron-left" class="h-4 w-4" /> Diagnóstico
                    </button>
                    <div class="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--nav)]">Roda da Maturidade</div>
                    <h1 class="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
                      {{ justSubmitted() ? 'Seu diagnóstico está pronto' : 'Diagnóstico de ' + date(r.createdAt) }}
                    </h1>
                  </div>
                  <button
                    type="button"
                    (click)="restart()"
                    class="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                  >
                    <app-icon name="rotate-ccw" class="h-3.5 w-3.5" /> Refazer
                  </button>
                </div>

                <div class="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
                  <div class="relative overflow-hidden rounded-3xl border border-border/60 bg-surface/50 p-8">
                    <div class="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Média Geral</div>
                    <div class="mt-4 flex flex-wrap items-baseline gap-3">
                      <div class="font-display text-7xl font-bold tabular-nums text-foreground">{{ r.overall.toFixed(1) }}</div>
                      <div class="text-muted-foreground">/ 5.0</div>
                      <span class="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em]" [class]="toneClass(r.overallTone)">
                        {{ r.overallLabel }}
                      </span>
                    </div>
                    <div class="mt-8">
                      <app-radar [scores]="r.pillars" />
                    </div>
                  </div>
                  <div class="flex flex-col gap-3">
                    @for (p of r.pillars; track p.id) {
                      <div class="rounded-2xl border border-border/60 bg-surface/40 p-4">
                        <div class="flex items-center justify-between gap-3">
                          <div class="flex min-w-0 items-center gap-3">
                            <div class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
                              <app-icon [name]="icon(p.id)" class="h-4 w-4" />
                            </div>
                            <div class="truncate text-[13px] font-semibold">{{ p.name }}</div>
                          </div>
                          <div class="flex shrink-0 items-center gap-3">
                            <div class="font-display text-lg font-bold tabular-nums">{{ p.avg.toFixed(1) }}</div>
                            <span class="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em]" [class]="toneClass(p.tone)">
                              {{ p.label }}
                            </span>
                          </div>
                        </div>
                        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/50">
                          <div class="h-full gradient-gold transition-all duration-700" [style.width.%]="(p.avg / 5) * 100"></div>
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div class="rounded-3xl border border-border/60 bg-surface/40 p-6">
                    <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-400">
                      <app-icon name="trending-up" class="h-3.5 w-3.5" /> Pontos fortes
                    </div>
                    <ul class="mt-4 flex flex-col divide-y divide-border/30">
                      @for (p of pillarsById(r, r.strengths); track p.id) {
                        <li class="flex items-center justify-between py-3">
                          <span class="text-[14px] font-medium">{{ p.name }}</span>
                          <span class="font-display text-lg font-bold tabular-nums text-foreground">{{ p.avg.toFixed(1) }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                  <div class="rounded-3xl border border-border/60 bg-surface/40 p-6">
                    <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--nav)]">
                      <app-icon name="triangle-alert" class="h-3.5 w-3.5" /> Oportunidades de melhoria
                    </div>
                    <ul class="mt-4 flex flex-col divide-y divide-border/30">
                      @for (p of pillarsById(r, r.weaknesses); track p.id) {
                        <li class="flex items-center justify-between py-3">
                          <span class="text-[14px] font-medium">{{ p.name }}</span>
                          <span class="font-display text-lg font-bold tabular-nums text-foreground">{{ p.avg.toFixed(1) }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                </div>

                @if (r.plan.length) {
                  <div class="mt-8 overflow-hidden rounded-3xl border border-[var(--nav)]/25 bg-gradient-to-br from-[var(--nav)]/12 via-surface/40 to-transparent p-8">
                    <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--nav)]">
                      <app-icon name="sparkles" class="h-3.5 w-3.5" /> Plano de Ação Recomendado
                    </div>
                    <h2 class="mt-3 font-display text-2xl font-semibold tracking-tight md:text-3xl">
                      Comece pelas trilhas de
                      @for (item of r.plan; track item.pillarId; let last = $last; let first = $first) {
                        @if (!first) {
                          e
                        }
                        <span class="text-[var(--nav)]">{{ item.name }}</span>
                      }
                    </h2>
                    <div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                      @for (item of r.plan; track item.pillarId) {
                        <div class="rounded-2xl border border-border/60 bg-background/50 p-6">
                          <div class="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--nav)]">Trilha prioritária</div>
                          <div class="mt-2 font-display text-xl font-semibold">{{ item.name }}</div>
                          <ul class="mt-5 flex flex-col gap-3">
                            @for (a of item.actions; track $index) {
                              <li class="flex items-start gap-3 text-[13.5px] leading-relaxed">
                                <span class="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[var(--nav)]/15 text-[var(--nav)]">
                                  <app-icon name="check" class="h-3 w-3" />
                                </span>
                                <span class="text-foreground/85">{{ a }}</span>
                              </li>
                            }
                          </ul>
                          @if (item.sections.length) {
                            <div class="mt-6 border-t border-border/50 pt-4">
                              <div class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trilhas recomendadas</div>
                              <div class="mt-3 flex flex-wrap gap-2">
                                @for (s of item.sections; track s.id) {
                                  <a
                                    [routerLink]="['/secao', s.id]"
                                    class="inline-flex items-center gap-1.5 rounded-full border border-[var(--nav)]/30 bg-[var(--nav)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--nav)] transition hover:bg-[var(--nav)]/20"
                                  >
                                    {{ s.title }} <app-icon name="arrow-right" class="h-3 w-3" />
                                  </a>
                                }
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </section>
          }
        }
      }
    }
  `,
})
export class DiagnosticPage {
  private readonly api = inject(DiagnosticApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly pillars = signal<PillarDto[]>([]);
  protected readonly history = signal<DiagnosticSubmissionSummary[]>([]);
  protected readonly latest = signal<DiagnosticResultDto | null>(null);
  protected readonly phase = signal<'intro' | 'quiz' | 'result'>('intro');
  protected readonly step = signal(0);
  protected readonly dir = signal<'fwd' | 'back'>('fwd');
  protected readonly answers = signal<Record<string, number>>({});
  protected readonly submitting = signal(false);
  protected readonly result = signal<DiagnosticResultDto | null>(null);
  protected readonly justSubmitted = signal(false);
  protected readonly opening = signal<string | null>(null);
  private advanceTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly questions = computed<FlatQuestion[]>(() =>
    this.pillars().flatMap((p, catIndex) =>
      p.questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: [...q.options].sort((a, b) => a.score - b.score),
        catIndex,
        catId: p.id,
        catName: p.name,
        icon: PILLAR_ICONS[p.id] ?? 'hexagon',
      })),
    ),
  );
  protected readonly currentQ = computed(() => this.questions()[this.step()] ?? null);
  protected readonly answeredCount = computed(() => {
    const ids = new Set(this.questions().map((q) => q.id));
    return Object.keys(this.answers()).filter((k) => ids.has(k)).length;
  });
  protected readonly allDone = computed(() => this.questions().length > 0 && this.answeredCount() === this.questions().length);
  protected readonly isLast = computed(() => this.step() === this.questions().length - 1);
  protected readonly overallPct = computed(() =>
    this.questions().length ? Math.round((this.answeredCount() / this.questions().length) * 100) : 0,
  );
  protected readonly introStats = computed(() => [
    { icon: 'target', label: 'Pilares', value: String(this.pillars().length) },
    { icon: 'chart-column', label: 'Perguntas', value: String(this.questions().length) },
    { icon: 'clock', label: 'Duração', value: '~8 min' },
  ]);
  /** Barras: histórico real (até 4, mais antigo → mais novo) ou decorativas. */
  protected readonly bars = computed(() => {
    const h = this.history().slice(0, 4).reverse();
    if (!h.length) return [35, 55, 75, 100].map((pct) => ({ pct, label: '', title: '' }));
    return h.map((x) => ({
      pct: Math.max(8, (x.overall / 5) * 100),
      label: x.overall.toFixed(1),
      title: `${formatDateShort(x.createdAt)} — ${x.overall.toFixed(1)} (${x.overallLabel})`,
    }));
  });

  private get draftKey(): string {
    return `lure.diag.draft.${this.auth.user()?.id ?? 'anon'}`;
  }

  constructor() {
    this.init();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.advanceTimer));
  }

  protected init(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      pillars: this.api.pillars(),
      history: this.api.history(),
      latest: this.api.latest(),
    }).subscribe({
      next: ({ pillars, history, latest }) => {
        this.pillars.set(pillars);
        this.history.set(history);
        this.latest.set(latest);
        this.restoreDraft();
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(apiMessage(err));
        this.loading.set(false);
      },
    });
  }

  // ------------------------------------------------------------ rascunho
  private restoreDraft(): void {
    const d = safeGetJson<Draft>('local', this.draftKey);
    if (!d || typeof d.answers !== 'object' || !d.answers) return;
    const valid: Record<string, number> = {};
    const ids = new Set(this.questions().map((q) => q.id));
    for (const [k, v] of Object.entries(d.answers)) {
      if (ids.has(k) && typeof v === 'number' && v >= 1 && v <= 5) valid[k] = v;
    }
    this.answers.set(valid);
    this.step.set(Math.min(Math.max(0, d.step || 0), Math.max(0, this.questions().length - 1)));
  }

  private saveDraft(): void {
    safeSet('local', this.draftKey, JSON.stringify({ answers: this.answers(), step: this.step() } satisfies Draft));
  }

  protected discardDraft(): void {
    safeRemove('local', this.draftKey);
    this.answers.set({});
    this.step.set(0);
  }

  // ------------------------------------------------------------ navegação
  protected start(): void {
    const qs = this.questions();
    if (!qs.length) return;
    const firstOpen = qs.findIndex((q) => this.answers()[q.id] === undefined);
    this.dir.set('fwd');
    this.step.set(firstOpen === -1 ? 0 : firstOpen);
    this.justSubmitted.set(false);
    this.phase.set('quiz');
    window.scrollTo({ top: 0 });
  }

  protected go(i: number, dir: 'fwd' | 'back'): void {
    if (i < 0 || i >= this.questions().length) return;
    clearTimeout(this.advanceTimer);
    this.dir.set(dir);
    this.step.set(i);
    this.saveDraft();
  }

  protected goToPillar(catIndex: number): void {
    const i = this.questions().findIndex((q) => q.catIndex === catIndex);
    if (i >= 0) this.go(i, i > this.step() ? 'fwd' : 'back');
  }

  protected goToFirstUnanswered(): void {
    const i = this.questions().findIndex((q) => this.answers()[q.id] === undefined);
    if (i >= 0) this.go(i, i > this.step() ? 'fwd' : 'back');
  }

  protected answer(score: number): void {
    const q = this.currentQ();
    if (!q) return;
    this.answers.update((a) => ({ ...a, [q.id]: score }));
    this.saveDraft();
    const i = this.step();
    if (i < this.questions().length - 1) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = setTimeout(() => {
        if (this.phase() === 'quiz' && this.step() === i) this.go(i + 1, 'fwd');
      }, 340);
    }
  }

  protected onKey(e: KeyboardEvent): void {
    if (this.phase() !== 'quiz' || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (document.querySelector('[aria-modal="true"]:not([inert])')) return;
    if (e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      this.answer(Number(e.key));
    } else if (e.key === 'ArrowRight') {
      const q = this.currentQ();
      if (q && this.answers()[q.id] !== undefined) this.go(this.step() + 1, 'fwd');
    } else if (e.key === 'ArrowLeft') {
      this.go(this.step() - 1, 'back');
    }
  }

  // ------------------------------------------------------------ envio / resultado
  protected submit(): void {
    if (!this.allDone()) {
      this.goToFirstUnanswered();
      return;
    }
    if (this.submitting()) return;
    this.submitting.set(true);
    this.api.submit(this.answers()).subscribe({
      next: (r) => {
        this.submitting.set(false);
        safeRemove('local', this.draftKey);
        this.answers.set({});
        this.step.set(0);
        this.latest.set(r);
        this.history.update((h) => [{ id: r.id, createdAt: r.createdAt, overall: r.overall, overallLabel: r.overallLabel }, ...h]);
        this.justSubmitted.set(true);
        this.showResult(r, true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.toast.error(apiMessage(err, 'Não foi possível gerar o diagnóstico.'));
      },
    });
  }

  protected showResult(r: DiagnosticResultDto, fresh = false): void {
    this.justSubmitted.set(fresh);
    this.result.set(r);
    this.phase.set('result');
    window.scrollTo({ top: 0 });
  }

  protected openSubmission(id: string): void {
    const l = this.latest();
    if (l && l.id === id) {
      this.showResult(l);
      return;
    }
    this.opening.set(id);
    this.api.submission(id).subscribe({
      next: (r) => {
        this.opening.set(null);
        this.showResult(r);
      },
      error: (err) => {
        this.opening.set(null);
        this.toast.error(apiMessage(err, 'Não foi possível abrir este diagnóstico.'));
      },
    });
  }

  protected restart(): void {
    this.discardDraft();
    this.result.set(null);
    this.start();
  }

  // ------------------------------------------------------------ helpers
  protected icon(pillarId: string): string {
    return PILLAR_ICONS[pillarId] ?? 'hexagon';
  }

  protected pillarAnswered(p: PillarDto): number {
    const a = this.answers();
    return p.questions.filter((q) => a[q.id] !== undefined).length;
  }

  protected pillarsById(r: DiagnosticResultDto, ids: string[]) {
    return ids.map((id) => r.pillars.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  }

  protected toneOf(avg: number): Tone {
    return avg < 3 ? 'critical' : avg < 4.2 ? 'stable' : 'excellent';
  }

  protected toneClass(t: Tone): string {
    return t === 'critical'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : t === 'excellent'
        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
        : 'border-[var(--nav)]/40 bg-[var(--nav)]/10 text-[var(--nav)]';
  }

  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  protected date(iso: string): string {
    return formatDateShort(iso);
  }
}
