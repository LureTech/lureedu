import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiService, WHATSAPP_SUPPORT } from '../core/ui.service';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';

const BENEFITS: { icon: string; title: string; text: string }[] = [
  { icon: 'layers', title: 'Todas as trilhas', text: 'Acesso vitalício a todos os módulos, inclusive os que ainda estão em gravação.' },
  { icon: 'video', title: 'Mentorias ao vivo', text: 'Encontros com o time LURE para destravar os seus próximos passos.' },
  { icon: 'users', title: 'Comunidade exclusiva', text: 'Troque conquistas, dúvidas e cases com quem está no mesmo jogo.' },
  { icon: 'award', title: 'Certificados verificáveis', text: 'Cada módulo concluído gera um certificado com código de verificação.' },
  { icon: 'life-buoy', title: 'Suporte direto', text: 'Fale com a equipe pelo WhatsApp sempre que precisar.' },
];

/** Modal "Plano Premium → Ver benefícios" (no original o botão não fazia nada). */
@Component({
  selector: 'app-benefits-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, IconComponent],
  template: `
    @if (ui.benefitsOpen()) {
      <app-modal label="Plano Premium" panelClass="max-w-lg" (closed)="ui.benefitsOpen.set(false)">
        <div class="relative overflow-hidden border-b border-border px-6 pb-5 pt-6">
          <div
            class="pointer-events-none absolute inset-0"
            style="background: radial-gradient(ellipse 70% 120% at 15% -20%, rgba(187, 154, 53, 0.3), transparent 70%)"
          ></div>
          <button
            type="button"
            (click)="ui.benefitsOpen.set(false)"
            class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-border/60 bg-background/50 text-muted-foreground transition hover:text-foreground"
            aria-label="Fechar"
          >
            <app-icon name="x" class="h-4 w-4" />
          </button>
          <div class="relative flex items-center gap-3">
            <div class="grid h-11 w-11 place-items-center rounded-xl gradient-gold text-primary-foreground shadow-[var(--shadow-glow)]">
              <app-icon name="crown" class="h-5 w-5" />
            </div>
            <div>
              <div class="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Seu plano</div>
              <h2 class="font-display text-xl font-bold">Plano Premium</h2>
            </div>
          </div>
          <p class="relative mt-3 text-sm leading-relaxed text-muted-foreground">
            Tudo o que o AssessoriaLure oferece, liberado para você.
          </p>
        </div>
        <ul class="grid gap-3 p-6 sm:grid-cols-2">
          @for (b of benefits; track b.title; let i = $index) {
            <li class="lure-rise rounded-2xl border border-border/60 bg-surface/50 p-4" [style.--d]="i * 50 + 'ms'">
              <div class="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
                <app-icon [name]="b.icon" class="h-4 w-4" />
              </div>
              <div class="mt-3 text-sm font-semibold">{{ b.title }}</div>
              <p class="mt-1 text-xs leading-relaxed text-muted-foreground">{{ b.text }}</p>
            </li>
          }
        </ul>
        <div class="flex flex-col gap-2 border-t border-border/60 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            (click)="ui.benefitsOpen.set(false)"
            class="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Fechar
          </button>
          <a
            [href]="support"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center justify-center gap-2 rounded-xl gradient-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            <app-icon name="message-circle" class="h-4 w-4" /> Falar com o suporte
          </a>
        </div>
      </app-modal>
    }
  `,
})
export class BenefitsModalComponent {
  protected readonly ui = inject(UiService);
  protected readonly benefits = BENEFITS;
  protected readonly support = WHATSAPP_SUPPORT;
}
