import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { formatClock } from './format';
import { IconComponent } from './icon.component';
import { driveId, isDirectVideo, videoThumb, youtubeId } from './youtube';
import { YTEvent, YTPlayer, loadYouTubeApi } from './youtube-api';


/** Arquivo direto (.mp4 no R2 etc.) exposto com a mesma interface do player do YouTube. */
function html5Player(v: HTMLVideoElement): YTPlayer {
  return {
    playVideo: () => void v.play().catch(() => undefined),
    pauseVideo: () => v.pause(),
    seekTo: (s) => {
      v.currentTime = s;
    },
    mute: () => {
      v.muted = true;
    },
    unMute: () => {
      v.muted = false;
    },
    isMuted: () => v.muted,
    setVolume: (n) => {
      v.volume = Math.min(1, Math.max(0, n / 100));
    },
    getVolume: () => Math.round(v.volume * 100),
    getDuration: () => (Number.isFinite(v.duration) ? v.duration : 0),
    getCurrentTime: () => v.currentTime,
    destroy: () => {
      v.pause();
      v.removeAttribute('src');
      v.load();
    },
  };
}

/**
 * LURE Player — controles próprios sobre dois motores:
 * - YouTube: IFrame API (host youtube-nocookie, controls:0). Nada da interface do YouTube chega ao aluno:
 *   o iframe fica sem ponteiro e recortado (.yt-crop), a capa cobre pausa/fim, a LURE desenha o próprio
 *   carregamento e, se o YouTube falhar, mostra o próprio erro — nunca o player padrão do YouTube;
 * - arquivo direto (https://…/aula.mp4, ex.: Cloudflare R2): elemento <video> nativo;
 * - Google Drive: iframe do próprio Drive (não expõe tempo nem fim do vídeo).
 */
@Component({
  selector: 'app-lure-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'block' },
  template: `
    @if (driveSrc(); as src) {
      <!-- Google Drive não tem API de controle: usa o player dele (sem progresso automático; o aluno marca a aula como concluída). -->
      <div class="relative h-full w-full bg-black">
        <iframe
          [src]="src"
          class="h-full w-full border-0 bg-black"
          allow="autoplay; fullscreen"
          allowfullscreen
          fetchpriority="high"
          title="Vídeo da aula"
          (load)="driveReady.set(true)"
        ></iframe>
        @if (!driveReady()) {
          <!-- Capa da aula na hora, enquanto o player do Drive carrega (em vez de tela preta) -->
          <div class="pointer-events-none absolute inset-0 grid place-items-center">
            @if (driveThumb(); as t) {
              <img [src]="t" alt="" class="absolute inset-0 h-full w-full object-cover" fetchpriority="high" />
            }
            <div class="absolute inset-0 bg-black/45"></div>
            <span class="relative grid h-16 w-16 place-items-center rounded-full bg-black/70">
              <app-icon name="loader-circle" class="h-7 w-7 animate-spin text-primary" />
            </span>
          </div>
        }
      </div>
    } @else if (!videoId() && !directSrc()) {
      <div class="grid h-full w-full place-items-center bg-black text-sm text-white/60">Vídeo indisponível.</div>
    } @else if (failed()) {
      <div class="flex h-full w-full flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <img src="/lure-logo-large.png" alt="" class="h-14 w-14 object-contain opacity-80" />
        <div>
          <p class="text-sm font-semibold text-white/90">Não foi possível carregar a aula.</p>
          <p class="mt-1 text-xs text-white/50">Verifique sua conexão e tente de novo.</p>
        </div>
        <button
          type="button"
          (click)="retry()"
          class="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
        >
          <app-icon name="rotate-ccw" class="h-4 w-4" /> Tentar de novo
        </button>
      </div>
    } @else {
      <div
        #shell
        class="group relative h-full w-full select-none overflow-hidden bg-black outline-none"
        tabindex="0"
        role="region"
        aria-label="LURE Player"
        (mousemove)="poke()"
        (mouseleave)="playing() && controlsVisible.set(false)"
        (keydown)="onKey($event)"
      >
        <div class="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            #host
            class="yt-host absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2"
            [class.yt-crop]="!!videoId()"
          ></div>
        </div>
        <div
          class="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black via-black/65 to-transparent"
        ></div>
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-black via-black/70 to-transparent"
        ></div>

        <div
          class="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          [class]="!playing() || flash() ? 'opacity-100' : 'opacity-0 transition-opacity duration-500'"
        >
          @if (videoId()) {
            <img
              [src]="thumb()"
              alt=""
              aria-hidden="true"
              class="absolute inset-0 h-full w-full object-cover"
              (error)="thumbFallback()"
            />
          }
          <div class="absolute inset-0 bg-black/45"></div>
        </div>

        <button
          type="button"
          (click)="toggle()"
          [attr.aria-label]="playing() ? 'Pausar' : 'Reproduzir'"
          class="absolute inset-0 z-30 h-full w-full cursor-pointer"
          tabindex="-1"
        ></button>

        @if (ready() && buffering() && playing()) {
          <!-- disco opaco por cima do carregamento do YouTube (centro do iframe) -->
          <div class="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <span class="grid h-24 w-24 place-items-center rounded-full bg-black">
              <app-icon name="loader-circle" class="h-8 w-8 animate-spin text-primary" />
            </span>
          </div>
        }
        @if (!ready()) {
          <div class="absolute inset-0 z-40 grid place-items-center bg-black">
            <app-icon name="loader-circle" class="h-8 w-8 animate-spin text-primary" />
          </div>
        }
        @if (ready() && !playing() && !ended()) {
          <div class="pointer-events-none absolute inset-0 z-30 grid place-items-center">
            <span
              class="grid h-20 w-20 place-items-center rounded-full bg-primary/95 shadow-[var(--shadow-glow)] transition group-hover:scale-105"
            >
              <app-icon name="play" [filled]="true" class="ml-1 h-8 w-8 text-primary-foreground" />
            </span>
          </div>
        }
        @if (ended()) {
          <div class="absolute inset-0 z-40 grid place-items-center bg-black/85 backdrop-blur-sm">
            <button
              type="button"
              (click)="toggle()"
              class="inline-flex items-center gap-2 rounded-xl gradient-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110"
            >
              <app-icon name="rotate-ccw" class="h-4 w-4" />
              Assistir de novo
            </button>
          </div>
        }

        <div
          class="absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-300 md:px-4"
          [class]="controlsVisible() || !playing() ? 'opacity-100' : 'opacity-0'"
        >
          <div
            class="group/bar relative h-3 cursor-pointer"
            role="slider"
            aria-label="Posição do vídeo"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="round(duration())"
            [attr.aria-valuenow]="round(current())"
            [attr.aria-valuetext]="clock(current()) + ' de ' + clock(duration())"
            (click)="seekFromBar($event)"
          >
            <div class="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/25">
              <div class="absolute inset-y-0 left-0 rounded-full bg-primary" [style.width.%]="pct()"></div>
            </div>
            <div
              class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition group-hover/bar:opacity-100"
              [style.left.%]="pct()"
            ></div>
          </div>
          <div class="mt-1 flex items-center gap-3 text-white">
            <button
              type="button"
              (click)="toggle()"
              [attr.aria-label]="playing() ? 'Pausar' : 'Reproduzir'"
              class="transition hover:text-primary"
            >
              <app-icon [name]="playing() ? 'pause' : 'play'" class="h-5 w-5" />
            </button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="toggleMute()"
                [attr.aria-label]="muted() || volume() === 0 ? 'Ativar som' : 'Mudo'"
                class="transition hover:text-primary"
              >
                <app-icon [name]="muted() || volume() === 0 ? 'volume-x' : 'volume-2'" class="h-5 w-5" />
              </button>
              <input
                type="range"
                min="0"
                max="100"
                [value]="muted() ? 0 : volume()"
                (input)="setVolume($event)"
                aria-label="Volume"
                class="hidden h-1 w-20 cursor-pointer sm:block"
              />
            </div>
            <div class="text-xs tabular-nums text-white/80">
              {{ clock(current()) }} <span class="text-white/40">/</span> {{ clock(duration()) }}
            </div>
            <div class="ml-auto flex items-center gap-3">
              <span class="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 sm:inline">
                LURE Player
              </span>
              <button
                type="button"
                (click)="toggleFullscreen()"
                [attr.aria-label]="fullscreen() ? 'Sair da tela cheia' : 'Tela cheia'"
                class="transition hover:text-primary"
              >
                <app-icon [name]="fullscreen() ? 'minimize' : 'maximize'" class="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class LurePlayerComponent {
  readonly videoUrl = input.required<string>();
  /** Retoma deste ponto se > 5 s. */
  readonly startAt = input<number>(0);

  readonly ended$ = output<void>({ alias: 'ended' });
  readonly durationChange = output<number>();
  readonly playingChange = output<boolean>();
  readonly timeUpdate = output<number>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = viewChild<ElementRef<HTMLElement>>('host');
  private readonly shellEl = viewChild<ElementRef<HTMLElement>>('shell');

  protected readonly videoId = computed(() => youtubeId(this.videoUrl()));
  protected readonly directSrc = computed(() => (isDirectVideo(this.videoUrl()) ? this.videoUrl().trim() : null));
  private readonly sanitizer = inject(DomSanitizer);
  /** O iframe do Drive terminou de carregar (até lá, mostra a capa com o carregando). */
  protected readonly driveReady = signal(false);
  protected readonly driveThumb = computed(() => videoThumb(this.videoUrl(), 1280));
  /** Player do Google Drive (iframe /preview); o ID só tem [A-Za-z0-9_-], então a URL é segura. */
  protected readonly driveSrc = computed((): SafeResourceUrl | null => {
    const id = driveId(this.videoUrl());
    return id
      ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://drive.google.com/file/d/${id}/preview`)
      : null;
  });
  /** Vídeo que não carregou (YouTube fora do ar/bloqueado, vídeo removido ou privado, link quebrado). */
  protected readonly failed = signal(false);
  protected readonly buffering = signal(false);
  protected readonly ready = signal(false);
  protected readonly playing = signal(false);
  protected readonly ended = signal(false);
  protected readonly duration = signal(0);
  protected readonly current = signal(0);
  protected readonly muted = signal(false);
  protected readonly volume = signal(100);
  protected readonly fullscreen = signal(false);
  protected readonly flash = signal(false);
  protected readonly controlsVisible = signal(true);
  private readonly thumbQuality = signal<'maxresdefault' | 'hqdefault'>('maxresdefault');

  protected readonly thumb = computed(
    () => `https://i.ytimg.com/vi/${this.videoId()}/${this.thumbQuality()}.jpg`,
  );
  protected readonly pct = computed(() => (this.duration() ? (this.current() / this.duration()) * 100 : 0));

  private player: YTPlayer | null = null;
  /** Autoplay mudo inicial para pré-carregar e posicionar no startAt. */
  private probing = false;
  private everPlayed = false;
  private tick: ReturnType<typeof setInterval> | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | undefined;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect((onCleanup) => {
      const id = this.videoId();
      const src = this.directSrc();
      // Espera o elemento host existir (renderizado no mesmo ciclo).
      const host = this.hostEl()?.nativeElement;
      if ((!id && !src) || !host) return;
      untracked(() => (id ? this.setup(id, host) : this.setupDirect(src!, host)));
      onCleanup(() => this.teardown());
    });

    const onVisibility = () => {
      if (document.hidden) {
        try {
          this.player?.pauseVideo();
        } catch {
          /* ignora */
        }
      }
    };
    const onFullscreen = () => this.fullscreen.set(!!document.fullscreenElement);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      this.teardown();
    });
  }

  private reset(): void {
    this.ready.set(false);
    this.playing.set(false);
    this.ended.set(false);
    this.current.set(0);
    this.failed.set(false);
    this.buffering.set(false);
    this.flash.set(false);
    this.thumbQuality.set('maxresdefault');
    this.everPlayed = false;
    this.probing = false;
  }

  private setupDirect(src: string, host: HTMLElement): void {
    this.reset();
    const events = new AbortController();
    this.cancelSetup = () => events.abort();
    host.innerHTML = '';
    const v = document.createElement('video');
    const on = (type: string, fn: () => void) => v.addEventListener(type, fn, { signal: events.signal });
    v.preload = 'metadata';
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.disablePictureInPicture = true;
    v.setAttribute('controlslist', 'nodownload noplaybackrate');
    const player = html5Player(v);
    this.player = player;

    on('loadedmetadata', () => {
      this.ready.set(true);
      const d = player.getDuration();
      this.duration.set(d);
      if (d) this.durationChange.emit(d);
      this.volume.set(player.getVolume());
      this.muted.set(player.isMuted());
      const t = this.startAt();
      if (t && t > 5 && t < d) {
        player.seekTo(t, true);
        this.current.set(t);
      }
    });
    on('durationchange', () => {
      const d = player.getDuration();
      if (d && Math.abs(this.duration() - d) > 0.5) {
        this.duration.set(d);
        this.durationChange.emit(d);
      }
    });
    on('waiting', () => this.buffering.set(true));
    on('playing', () => {
      this.buffering.set(false);
      this.everPlayed = true;
      this.ended.set(false);
      this.setPlaying(true);
    });
    on('pause', () => {
      if (!v.ended) this.setPlaying(false);
    });
    on('ended', () => {
      this.ended.set(true);
      this.setPlaying(false);
      this.ended$.emit();
    });
    on('volumechange', () => {
      this.muted.set(v.muted);
      if (!v.muted) this.volume.set(player.getVolume());
    });
    on('error', () => this.failed.set(true));

    v.src = src;
    host.appendChild(v);
  }

  private setup(id: string, host: HTMLElement): void {
    this.reset();

    let cancelled = false;
    // YouTube não respondeu (rede lenta, bloqueador): erro da LURE com "Tentar de novo".
    const fallbackTimer = setTimeout(() => {
      if (!cancelled && !this.ready()) this.failed.set(true);
    }, 15000);
    this.cancelSetup = () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };

    void loadYouTubeApi().then(() => {
      if (cancelled) return;
      const YT = window.YT;
      if (!YT?.Player) {
        clearTimeout(fallbackTimer);
        this.failed.set(true);
        return;
      }
      host.innerHTML = '';
      const mount = document.createElement('div');
      host.appendChild(mount);
      this.player = new YT.Player(mount, {
        videoId: id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          cc_load_policy: 0,
          cc_lang_pref: 'pt',
          hl: 'pt-BR',
          vq: 'hd1080',
          origin: window.location.origin,
        },
        events: {
          onReady: (e: YTEvent) => {
            if (cancelled) return;
            clearTimeout(fallbackTimer);
            this.ready.set(true);
            const d = e.target.getDuration?.() || 0;
            this.duration.set(d);
            if (d) this.durationChange.emit(d);
            this.volume.set(e.target.getVolume?.() ?? 100);
            this.muted.set(e.target.isMuted?.() ?? false);
            try {
              e.target.unloadModule?.('captions');
              e.target.unloadModule?.('cc');
              e.target.setPlaybackQuality?.('hd1080');
            } catch {
              /* ignora */
            }
            try {
              this.probing = true;
              e.target.mute();
              e.target.playVideo();
              setTimeout(() => {
                if (this.probing) {
                  this.probing = false;
                  try {
                    e.target.unMute();
                  } catch {
                    /* ignora */
                  }
                }
              }, 4000);
            } catch {
              this.probing = false;
            }
          },
          // Vídeo removido, privado ou com incorporação desligada: esconde a tela de erro do YouTube.
          onError: () => {
            if (cancelled) return;
            clearTimeout(fallbackTimer);
            this.failed.set(true);
          },
          onStateChange: (e: YTEvent) => {
            if (cancelled) return;
            const S = window.YT!.PlayerState;
            this.buffering.set(e.data === S.BUFFERING);
            if (this.probing && e.data === S.PLAYING) {
              this.probing = false;
              try {
                e.target.pauseVideo();
                const t = this.startAt();
                e.target.seekTo(t && t > 5 ? t : 0, true);
                e.target.unMute();
                if (t && t > 5) this.current.set(t);
              } catch {
                /* ignora */
              }
              return;
            }
            if (e.data === S.PLAYING) {
              this.everPlayed = true;
              this.ended.set(false);
              this.setPlaying(true);
              try {
                e.target.unloadModule?.('captions');
                e.target.unloadModule?.('cc');
              } catch {
                /* ignora */
              }
              const d = e.target.getDuration?.() || 0;
              if (d) {
                this.duration.set(d);
                this.durationChange.emit(d);
              }
            } else if (e.data === S.PAUSED) {
              if (!this.everPlayed) return;
              this.setPlaying(false);
            } else if (e.data === S.ENDED) {
              this.ended.set(true);
              this.setPlaying(false);
              this.ended$.emit();
            }
          },
        },
      });
    });
  }

  private cancelSetup: () => void = () => undefined;

  private setPlaying(p: boolean): void {
    if (this.playing() === p) return;
    this.playing.set(p);
    this.playingChange.emit(p);
    if (p) {
      this.flash.set(true);
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => this.flash.set(false), 1600);
      this.startTick();
      this.poke();
    } else {
      this.stopTick();
      this.controlsVisible.set(true);
    }
  }

  private startTick(): void {
    this.stopTick();
    this.tick = setInterval(() => {
      const p = this.player;
      if (!p?.getCurrentTime) return;
      const t = p.getCurrentTime() || 0;
      this.current.set(t);
      this.timeUpdate.emit(t);
      const d = p.getDuration?.() || 0;
      if (d && Math.abs(this.duration() - d) > 0.5) this.duration.set(d);
    }, 500);
  }

  private stopTick(): void {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  private teardown(): void {
    this.cancelSetup();
    this.stopTick();
    clearTimeout(this.flashTimer);
    clearTimeout(this.hideTimer);
    if (this.playing()) {
      this.playing.set(false);
      this.playingChange.emit(false);
    }
    try {
      this.player?.destroy();
    } catch {
      /* ignora */
    }
    this.player = null;
    const host = this.hostEl()?.nativeElement;
    if (host) host.innerHTML = '';
  }

  // ---------------------------------------------------------------- controles
  protected toggle(): void {
    const p = this.player;
    if (!p || !this.ready()) return;
    if (this.probing) {
      this.probing = false;
      try {
        p.unMute();
      } catch {
        /* ignora */
      }
    }
    if (this.ended()) {
      p.seekTo(0, true);
      p.playVideo();
      this.ended.set(false);
      return;
    }
    if (this.playing()) p.pauseVideo();
    else p.playVideo();
  }

  protected seekFromBar(e: MouseEvent): void {
    const p = this.player;
    const d = this.duration();
    if (!p || !d) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * d;
    p.seekTo(t, true);
    this.current.set(t);
  }

  private seekBy(delta: number): void {
    const p = this.player;
    const d = this.duration();
    if (!p || !d) return;
    const t = Math.min(d, Math.max(0, this.current() + delta));
    p.seekTo(t, true);
    this.current.set(t);
  }

  protected toggleMute(): void {
    const p = this.player;
    if (!p) return;
    if (this.muted() || this.volume() === 0) {
      p.unMute();
      const v = this.volume() === 0 ? 60 : this.volume();
      p.setVolume(v);
      this.volume.set(v);
      this.muted.set(false);
    } else {
      p.mute();
      this.muted.set(true);
    }
  }

  protected setVolume(e: Event): void {
    const p = this.player;
    const v = Number((e.target as HTMLInputElement).value);
    if (!p) return;
    p.setVolume(v);
    if (v === 0) {
      p.mute();
      this.muted.set(true);
    } else {
      p.unMute();
      this.muted.set(false);
    }
    this.volume.set(v);
  }

  protected toggleFullscreen(): void {
    const el = this.shellEl()?.nativeElement;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }

  protected poke(): void {
    this.controlsVisible.set(true);
    clearTimeout(this.hideTimer);
    if (this.playing()) this.hideTimer = setTimeout(() => this.controlsVisible.set(false), 2600);
  }

  protected onKey(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') {
      e.preventDefault();
      this.toggle();
    } else if (k === 'arrowright') {
      e.preventDefault();
      this.seekBy(5);
    } else if (k === 'arrowleft') {
      e.preventDefault();
      this.seekBy(-5);
    } else if (k === 'm') {
      this.toggleMute();
    } else if (k === 'f') {
      this.toggleFullscreen();
    } else {
      return;
    }
    this.poke();
  }

  /** Remonta o player do zero (o host volta a existir e o effect chama o setup de novo). */
  protected retry(): void {
    this.failed.set(false);
  }

  protected thumbFallback(): void {
    this.thumbQuality.set('hqdefault');
  }

  protected clock(s: number): string {
    return formatClock(s);
  }

  protected round(n: number): number {
    return Math.round(n);
  }
}
