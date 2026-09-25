import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CertificatesApi } from '../../core/api/certificates.api';
import { apiStatus } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { CertificateDto } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { downloadCertificate, verificationUrl } from '../../shared/certificate-canvas';
import { formatDateLong } from '../../shared/format';
import { IconComponent } from '../../shared/icon.component';
import { SpinnerComponent } from '../../shared/spinner.component';

/** Página pública de verificação: /certificado/:code */
@Component({
  selector: 'app-certificate-verify-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SpinnerComponent],
  template: `
    <main class="lure-grain relative min-h-screen overflow-hidden bg-background px-5 py-10 sm:px-10 sm:py-16">
      <div
        class="lure-aurora lure-aurora-a"
        style="width: 520px; height: 520px; top: -12%; left: 50%; margin-left: -260px; background: rgba(187, 154, 53, 0.14)"
      ></div>

      <div class="relative mx-auto max-w-3xl">
        <a [routerLink]="auth.isAuthenticated() ? '/' : '/login'" class="flex items-center justify-center gap-2.5">
          <img src="/lure-logo-large.png" alt="" class="h-9 w-9 object-contain" />
          <span class="font-display text-[17px] leading-none tracking-tight">
            <span class="font-normal">Assessoria</span><span class="font-bold">Lure</span>
          </span>
        </a>
        <p class="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Verificação de certificado
        </p>

        @if (loading()) {
          <div class="mt-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <app-spinner /> Verificando…
          </div>
        } @else if (cert(); as c) {
          <div class="lure-rise mt-10 flex justify-center" style="--d: 60ms">
            <span
              class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400"
            >
              <app-icon name="shield-check" class="h-4 w-4" /> Certificado válido
            </span>
          </div>

          <div
            class="lure-rise relative mt-6 overflow-hidden rounded-3xl border border-primary/30 bg-black shadow-[0_40px_120px_-40px_rgba(187,154,53,0.45)]"
            style="--d: 140ms"
          >
            <div
              class="pointer-events-none absolute inset-0 opacity-80"
              style="background: radial-gradient(ellipse 90% 60% at 50% 100%, rgba(187, 154, 53, 0.35), transparent 65%)"
            ></div>
            <div class="absolute inset-3 rounded-2xl border border-primary/50 sm:inset-4"></div>
            <div class="absolute inset-5 rounded-xl border border-primary/20 sm:inset-7"></div>
            <div class="relative px-8 py-12 text-center sm:px-16 sm:py-16">
              <div class="text-[10px] font-bold uppercase tracking-[0.36em] text-primary">AssessoriaLure · Área de Membros</div>
              <div class="mt-4 font-serif text-4xl italic leading-tight text-white sm:text-6xl">Certificado de Conclusão</div>
              <div class="mt-6 text-xs uppercase tracking-[0.2em] text-white/60">Concedido a</div>
              <div class="mt-2 font-display text-2xl font-bold text-white sm:text-4xl">{{ c.studentName }}</div>
              <div class="mx-auto mt-3 h-px w-48 bg-primary/60"></div>
              <div class="mt-5 text-sm text-white/75">por concluir com êxito o curso</div>
              <div class="mt-2 font-display text-xl font-bold text-primary sm:text-3xl">{{ c.moduleTitle }}</div>
              <div class="mt-3 text-xs text-white/60">
                {{ c.sectionTitle }}
                @if (c.author) {
                  · Mentor: {{ c.author }}
                }
                · {{ c.lessonCount }} {{ c.lessonCount === 1 ? 'aula' : 'aulas' }}
              </div>
              <div class="mt-10 grid grid-cols-2 gap-6 text-xs text-white/70">
                <div>
                  <div class="mx-auto h-px w-32 bg-white/30"></div>
                  <div class="mt-2">Lure Digital</div>
                  <div class="text-[10px] text-white/45">Assinatura</div>
                </div>
                <div>
                  <div class="mx-auto h-px w-32 bg-white/30"></div>
                  <div class="mt-2">{{ issued() }}</div>
                  <div class="text-[10px] text-white/45">Data de emissão</div>
                </div>
              </div>
              <div class="mt-8 font-mono text-[11px] tracking-wider text-white/45">Código: {{ c.code }}</div>
            </div>
          </div>

          <div class="lure-rise mt-6 grid gap-3 sm:grid-cols-3" style="--d: 220ms">
            <div class="rounded-2xl border border-border/60 bg-surface/50 p-4">
              <div class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Aluno</div>
              <div class="mt-1 truncate text-sm font-semibold">{{ c.studentName }}</div>
            </div>
            <div class="rounded-2xl border border-border/60 bg-surface/50 p-4">
              <div class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Emitido em</div>
              <div class="mt-1 text-sm font-semibold">{{ issued() }}</div>
            </div>
            <div class="rounded-2xl border border-border/60 bg-surface/50 p-4">
              <div class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Código</div>
              <div class="mt-1 font-mono text-sm font-semibold">{{ c.code }}</div>
            </div>
          </div>

          <div class="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button
              type="button"
              (click)="download(c)"
              [disabled]="busy()"
              class="inline-flex items-center justify-center gap-2 rounded-xl gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-70"
            >
              @if (busy()) {
                <app-spinner />
              } @else {
                <app-icon name="download" class="h-4 w-4" />
              }
              Baixar certificado
            </button>
            <button
              type="button"
              (click)="copyLink(c.code)"
              class="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40"
            >
              <app-icon name="share" class="h-4 w-4" /> Copiar link de verificação
            </button>
          </div>
        } @else {
          <div class="lure-rise mx-auto mt-14 max-w-md text-center" style="--d: 60ms">
            <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-red-400">
              <app-icon name="triangle-alert" class="h-6 w-6" />
            </div>
            <h1 class="mt-5 font-display text-2xl font-bold">Certificado não encontrado</h1>
            <p class="mt-2 text-sm text-muted-foreground">
              @if (failed()) {
                Não foi possível verificar agora. Tente de novo em instantes.
              } @else {
                Não existe certificado com o código <span class="font-mono text-foreground">{{ code() }}</span>. Confira se o código foi digitado corretamente.
              }
            </p>
            <a
              [routerLink]="auth.isAuthenticated() ? '/' : '/login'"
              class="mt-6 inline-flex items-center justify-center rounded-xl gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {{ auth.isAuthenticated() ? 'Voltar ao início' : 'Ir para o AssessoriaLure' }}
            </a>
          </div>
        }
      </div>
    </main>
  `,
})
export class CertificateVerifyPage {
  readonly code = input.required<string>();

  protected readonly auth = inject(AuthService);
  private readonly api = inject(CertificatesApi);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly cert = signal<CertificateDto | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly issued = computed(() => formatDateLong(this.cert()?.issuedAt));

  constructor() {
    effect(() => {
      const code = this.code();
      untracked(() => this.load(code));
    });
  }

  private load(code: string): void {
    this.loading.set(true);
    this.failed.set(false);
    this.cert.set(null);
    this.api.verify(code).subscribe({
      next: (c) => {
        this.cert.set(c);
        this.loading.set(false);
      },
      error: (err) => {
        this.failed.set(apiStatus(err) !== 404 && apiStatus(err) !== 400);
        this.loading.set(false);
      },
    });
  }

  protected async download(c: CertificateDto): Promise<void> {
    this.busy.set(true);
    try {
      await downloadCertificate(c);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o certificado.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async copyLink(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(verificationUrl(code));
      this.toast.success('Link de verificação copiado.');
    } catch {
      this.toast.info(verificationUrl(code));
    }
  }
}
