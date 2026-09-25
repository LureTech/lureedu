import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/api/admin.api';
import { apiMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { AdminStatsDto, Role, UserDto } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';
import { SpinnerComponent } from '../../shared/spinner.component';
import { TimeAgoPipe } from '../../shared/time-ago.pipe';
import { validateAvatar } from '../../shared/youtube';
import { generatePassword } from './admin-shared';

interface Msg {
  type: 'ok' | 'err';
  text: string;
}

/** /admin — Contas: estatísticas, criação de contas e gestão de acessos. */
@Component({
  selector: 'app-accounts-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AvatarComponent, IconComponent, SpinnerComponent, ModalComponent, TimeAgoPipe],
  template: `
    <div class="mx-auto max-w-[1100px] px-4 py-8 md:px-10 lg:py-12">
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div class="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <app-icon name="shield-check" class="h-3.5 w-3.5" /> Admin
          </div>
          <h1 class="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">Gerenciar acessos</h1>
          <p class="mt-2 max-w-2xl text-sm text-muted-foreground">
            Crie contas para novos membros com e-mail e senha, e libere ou bloqueie o acesso quando quiser.
          </p>
        </div>
        <a
          routerLink="/admin/modulos"
          class="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          Módulos <app-icon name="arrow-right" class="h-3.5 w-3.5" />
        </a>
      </div>

      <!-- Estatísticas -->
      <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        @for (s of statCards(); track s.label) {
          <div class="rounded-2xl border border-border bg-card p-4">
            <div class="flex items-center gap-2 text-muted-foreground">
              <app-icon [name]="s.icon" class="h-4 w-4 text-primary" />
              <span class="text-[10px] font-semibold uppercase tracking-[0.16em]">{{ s.label }}</span>
            </div>
            <div class="mt-2 font-display text-2xl font-bold tabular-nums">
              @if (stats()) {
                {{ s.value }}
              } @else {
                <span class="inline-block h-6 w-10 animate-pulse rounded bg-surface-elevated align-middle"></span>
              }
            </div>
            <div class="mt-0.5 truncate text-[11px] text-muted-foreground">{{ stats() ? s.hint : ' ' }}</div>
          </div>
        }
      </div>

      <div class="grid gap-8 lg:grid-cols-[380px_1fr]">
        <!-- Nova conta -->
        <div class="h-fit overflow-hidden rounded-2xl border border-border bg-card">
          <div class="relative border-b border-border bg-gradient-to-br from-primary/15 via-card to-card px-6 py-5">
            <div
              class="pointer-events-none absolute inset-0"
              style="background: radial-gradient(ellipse 60% 120% at 15% -20%, rgba(187, 154, 53, 0.25), transparent 70%)"
            ></div>
            <div class="relative flex items-center gap-3">
              <div class="grid h-10 w-10 place-items-center rounded-xl gradient-gold text-primary-foreground shadow-[var(--shadow-glow)]">
                <app-icon name="user-plus" class="h-5 w-5" />
              </div>
              <div>
                <h2 class="font-display text-lg font-bold">Nova conta</h2>
                <p class="text-xs text-muted-foreground">Cadastre um cliente em segundos</p>
              </div>
            </div>
          </div>
          <form class="space-y-5 p-6" (submit)="create($event)">
            <div class="flex items-center gap-4">
              <button type="button" (click)="photoInput().nativeElement.click()" class="group relative shrink-0" aria-label="Adicionar foto">
                <app-avatar
                  [url]="photoPreview()"
                  [name]="fName()"
                  [email]="fEmail() || '?'"
                  class="h-16 w-16 ring-2 ring-border transition group-hover:ring-primary/50"
                />
                <span class="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full gradient-gold text-primary-foreground shadow ring-2 ring-card">
                  <app-icon name="camera" class="h-3.5 w-3.5" />
                </span>
              </button>
              <div class="min-w-0">
                <p class="text-sm font-medium">Foto do cliente</p>
                <p class="text-xs text-muted-foreground">Opcional — JPG, PNG ou WebP até 5 MB.</p>
                @if (photoPreview()) {
                  <button type="button" (click)="clearPhoto()" class="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-400 transition hover:text-red-300">
                    <app-icon name="trash-2" class="h-3 w-3" /> Remover
                  </button>
                }
              </div>
              <input #photo type="file" accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onPhoto($event)" />
            </div>

            <div>
              <label for="acc-name" class="mb-1.5 block text-sm font-medium">Nome</label>
              <div class="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                <app-icon name="user" class="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  id="acc-name"
                  [value]="fName()"
                  (input)="fName.set($any($event.target).value)"
                  maxlength="80"
                  placeholder="Ex.: João Silva"
                  class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div>
              <label for="acc-email" class="mb-1.5 block text-sm font-medium">E-mail</label>
              <div class="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                <app-icon name="mail" class="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  id="acc-email"
                  type="email"
                  required
                  autocomplete="off"
                  [value]="fEmail()"
                  (input)="fEmail.set($any($event.target).value)"
                  placeholder="joao@email.com"
                  class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <label for="acc-pass" class="block text-sm font-medium">Senha</label>
                <button type="button" (click)="genPassword()" class="inline-flex items-center gap-1 text-xs font-semibold text-primary transition hover:brightness-125">
                  <app-icon name="sparkles" class="h-3 w-3" /> Gerar senha
                </button>
              </div>
              <div class="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                <app-icon name="lock" class="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  id="acc-pass"
                  [type]="showPass() ? 'text' : 'password'"
                  required
                  minlength="8"
                  autocomplete="new-password"
                  [value]="fPass()"
                  (input)="fPass.set($any($event.target).value)"
                  placeholder="mínimo 8 caracteres"
                  class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                @if (fPass()) {
                  <button type="button" (click)="copy(fPass())" class="text-muted-foreground transition hover:text-foreground" aria-label="Copiar senha" title="Copiar senha">
                    <app-icon name="file-text" class="h-4 w-4" />
                  </button>
                }
                <button
                  type="button"
                  (click)="showPass.set(!showPass())"
                  class="text-muted-foreground transition hover:text-foreground"
                  [attr.aria-label]="showPass() ? 'Ocultar senha' : 'Mostrar senha'"
                >
                  <app-icon [name]="showPass() ? 'eye-off' : 'eye'" class="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              <span class="mb-1.5 block text-sm font-medium">Tipo de conta</span>
              <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de conta">
                @for (r of roles; track r.value) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="fRole() === r.value"
                    (click)="fRole.set(r.value)"
                    class="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition"
                    [class]="fRole() === r.value ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-surface text-muted-foreground hover:text-foreground'"
                  >
                    <app-icon [name]="r.icon" class="h-4 w-4" /> {{ r.label }}
                  </button>
                }
              </div>
            </div>
            @if (formMsg(); as m) {
              <div
                class="rounded-lg border px-3 py-2.5 text-sm"
                [class]="m.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'"
                role="status"
              >
                {{ m.text }}
              </div>
            }
            <button
              type="submit"
              [disabled]="creating()"
              class="inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              @if (creating()) {
                <app-spinner /> Criando…
              } @else {
                <app-icon name="user-plus" class="h-4 w-4" /> Criar conta
              }
            </button>
          </form>
        </div>

        <!-- Lista de contas -->
        <div class="min-w-0 rounded-2xl border border-border bg-card">
          <div class="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-2.5">
              <div class="grid h-9 w-9 place-items-center rounded-xl bg-surface text-muted-foreground">
                <app-icon name="users" class="h-4 w-4" />
              </div>
              <div>
                <h2 class="font-display text-lg font-bold">Contas</h2>
                <p class="text-xs text-muted-foreground">{{ users().length }} {{ query() ? 'encontradas' : 'no total' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 focus-within:border-primary/40 sm:w-56 sm:flex-none">
                <app-icon name="search" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  type="search"
                  aria-label="Buscar contas"
                  placeholder="Buscar nome ou e-mail"
                  [value]="query()"
                  (input)="onSearch($event)"
                  class="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                type="button"
                (click)="loadUsers(); loadStats()"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <app-icon name="refresh-cw" class="h-3.5 w-3.5" /> Atualizar
              </button>
            </div>
          </div>

          @if (usersLoading()) {
            <div class="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><app-spinner /> Carregando contas…</div>
          } @else if (usersError()) {
            <div class="px-6 py-10 text-sm text-red-400">Erro ao carregar: {{ usersError() }}</div>
          } @else if (users().length === 0) {
            <div class="px-6 py-14 text-center text-sm text-muted-foreground">Nenhuma conta encontrada.</div>
          } @else {
            <ul class="divide-y divide-border">
              @for (u of users(); track u.id) {
                @let me = u.id === myId();
                @let busy = busyId() === u.id;
                <li class="flex flex-col gap-2.5 px-6 py-4">
                  <div class="flex min-w-0 flex-1 items-center gap-4">
                    <app-avatar [url]="u.avatarUrl" [name]="u.fullName" [email]="u.email" class="h-10 w-10" />
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="truncate text-sm font-semibold">{{ u.fullName || u.email.split('@')[0] }}</span>
                        @if (u.role === 'ADMIN') {
                          <span class="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                            <app-icon name="crown" class="h-3 w-3" /> Admin
                          </span>
                        }
                        @if (me) {
                          <span class="text-[10px] uppercase tracking-wider text-muted-foreground">você</span>
                        }
                        <span class="inline-flex items-center gap-1 text-[11px] font-medium" [class]="u.active ? 'text-emerald-400' : 'text-red-400'">
                          <app-icon [name]="u.active ? 'circle-check' : 'ban'" class="h-3 w-3" />
                          {{ u.active ? 'Ativo' : 'Bloqueado' }}
                        </span>
                      </div>
                      <div class="truncate text-xs text-muted-foreground">
                        {{ u.email }}
                        @if (u.lastLoginAt) {
                          · último acesso {{ u.lastLoginAt | timeAgo }}
                        } @else {
                          · nunca entrou
                        }
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5 sm:pl-14">
                    <button
                      type="button"
                      (click)="toggleRole(u)"
                      [disabled]="me || busy"
                      [title]="me ? 'Você não pode alterar o próprio papel' : u.role === 'ADMIN' ? 'Tornar membro' : 'Tornar administrador'"
                      class="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <app-icon [name]="u.role === 'ADMIN' ? 'user' : 'crown'" class="h-3.5 w-3.5" />
                      {{ u.role === 'ADMIN' ? 'Tornar membro' : 'Tornar admin' }}
                    </button>
                    <button
                      type="button"
                      (click)="openReset(u)"
                      [disabled]="me || busy"
                      [title]="me ? 'Use Editar perfil para trocar a sua senha' : 'Definir nova senha para esta conta'"
                      class="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <app-icon name="lock" class="h-3.5 w-3.5" /> Redefinir senha
                    </button>
                    <button
                      type="button"
                      (click)="toggleActive(u)"
                      [disabled]="me || busy"
                      [title]="me ? 'Você não pode bloquear a própria conta' : u.active ? 'Bloquear acesso' : 'Liberar acesso'"
                      class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                      [class]="u.active ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'"
                    >
                      @if (busy) {
                        <app-spinner size="h-3.5 w-3.5" />
                      } @else {
                        <app-icon [name]="u.active ? 'ban' : 'circle-check'" class="h-3.5 w-3.5" />
                      }
                      {{ u.active ? 'Bloquear' : 'Liberar' }}
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      </div>
    </div>

    @if (resetUser(); as ru) {
      <app-modal label="Redefinir senha" panelClass="max-w-sm" [locked]="resetting()" (closed)="resetUser.set(null)">
        <form class="p-6" (submit)="doReset($event)">
          <h2 class="font-display text-lg font-bold">Redefinir senha</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Nova senha para <span class="font-semibold text-foreground">{{ ru.fullName || ru.email }}</span>. As sessões abertas dessa conta serão encerradas.
          </p>
          <div class="mt-5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 focus-within:border-primary/50">
            <app-icon name="lock" class="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              autofocus
              minlength="8"
              required
              aria-label="Nova senha"
              [value]="resetPass()"
              (input)="resetPass.set($any($event.target).value)"
              placeholder="mínimo 8 caracteres"
              class="w-full bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground"
            />
            <button type="button" (click)="resetPass.set(gen())" class="shrink-0 text-xs font-semibold text-primary">Gerar</button>
          </div>
          @if (resetError()) {
            <p class="mt-2 text-xs text-red-400">{{ resetError() }}</p>
          }
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              (click)="resetUser.set(null)"
              [disabled]="resetting()"
              class="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="resetting()"
              class="inline-flex items-center justify-center gap-2 rounded-xl gradient-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-70"
            >
              @if (resetting()) {
                <app-spinner />
              }
              Salvar nova senha
            </button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class AccountsPage {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly photoInput = viewChild.required<ElementRef<HTMLInputElement>>('photo');

  protected readonly myId = computed(() => this.auth.user()?.id ?? null);
  protected readonly roles: { value: Role; label: string; icon: string }[] = [
    { value: 'MEMBER', label: 'Membro', icon: 'users' },
    { value: 'ADMIN', label: 'Admin', icon: 'crown' },
  ];

  // stats
  protected readonly stats = signal<AdminStatsDto | null>(null);
  protected readonly statCards = computed(() => {
    const s = this.stats();
    return [
      { icon: 'users', label: 'Contas', value: s?.users ?? 0, hint: `${s?.activeUsers ?? 0} ativas · ${s?.admins ?? 0} admins` },
      { icon: 'layers', label: 'Módulos', value: s?.modules ?? 0, hint: `${s?.lessons ?? 0} aulas` },
      { icon: 'circle-check', label: 'Aulas vistas', value: s?.lessonsCompleted ?? 0, hint: 'conclusões no total' },
      { icon: 'award', label: 'Certificados', value: s?.certificates ?? 0, hint: 'emitidos' },
      { icon: 'message-square', label: 'Posts', value: s?.postsTotal ?? 0, hint: `${s?.postsToday ?? 0} hoje` },
      { icon: 'target', label: 'Diagnósticos', value: s?.diagnostics ?? 0, hint: 'realizados' },
    ];
  });

  // lista
  protected readonly users = signal<UserDto[]>([]);
  protected readonly usersLoading = signal(true);
  protected readonly usersError = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly busyId = signal<string | null>(null);
  private readonly search$ = new Subject<string>();

  // formulário
  protected readonly fName = signal('');
  protected readonly fEmail = signal('');
  protected readonly fPass = signal('');
  protected readonly fRole = signal<Role>('MEMBER');
  protected readonly showPass = signal(false);
  protected readonly photo = signal<File | null>(null);
  protected readonly photoPreview = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly formMsg = signal<Msg | null>(null);

  // redefinir senha
  protected readonly resetUser = signal<UserDto | null>(null);
  protected readonly resetPass = signal('');
  protected readonly resetting = signal(false);
  protected readonly resetError = signal<string | null>(null);

  constructor() {
    this.loadStats();
    this.loadUsers();
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed()).subscribe(() => this.loadUsers());
    inject(DestroyRef).onDestroy(() => {
      const u = this.photoPreview();
      if (u) URL.revokeObjectURL(u);
    });
  }

  protected loadStats(): void {
    this.api.stats().subscribe({ next: (s) => this.stats.set(s), error: () => undefined });
  }

  protected loadUsers(): void {
    this.usersLoading.set(true);
    this.usersError.set(null);
    this.api.users(this.query()).subscribe({
      next: (list) => {
        this.users.set(list);
        this.usersLoading.set(false);
      },
      error: (err) => {
        this.usersError.set(apiMessage(err));
        this.usersLoading.set(false);
      },
    });
  }

  protected onSearch(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.query.set(v);
    this.search$.next(v.trim());
  }

  // ------------------------------------------------ criar conta
  protected onPhoto(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const err = validateAvatar(f);
    if (err) {
      this.formMsg.set({ type: 'err', text: err });
      return;
    }
    this.clearPhoto();
    this.photo.set(f);
    this.photoPreview.set(URL.createObjectURL(f));
    this.formMsg.set(null);
  }

  protected clearPhoto(): void {
    const u = this.photoPreview();
    if (u) URL.revokeObjectURL(u);
    this.photoPreview.set(null);
    this.photo.set(null);
  }

  protected genPassword(): void {
    this.fPass.set(generatePassword());
    this.showPass.set(true);
  }

  protected gen(): string {
    return generatePassword();
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('Senha copiada.');
    } catch {
      this.toast.info(text);
    }
  }

  protected async create(e: Event): Promise<void> {
    e.preventDefault();
    if (this.creating()) return;
    const email = this.fEmail().trim();
    if (this.fPass().length < 8) {
      this.formMsg.set({ type: 'err', text: 'A senha precisa ter pelo menos 8 caracteres.' });
      return;
    }
    this.formMsg.set(null);
    this.creating.set(true);
    try {
      const user = await firstValueFrom(
        this.api.createUser({ email, password: this.fPass(), fullName: this.fName().trim() || null, role: this.fRole() }),
      );
      const file = this.photo();
      let photoFailed = false;
      if (file) {
        try {
          await firstValueFrom(this.api.uploadUserAvatar(user.id, file));
        } catch {
          photoFailed = true;
        }
      }
      this.formMsg.set({
        type: 'ok',
        text: photoFailed
          ? `Conta criada para ${email}, mas a foto não subiu. Você pode adicioná-la depois.`
          : `Conta criada para ${email}. Já pode entrar com a senha definida.`,
      });
      this.fName.set('');
      this.fEmail.set('');
      this.fPass.set('');
      this.fRole.set('MEMBER');
      this.showPass.set(false);
      this.clearPhoto();
      this.loadUsers();
      this.loadStats();
    } catch (err) {
      this.formMsg.set({ type: 'err', text: apiMessage(err, 'Não foi possível criar a conta.') });
    } finally {
      this.creating.set(false);
    }
  }

  // ------------------------------------------------ ações na lista
  private replaceUser(u: UserDto): void {
    this.users.update((list) => list.map((x) => (x.id === u.id ? u : x)));
  }

  protected async toggleActive(u: UserDto): Promise<void> {
    if (u.id === this.myId()) return;
    if (u.active) {
      const ok = await this.confirm.ask({
        title: `Bloquear ${u.fullName || u.email}?`,
        message: 'A pessoa perde o acesso imediatamente, até você liberar de novo.',
        confirmLabel: 'Bloquear',
        danger: true,
      });
      if (!ok) return;
    }
    this.busyId.set(u.id);
    this.api.updateUser(u.id, { active: !u.active }).subscribe({
      next: (res) => {
        this.busyId.set(null);
        this.replaceUser(res);
        this.toast.success(res.active ? 'Acesso liberado.' : 'Acesso bloqueado.');
        this.loadStats();
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error(apiMessage(err));
      },
    });
  }

  protected async toggleRole(u: UserDto): Promise<void> {
    if (u.id === this.myId()) return;
    const toAdmin = u.role !== 'ADMIN';
    const ok = await this.confirm.ask({
      title: toAdmin ? `Tornar ${u.fullName || u.email} administrador?` : `Tornar ${u.fullName || u.email} membro?`,
      message: toAdmin
        ? 'Administradores podem gerenciar contas, módulos e conteúdos.'
        : 'A pessoa perde o acesso à área de administração.',
      confirmLabel: toAdmin ? 'Tornar admin' : 'Tornar membro',
      danger: !toAdmin,
    });
    if (!ok) return;
    this.busyId.set(u.id);
    this.api.updateUser(u.id, { role: toAdmin ? 'ADMIN' : 'MEMBER' }).subscribe({
      next: (res) => {
        this.busyId.set(null);
        this.replaceUser(res);
        this.toast.success(res.role === 'ADMIN' ? 'Agora é administrador.' : 'Agora é membro.');
        this.loadStats();
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error(apiMessage(err));
      },
    });
  }

  protected openReset(u: UserDto): void {
    if (u.id === this.myId()) return;
    this.resetPass.set(generatePassword());
    this.resetError.set(null);
    this.resetUser.set(u);
  }

  protected doReset(e: Event): void {
    e.preventDefault();
    const u = this.resetUser();
    if (!u || this.resetting()) return;
    const pass = this.resetPass();
    if (pass.length < 8) {
      this.resetError.set('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    this.resetting.set(true);
    this.resetError.set(null);
    this.api.resetUserPassword(u.id, pass).subscribe({
      next: () => {
        this.resetting.set(false);
        this.resetUser.set(null);
        void this.copy(pass);
        this.toast.success(`Senha de ${u.email} redefinida.`);
      },
      error: (err) => {
        this.resetting.set(false);
        this.resetError.set(apiMessage(err, 'Não foi possível redefinir a senha.'));
      },
    });
  }
}
