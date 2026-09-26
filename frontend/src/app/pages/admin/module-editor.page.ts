import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminApi } from '../../core/api/admin.api';
import { CatalogApi } from '../../core/api/catalog.api';
import { apiMessage, apiStatus } from '../../core/api-error';
import { ConfirmService } from '../../core/confirm.service';
import { AdminModuleDetailDto, AdminQuizQuestionDto, LessonDto, SectionDto } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { formatBytes, formatDuration } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';
import { SpinnerComponent } from '../../shared/spinner.component';
import { SwitchComponent } from '../../shared/switch.component';
import { prepareCover } from '../../shared/image-compress';
import { driveId, isPlayableVideo, validateCover, validateMaterial, youtubeId, youtubeThumb } from '../../shared/youtube';
import { INPUT_CLASS } from './admin-shared';

interface QuizDraft {
  key: number;
  text: string;
  options: string[];
  correctIndex: number;
}

/** "mm:ss", "h:mm:ss" ou segundos → segundos; vazio → null; inválido → NaN */
function parseDuration(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const parts = t.split(':').map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p)) || parts.length > 3) return NaN;
  return parts.map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

let quizKey = 0;

/** /admin/modulos/:id — editor do módulo: dados, capa, aulas, materiais e prova. */
@Component({
  selector: 'app-module-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SpinnerComponent, SwitchComponent],
  template: `
    <div class="mx-auto max-w-[1100px] px-4 py-8 md:px-10 lg:py-12">
      <a routerLink="/admin/modulos" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
        <app-icon name="chevron-left" class="h-4 w-4" /> Módulos
      </a>

      @if (loading()) {
        <div class="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"><app-spinner /> Carregando módulo…</div>
      } @else if (notFound()) {
        <div class="mt-8 rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <p class="text-sm font-semibold">Módulo não encontrado</p>
          <a routerLink="/admin/modulos" class="mt-4 inline-flex rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-primary">Voltar aos módulos</a>
        </div>
      } @else if (loadError()) {
        <div class="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-6 text-sm text-red-400">
          {{ loadError() }}
          <button type="button" (click)="load(id())" class="ml-2 font-semibold underline">Tentar de novo</button>
        </div>
      } @else if (mod(); as m) {
        <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{{ m.sectionTitle }}</div>
            <h1 class="mt-1 truncate font-display text-3xl font-bold tracking-tight md:text-4xl">{{ m.title }}</h1>
            <p class="mt-1 text-xs text-muted-foreground">
              <span class="font-mono">/curso/{{ m.slug }}</span> · {{ m.lessonCount }} aulas · {{ m.lessonsWithVideo }} com vídeo
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              (click)="toggleLock()"
              [disabled]="lockBusy()"
              class="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-60"
              [class]="m.locked ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'"
            >
              <app-icon [name]="m.locked ? 'lock' : 'lock-open'" class="h-3.5 w-3.5" />
              {{ m.locked ? 'Trancado — liberar' : 'Liberado — trancar' }}
            </button>
            <a
              [routerLink]="['/curso', m.slug]"
              class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40"
            >
              <app-icon name="eye" class="h-3.5 w-3.5" /> Ver como aluno
            </a>
          </div>
        </div>

        <div class="mt-8 grid gap-8 lg:grid-cols-[380px_1fr]">
          <!-- ================= Dados do módulo ================= -->
          <div class="flex flex-col gap-8">
            <form class="h-fit overflow-hidden rounded-2xl border border-border bg-card" (submit)="saveModule($event)">
              <div class="flex items-center gap-2.5 border-b border-border bg-gradient-to-br from-primary/10 to-card px-5 py-4">
                <div class="grid h-9 w-9 place-items-center rounded-xl gradient-gold text-primary-foreground">
                  <app-icon name="pencil" class="h-4 w-4" />
                </div>
                <h2 class="font-display text-lg font-bold">Dados do módulo</h2>
              </div>
              <div class="space-y-4 p-5">
                <div>
                  <span class="mb-1.5 block text-sm font-medium">Capa</span>
                  <div class="flex items-center gap-3">
                    <div class="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-black">
                      @if (m.coverUrl) {
                        <img [src]="m.coverUrl" alt="Capa do módulo" class="absolute inset-0 h-full w-full object-cover" />
                      } @else {
                        <div class="grid h-full w-full place-items-center text-white/30"><app-icon name="video" class="h-5 w-5" /></div>
                      }
                      @if (coverBusy()) {
                        <div class="absolute inset-0 grid place-items-center bg-black/60"><app-spinner class="text-primary" /></div>
                      }
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <button
                        type="button"
                        (click)="coverInput().nativeElement.click()"
                        [disabled]="coverBusy()"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
                      >
                        <app-icon name="image-plus" class="h-3.5 w-3.5" /> {{ m.coverUrl ? 'Trocar capa' : 'Enviar capa' }}
                      </button>
                      @if (m.coverUrl) {
                        <button type="button" (click)="removeCover()" [disabled]="coverBusy()" class="text-left text-[11px] text-muted-foreground transition hover:text-red-400">
                          remover capa
                        </button>
                      }
                      <span class="text-[10px] text-muted-foreground/70">Imagem até 10 MB</span>
                    </div>
                    <input #cover type="file" accept="image/*" class="hidden" (change)="onCover($event)" />
                  </div>
                </div>
                <div>
                  <label for="me-section" class="mb-1.5 block text-sm font-medium">Seção</label>
                  <select id="me-section" (change)="fSection.set($any($event.target).value)" [class]="inputClass">
                    @for (s of sections(); track s.id) {
                      <option [value]="s.id" [selected]="s.id === fSection()">{{ s.title }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label for="me-title" class="mb-1.5 block text-sm font-medium">Título</label>
                  <input id="me-title" [value]="fTitle()" (input)="fTitle.set($any($event.target).value)" [class]="inputClass" />
                </div>
                <div>
                  <label for="me-author" class="mb-1.5 block text-sm font-medium">Autor / mentor</label>
                  <input id="me-author" [value]="fAuthor()" (input)="fAuthor.set($any($event.target).value)" placeholder="Ex.: Time LURE" [class]="inputClass" />
                </div>
                <div>
                  <label for="me-desc" class="mb-1.5 block text-sm font-medium">Descrição</label>
                  <textarea id="me-desc" rows="4" [value]="fDesc()" (input)="fDesc.set($any($event.target).value)" [class]="inputClass + ' resize-none'"></textarea>
                </div>
                <div>
                  <label for="me-order" class="mb-1.5 block text-sm font-medium">Ordem na seção</label>
                  <input
                    id="me-order"
                    type="number"
                    [value]="fOrder()"
                    (input)="setOrder($event)"
                    [class]="inputClass + ' w-28'"
                  />
                  <p class="mt-1 text-[11px] text-muted-foreground">Menor aparece primeiro.</p>
                </div>
                <div class="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface/50 px-3 py-3">
                  <span>
                    <span class="block text-sm font-medium">Trancado (“Em gravação”)</span>
                    <span class="mt-0.5 block text-xs text-muted-foreground">Liberar dispara a notificação de conteúdo novo.</span>
                  </span>
                  <app-switch [checked]="fLocked()" label="Trancado" (changed)="fLocked.set($event)" />
                </div>
                <button
                  type="submit"
                  [disabled]="savingModule()"
                  class="inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  @if (savingModule()) {
                    <app-spinner /> Salvando…
                  } @else {
                    <app-icon name="circle-check" class="h-4 w-4" /> Salvar alterações
                  }
                </button>
              </div>
            </form>

            <div class="rounded-2xl border border-red-500/20 bg-card p-5">
              <div class="text-sm font-semibold text-red-400">Zona de perigo</div>
              <p class="mt-1 text-xs text-muted-foreground">Apaga aulas, progresso, materiais, comentários e prova. Certificados emitidos continuam válidos.</p>
              <button
                type="button"
                (click)="deleteModule()"
                class="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10"
              >
                <app-icon name="trash-2" class="h-3.5 w-3.5" /> Apagar módulo
              </button>
            </div>
          </div>

          <div class="flex min-w-0 flex-col gap-8">
            <!-- ================= Aulas ================= -->
            <div class="rounded-2xl border border-border bg-card">
              <div class="flex items-center gap-2.5 border-b border-border px-5 py-4">
                <div class="grid h-9 w-9 place-items-center rounded-xl bg-surface text-muted-foreground">
                  <app-icon name="video" class="h-4 w-4" />
                </div>
                <div>
                  <h2 class="font-display text-lg font-bold">Aulas</h2>
                  <p class="text-xs text-muted-foreground">{{ lessons().length }} {{ lessons().length === 1 ? 'aula' : 'aulas' }}</p>
                </div>
              </div>

              @if (lessons().length === 0) {
                <p class="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma aula ainda. Adicione a primeira abaixo.</p>
              }
              <ul class="divide-y divide-border">
                @for (l of lessons(); track l.id; let i = $index; let first = $first; let last = $last) {
                  @let open = expanded() === l.id;
                  <li [class]="open ? 'bg-surface/40' : ''">
                    <div class="flex items-center gap-3 px-4 py-3">
                      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-sm font-bold text-muted-foreground">{{ l.position }}</span>
                      <button type="button" (click)="toggleLesson(l)" class="min-w-0 flex-1 text-left" [attr.aria-expanded]="open">
                        <span class="block truncate text-sm font-semibold">{{ l.title }}</span>
                        <span class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          @if (l.videoUrl) {
                            <span class="inline-flex items-center gap-1 text-emerald-400"><app-icon name="video" class="h-3 w-3" /> com vídeo</span>
                          } @else {
                            <span class="inline-flex items-center gap-1 text-amber-400"><app-icon name="video" class="h-3 w-3" /> sem vídeo</span>
                          }
                          <span>· {{ dur(l.durationSeconds) }}</span>
                          @if (l.materials.length) {
                            <span>· {{ l.materials.length }} {{ l.materials.length === 1 ? 'material' : 'materiais' }}</span>
                          }
                        </span>
                      </button>
                      <button type="button" (click)="moveLesson(i, -1)" [disabled]="first || orderBusy()" class="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label="Mover aula para cima">
                        <app-icon name="arrow-up" class="h-3.5 w-3.5" />
                      </button>
                      <button type="button" (click)="moveLesson(i, 1)" [disabled]="last || orderBusy()" class="grid h-8 w-8 rotate-180 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label="Mover aula para baixo">
                        <app-icon name="arrow-up" class="h-3.5 w-3.5" />
                      </button>
                      <button type="button" (click)="toggleLesson(l)" class="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground" [attr.aria-label]="open ? 'Fechar edição' : 'Editar aula'">
                        <app-icon [name]="open ? 'x' : 'pencil'" class="h-3.5 w-3.5" />
                      </button>
                      <button type="button" (click)="deleteLesson(l)" class="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400" aria-label="Apagar aula">
                        <app-icon name="trash-2" class="h-3.5 w-3.5" />
                      </button>
                    </div>

                    @if (open) {
                      <div class="space-y-4 px-4 pb-5 sm:pl-16">
                        <div>
                          <label [for]="'l-title-' + l.id" class="mb-1.5 block text-xs font-medium text-muted-foreground">Título</label>
                          <input [id]="'l-title-' + l.id" [value]="lTitle()" (input)="lTitle.set($any($event.target).value)" [class]="inputClass" />
                        </div>
                        <div>
                          <label [for]="'l-url-' + l.id" class="mb-1.5 block text-xs font-medium text-muted-foreground">Link do vídeo</label>
                          <div class="relative">
                            <app-icon
                              name="video"
                              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                              [class]="lUrlValid() ? 'text-muted-foreground' : 'text-red-400'"
                            />
                            <input
                              [id]="'l-url-' + l.id"
                              [value]="lUrl()"
                              (input)="lUrl.set($any($event.target).value)"
                              placeholder="Google Drive, YouTube ou https://…/aula.mp4"
                              [class]="inputClass + ' pl-10 ' + (lUrlValid() ? '' : 'border-red-500/50')"
                            />
                          </div>
                          @if (!lUrlValid()) {
                            <p class="mt-1 text-xs text-red-400">Link inválido. Cole o link de um vídeo do Google Drive (não de pasta), do YouTube ou um link direto terminando em .mp4.</p>
                          } @else if (lDriveId()) {
                            <p class="mt-1 text-[11px] text-emerald-400">
                              <app-icon name="circle-check" class="inline h-3 w-3" /> Vídeo do Google Drive. Deixe o arquivo como
                              <b>“Qualquer pessoa com o link”</b>. O Drive não avisa quando a aula termina: o aluno marca como concluída.
                              Preencha a duração ao lado.
                            </p>
                          } @else if (lVideoId(); as vid) {
                            <div class="mt-2 flex items-center gap-3">
                              <img [src]="thumb(vid)" alt="Miniatura do vídeo" loading="lazy" class="h-16 w-28 rounded-lg border border-border object-cover" />
                              <span class="font-mono text-[11px] text-muted-foreground">ID {{ vid }}</span>
                            </div>
                          } @else if (lUrl().trim()) {
                            <p class="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-400"><app-icon name="circle-check" class="h-3 w-3" /> Arquivo de vídeo direto — toca no player da LURE.</p>
                          } @else {
                            <p class="mt-1 text-[11px] text-muted-foreground">Cole o link de compartilhamento do Google Drive, um link do YouTube <b>Não listado</b> ou o link público de um .mp4. Sem link, o aluno vê “Vídeo em breve”.</p>
                          }
                        </div>
                        <div class="grid gap-4 sm:grid-cols-[1fr_140px]">
                          <div>
                            <label [for]="'l-desc-' + l.id" class="mb-1.5 block text-xs font-medium text-muted-foreground">Descrição</label>
                            <textarea [id]="'l-desc-' + l.id" rows="3" [value]="lDesc()" (input)="lDesc.set($any($event.target).value)" [class]="inputClass + ' resize-none'"></textarea>
                          </div>
                          <div>
                            <label [for]="'l-dur-' + l.id" class="mb-1.5 block text-xs font-medium text-muted-foreground">Duração (mm:ss)</label>
                            <input
                              [id]="'l-dur-' + l.id"
                              [value]="lDur()"
                              (input)="lDur.set($any($event.target).value)"
                              placeholder="auto"
                              [class]="inputClass + (lDurValid() ? '' : ' border-red-500/50')"
                            />
                            <p class="mt-1 text-[10px] text-muted-foreground">Vazio = detectada pelo player.</p>
                          </div>
                        </div>
                        <div class="flex justify-end gap-2">
                          <button type="button" (click)="expanded.set(null)" class="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground">Cancelar</button>
                          <button
                            type="button"
                            (click)="saveLesson(l)"
                            [disabled]="lessonSaving() || !lUrlValid() || !lDurValid() || !lTitle().trim()"
                            class="inline-flex items-center gap-1.5 rounded-lg gradient-gold px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                          >
                            @if (lessonSaving()) {
                              <app-spinner size="h-3.5 w-3.5" />
                            } @else {
                              <app-icon name="check" class="h-3.5 w-3.5" />
                            }
                            Salvar aula
                          </button>
                        </div>

                        <!-- Materiais -->
                        <div class="rounded-xl border border-border bg-background/40 p-4">
                          <div class="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            <app-icon name="file-text" class="h-3.5 w-3.5" /> Materiais da aula
                          </div>
                          @if (l.materials.length) {
                            <ul class="flex flex-col gap-2">
                              @for (mat of l.materials; track mat.id) {
                                <li class="flex items-center gap-2">
                                  <a
                                    [href]="mat.url"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition hover:bg-muted"
                                  >
                                    <app-icon name="download" class="h-4 w-4 shrink-0 text-primary" />
                                    <span class="min-w-0 flex-1 truncate">{{ mat.label }}</span>
                                    <span class="shrink-0 text-[11px] text-muted-foreground">{{ bytes(mat.sizeBytes) }}</span>
                                  </a>
                                  <button
                                    type="button"
                                    (click)="deleteMaterial(l, mat.id)"
                                    class="shrink-0 rounded-lg border border-red-500/30 px-2.5 py-2 text-red-400 transition hover:bg-red-500/10"
                                    aria-label="Remover material"
                                    title="Remover material"
                                  >
                                    <app-icon name="trash-2" class="h-3.5 w-3.5" />
                                  </button>
                                </li>
                              }
                            </ul>
                          } @else {
                            <p class="text-xs text-muted-foreground">Nenhum material ainda.</p>
                          }
                          <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              [value]="matLabel()"
                              (input)="matLabel.set($any($event.target).value)"
                              placeholder="Nome exibido (opcional)"
                              aria-label="Nome do material"
                              [class]="inputClass + ' sm:flex-1'"
                            />
                            <button
                              type="button"
                              (click)="matInput()?.nativeElement?.click()"
                              [disabled]="uploadPct() !== null"
                              class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60"
                            >
                              @if (uploadPct() !== null) {
                                <app-spinner /> Enviando… {{ uploadPct() }}%
                              } @else {
                                <app-icon name="file-text" class="h-4 w-4" /> Adicionar material
                              }
                            </button>
                            <input #mat type="file" class="hidden" (change)="onMaterial($event, l)" />
                          </div>
                          @if (uploadPct() !== null) {
                            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/60">
                              <div class="h-full rounded-full gradient-gold transition-all" [style.width.%]="uploadPct()"></div>
                            </div>
                          }
                          @if (matError()) {
                            <p class="mt-2 text-xs text-red-400">{{ matError() }}</p>
                          }
                          <p class="mt-1.5 text-[11px] text-muted-foreground">PDF, planilha, zip… até 50 MB. O aluno baixa clicando no material.</p>
                        </div>
                      </div>
                    }
                  </li>
                }
              </ul>

              <form class="flex flex-col gap-2 border-t border-border p-4 sm:flex-row" (submit)="addLesson($event)">
                <input
                  [value]="aTitle()"
                  (input)="aTitle.set($any($event.target).value)"
                  placeholder="Título da nova aula"
                  aria-label="Título da nova aula"
                  [class]="inputClass + ' sm:flex-1'"
                />
                <input
                  [value]="aUrl()"
                  (input)="aUrl.set($any($event.target).value)"
                  placeholder="Link do vídeo (opcional)"
                  aria-label="Link do vídeo da nova aula"
                  [class]="inputClass + ' sm:flex-1 ' + (aUrlValid() ? '' : 'border-red-500/50')"
                />
                <button
                  type="submit"
                  [disabled]="adding() || !aTitle().trim() || !aUrlValid()"
                  class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/50 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
                >
                  @if (adding()) {
                    <app-spinner />
                  } @else {
                    <app-icon name="plus" class="h-4 w-4" />
                  }
                  Adicionar aula
                </button>
              </form>
            </div>

            <!-- ================= Prova final ================= -->
            <div class="rounded-2xl border border-border bg-card">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div class="flex items-center gap-2.5">
                  <div class="grid h-9 w-9 place-items-center rounded-xl bg-surface text-muted-foreground">
                    <app-icon name="award" class="h-4 w-4" />
                  </div>
                  <div>
                    <h2 class="font-display text-lg font-bold">Prova final</h2>
                    <p class="text-xs text-muted-foreground">
                      {{ quiz().length ? quiz().length + ' perguntas · nota mínima 70%' : 'Sem prova — o certificado sai ao concluir as aulas' }}
                    </p>
                  </div>
                </div>
                @if (quizDirty()) {
                  <span class="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-400">Alterações não salvas</span>
                }
              </div>
              <ol class="space-y-4 p-5">
                @for (q of quiz(); track q.key; let qi = $index) {
                  <li class="rounded-xl border border-border bg-background/40 p-4">
                    <div class="flex items-start gap-2">
                      <span class="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">{{ qi + 1 }}</span>
                      <textarea
                        rows="2"
                        [value]="q.text"
                        (input)="setQuestionText(qi, $any($event.target).value)"
                        placeholder="Enunciado da pergunta"
                        [attr.aria-label]="'Enunciado da pergunta ' + (qi + 1)"
                        [class]="inputClass + ' resize-none'"
                      ></textarea>
                      <button
                        type="button"
                        (click)="removeQuestion(qi)"
                        class="mt-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Remover pergunta"
                      >
                        <app-icon name="trash-2" class="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div class="mt-3 space-y-2 pl-8" role="radiogroup" [attr.aria-label]="'Alternativa correta da pergunta ' + (qi + 1)">
                      @for (opt of q.options; track $index; let oi = $index) {
                        <div class="flex items-center gap-2">
                          <label class="flex shrink-0 cursor-pointer items-center" [title]="'Marcar como correta'">
                            <input
                              type="radio"
                              [name]="'correct-' + q.key"
                              [checked]="q.correctIndex === oi"
                              (change)="setCorrect(qi, oi)"
                              class="h-4 w-4 accent-[#bb9a35]"
                              [attr.aria-label]="'Alternativa ' + (oi + 1) + ' é a correta'"
                            />
                          </label>
                          <input
                            [value]="opt"
                            (input)="setOption(qi, oi, $any($event.target).value)"
                            [placeholder]="'Alternativa ' + (oi + 1)"
                            [attr.aria-label]="'Alternativa ' + (oi + 1)"
                            [class]="inputClass + ' py-2 ' + (q.correctIndex === oi ? 'border-emerald-500/50' : '')"
                          />
                          <button
                            type="button"
                            (click)="removeOption(qi, oi)"
                            [disabled]="q.options.length <= 2"
                            class="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
                            aria-label="Remover alternativa"
                          >
                            <app-icon name="x" class="h-3.5 w-3.5" />
                          </button>
                        </div>
                      }
                      @if (q.options.length < 6) {
                        <button type="button" (click)="addOption(qi)" class="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:brightness-125">
                          <app-icon name="plus" class="h-3 w-3" /> Alternativa
                        </button>
                      }
                    </div>
                  </li>
                } @empty {
                  <li class="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                    Sem perguntas. Adicione para exigir uma prova antes do certificado.
                  </li>
                }
              </ol>
              @if (quizError()) {
                <p class="mx-5 -mt-1 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{{ quizError() }}</p>
              }
              <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4">
                <button
                  type="button"
                  (click)="addQuestion()"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/50 px-3.5 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
                >
                  <app-icon name="plus" class="h-4 w-4" /> Pergunta
                </button>
                <button
                  type="button"
                  (click)="saveQuiz()"
                  [disabled]="quizSaving() || !quizDirty()"
                  class="inline-flex items-center gap-2 rounded-lg gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                >
                  @if (quizSaving()) {
                    <app-spinner />
                  } @else {
                    <app-icon name="check" class="h-4 w-4" />
                  }
                  Salvar prova
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ModuleEditorPage {
  readonly id = input.required<string>();

  private readonly admin = inject(AdminApi);
  private readonly catalog = inject(CatalogApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  protected readonly coverInput = viewChild.required<ElementRef<HTMLInputElement>>('cover');
  protected readonly matInput = viewChild<ElementRef<HTMLInputElement>>('mat');
  protected readonly inputClass = INPUT_CLASS;

  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly mod = signal<AdminModuleDetailDto | null>(null);
  protected readonly sections = signal<SectionDto[]>([]);
  protected readonly lessons = computed(() => [...(this.mod()?.lessons ?? [])].sort((a, b) => a.position - b.position));

  // dados
  protected readonly fSection = signal('');
  protected readonly fTitle = signal('');
  protected readonly fAuthor = signal('');
  protected readonly fDesc = signal('');
  protected readonly fOrder = signal(0);
  protected readonly fLocked = signal(false);
  protected readonly savingModule = signal(false);
  protected readonly coverBusy = signal(false);
  protected readonly lockBusy = signal(false);

  // aulas
  protected readonly expanded = signal<string | null>(null);
  protected readonly lTitle = signal('');
  protected readonly lDesc = signal('');
  protected readonly lUrl = signal('');
  protected readonly lDur = signal('');
  protected readonly lessonSaving = signal(false);
  protected readonly orderBusy = signal(false);
  protected readonly lVideoId = computed(() => youtubeId(this.lUrl()));
  protected readonly lDriveId = computed(() => driveId(this.lUrl()));
  protected readonly lUrlValid = computed(() => !this.lUrl().trim() || isPlayableVideo(this.lUrl()));
  protected readonly lDurValid = computed(() => {
    const d = parseDuration(this.lDur());
    return d === null || (!isNaN(d) && d >= 0);
  });
  protected readonly aTitle = signal('');
  protected readonly aUrl = signal('');
  protected readonly adding = signal(false);
  protected readonly aUrlValid = computed(() => !this.aUrl().trim() || isPlayableVideo(this.aUrl()));

  // materiais
  protected readonly matLabel = signal('');
  protected readonly uploadPct = signal<number | null>(null);
  protected readonly matError = signal<string | null>(null);

  // prova
  protected readonly quiz = signal<QuizDraft[]>([]);
  protected readonly quizDirty = signal(false);
  protected readonly quizSaving = signal(false);
  protected readonly quizError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected load(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.loadError.set(null);
    forkJoin({ mod: this.admin.module(id), sections: this.catalog.sections() }).subscribe({
      next: ({ mod, sections }) => {
        this.sections.set([...sections].sort((a, b) => a.sortOrder - b.sortOrder));
        this.applyModule(mod, true);
        this.loading.set(false);
      },
      error: (err) => {
        if (apiStatus(err) === 404) this.notFound.set(true);
        else this.loadError.set(apiMessage(err));
        this.loading.set(false);
      },
    });
  }

  private applyModule(m: AdminModuleDetailDto, resetForms: boolean): void {
    this.mod.set(m);
    this.title.setTitle(`Editar: ${m.title} — AssessoriaLure`);
    if (resetForms) {
      this.fSection.set(m.sectionId);
      this.fTitle.set(m.title);
      this.fAuthor.set(m.author ?? '');
      this.fDesc.set(m.description ?? '');
      this.fOrder.set(m.sortOrder);
      this.fLocked.set(m.locked);
      this.setQuizFrom(m.quiz);
    }
  }

  private reload(): void {
    this.admin.module(this.id()).subscribe({ next: (m) => this.applyModule(m, false) });
  }

  // ------------------------------------------------ dados do módulo
  protected saveModule(e: Event): void {
    e.preventDefault();
    const m = this.mod();
    if (!m || this.savingModule()) return;
    if (!this.fTitle().trim()) {
      this.toast.error('Dê um título ao módulo.');
      return;
    }
    this.savingModule.set(true);
    this.admin
      .updateModule(m.id, {
        sectionId: this.fSection(),
        title: this.fTitle().trim(),
        author: this.fAuthor().trim() || null,
        description: this.fDesc().trim() || null,
        locked: this.fLocked(),
        sortOrder: this.fOrder(),
      })
      .subscribe({
        next: (res) => {
          this.savingModule.set(false);
          this.mod.set({ ...m, ...res });
          this.toast.success('Módulo salvo.');
        },
        error: (err) => {
          this.savingModule.set(false);
          this.toast.error(apiMessage(err, 'Não foi possível salvar o módulo.'));
        },
      });
  }

  protected toggleLock(): void {
    const m = this.mod();
    if (!m || this.lockBusy()) return;
    const next = !m.locked;
    this.lockBusy.set(true);
    this.admin.setModuleLock(m.id, next).subscribe({
      next: (res) => {
        this.lockBusy.set(false);
        this.mod.set({ ...m, ...res });
        this.fLocked.set(res.locked);
        this.toast.success(res.locked ? 'Módulo trancado.' : 'Módulo liberado — os alunos serão avisados.');
      },
      error: (err) => {
        this.lockBusy.set(false);
        this.toast.error(apiMessage(err));
      },
    });
  }

  protected async onCover(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    const m = this.mod();
    if (!f || !m) return;
    const err = validateCover(f);
    if (err) {
      this.toast.error(err);
      return;
    }
    this.coverBusy.set(true);
    let cover: File;
    try {
      cover = await prepareCover(f); // recorte central 3:4, igual em todos os cards
    } catch (er) {
      this.coverBusy.set(false);
      this.toast.error(er instanceof Error ? er.message : 'Não foi possível preparar essa imagem.');
      return;
    }
    this.admin.uploadCover(m.id, cover).subscribe({
      next: (res) => {
        this.coverBusy.set(false);
        this.mod.set({ ...m, ...res });
        this.toast.success('Capa atualizada.');
      },
      error: (er) => {
        this.coverBusy.set(false);
        this.toast.error(apiMessage(er, 'A capa não subiu.'));
      },
    });
  }

  protected removeCover(): void {
    const m = this.mod();
    if (!m) return;
    this.coverBusy.set(true);
    this.admin.removeCover(m.id).subscribe({
      next: (res) => {
        this.coverBusy.set(false);
        this.mod.set({ ...m, ...res });
      },
      error: (err) => {
        this.coverBusy.set(false);
        this.toast.error(apiMessage(err));
      },
    });
  }

  protected async deleteModule(): Promise<void> {
    const m = this.mod();
    if (!m) return;
    const ok = await this.confirm.ask({
      title: `Apagar o módulo “${m.title}”?`,
      message: 'Isso não tem desfazer.',
      confirmLabel: 'Apagar módulo',
      danger: true,
    });
    if (!ok) return;
    this.admin.deleteModule(m.id).subscribe({
      next: () => {
        this.toast.success('Módulo apagado.');
        void this.router.navigate(['/admin/modulos']);
      },
      error: (err) => this.toast.error(apiMessage(err)),
    });
  }

  // ------------------------------------------------ aulas
  protected toggleLesson(l: LessonDto): void {
    if (this.expanded() === l.id) {
      this.expanded.set(null);
      return;
    }
    this.lTitle.set(l.title);
    this.lDesc.set(l.description ?? '');
    this.lUrl.set(l.videoUrl ?? '');
    this.lDur.set(formatDuration(l.durationSeconds) ?? '');
    this.matLabel.set('');
    this.matError.set(null);
    this.expanded.set(l.id);
  }

  private replaceLesson(l: LessonDto): void {
    const m = this.mod();
    if (!m) return;
    const lessons = m.lessons.map((x) => (x.id === l.id ? { ...l, materials: l.materials ?? x.materials } : x));
    this.mod.set({ ...m, lessons, lessonsWithVideo: lessons.filter((x) => !!x.videoUrl).length });
  }

  protected saveLesson(l: LessonDto): void {
    if (!this.lUrlValid() || !this.lDurValid() || !this.lTitle().trim()) return;
    const d = parseDuration(this.lDur());
    this.lessonSaving.set(true);
    this.admin
      .updateLesson(l.id, {
        title: this.lTitle().trim(),
        description: this.lDesc().trim() || null,
        videoUrl: this.lUrl().trim() || null,
        durationSeconds: d === null || isNaN(d) ? null : d,
      })
      .subscribe({
        next: (res) => {
          this.lessonSaving.set(false);
          this.replaceLesson(res);
          this.toast.success('Aula salva.');
        },
        error: (err) => {
          this.lessonSaving.set(false);
          this.toast.error(apiMessage(err, 'Não foi possível salvar a aula.'));
        },
      });
  }

  protected addLesson(e: Event): void {
    e.preventDefault();
    const m = this.mod();
    if (!m || !this.aTitle().trim() || !this.aUrlValid() || this.adding()) return;
    this.adding.set(true);
    this.admin.createLesson(m.id, { title: this.aTitle().trim(), videoUrl: this.aUrl().trim() || null }).subscribe({
      next: (l) => {
        this.adding.set(false);
        const cur = this.mod();
        if (cur) {
          const lessons = [...cur.lessons, { ...l, materials: l.materials ?? [] }];
          this.mod.set({
            ...cur,
            lessons,
            lessonCount: lessons.length,
            lessonsWithVideo: lessons.filter((x) => !!x.videoUrl).length,
          });
        }
        this.aTitle.set('');
        this.aUrl.set('');
        this.toast.success('Aula adicionada.');
      },
      error: (err) => {
        this.adding.set(false);
        this.toast.error(apiMessage(err, 'Não foi possível adicionar a aula.'));
      },
    });
  }

  protected async deleteLesson(l: LessonDto): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Apagar a aula “${l.title}”?`,
      message: 'Progresso dos alunos e materiais desta aula também serão removidos.',
      confirmLabel: 'Apagar aula',
      danger: true,
    });
    if (!ok) return;
    this.admin.deleteLesson(l.id).subscribe({
      next: () => {
        if (this.expanded() === l.id) this.expanded.set(null);
        this.toast.success('Aula apagada.');
        this.reload();
      },
      error: (err) => this.toast.error(apiMessage(err)),
    });
  }

  protected moveLesson(index: number, delta: number): void {
    const m = this.mod();
    const list = [...this.lessons()];
    const j = index + delta;
    if (!m || j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    const previous = m.lessons;
    const reordered = list.map((l, i) => ({ ...l, position: i + 1 }));
    this.mod.set({ ...m, lessons: reordered });
    this.orderBusy.set(true);
    this.admin.reorderLessons(m.id, reordered.map((l) => l.id)).subscribe({
      next: () => this.orderBusy.set(false),
      error: (err) => {
        this.orderBusy.set(false);
        const cur = this.mod();
        if (cur) this.mod.set({ ...cur, lessons: previous });
        this.toast.error(apiMessage(err, 'Não foi possível reordenar.'));
      },
    });
  }

  // ------------------------------------------------ materiais
  protected onMaterial(e: Event, l: LessonDto): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const err = validateMaterial(f);
    if (err) {
      this.matError.set(err);
      return;
    }
    this.matError.set(null);
    this.uploadPct.set(0);
    this.admin.uploadMaterial(l.id, f, this.matLabel().trim() || f.name).subscribe({
      next: (ev) => {
        if (ev.type === HttpEventType.UploadProgress) {
          this.uploadPct.set(ev.total ? Math.min(99, Math.round((100 * ev.loaded) / ev.total)) : 50);
        } else if (ev.type === HttpEventType.Response && ev.body) {
          const mat = ev.body;
          this.uploadPct.set(null);
          this.matLabel.set('');
          const m = this.mod();
          if (m) {
            this.mod.set({
              ...m,
              lessons: m.lessons.map((x) => (x.id === l.id ? { ...x, materials: [...x.materials, mat] } : x)),
            });
          }
          this.toast.success('Material enviado.');
        }
      },
      error: (er) => {
        this.uploadPct.set(null);
        this.matError.set(`Não subiu: ${apiMessage(er)}`);
      },
    });
  }

  protected async deleteMaterial(l: LessonDto, materialId: string): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Remover este material?', confirmLabel: 'Remover', danger: true });
    if (!ok) return;
    this.admin.deleteMaterial(materialId).subscribe({
      next: () => {
        const m = this.mod();
        if (m) {
          this.mod.set({
            ...m,
            lessons: m.lessons.map((x) => (x.id === l.id ? { ...x, materials: x.materials.filter((mm) => mm.id !== materialId) } : x)),
          });
        }
      },
      error: (err) => this.toast.error(apiMessage(err)),
    });
  }

  // ------------------------------------------------ prova
  private setQuizFrom(qs: AdminQuizQuestionDto[]): void {
    this.quiz.set(qs.map((q) => ({ key: ++quizKey, text: q.text, options: [...q.options], correctIndex: q.correctIndex })));
    this.quizDirty.set(false);
    this.quizError.set(null);
  }

  private updateQuestion(qi: number, fn: (q: QuizDraft) => QuizDraft): void {
    this.quiz.update((list) => list.map((q, i) => (i === qi ? fn(q) : q)));
    this.quizDirty.set(true);
  }

  protected addQuestion(): void {
    this.quiz.update((list) => [...list, { key: ++quizKey, text: '', options: ['', '', '', ''], correctIndex: 0 }]);
    this.quizDirty.set(true);
  }

  protected removeQuestion(qi: number): void {
    this.quiz.update((list) => list.filter((_, i) => i !== qi));
    this.quizDirty.set(true);
  }

  protected setQuestionText(qi: number, text: string): void {
    this.updateQuestion(qi, (q) => ({ ...q, text }));
  }

  protected setOption(qi: number, oi: number, text: string): void {
    this.updateQuestion(qi, (q) => ({ ...q, options: q.options.map((o, i) => (i === oi ? text : o)) }));
  }

  protected setCorrect(qi: number, oi: number): void {
    this.updateQuestion(qi, (q) => ({ ...q, correctIndex: oi }));
  }

  protected addOption(qi: number): void {
    this.updateQuestion(qi, (q) => (q.options.length >= 6 ? q : { ...q, options: [...q.options, ''] }));
  }

  protected removeOption(qi: number, oi: number): void {
    this.updateQuestion(qi, (q) => {
      if (q.options.length <= 2) return q;
      const options = q.options.filter((_, i) => i !== oi);
      const correctIndex = q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex;
      return { ...q, options, correctIndex };
    });
  }

  protected saveQuiz(): void {
    const m = this.mod();
    if (!m) return;
    const qs = this.quiz();
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (!q.text.trim()) return this.quizError.set(`Pergunta ${i + 1}: escreva o enunciado.`);
      if (q.options.length < 2 || q.options.length > 6) return this.quizError.set(`Pergunta ${i + 1}: use de 2 a 6 alternativas.`);
      if (q.options.some((o) => !o.trim())) return this.quizError.set(`Pergunta ${i + 1}: preencha todas as alternativas (ou remova as vazias).`);
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) return this.quizError.set(`Pergunta ${i + 1}: marque a alternativa correta.`);
    }
    this.quizError.set(null);
    this.quizSaving.set(true);
    this.admin
      .saveQuiz(
        m.id,
        qs.map((q) => ({ text: q.text.trim(), options: q.options.map((o) => o.trim()), correctIndex: q.correctIndex })),
      )
      .subscribe({
        next: (res) => {
          this.quizSaving.set(false);
          this.setQuizFrom(res);
          const cur = this.mod();
          if (cur) this.mod.set({ ...cur, quiz: res, quizQuestionCount: res.length });
          this.toast.success(res.length ? 'Prova salva.' : 'Prova removida.');
        },
        error: (err) => {
          this.quizSaving.set(false);
          this.quizError.set(apiMessage(err, 'Não foi possível salvar a prova.'));
        },
      });
  }

  // ------------------------------------------------ helpers
  protected setOrder(e: Event): void {
    const n = Number((e.target as HTMLInputElement).value);
    this.fOrder.set(Number.isFinite(n) ? Math.trunc(n) : 0);
  }

  protected dur(s: number | null): string {
    return formatDuration(s) ?? 'duração automática';
  }

  protected bytes(n: number): string {
    return formatBytes(n);
  }

  protected thumb(id: string): string {
    return youtubeThumb(id);
  }
}
