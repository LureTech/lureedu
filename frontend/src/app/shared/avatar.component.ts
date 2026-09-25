import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';

/** Avatar redondo com fallback de silhueta padrão (cinza) quando não há foto. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-700 text-zinc-400',
  },
  template: `
    @if (showImage()) {
      <img
        [src]="url()"
        [alt]="name() || email() || 'Perfil'"
        class="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        (error)="failed.set(true)"
      />
    } @else {
      <svg viewBox="0 0 24 24" fill="currentColor" class="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="12" cy="9.2" r="4.2" />
        <path d="M3.6 22.4c0-4.9 3.8-8.1 8.4-8.1s8.4 3.2 8.4 8.1z" />
      </svg>
    }
  `,
})
export class AvatarComponent {
  readonly url = input<string | null | undefined>(null);
  readonly name = input<string | null | undefined>(null);
  readonly email = input<string | null | undefined>(null);

  protected readonly failed = linkedSignal({ source: this.url, computation: () => false });
  protected readonly showImage = computed(() => !!this.url() && !this.failed());
}
