import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CertificateDto } from '../core/models';
import { ToastService } from '../core/toast.service';
import { UiService } from '../core/ui.service';
import { downloadCertificate } from './certificate-canvas';
import { IconComponent } from './icon.component';
import { ModalComponent } from './modal.component';
import { SpinnerComponent } from './spinner.component';

/** Modal de comemoração quando uma resposta da API traz `certificate`. */
@Component({
  selector: 'app-certificate-celebration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, IconComponent, SpinnerComponent],
  template: `
    @if (ui.celebrate(); as c) {
      <app-modal label="Certificado emitido" panelClass="max-w-md" zClass="z-[120]" (closed)="close()">
        <div class="relative overflow-hidden">
          <div
            class="pointer-events-none absolute inset-x-0 -top-24 h-64"
            style="background: radial-gradient(ellipse 70% 80% at 50% 0%, rgba(187, 154, 53, 0.45), transparent 70%)"
          ></div>
          <div class="relative px-6 pb-6 pt-8 text-center">
            <div class="relative mx-auto grid h-20 w-20 place-items-center">
              <div class="lure-ring-pulse absolute inset-0 rounded-full border border-primary/50"></div>
              <div class="grid h-16 w-16 place-items-center rounded-2xl gradient-gold text-primary-foreground shadow-[var(--shadow-glow)]">
                <app-icon name="ph-certificate-fill" class="h-8 w-8" />
              </div>
            </div>
            <div class="mt-5 text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Parabéns!</div>
            <h2 class="mt-2 font-display text-2xl font-bold leading-tight">Certificado emitido</h2>
            <p class="mt-2 text-sm text-muted-foreground">
              Você concluiu <span class="font-semibold text-foreground">{{ c.moduleTitle }}</span>.
            </p>

            <div class="mt-5 rounded-2xl border border-primary/30 bg-black/40 px-4 py-4">
              <div class="text-[9px] font-bold uppercase tracking-[0.32em] text-primary">AssessoriaLure</div>
              <div class="mt-1 font-serif text-2xl italic text-white">Certificado</div>
              <div class="mt-1 text-xs text-white/80">{{ c.studentName }}</div>
              <div class="mt-2 font-mono text-[11px] tracking-wider text-white/50">{{ c.code }}</div>
            </div>

            <div class="mt-6 flex flex-col gap-2">
              <button
                type="button"
                autofocus
                (click)="download(c)"
                [disabled]="busy()"
                class="inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-70"
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
                (click)="goToCertificates()"
                class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40"
              >
                Ver meus certificados
              </button>
            </div>
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class CertificateCelebrationComponent {
  protected readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);

  protected close(): void {
    this.ui.celebrate.set(null);
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

  protected goToCertificates(): void {
    this.close();
    void this.router.navigate(['/meus-cursos'], { queryParams: { tab: 'certificados' } });
  }
}
