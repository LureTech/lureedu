import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface RadarScore {
  name: string;
  avg: number;
}

/** "Roda da Maturidade" — radar SVG portado do original (escala 1–5). */
@Component({
  selector: 'app-radar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mx-auto block max-w-md' },
  template: `
    <svg viewBox="0 0 320 320" class="w-full" role="img" [attr.aria-label]="label()">
      @for (ring of rings(); track $index) {
        <polygon [attr.points]="ring" fill="none" stroke="#232936" stroke-width="0.5" />
      }
      @for (a of axes(); track $index) {
        <line x1="160" y1="160" [attr.x2]="a[0]" [attr.y2]="a[1]" stroke="#232936" stroke-width="0.5" />
      }
      <polygon [attr.points]="shape()" fill="rgba(187, 154, 53, 0.25)" stroke="#BB9A35" stroke-width="1.5" />
      @for (d of dots(); track $index) {
        <circle [attr.cx]="d[0]" [attr.cy]="d[1]" r="3" fill="#D4B85C" />
      }
      @for (t of labels(); track $index) {
        <text
          [attr.x]="t.x"
          [attr.y]="t.y"
          text-anchor="middle"
          dominant-baseline="middle"
          class="fill-muted-foreground"
          style="font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600"
        >
          {{ t.text }}
        </text>
      }
    </svg>
  `,
})
export class RadarComponent {
  readonly scores = input.required<RadarScore[]>();

  private point(i: number, value: number): [number, number] {
    const n = this.scores().length || 1;
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (value / 5) * 120;
    return [160 + r * Math.cos(angle), 160 + r * Math.sin(angle)];
  }

  protected readonly rings = computed(() =>
    [1, 2, 3, 4, 5].map((lvl) => this.scores().map((_, i) => this.point(i, lvl).join(',')).join(' ')),
  );
  protected readonly axes = computed(() => this.scores().map((_, i) => this.point(i, 5)));
  protected readonly shape = computed(() =>
    this.scores()
      .map((s, i) => this.point(i, Math.max(0, Math.min(5, s.avg))).join(','))
      .join(' '),
  );
  protected readonly dots = computed(() => this.scores().map((s, i) => this.point(i, Math.max(0, Math.min(5, s.avg)))));
  protected readonly labels = computed(() => {
    const n = this.scores().length || 1;
    return this.scores().map((s, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return { x: 160 + 142 * Math.cos(angle), y: 160 + 142 * Math.sin(angle), text: s.name.split(' ')[0] };
    });
  });
  protected readonly label = computed(
    () => 'Roda da Maturidade: ' + this.scores().map((s) => `${s.name} ${s.avg.toFixed(1)}`).join(', '),
  );
}
