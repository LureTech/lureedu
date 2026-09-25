import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { SpinnerComponent } from '../../shared/spinner.component';

/** /redefinir-senha?token=… (link enviado por e-mail). */
@Component({
  selector: 'app-reset-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SpinnerComponent],
  template: `
    <main class="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-14 sm:px-10">
      <div
        class="lure-aurora lure-aurora-a"
        style="width: 420px; height: 420px; top: -8%; right: -6%; background: rgba(187, 154, 53, 0.16)"
      ></div>
      <div
        class="lure-aurora lure-aurora-b"
        style="width: 360px; height: 360px; bottom: -10%; left: -8%; background: rgba(212, 184, 92, 0.12)"
      ></div>
      <div class="relative w-full max-w-md">
        <a routerLink="/login" class="lure-rise mb-9 flex flex-col items-center gap-3 text-center" style="--d: 40ms">
          <img src="/lure-logo-large.png" alt="LURE" class="h-16 w-16 rounded-full object-contain" />
          <div class="leading-tight">
            <div class="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Assessoria</div>
            <div class="font-display text-lg font-bold tracking-[0.18em]">LURE</div>
          </div>
        </a>
        <div
          class="lure-rise relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 shadow-[var(--shadow-card)] backdrop-blur-xl sm:p-10"
          style="--d: 120ms"
        >
          <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"></div>
          <h1 class="font-display text-3xl font-bold tracking-tight">Nova senha</h1>

          @if (!token()) {
            <div class="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-red-300" role="alert">
              Link inválido. Peça um novo link em “Esqueceu a senha?” na tela de login.
            </div>
            <a
              routerLink="/login"
              class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl gradient-gold px-5 py-3.5 text-sm font-semibold text-primary-foreground"
            >
              Ir para o login
            </a>
          } @else if (done()) {
            <div class="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-300" role="status">
              <app-icon name="circle-check" class="mt-0.5 h-5 w-5 shrink-0" />
              <p class="leading-relaxed">Senha redefinida! Agora é só entrar com a nova senha.</p>
            </div>
            <a
              routerLink="/login"
              class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl gradient-gold px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110"
            >
              Entrar <app-icon name="arrow-right" class="h-4 w-4" />
            </a>
          } @else {
            <p class="mt-2 text-sm text-muted-foreground">Crie uma nova senha com pelo menos 8 caracteres.</p>
            <form class="mt-8 space-y-4" (submit)="submit($event)">
              <div>
                <label for="rp-new" class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nova senha
                </label>
                <div class="group relative">
                  <app-icon
                    name="lock"
                    class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
                  />
                  <input
                    id="rp-new"
                    [type]="show() ? 'text' : 'password'"
                    autocomplete="new-password"
                    required
                    minlength="8"
                    [value]="pw()"
                    (input)="pw.set($any($event.target).value)"
                    placeholder="••••••••"
                    class="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-11 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-primary/10"
                  />
                  <button
                    type="button"
                    (click)="show.set(!show())"
                    class="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                    [attr.aria-label]="show() ? 'Ocultar senha' : 'Mostrar senha'"
                  >
                    <app-icon [name]="show() ? 'eye-off' : 'eye'" class="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>
              <div>
                <label for="rp-confirm" class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confirme a senha
                </label>
                <div class="group relative">
                  <app-icon
                    name="lock"
                    class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
                  />
                  <input
                    id="rp-confirm"
                    [type]="show() ? 'text' : 'password'"
                    autocomplete="new-password"
                    required
                    [value]="confirm()"
                    (input)="confirm.set($any($event.target).value)"
                    placeholder="••••••••"
                    class="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>
              @if (error()) {
                <div class="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-red-300" role="alert">
                  {{ error() }}
                </div>
              }
              <button
                type="submit"
                [disabled]="loading()"
                class="inline-flex w-full items-center justify-center gap-2 rounded-2xl gradient-gold px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-70"
              >
                @if (loading()) {
                  <app-spinner /> Salvando…
                } @else {
                  Salvar nova senha
                }
              </button>
            </form>
          }
        </div>
      </div>
    </main>
  `,
})
export class ResetPasswordPage {
  /** query param ?token= (withComponentInputBinding) */
  readonly tokenParam = input<string | undefined>(undefined, { alias: 'token' });
  protected readonly token = computed(() => (this.tokenParam() ?? '').trim());

  private readonly auth = inject(AuthService);
  protected readonly pw = signal('');
  protected readonly confirm = signal('');
  protected readonly show = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal(false);

  protected submit(e: Event): void {
    e.preventDefault();
    this.error.set(null);
    if (this.pw().length < 8) return this.error.set('A senha precisa ter pelo menos 8 caracteres.');
    if (this.pw() !== this.confirm()) return this.error.set('As senhas não conferem.');
    this.loading.set(true);
    this.auth.resetPassword(this.token(), this.pw()).subscribe({
      next: () => {
        this.loading.set(false);
        this.done.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiMessage(err, 'Link inválido ou expirado. Peça um novo.'));
      },
    });
  }
}
