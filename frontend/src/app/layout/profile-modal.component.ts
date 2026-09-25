import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ProfileApi } from '../core/api/profile.api';
import { apiMessage } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { NotificationPrefsDto } from '../core/models';
import { UiService } from '../core/ui.service';
import { FaceIdSettingsComponent } from './face-id-settings.component';
import { AvatarComponent } from '../shared/avatar.component';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';
import { SpinnerComponent } from '../shared/spinner.component';
import { SwitchComponent } from '../shared/switch.component';
import { validateAvatar } from '../shared/youtube';

type PrefKey = keyof NotificationPrefsDto;
interface Msg {
  type: 'ok' | 'err';
  text: string;
}

const PREF_ROWS: { key: PrefKey; label: string; hint: string }[] = [
  { key: 'community', label: 'Novidades da comunidade', hint: 'Quando a Lure publica algo novo no feed.' },
  { key: 'replies', label: 'Respostas e curtidas', hint: 'Quando alguém interage com o que você publicou.' },
  { key: 'newContent', label: 'Aula ou módulo novo', hint: 'Assim que a Lure libera conteúdo inédito.' },
];

/** Modal "Editar perfil": foto, nome, e-mail, papel, senha e preferências de notificação. */
@Component({
  selector: 'app-profile-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, AvatarComponent, IconComponent, SpinnerComponent, SwitchComponent, RouterLink, FaceIdSettingsComponent],
  template: `
    @if (user(); as u) {
      <app-modal label="Editar perfil" [locked]="saving()" (closed)="close()">
        <div class="relative h-24 overflow-hidden bg-gradient-to-br from-primary/25 via-surface-elevated to-background">
          <div
            class="pointer-events-none absolute inset-0"
            style="background: radial-gradient(ellipse 70% 120% at 50% -10%, rgba(187, 154, 53, 0.35), transparent 70%)"
          ></div>
          <button
            type="button"
            (click)="close()"
            [disabled]="saving()"
            class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-border/60 bg-background/50 text-muted-foreground backdrop-blur transition hover:text-foreground"
            aria-label="Fechar"
          >
            <app-icon name="x" class="h-4 w-4" />
          </button>
        </div>

        <div class="px-6 pb-6">
          <div class="-mt-12 flex flex-col items-center">
            <div class="group relative">
              <app-avatar
                [url]="previewUrl()"
                [name]="name() || u.fullName"
                [email]="u.email"
                class="h-24 w-24 ring-4 ring-card"
              />
              <button
                type="button"
                (click)="pick()"
                [disabled]="saving()"
                class="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                aria-label="Trocar foto"
              >
                <app-icon name="camera" class="h-6 w-6" />
              </button>
              <button
                type="button"
                (click)="pick()"
                [disabled]="saving()"
                class="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full gradient-gold text-primary-foreground shadow-[var(--shadow-glow)] ring-2 ring-card transition hover:brightness-110"
                aria-label="Adicionar foto"
              >
                <app-icon name="camera" class="h-4 w-4" />
              </button>
            </div>
            <input #file type="file" accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onFile($event)" />
            <div class="mt-3 flex items-center gap-2">
              <button
                type="button"
                (click)="pick()"
                [disabled]="saving()"
                class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40"
              >
                <app-icon name="camera" class="h-3.5 w-3.5" />
                {{ previewUrl() ? 'Trocar foto' : 'Adicionar foto' }}
              </button>
              @if (previewUrl()) {
                <button
                  type="button"
                  (click)="removePhoto()"
                  [disabled]="saving()"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
                >
                  <app-icon name="trash-2" class="h-3.5 w-3.5" />
                  Remover
                </button>
              }
            </div>
            <span
              class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary"
            >
              <app-icon [name]="auth.isAdmin() ? 'crown' : 'sparkles'" class="h-3.5 w-3.5" />
              {{ auth.isAdmin() ? 'Administrador' : 'Membro' }}
            </span>
          </div>

          <div class="mt-6 space-y-4">
            <div>
              <label for="pf-name" class="mb-1.5 block text-sm font-medium">Nome</label>
              <input
                id="pf-name"
                [value]="name()"
                (input)="name.set($any($event.target).value)"
                maxlength="80"
                placeholder="Seu nome"
                autocomplete="name"
                class="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <span class="mb-1.5 block text-sm font-medium">E-mail</span>
              <div class="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-sm text-muted-foreground">
                <app-icon name="mail" class="h-4 w-4 shrink-0" />
                <span class="truncate">{{ u.email }}</span>
              </div>
            </div>
          </div>

          <!-- Senha -->
          <section class="mt-6 border-t border-border/60 pt-5">
            <button
              type="button"
              (click)="pwOpen.set(!pwOpen())"
              [attr.aria-expanded]="pwOpen()"
              class="flex w-full items-center justify-between gap-3 text-left"
            >
              <span class="flex items-center gap-2 text-sm font-semibold">
                <app-icon name="lock" class="h-4 w-4 text-primary" /> Alterar senha
              </span>
              <app-icon name="chevron-right" class="h-4 w-4 text-muted-foreground transition" [class.rotate-90]="pwOpen()" />
            </button>
            @if (pwOpen()) {
              <div class="mt-4 space-y-3">
                <input
                  type="password"
                  autocomplete="current-password"
                  placeholder="Senha atual"
                  aria-label="Senha atual"
                  [value]="pwCurrent()"
                  (input)="pwCurrent.set($any($event.target).value)"
                  class="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="password"
                  autocomplete="new-password"
                  placeholder="Nova senha (mínimo 8 caracteres)"
                  aria-label="Nova senha"
                  [value]="pwNew()"
                  (input)="pwNew.set($any($event.target).value)"
                  class="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="password"
                  autocomplete="new-password"
                  placeholder="Confirme a nova senha"
                  aria-label="Confirme a nova senha"
                  [value]="pwConfirm()"
                  (input)="pwConfirm.set($any($event.target).value)"
                  class="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                @if (pwMsg(); as m) {
                  <div
                    class="rounded-lg border px-3 py-2 text-xs"
                    [class]="m.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'"
                  >
                    {{ m.text }}
                  </div>
                }
                <button
                  type="button"
                  (click)="changePassword()"
                  [disabled]="pwSaving()"
                  class="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60"
                >
                  @if (pwSaving()) {
                    <app-spinner size="h-3.5 w-3.5" />
                  } @else {
                    <app-icon name="check" class="h-3.5 w-3.5" />
                  }
                  Atualizar senha
                </button>
              </div>
            }
          </section>

          <!-- Face ID -->
          <section class="mt-6 border-t border-border/60 pt-5">
            <button
              type="button"
              (click)="faceIdOpen.set(!faceIdOpen())"
              [attr.aria-expanded]="faceIdOpen()"
              class="flex w-full items-center justify-between gap-3 text-left"
            >
              <span class="flex items-center gap-2 text-sm font-semibold">
                <app-icon name="scan-face" class="h-4 w-4 text-primary" /> Face ID
              </span>
              <app-icon name="chevron-right" class="h-4 w-4 text-muted-foreground transition" [class.rotate-90]="faceIdOpen()" />
            </button>
            @if (faceIdOpen()) {
              <app-face-id-settings />
            }
          </section>

          <!-- Notificações -->
          <section class="mt-6 border-t border-border/60 pt-5">
            <div class="flex items-center justify-between gap-4">
              <h3 class="flex items-center gap-2 text-sm font-semibold">
                <app-icon name="bell" class="h-4 w-4 text-primary" /> Notificações
              </h3>
              @if (prefsLoading()) {
                <app-spinner class="text-muted-foreground" />
              }
            </div>
            <p class="mt-1 text-xs leading-relaxed text-muted-foreground">Avisos que aparecem no sino da plataforma.</p>
            @if (prefs(); as p) {
              <div class="mt-2 flex flex-col divide-y divide-border/50">
                @for (row of prefRows; track row.key) {
                  <div class="flex items-start justify-between gap-4 py-3">
                    <span class="min-w-0">
                      <span class="block text-sm font-medium">{{ row.label }}</span>
                      <span class="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{{ row.hint }}</span>
                    </span>
                    <app-switch [checked]="p[row.key]" [label]="row.label" [disabled]="saving()" (changed)="setPref(row.key, $event)" />
                  </div>
                }
              </div>
            } @else if (!prefsLoading()) {
              <p class="mt-3 text-xs text-red-400">Não foi possível carregar suas preferências.</p>
            }
          </section>

          @if (msg(); as m) {
            <div
              class="mt-4 rounded-lg border px-3 py-2.5 text-sm"
              [class]="m.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'"
              role="status"
            >
              {{ m.text }}
            </div>
          }

          <div class="mt-6 flex flex-col gap-2">
            <button
              type="button"
              (click)="save()"
              [disabled]="saving()"
              class="inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              @if (saving()) {
                <app-spinner /> Salvando…
              } @else {
                <app-icon name="check" class="h-4 w-4" /> Salvar alterações
              }
            </button>
            @if (auth.isAdmin()) {
              <a
                routerLink="/admin"
                (click)="close()"
                class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40"
              >
                <app-icon name="shield-check" class="h-4 w-4" /> Gerenciar acessos
              </a>
            }
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class ProfileModalComponent {
  protected readonly auth = inject(AuthService);
  private readonly ui = inject(UiService);
  private readonly api = inject(ProfileApi);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('file');

  protected readonly user = this.auth.user;
  protected readonly prefRows = PREF_ROWS;

  protected readonly name = signal(this.auth.user()?.fullName ?? '');
  private readonly newFile = signal<File | null>(null);
  private readonly localPreview = signal<string | null>(null);
  private readonly removeAvatar = signal(false);
  protected readonly previewUrl = computed(() =>
    this.removeAvatar() ? null : (this.localPreview() ?? this.auth.user()?.avatarUrl ?? null),
  );

  protected readonly prefs = signal<NotificationPrefsDto | null>(null);
  private originalPrefs: NotificationPrefsDto | null = null;
  protected readonly prefsLoading = signal(true);

  protected readonly saving = signal(false);
  protected readonly msg = signal<Msg | null>(null);

  protected readonly pwOpen = signal(false);
  protected readonly faceIdOpen = signal(false);
  protected readonly pwCurrent = signal('');
  protected readonly pwNew = signal('');
  protected readonly pwConfirm = signal('');
  protected readonly pwSaving = signal(false);
  protected readonly pwMsg = signal<Msg | null>(null);

  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.api.notificationPrefs().subscribe({
      next: (p) => {
        this.prefs.set({ ...p });
        this.originalPrefs = { ...p };
        this.prefsLoading.set(false);
      },
      error: () => this.prefsLoading.set(false),
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.closeTimer);
      const url = this.localPreview();
      if (url) URL.revokeObjectURL(url);
    });
  }

  protected close(): void {
    if (this.saving()) return;
    this.ui.closeProfile();
  }

  protected pick(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    input.value = '';
    if (!f) return;
    const err = validateAvatar(f);
    if (err) {
      this.msg.set({ type: 'err', text: err });
      return;
    }
    const old = this.localPreview();
    if (old) URL.revokeObjectURL(old);
    this.newFile.set(f);
    this.localPreview.set(URL.createObjectURL(f));
    this.removeAvatar.set(false);
    this.msg.set(null);
  }

  protected removePhoto(): void {
    const old = this.localPreview();
    if (old) URL.revokeObjectURL(old);
    this.localPreview.set(null);
    this.newFile.set(null);
    this.removeAvatar.set(true);
  }

  protected setPref(key: PrefKey, value: boolean): void {
    const p = this.prefs();
    if (p) this.prefs.set({ ...p, [key]: value });
  }

  protected async save(): Promise<void> {
    const u = this.auth.user();
    if (!u || this.saving()) return;
    this.saving.set(true);
    this.msg.set(null);
    try {
      const trimmed = this.name().trim();
      if (trimmed !== (u.fullName ?? '')) {
        this.auth.setUser(await firstValueFrom(this.api.update(trimmed)));
      }
      const file = this.newFile();
      if (file) {
        this.auth.setUser(await firstValueFrom(this.api.uploadAvatar(file)));
        this.newFile.set(null);
      } else if (this.removeAvatar() && u.avatarUrl) {
        this.auth.setUser(await firstValueFrom(this.api.removeAvatar()));
      }
      this.removeAvatar.set(false);
      const p = this.prefs();
      if (p && this.originalPrefs && JSON.stringify(p) !== JSON.stringify(this.originalPrefs)) {
        const saved = await firstValueFrom(this.api.saveNotificationPrefs(p));
        this.prefs.set({ ...saved });
        this.originalPrefs = { ...saved };
      }
      this.msg.set({ type: 'ok', text: 'Perfil atualizado!' });
      this.closeTimer = setTimeout(() => this.ui.closeProfile(), 700);
    } catch (err) {
      this.msg.set({ type: 'err', text: apiMessage(err, 'Não foi possível salvar.') });
    } finally {
      this.saving.set(false);
    }
  }

  protected async changePassword(): Promise<void> {
    this.pwMsg.set(null);
    const current = this.pwCurrent();
    const next = this.pwNew();
    if (!current) return this.pwMsg.set({ type: 'err', text: 'Informe a senha atual.' });
    if (next.length < 8) return this.pwMsg.set({ type: 'err', text: 'A nova senha precisa ter pelo menos 8 caracteres.' });
    if (next !== this.pwConfirm()) return this.pwMsg.set({ type: 'err', text: 'As senhas não conferem.' });
    this.pwSaving.set(true);
    try {
      await firstValueFrom(this.api.changePassword(current, next));
      this.pwCurrent.set('');
      this.pwNew.set('');
      this.pwConfirm.set('');
      this.pwMsg.set({ type: 'ok', text: 'Senha atualizada com sucesso.' });
    } catch (err) {
      this.pwMsg.set({ type: 'err', text: apiMessage(err, 'Não foi possível alterar a senha.') });
    } finally {
      this.pwSaving.set(false);
    }
  }
}
