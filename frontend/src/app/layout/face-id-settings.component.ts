import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PasskeyDto, WebAuthnApi, passkeyErrorMessage, passkeySupported } from '../core/api/webauthn.api';
import { apiMessage } from '../core/api-error';
import { ToastService } from '../core/toast.service';
import { formatDateShort, timeAgo } from '../shared/format';
import { IconComponent } from '../shared/icon.component';
import { SpinnerComponent } from '../shared/spinner.component';

/** Nome sugerido para o aparelho, a partir do navegador. */
function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows (Hello)';
  return 'Meu aparelho';
}

/** Cadastro e remoção de Face ID (passkeys) — seção do modal de Configurações. */
@Component({
  selector: 'app-face-id-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent],
  template: `
    <div class="mt-4 space-y-3">
      <div class="flex items-start gap-3">
        <span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
          <app-icon name="scan-face" class="h-6 w-6" [strokeWidth]="1.6" [class.animate-pulse]="registering()" />
        </span>
        <p class="text-xs leading-relaxed text-muted-foreground">
          @if (supported() === false) {
            Este aparelho não tem Face ID / Windows Hello disponível. Abra a plataforma no iPhone, Mac ou num PC com
            Windows Hello para cadastrar.
          } @else {
            Entre sem senha usando o Face ID (ou Windows Hello). Seu rosto nunca sai do aparelho — a plataforma guarda
            só uma chave de segurança.
          }
        </p>
      </div>

      @if (supported() !== false) {
        <div class="flex gap-2">
          <input
            type="text"
            maxlength="100"
            [value]="label()"
            (input)="label.set($any($event.target).value)"
            aria-label="Nome do aparelho"
            placeholder="Nome do aparelho"
            class="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            (click)="register()"
            [disabled]="registering() || supported() === null"
            class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60"
          >
            @if (registering()) {
              <app-spinner size="h-3.5 w-3.5" /> Aguardando…
            } @else {
              <app-icon name="scan-face" class="h-3.5 w-3.5" /> Cadastrar
            }
          </button>
        </div>
      }

      @if (error()) {
        <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400" role="alert">
          {{ error() }}
        </div>
      }

      @if (loading()) {
        <div class="flex items-center gap-2 py-2 text-xs text-muted-foreground"><app-spinner size="h-3.5 w-3.5" /> Carregando…</div>
      } @else if (items().length) {
        <ul class="space-y-2">
          @for (p of items(); track p.id) {
            <li class="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-3 py-2.5">
              <app-icon name="shield-check" class="h-4 w-4 shrink-0 text-primary" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{{ p.label }}</div>
                <div class="text-[11px] text-muted-foreground">
                  {{ date(p.createdAt) }} · {{ p.lastUsedAt ? 'usado ' + ago(p.lastUsedAt) : 'ainda não usado' }}
                </div>
              </div>
              <button
                type="button"
                (click)="remove(p)"
                [disabled]="removing() === p.id"
                class="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                [attr.aria-label]="'Remover ' + p.label"
              >
                @if (removing() === p.id) {
                  <app-spinner size="h-3.5 w-3.5" />
                } @else {
                  <app-icon name="trash-2" class="h-3.5 w-3.5" />
                }
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="text-xs text-muted-foreground">Nenhum aparelho conectado ainda.</p>
      }
    </div>
  `,
})
export class FaceIdSettingsComponent {
  private readonly api = inject(WebAuthnApi);
  private readonly toast = inject(ToastService);

  protected readonly supported = signal<boolean | null>(null);
  protected readonly items = signal<PasskeyDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly registering = signal(false);
  protected readonly removing = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly label = signal(guessDeviceName());

  protected readonly date = formatDateShort;
  protected readonly ago = timeAgo;

  constructor() {
    void passkeySupported().then((ok) => this.supported.set(ok));
    this.api.list().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiMessage(err, 'Não foi possível carregar os aparelhos.'));
      },
    });
  }

  protected register(): void {
    if (this.registering()) return;
    this.error.set(null);
    this.registering.set(true);
    this.api.register(this.label().trim()).subscribe({
      next: (p) => {
        this.registering.set(false);
        this.items.update((l) => [...l, p]);
        this.toast.success('Face ID conectado! Agora você pode entrar sem senha.');
      },
      error: (err) => {
        this.registering.set(false);
        this.error.set(passkeyErrorMessage(err) ?? apiMessage(err, 'Não foi possível cadastrar o Face ID.'));
      },
    });
  }

  protected remove(p: PasskeyDto): void {
    if (!confirm(`Remover "${p.label}"? Você não vai mais conseguir entrar com o Face ID desse aparelho.`)) return;
    this.removing.set(p.id);
    this.api.remove(p.id).subscribe({
      next: () => {
        this.removing.set(null);
        this.items.update((l) => l.filter((x) => x.id !== p.id));
        this.toast.success('Aparelho removido.');
      },
      error: (err) => {
        this.removing.set(null);
        this.error.set(apiMessage(err, 'Não foi possível remover.'));
      },
    });
  }
}
