import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AdminApi } from '../../core/api/admin.api';
import { CatalogApi } from '../../core/api/catalog.api';
import { apiMessage } from '../../core/api-error';
import { ConfirmService } from '../../core/confirm.service';
import { AdminModuleDto, SectionDto } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { SpinnerComponent } from '../../shared/spinner.component';
import { SwitchComponent } from '../../shared/switch.component';
import { prepareCover } from '../../shared/image-compress';
import { validateCover } from '../../shared/youtube';
import { INPUT_CLASS } from './admin-shared';

interface Msg {
  type: 'ok' | 'err';
  text: string;
}

/** /admin/modulos — seções, novo módulo e lista de módulos agrupada por seção. */
@Component({
  selector: 'app-modules-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SpinnerComponent, SwitchComponent],
  template: `
    <div class="mx-auto max-w-[1100px] px-4 py-8 md:px-10 lg:py-12">
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div class="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <app-icon name="shield-check" class="h-3.5 w-3.5" /> Admin
          </div>
          <h1 class="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">Módulos</h1>
          <p class="mt-2 max-w-2xl text-sm text-muted-foreground">
            Organize seções e módulos. As aulas usam links do YouTube ou de arquivos .mp4 (Cloudflare R2) — no site, o vídeo toca no player da LURE.
          </p>
        </div>
        <a
          routerLink="/admin"
          class="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          Gerenciar acessos <app-icon name="arrow-right" class="h-3.5 w-3.5" />
        </a>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"><app-spinner /> Carregando…</div>
      } @else if (loadError()) {
        <div class="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-6 text-sm text-red-400">
          {{ loadError() }}
          <button type="button" (click)="load()" class="ml-2 font-semibold underline">Tentar de novo</button>
        </div>
      } @else {
        <div class="grid gap-8 lg:grid-cols-[400px_1fr]">
          <div class="flex flex-col gap-8">
            <!-- Novo módulo -->
            <form class="h-fit overflow-hidden rounded-2xl border border-border bg-card" (submit)="createModule($event)">
              <div class="flex items-center gap-2.5 border-b border-border bg-gradient-to-br from-primary/10 to-card px-5 py-4">
                <div class="grid h-9 w-9 place-items-center rounded-xl gradient-gold text-primary-foreground">
                  <app-icon name="plus" class="h-4 w-4" />
                </div>
                <h2 class="font-display text-lg font-bold">Novo módulo</h2>
              </div>
              <div class="space-y-4 p-5">
                @if (sections().length === 0) {
                  <p class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-400">
                    Crie uma seção primeiro (abaixo) para poder adicionar módulos.
                  </p>
                }
                <div>
                  <span class="mb-1.5 block text-sm font-medium">Capa (opcional)</span>
                  <div class="flex items-center gap-3">
                    <div class="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-black">
                      @if (coverPreview()) {
                        <img [src]="coverPreview()" alt="" class="absolute inset-0 h-full w-full object-cover" />
                      } @else {
                        <div class="grid h-full w-full place-items-center text-white/30"><app-icon name="video" class="h-5 w-5" /></div>
                      }
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <button
                        type="button"
                        (click)="coverInput().nativeElement.click()"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                      >
                        <app-icon name="image-plus" class="h-3.5 w-3.5" /> Escolher imagem
                      </button>
                      @if (coverPreview()) {
                        <button type="button" (click)="clearCover()" class="text-left text-[11px] text-muted-foreground transition hover:text-red-400">remover</button>
                      }
                    </div>
                    <input #cover type="file" accept="image/*" class="hidden" (change)="onCover($event)" />
                  </div>
                </div>
                <div>
                  <label for="nm-section" class="mb-1.5 block text-sm font-medium">Seção</label>
                  <select id="nm-section" [value]="nSection()" (change)="nSection.set($any($event.target).value)" [class]="inputClass">
                    @for (s of sections(); track s.id) {
                      <option [value]="s.id" [selected]="s.id === nSection()">{{ s.title }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label for="nm-title" class="mb-1.5 block text-sm font-medium">Título</label>
                  <input id="nm-title" [value]="nTitle()" (input)="nTitle.set($any($event.target).value)" placeholder="Ex.: Funil de vendas na prática" [class]="inputClass" />
                </div>
                <div>
                  <label for="nm-author" class="mb-1.5 block text-sm font-medium">Autor / mentor (opcional)</label>
                  <input id="nm-author" [value]="nAuthor()" (input)="nAuthor.set($any($event.target).value)" placeholder="Ex.: Time LURE" [class]="inputClass" />
                </div>
                <div>
                  <label for="nm-desc" class="mb-1.5 block text-sm font-medium">Descrição (opcional)</label>
                  <textarea
                    id="nm-desc"
                    rows="3"
                    [value]="nDesc()"
                    (input)="nDesc.set($any($event.target).value)"
                    placeholder="Sobre o que é este módulo…"
                    [class]="inputClass + ' resize-none'"
                  ></textarea>
                </div>
                <div class="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface/50 px-3 py-3">
                  <span>
                    <span class="block text-sm font-medium">Trancado (“Em gravação”)</span>
                    <span class="mt-0.5 block text-xs text-muted-foreground">Alunos veem “Em breve” e não conseguem abrir.</span>
                  </span>
                  <app-switch [checked]="nLocked()" label="Trancado" (changed)="nLocked.set($event)" />
                </div>
                @if (newMsg(); as m) {
                  <div
                    class="rounded-lg border px-3 py-2.5 text-sm"
                    [class]="m.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'"
                  >
                    {{ m.text }}
                  </div>
                }
                <button
                  type="submit"
                  [disabled]="creating() || sections().length === 0"
                  class="inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  @if (creating()) {
                    <app-spinner /> Criando…
                  } @else {
                    <app-icon name="plus" class="h-4 w-4" /> Adicionar módulo
                  }
                </button>
              </div>
            </form>

            <!-- Seções -->
            <div class="h-fit overflow-hidden rounded-2xl border border-border bg-card">
              <div class="flex items-center gap-2.5 border-b border-border px-5 py-4">
                <div class="grid h-9 w-9 place-items-center rounded-xl bg-surface text-muted-foreground">
                  <app-icon name="layers" class="h-4 w-4" />
                </div>
                <div>
                  <h2 class="font-display text-lg font-bold">Seções</h2>
                  <p class="text-xs text-muted-foreground">Ordem em que aparecem na Home</p>
                </div>
              </div>
              <ul class="divide-y divide-border">
                @for (s of sections(); track s.id; let i = $index; let first = $first; let last = $last) {
                  <li class="px-4 py-3">
                    @if (editingSection() === s.id) {
                      <div class="space-y-2">
                        <input [value]="eTitle()" (input)="eTitle.set($any($event.target).value)" placeholder="Título (ex.: MARKETING)" aria-label="Título da seção" [class]="inputClass" />
                        <input [value]="eSubtitle()" (input)="eSubtitle.set($any($event.target).value)" placeholder="Subtítulo" aria-label="Subtítulo da seção" [class]="inputClass" />
                        <div class="flex justify-end gap-2">
                          <button type="button" (click)="editingSection.set(null)" class="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground">Cancelar</button>
                          <button
                            type="button"
                            (click)="saveSection(s)"
                            [disabled]="sectionBusy()"
                            class="inline-flex items-center gap-1.5 rounded-lg gradient-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                          >
                            <app-icon name="check" class="h-3.5 w-3.5" /> Salvar
                          </button>
                        </div>
                      </div>
                    } @else {
                      <div class="flex items-center gap-2">
                        <div class="min-w-0 flex-1">
                          <div class="truncate text-sm font-semibold">{{ s.title }}</div>
                          <div class="truncate text-xs text-muted-foreground">{{ s.subtitle || '—' }} · <span class="font-mono">{{ s.id }}</span></div>
                        </div>
                        <button type="button" (click)="moveSection(i, -1)" [disabled]="first || sectionBusy()" class="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label="Mover para cima">
                          <app-icon name="arrow-up" class="h-3.5 w-3.5" />
                        </button>
                        <button type="button" (click)="moveSection(i, 1)" [disabled]="last || sectionBusy()" class="grid h-7 w-7 rotate-180 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label="Mover para baixo">
                          <app-icon name="arrow-up" class="h-3.5 w-3.5" />
                        </button>
                        <button type="button" (click)="startEditSection(s)" class="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Renomear seção">
                          <app-icon name="pencil" class="h-3.5 w-3.5" />
                        </button>
                        <button type="button" (click)="deleteSection(s)" [disabled]="sectionBusy()" class="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400" aria-label="Apagar seção">
                          <app-icon name="trash-2" class="h-3.5 w-3.5" />
                        </button>
                      </div>
                    }
                  </li>
                } @empty {
                  <li class="px-5 py-6 text-center text-xs text-muted-foreground">Nenhuma seção ainda.</li>
                }
              </ul>
              <form class="space-y-2 border-t border-border p-4" (submit)="createSection($event)">
                <div class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nova seção</div>
                <input [value]="sTitle()" (input)="sTitle.set($any($event.target).value)" placeholder="Título (ex.: VENDAS B2B)" aria-label="Título da nova seção" [class]="inputClass" />
                <input [value]="sSubtitle()" (input)="sSubtitle.set($any($event.target).value)" placeholder="Subtítulo (ex.: Do lead ao contrato)" aria-label="Subtítulo da nova seção" [class]="inputClass" />
                <input [value]="sId()" (input)="sId.set($any($event.target).value)" placeholder="id/slug (opcional — gerado do título)" aria-label="Identificador da seção" [class]="inputClass + ' font-mono text-xs'" />
                <button
                  type="submit"
                  [disabled]="sectionBusy() || !sTitle().trim()"
                  class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
                >
                  <app-icon name="plus" class="h-4 w-4" /> Criar seção
                </button>
              </form>
            </div>
          </div>

          <!-- Lista de módulos -->
          <div class="h-fit min-w-0 rounded-2xl border border-border bg-card">
            <div class="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
              <div class="flex items-center gap-2.5">
                <div class="grid h-9 w-9 place-items-center rounded-xl bg-surface text-muted-foreground">
                  <app-icon name="layout-grid" class="h-4 w-4" />
                </div>
                <div>
                  <h2 class="font-display text-lg font-bold">Seus módulos</h2>
                  <p class="text-xs text-muted-foreground">{{ modules().length }} no total</p>
                </div>
              </div>
              <button type="button" (click)="load()" class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground">
                <app-icon name="refresh-cw" class="h-3.5 w-3.5" /> Atualizar
              </button>
            </div>
            @if (modules().length === 0) {
              <div class="px-6 py-16 text-center">
                <app-icon name="video" class="mx-auto h-7 w-7 text-muted-foreground/40" />
                <p class="mt-3 text-sm font-semibold">Nenhum módulo ainda</p>
                <p class="mt-1 text-xs text-muted-foreground">Use o formulário ao lado para adicionar o primeiro.</p>
              </div>
            } @else {
              <div class="divide-y divide-border">
                @for (g of grouped(); track g.id) {
                  <div class="px-4 py-4">
                    <div class="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">{{ g.title }}</div>
                    <ul class="space-y-1.5">
                      @for (m of g.items; track m.id) {
                        <li class="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface">
                          <a [routerLink]="['/admin/modulos', m.id]" class="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-black" [attr.aria-label]="'Editar ' + m.title">
                            @if (m.coverUrl) {
                              <img [src]="m.coverUrl" alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover" />
                            } @else {
                              <div class="grid h-full w-full place-items-center"><app-icon name="video" class="h-4 w-4 text-white/30" /></div>
                            }
                            @if (m.locked) {
                              <span class="absolute inset-0 grid place-items-center bg-black/55 text-primary"><app-icon name="lock" class="h-4 w-4" /></span>
                            }
                          </a>
                          <div class="min-w-0 flex-1">
                            <a [routerLink]="['/admin/modulos', m.id]" class="block truncate text-sm font-semibold hover:text-primary">{{ m.title }}</a>
                            <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span
                                class="inline-flex items-center gap-1"
                                [class]="m.lessonCount > 0 && m.lessonsWithVideo === m.lessonCount ? 'text-emerald-400' : 'text-amber-400'"
                              >
                                <app-icon [name]="m.lessonCount > 0 && m.lessonsWithVideo === m.lessonCount ? 'circle-check' : 'youtube'" class="h-3 w-3" />
                                com vídeo {{ m.lessonsWithVideo }}/{{ m.lessonCount }} aulas
                              </span>
                              @if (m.quizQuestionCount > 0) {
                                <span>· prova {{ m.quizQuestionCount }}q</span>
                              }
                              @if (m.author) {
                                <span class="truncate">· {{ m.author }}</span>
                              }
                            </div>
                          </div>
                          <button
                            type="button"
                            (click)="toggleLock(m)"
                            [disabled]="busyId() === m.id"
                            class="rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
                            [class]="m.locked ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'"
                            [title]="m.locked ? 'Liberar módulo para os alunos' : 'Trancar módulo'"
                            [attr.aria-label]="m.locked ? 'Liberar módulo para os alunos' : 'Trancar módulo'"
                          >
                            <app-icon [name]="m.locked ? 'lock' : 'lock-open'" class="h-3.5 w-3.5" />
                          </button>
                          <a
                            [routerLink]="['/admin/modulos', m.id]"
                            class="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                            title="Editar"
                            aria-label="Editar módulo"
                          >
                            <app-icon name="pencil" class="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            (click)="deleteModule(m)"
                            [disabled]="busyId() === m.id"
                            class="rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                            title="Apagar"
                            aria-label="Apagar módulo"
                          >
                            @if (busyId() === m.id) {
                              <app-spinner size="h-3.5 w-3.5" />
                            } @else {
                              <app-icon name="trash-2" class="h-3.5 w-3.5" />
                            }
                          </button>
                        </li>
                      }
                    </ul>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ModulesPage {
  private readonly admin = inject(AdminApi);
  private readonly catalog = inject(CatalogApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  protected readonly coverInput = viewChild.required<ElementRef<HTMLInputElement>>('cover');
  protected readonly inputClass = INPUT_CLASS;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly sections = signal<SectionDto[]>([]);
  protected readonly modules = signal<AdminModuleDto[]>([]);
  protected readonly busyId = signal<string | null>(null);

  protected readonly grouped = computed(() => {
    const secs = this.sections();
    const mods = [...this.modules()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
    );
    const known = new Set(secs.map((s) => s.id));
    const groups = secs
      .map((s) => ({ id: s.id, title: s.title, items: mods.filter((m) => m.sectionId === s.id) }))
      .filter((g) => g.items.length > 0);
    const orphans = mods.filter((m) => !known.has(m.sectionId));
    if (orphans.length) groups.push({ id: '__outros', title: 'Outras seções', items: orphans });
    return groups;
  });

  // novo módulo
  protected readonly nSection = signal('');
  protected readonly nTitle = signal('');
  protected readonly nAuthor = signal('');
  protected readonly nDesc = signal('');
  protected readonly nLocked = signal(true);
  protected readonly coverFile = signal<File | null>(null);
  protected readonly coverPreview = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly newMsg = signal<Msg | null>(null);

  // seções
  protected readonly sTitle = signal('');
  protected readonly sSubtitle = signal('');
  protected readonly sId = signal('');
  protected readonly sectionBusy = signal(false);
  protected readonly editingSection = signal<string | null>(null);
  protected readonly eTitle = signal('');
  protected readonly eSubtitle = signal('');

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => {
      const u = this.coverPreview();
      if (u) URL.revokeObjectURL(u);
    });
  }

  protected load(): void {
    this.loading.set(this.modules().length === 0 && this.sections().length === 0);
    this.loadError.set(null);
    forkJoin({ sections: this.catalog.sections(), modules: this.admin.modules() }).subscribe({
      next: ({ sections, modules }) => {
        this.sections.set([...sections].sort((a, b) => a.sortOrder - b.sortOrder));
        this.modules.set(modules);
        if (!this.nSection() || !sections.some((s) => s.id === this.nSection())) {
          this.nSection.set(this.sections()[0]?.id ?? '');
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(apiMessage(err));
        this.loading.set(false);
      },
    });
  }

  // ------------------------------------------------ novo módulo
  protected async onCover(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const err = validateCover(f);
    if (err) {
      this.newMsg.set({ type: 'err', text: err });
      return;
    }
    try {
      const cover = await prepareCover(f); // recorte central 3:4, igual em todos os cards
      this.clearCover();
      this.coverFile.set(cover);
      this.coverPreview.set(URL.createObjectURL(cover));
      this.newMsg.set(null);
    } catch (er) {
      this.newMsg.set({ type: 'err', text: er instanceof Error ? er.message : 'Não foi possível preparar essa imagem.' });
    }
  }

  protected clearCover(): void {
    const u = this.coverPreview();
    if (u) URL.revokeObjectURL(u);
    this.coverPreview.set(null);
    this.coverFile.set(null);
  }

  protected async createModule(e: Event): Promise<void> {
    e.preventDefault();
    if (this.creating()) return;
    if (!this.nTitle().trim()) {
      this.newMsg.set({ type: 'err', text: 'Dê um título ao módulo.' });
      return;
    }
    if (!this.nSection()) {
      this.newMsg.set({ type: 'err', text: 'Escolha uma seção.' });
      return;
    }
    this.creating.set(true);
    this.newMsg.set(null);
    try {
      const m = await firstValueFrom(
        this.admin.createModule({
          sectionId: this.nSection(),
          title: this.nTitle().trim(),
          author: this.nAuthor().trim() || null,
          description: this.nDesc().trim() || null,
          locked: this.nLocked(),
        }),
      );
      const file = this.coverFile();
      if (file) {
        try {
          await firstValueFrom(this.admin.uploadCover(m.id, file));
        } catch (err) {
          this.toast.error(`Módulo criado, mas a capa não subiu: ${apiMessage(err)}`);
        }
      }
      this.toast.success('Módulo criado! Agora adicione as aulas.');
      this.nTitle.set('');
      this.nAuthor.set('');
      this.nDesc.set('');
      this.clearCover();
      void this.router.navigate(['/admin/modulos', m.id]);
    } catch (err) {
      this.newMsg.set({ type: 'err', text: apiMessage(err, 'Falha ao criar.') });
    } finally {
      this.creating.set(false);
    }
  }

  // ------------------------------------------------ lista
  protected toggleLock(m: AdminModuleDto): void {
    this.busyId.set(m.id);
    const next = !m.locked;
    this.modules.update((list) => list.map((x) => (x.id === m.id ? { ...x, locked: next } : x)));
    this.admin.setModuleLock(m.id, next).subscribe({
      next: (res) => {
        this.busyId.set(null);
        this.modules.update((list) => list.map((x) => (x.id === m.id ? res : x)));
        this.toast.success(next ? 'Módulo trancado.' : 'Módulo liberado para os alunos.');
      },
      error: (err) => {
        this.busyId.set(null);
        this.modules.update((list) => list.map((x) => (x.id === m.id ? { ...x, locked: m.locked } : x)));
        this.toast.error(apiMessage(err));
      },
    });
  }

  protected async deleteModule(m: AdminModuleDto): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Apagar o módulo “${m.title}”?`,
      message: 'Aulas, progresso, materiais, comentários e prova serão apagados. Certificados já emitidos continuam válidos. Isso não tem desfazer.',
      confirmLabel: 'Apagar módulo',
      danger: true,
    });
    if (!ok) return;
    this.busyId.set(m.id);
    this.admin.deleteModule(m.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.modules.update((list) => list.filter((x) => x.id !== m.id));
        this.toast.success('Módulo apagado.');
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error(apiMessage(err));
      },
    });
  }

  // ------------------------------------------------ seções
  protected createSection(e: Event): void {
    e.preventDefault();
    const title = this.sTitle().trim();
    if (!title || this.sectionBusy()) return;
    this.sectionBusy.set(true);
    this.admin.createSection({ id: this.sId().trim() || null, title, subtitle: this.sSubtitle().trim() }).subscribe({
      next: (s) => {
        this.sectionBusy.set(false);
        this.sections.update((list) => [...list, s].sort((a, b) => a.sortOrder - b.sortOrder));
        if (!this.nSection()) this.nSection.set(s.id);
        this.sTitle.set('');
        this.sSubtitle.set('');
        this.sId.set('');
        this.toast.success('Seção criada.');
      },
      error: (err) => {
        this.sectionBusy.set(false);
        this.toast.error(apiMessage(err, 'Não foi possível criar a seção.'));
      },
    });
  }

  protected startEditSection(s: SectionDto): void {
    this.eTitle.set(s.title);
    this.eSubtitle.set(s.subtitle);
    this.editingSection.set(s.id);
  }

  protected saveSection(s: SectionDto): void {
    const title = this.eTitle().trim();
    if (!title) return;
    this.sectionBusy.set(true);
    this.admin.updateSection(s.id, { title, subtitle: this.eSubtitle().trim(), sortOrder: s.sortOrder }).subscribe({
      next: (res) => {
        this.sectionBusy.set(false);
        this.editingSection.set(null);
        this.sections.update((list) => list.map((x) => (x.id === s.id ? res : x)));
        this.toast.success('Seção atualizada.');
      },
      error: (err) => {
        this.sectionBusy.set(false);
        this.toast.error(apiMessage(err));
      },
    });
  }

  protected async moveSection(index: number, delta: number): Promise<void> {
    const list = [...this.sections()];
    const j = index + delta;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    const changed = list
      .map((s, i) => ({ s, order: (i + 1) * 10 }))
      .filter(({ s, order }) => s.sortOrder !== order);
    const previous = this.sections();
    this.sections.set(list.map((s, i) => ({ ...s, sortOrder: (i + 1) * 10 })));
    this.sectionBusy.set(true);
    try {
      for (const { s, order } of changed) {
        await firstValueFrom(this.admin.updateSection(s.id, { title: s.title, subtitle: s.subtitle, sortOrder: order }));
      }
    } catch (err) {
      this.sections.set(previous);
      this.toast.error(apiMessage(err, 'Não foi possível reordenar.'));
    } finally {
      this.sectionBusy.set(false);
    }
  }

  protected async deleteSection(s: SectionDto): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Apagar a seção “${s.title}”?`,
      message: 'Só é possível apagar seções sem módulos.',
      confirmLabel: 'Apagar seção',
      danger: true,
    });
    if (!ok) return;
    this.sectionBusy.set(true);
    this.admin.deleteSection(s.id).subscribe({
      next: () => {
        this.sectionBusy.set(false);
        this.sections.update((list) => list.filter((x) => x.id !== s.id));
        if (this.nSection() === s.id) this.nSection.set(this.sections()[0]?.id ?? '');
        this.toast.success('Seção apagada.');
      },
      error: (err) => {
        this.sectionBusy.set(false);
        this.toast.error(apiMessage(err, 'Não foi possível apagar a seção.'));
      },
    });
  }
}
