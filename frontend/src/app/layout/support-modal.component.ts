import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiService } from '../core/ui.service';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent } from '../shared/modal.component';

const TOPICS: { icon: string; title: string; text: string }[] = [
  { icon: 'play', title: 'Dúvidas sobre as aulas', text: 'Algum conceito não ficou claro ou você quer se aprofundar em um tema.' },
  { icon: 'target', title: 'Como aplicar no seu negócio', text: 'Adaptar o método à realidade da sua empresa e do seu time.' },
  { icon: 'life-buoy', title: 'Acesso e plataforma', text: 'Login, vídeos que não abrem, certificados ou qualquer problema técnico.' },
];

/** "Suporte": orienta o aluno a falar com o Head responsável pelo projeto dele na Lure. */
@Component({
  selector: 'app-support-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, IconComponent],
  template: `
    @if (ui.supportOpen()) {
      <app-modal label="Suporte" panelClass="max-w-lg" (closed)="ui.supportOpen.set(false)">
        <div class="relative overflow-hidden border-b border-border px-6 pb-5 pt-6">
          <div
            class="pointer-events-none absolute inset-0"
            style="background: radial-gradient(ellipse 70% 120% at 15% -20%, rgba(187, 154, 53, 0.3), transparent 70%)"
          ></div>
          <button
            type="button"
            (click)="ui.supportOpen.set(false)"
            class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-border/60 bg-background/50 text-muted-foreground transition hover:text-foreground"
            aria-label="Fechar"
          >
            <app-icon name="x" class="h-4 w-4" />
          </button>
          <div class="relative flex items-center gap-3">
            <div class="grid h-11 w-11 place-items-center rounded-xl gradient-gold text-primary-foreground shadow-[var(--shadow-glow)]">
              <app-icon name="ph-headset" class="h-5 w-5" />
            </div>
            <div>
              <div class="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Suporte</div>
              <h2 class="font-display text-xl font-bold">Precisa de ajuda?</h2>
            </div>
          </div>
          <p class="relative mt-3 text-sm leading-relaxed text-muted-foreground">
            Fale com o <span class="font-semibold text-foreground">Head responsável pelo seu projeto</span> na Lure. Ele
            acompanha a sua empresa de perto e é o caminho mais rápido para tirar dúvidas e destravar o próximo passo.
          </p>
        </div>
        <div class="p-6">
          <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Leve para o seu Head</div>
          <ul class="mt-3 flex flex-col gap-3">
            @for (t of topics; track t.title; let i = $index) {
              <li class="lure-rise flex gap-3 rounded-2xl border border-border/60 bg-surface/50 p-4" [style.--d]="i * 50 + 'ms'">
                <div class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <app-icon [name]="t.icon" class="h-4 w-4" />
                </div>
                <div>
                  <div class="text-sm font-semibold">{{ t.title }}</div>
                  <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">{{ t.text }}</p>
                </div>
              </li>
            }
          </ul>
          <p class="mt-4 text-xs leading-relaxed text-muted-foreground">
            Não sabe quem é o Head do seu projeto? Pergunte no grupo da sua empresa com a Lure.
          </p>
        </div>
        <div class="flex justify-end border-t border-border/60 px-6 py-4">
          <button
            type="button"
            (click)="ui.supportOpen.set(false)"
            class="inline-flex items-center justify-center gap-2 rounded-xl gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            Entendi
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class SupportModalComponent {
  protected readonly ui = inject(UiService);
  protected readonly topics = TOPICS;
}
