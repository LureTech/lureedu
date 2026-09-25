import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, IconDef } from './icons';

const FALLBACK: IconDef = { vb: 24, fill: false, nodes: [['circle', { cx: '12', cy: '12', r: '10' }]] };

/**
 * Ícone SVG (lucide = traço, phosphor `ph-*` = preenchido).
 * Uso: `<app-icon name="play" class="h-4 w-4" [strokeWidth]="1.8" />`
 * Para ícones lucide "cheios" (ex.: play dourado) use `[filled]="true"`.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: [
    `
      :host {
        display: inline-block;
        flex-shrink: 0;
        line-height: 0;
        vertical-align: middle;
      }
      svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
  template: `
    <svg:svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.viewBox]="viewBox()"
      [attr.fill]="fillAttr()"
      [attr.stroke]="def().fill ? null : 'currentColor'"
      [attr.stroke-width]="def().fill ? null : strokeWidth()"
      [attr.stroke-linecap]="def().fill ? null : 'round'"
      [attr.stroke-linejoin]="def().fill ? null : 'round'"
      focusable="false"
    >
      @for (n of def().nodes; track $index) {
        @switch (n[0]) {
          @case ('path') {
            <svg:path [attr.d]="n[1]['d']" [attr.opacity]="n[1]['opacity'] ?? null" />
          }
          @case ('circle') {
            <svg:circle
              [attr.cx]="n[1]['cx']"
              [attr.cy]="n[1]['cy']"
              [attr.r]="n[1]['r']"
              [attr.opacity]="n[1]['opacity'] ?? null"
            />
          }
          @case ('rect') {
            <svg:rect
              [attr.x]="n[1]['x'] ?? null"
              [attr.y]="n[1]['y'] ?? null"
              [attr.width]="n[1]['width']"
              [attr.height]="n[1]['height']"
              [attr.rx]="n[1]['rx'] ?? null"
              [attr.ry]="n[1]['ry'] ?? null"
              [attr.opacity]="n[1]['opacity'] ?? null"
            />
          }
          @case ('line') {
            <svg:line
              [attr.x1]="n[1]['x1']"
              [attr.y1]="n[1]['y1']"
              [attr.x2]="n[1]['x2']"
              [attr.y2]="n[1]['y2']"
            />
          }
        }
      }
    </svg:svg>
  `,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly strokeWidth = input<number>(2);
  readonly filled = input<boolean>(false);

  protected readonly def = computed<IconDef>(() => ICONS[this.name()] ?? FALLBACK);
  protected readonly viewBox = computed(() => `0 0 ${this.def().vb} ${this.def().vb}`);
  protected readonly fillAttr = computed(() =>
    this.def().fill || this.filled() ? 'currentColor' : 'none',
  );
}
