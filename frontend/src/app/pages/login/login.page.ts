import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { passkeyErrorMessage, passkeySupported } from '../../core/api/webauthn.api';
import { apiMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { safeGet, safeSet } from '../../core/storage';
import { WHATSAPP_FORGOT, WHATSAPP_NO_ACCESS } from '../../core/ui.service';
import { IconComponent } from '../../shared/icon.component';
import { SpinnerComponent } from '../../shared/spinner.component';

const SPLASH_KEY = 'lure.splash.seen';
/**
 * Vídeo de fundo: trecho de 43 s (8:14–8:57) de "Dia de fechamento na Lure D.", sem som, sem as faixas
 * pretas e comprimido. Servido pelo próprio site, em public/video — sem YouTube e sem banco.
 * Computador: 1280×634 (~8 MB). Celular: recorte vertical do centro, 540×960 (~4 MB).
 */
const LOGIN_VIDEO = '/video/login-bg.mp4';
const LOGIN_VIDEO_MOBILE = '/video/login-bg-mobile.mp4';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent],
  template: `
    <div class="relative min-h-screen overflow-hidden bg-background">
      @if (phase() === 'app') {
        <main
          class="lure-grain relative grid min-h-screen lg:grid-cols-[1.05fr_minmax(440px,0.95fr)]"
          (pointermove)="onPointer($event)"
        >
          @if (videoOn()) {
            <!-- Vídeo da Lure cobrindo a tela: arquivo próprio, mudo, em repetição, sem controles e sem cliques -->
            <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <div class="login-zoom absolute inset-0">
                <video
                  class="login-video transition-opacity duration-[1200ms]"
                  [class.opacity-0]="!videoReady()"
                  [src]="videoSrc()"
                  [muted]="true"
                  autoplay
                  loop
                  playsinline
                  preload="auto"
                  disablepictureinpicture
                  (loadedmetadata)="playBackground($event)"
                  (playing)="videoReady.set(true)"
                  (error)="videoOn.set(false)"
                ></video>
              </div>
              <!-- Escurecimento. Celular: por igual, o formulário ocupa a tela toda. Computador: forte onde tem
                   texto e na direita, mais leve no meio. -->
              <div
                class="absolute inset-0 bg-background/60 lg:bg-transparent lg:bg-gradient-to-r lg:from-background/92 lg:via-background/40 lg:to-background/70"
              ></div>
              <div class="absolute inset-0 bg-gradient-to-t from-background/95 via-transparent to-background/50"></div>
              <div class="login-spot absolute inset-0" [style.--mx]="spotX()" [style.--my]="spotY()"></div>
            </div>
          }

          <!-- Painel da marca (só no computador) -->
          <section class="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-16">
            @if (!videoOn()) {
              <div
                class="lure-aurora lure-aurora-a"
                style="width: 520px; height: 520px; top: -12%; left: -10%; background: rgba(187, 154, 53, 0.2)"
              ></div>
              <div
                class="lure-aurora lure-aurora-b"
                style="width: 420px; height: 420px; bottom: -14%; right: -8%; background: rgba(212, 184, 92, 0.14)"
              ></div>
            }

            <div class="lure-rise relative flex items-center gap-3" style="--d: 40ms">
              <img src="/lure-logo-large.png" alt="" class="h-11 w-11 rounded-full object-contain" />
              <div class="leading-tight">
                <div class="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Assessoria</div>
                <div class="font-display text-base font-bold tracking-[0.18em]">LURE</div>
              </div>
            </div>

            <div class="relative max-w-xl drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]">
              <div class="lure-rise flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary" style="--d: 120ms">
                <span class="h-px w-8 bg-primary/70"></span> Área de membros
              </div>
              <h2 class="lure-rise mt-5 font-display text-[40px] font-semibold leading-[1.05] tracking-tight xl:text-5xl" style="--d: 180ms">
                Continue de onde<br />
                <span class="bg-gradient-to-r from-primary via-[#e8cf86] to-[#f7ecc8] bg-clip-text text-transparent">você parou.</span>
              </h2>
              <p class="lure-rise mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground" style="--d: 240ms">
                A plataforma oficial da agência que já rodou +R$100M em mídia. Trilhas guiadas, mentorias ao vivo e a
                comunidade que cresce junto com você.
              </p>
              <ul class="mt-10 space-y-4">
                @for (h of highlights; track h.text; let i = $index) {
                  <li class="lure-rise flex items-center gap-3.5" [style.--d]="300 + i * 70 + 'ms'">
                    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                      <app-icon [name]="h.icon" class="h-[18px] w-[18px]" />
                    </span>
                    <span class="text-[15px] text-foreground/90">{{ h.text }}</span>
                  </li>
                }
              </ul>
            </div>

            <p class="lure-rise relative text-xs text-muted-foreground/70" style="--d: 560ms">
              Acesso exclusivo para alunos e clientes da Assessoria Lure.
            </p>
          </section>

          <!-- Formulário -->
          <section class="relative flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
            @if (!videoOn()) {
              <div
                class="lure-aurora lure-aurora-a lg:hidden"
                style="width: 380px; height: 380px; top: -10%; right: -14%; background: rgba(187, 154, 53, 0.16)"
              ></div>
            }

            <!-- Cartão de vidro por cima do vídeo -->
            <div
              class="lure-rise relative w-full max-w-[420px] overflow-hidden rounded-[28px] max-lg:border-0 max-lg:bg-transparent max-lg:p-0 max-lg:shadow-none max-lg:backdrop-blur-none lg:border lg:border-white/12 lg:bg-background/35 lg:p-9 lg:shadow-[0_40px_90px_-45px_rgba(0,0,0,0.95)] lg:backdrop-blur-2xl"
              style="--d: 100ms"
            >
              <div class="lure-hairline pointer-events-none absolute inset-x-0 top-0 hidden h-px lg:block" aria-hidden="true"></div>
              <div class="lure-rise mb-8 flex flex-col items-center gap-3 text-center lg:hidden" style="--d: 40ms">
                <img src="/lure-logo-large.png" alt="LURE" class="h-14 w-14 rounded-full object-contain" />
                <div class="leading-tight">
                  <div class="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Assessoria</div>
                  <div class="font-display text-lg font-bold tracking-[0.18em]">LURE</div>
                </div>
              </div>

              @if (mode() === 'login') {
                <h1 class="lure-rise font-display text-[32px] font-semibold leading-tight tracking-tight" style="--d: 220ms">
                  Bem-vindo de volta
                </h1>
                <p class="lure-rise mt-2 text-[15px] text-muted-foreground" style="--d: 280ms">
                  Entre para continuar seus estudos.
                </p>

                <form class="mt-9 space-y-4" (submit)="submit($event)">
                  <div class="lure-rise" style="--d: 340ms">
                    <label for="login-email" class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      E-mail
                    </label>
                    <div class="group relative">
                      <app-icon
                        name="mail"
                        class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
                      />
                      <input
                        id="login-email"
                        type="email"
                        autocomplete="email"
                        required
                        [value]="email()"
                        (input)="email.set($any($event.target).value)"
                        placeholder="voce@email.com"
                        class="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-3 text-[15px] outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-primary/10"
                      />
                    </div>
                  </div>

                  <div class="lure-rise" style="--d: 400ms">
                    <label for="login-password" class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Senha
                    </label>
                    <div class="group relative">
                      <app-icon
                        name="lock"
                        class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
                      />
                      <input
                        id="login-password"
                        [type]="showPassword() ? 'text' : 'password'"
                        autocomplete="current-password"
                        required
                        [value]="password()"
                        (input)="password.set($any($event.target).value)"
                        placeholder="••••••••"
                        class="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-11 text-[15px] outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-primary/10"
                      />
                      <button
                        type="button"
                        (click)="showPassword.set(!showPassword())"
                        class="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                        [attr.aria-label]="showPassword() ? 'Ocultar senha' : 'Mostrar senha'"
                      >
                        <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" class="h-[18px] w-[18px]" />
                      </button>
                    </div>
                  </div>

                  <div class="lure-rise flex items-center justify-between pt-0.5" style="--d: 440ms">
                    <label class="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
                      <input
                        type="checkbox"
                        class="peer sr-only"
                        [checked]="remember()"
                        (change)="remember.set($any($event.target).checked)"
                      />
                      <span
                        class="grid h-[18px] w-[18px] place-items-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50"
                        [class]="remember() ? 'border-primary bg-primary text-primary-foreground' : 'border-white/20 bg-white/[0.04]'"
                      >
                        @if (remember()) {
                          <app-icon name="check" class="h-3 w-3" [strokeWidth]="3" />
                        }
                      </span>
                      Manter-me conectado
                    </label>
                    <button
                      type="button"
                      (click)="openForgot()"
                      class="text-sm font-medium text-primary/90 underline-offset-4 transition hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>

                  @if (error()) {
                    <div
                      class="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-red-300"
                      role="alert"
                    >
                      <span class="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-destructive/30 text-[10px] font-bold">!</span>
                      <span>{{ error() }}</span>
                    </div>
                  }

                  <button
                    type="submit"
                    [disabled]="loading()"
                    class="lure-rise group relative mt-1 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl gradient-gold px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-all hover:shadow-[0_0_50px_-6px_rgba(187,154,53,0.55)] hover:brightness-110 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70"
                    style="--d: 460ms"
                  >
                    <span
                      class="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                    ></span>
                    @if (loading()) {
                      <app-spinner /> Entrando…
                    } @else {
                      Entrar
                      <app-icon name="arrow-right" class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    }
                  </button>

                  @if (passkeyAvailable()) {
                    <div class="lure-rise flex items-center gap-3 py-1" style="--d: 480ms" aria-hidden="true">
                      <span class="h-px flex-1 bg-white/10"></span>
                      <span class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">ou</span>
                      <span class="h-px flex-1 bg-white/10"></span>
                    </div>
                    <button
                      type="button"
                      (click)="loginWithFaceId()"
                      [disabled]="loading() || passkeyLoading()"
                      class="lure-rise inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3.5 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
                      style="--d: 500ms"
                    >
                      @if (passkeyLoading()) {
                        <app-spinner /> Aguardando o rosto…
                      } @else {
                        <app-icon name="scan-face" class="h-[18px] w-[18px]" /> Entrar com Face ID
                      }
                    </button>
                  }
                </form>

                <p class="lure-rise mt-7 text-center text-sm text-muted-foreground" style="--d: 520ms">
                  Não tem acesso?
                  <a
                    [href]="noAccessLink"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-semibold text-primary underline-offset-4 transition hover:underline"
                  >
                    Fale com o administrador
                  </a>
                </p>
              } @else {
                <button
                  type="button"
                  (click)="backToLogin()"
                  class="lure-rise inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  <app-icon name="arrow-left" class="h-4 w-4" /> Voltar para o login
                </button>
                <h1 class="lure-rise mt-5 font-display text-3xl font-bold tracking-tight" style="--d: 60ms">Redefinir senha</h1>
                @if (!forgotSent()) {
                  <p class="lure-rise mt-2 text-sm text-muted-foreground" style="--d: 120ms">
                    Informe seu e-mail. Se ele estiver cadastrado, enviaremos um link para você criar uma nova senha.
                  </p>
                  <form class="mt-8 space-y-4" (submit)="sendForgot($event)">
                    <div class="lure-rise" style="--d: 180ms">
                      <label for="forgot-email" class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        E-mail
                      </label>
                      <div class="group relative">
                        <app-icon
                          name="mail"
                          class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
                        />
                        <input
                          id="forgot-email"
                          type="email"
                          autocomplete="email"
                          required
                          [value]="email()"
                          (input)="email.set($any($event.target).value)"
                          placeholder="voce@email.com"
                          class="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-3 text-[15px] outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-white/[0.06] focus:ring-4 focus:ring-primary/10"
                        />
                      </div>
                    </div>
                    @if (forgotError()) {
                      <div class="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-red-300" role="alert">
                        {{ forgotError() }}
                      </div>
                    }
                    <button
                      type="submit"
                      [disabled]="forgotLoading()"
                      class="lure-rise inline-flex w-full items-center justify-center gap-2 rounded-2xl gradient-gold px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110 disabled:opacity-70"
                      style="--d: 240ms"
                    >
                      @if (forgotLoading()) {
                        <app-spinner /> Enviando…
                      } @else {
                        <app-icon name="send" class="h-4 w-4" /> Enviar link
                      }
                    </button>
                  </form>
                } @else {
                  <div class="lure-rise mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-300" role="status">
                    <app-icon name="circle-check" class="mt-0.5 h-5 w-5 shrink-0" />
                    <p class="leading-relaxed">
                      Se esse e-mail estiver cadastrado, você vai receber em instantes um link para redefinir a senha.
                      O link vale por 1 hora — confira também a caixa de spam.
                    </p>
                  </div>
                }
                <p class="lure-rise mt-7 text-center text-sm text-muted-foreground" style="--d: 300ms">
                  Não recebeu?
                  <a
                    [href]="forgotLink"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-semibold text-primary underline-offset-4 transition hover:underline"
                  >
                    Fale com o administrador
                  </a>
                </p>
              }
            </div>
          </section>
        </main>
      }

      @if (!splashGone()) {
        <div
          class="lure-grain absolute inset-0 z-50 grid place-items-center bg-background"
          [class]="phase() === 'app' ? 'lure-splash-out pointer-events-none' : ''"
          aria-hidden="true"
        >
          <div
            class="lure-aurora lure-aurora-a"
            style="width: 460px; height: 460px; top: 14%; left: 50%; margin-left: -230px; background: rgba(187, 154, 53, 0.16)"
          ></div>
          <div class="relative flex flex-col items-center">
            <div class="relative grid place-items-center">
              <div
                class="lure-bloom absolute h-56 w-56 rounded-full"
                style="background: radial-gradient(circle, rgba(212, 184, 92, 0.55), transparent 65%); filter: blur(18px)"
              ></div>
              <div class="lure-ring-pulse absolute h-28 w-28 rounded-full border border-primary/40"></div>
              <img src="/lure-logo-large.png" alt="" class="lure-logo-in relative h-24 w-24 rounded-full object-contain" />
            </div>
            <div class="lure-track-in mt-7 font-display text-3xl font-bold text-white" style="letter-spacing: 0.2em">LURE</div>
            <div class="lure-line-draw lure-hairline mt-3 h-px"></div>
            <div class="lure-rise mt-3 text-[11px] uppercase tracking-[0.42em] text-white/55" style="--d: 1100ms">Assessoria</div>
          </div>
        </div>
      }
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly noAccessLink = WHATSAPP_NO_ACCESS;
  protected readonly forgotLink = WHATSAPP_FORGOT;

  /** Versão do vídeo conforme a tela: deitada no computador, em pé no celular. */
  protected readonly videoSrc = signal(LOGIN_VIDEO);
  /** Desligado com "reduzir movimento" ou no modo de economia de dados. */
  protected readonly videoOn = signal(false);
  protected readonly videoReady = signal(false);
  /** Posição do brilho que acompanha o mouse. */
  protected readonly spotX = signal('50%');
  protected readonly spotY = signal('40%');

  /** O que o aluno encontra lá dentro (painel da esquerda, no computador). */
  protected readonly highlights = [
    { icon: 'play', text: 'Trilhas guiadas, do básico ao avançado' },
    { icon: 'users', text: 'Comunidade para trocar ideia com a rede' },
    { icon: 'award', text: 'Certificado a cada módulo concluído' },
  ];

  private readonly splashSeen = safeGet('session', SPLASH_KEY) === '1';
  protected readonly phase = signal<'intro' | 'app'>(this.splashSeen ? 'app' : 'intro');
  protected readonly splashGone = signal(this.splashSeen);

  protected readonly mode = signal<'login' | 'forgot'>('login');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly remember = signal(true);
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly passkeyAvailable = signal(false);
  protected readonly passkeyLoading = signal(false);

  protected readonly forgotLoading = signal(false);
  protected readonly forgotSent = signal(false);
  protected readonly forgotError = signal<string | null>(null);

  constructor() {
    void passkeySupported().then((ok) => this.passkeyAvailable.set(ok));
    this.setupBackgroundVideo();
    if (!this.splashSeen) {
      safeSet('session', SPLASH_KEY, '1');
      const t1 = setTimeout(() => this.phase.set('app'), 2300);
      const t2 = setTimeout(() => this.splashGone.set(true), 3050);
      inject(DestroyRef).onDestroy(() => {
        clearTimeout(t1);
        clearTimeout(t2);
      });
    }
  }

  private spotQueued = false;

  /** Uma atualização por quadro, para o brilho não pesar no mouse. */
  protected onPointer(e: PointerEvent): void {
    if (!this.videoOn() || e.pointerType === 'touch' || this.spotQueued) return;
    this.spotQueued = true;
    const { clientX, clientY } = e;
    requestAnimationFrame(() => {
      this.spotQueued = false;
      this.spotX.set(`${Math.round((clientX / innerWidth) * 100)}%`);
      this.spotY.set(`${Math.round((clientY / innerHeight) * 100)}%`);
    });
  }

  /** O Angular não aplica o atributo "muted" estático, e sem ele o navegador bloqueia o autoplay. */
  protected playBackground(e: Event): void {
    const v = e.target as HTMLVideoElement;
    v.muted = true;
    void v.play().catch(() => undefined);
  }

  /** Carrega o vídeo depois da tela pintar, e nunca com dados limitados ou movimento reduzido. */
  private setupBackgroundVideo(): void {
    const wide = matchMedia('(min-width: 1024px)');
    const calm = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (!calm || saveData) return;
    const pick = () => this.videoSrc.set(wide.matches ? LOGIN_VIDEO : LOGIN_VIDEO_MOBILE);
    pick();
    const timer = setTimeout(() => this.videoOn.set(true), 400);
    const onResize = () => {
      this.videoReady.set(false);
      pick();
    };
    wide.addEventListener('change', onResize);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      wide.removeEventListener('change', onResize);
    });
  }

  protected submit(e: Event): void {
    e.preventDefault();
    if (this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    this.auth
      .login({ email: this.email().trim(), password: this.password(), rememberMe: this.remember() })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.goNext();
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(apiMessage(err, 'Não foi possível entrar. Tente de novo.'));
        },
      });
  }

  protected loginWithFaceId(): void {
    if (this.passkeyLoading()) return;
    this.error.set(null);
    this.passkeyLoading.set(true);
    this.auth.loginWithPasskey(this.remember()).subscribe({
      next: () => {
        this.passkeyLoading.set(false);
        this.goNext();
      },
      error: (err) => {
        this.passkeyLoading.set(false);
        this.error.set(passkeyErrorMessage(err) ?? apiMessage(err, 'Não foi possível entrar com Face ID.'));
      },
    });
  }

  private goNext(): void {
    const next = this.route.snapshot.queryParamMap.get('next');
    const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }

  protected openForgot(): void {
    this.mode.set('forgot');
    this.forgotSent.set(false);
    this.forgotError.set(null);
  }

  protected backToLogin(): void {
    this.mode.set('login');
    this.error.set(null);
  }

  protected sendForgot(e: Event): void {
    e.preventDefault();
    if (this.forgotLoading()) return;
    this.forgotError.set(null);
    this.forgotLoading.set(true);
    this.auth.forgotPassword(this.email().trim()).subscribe({
      next: () => {
        this.forgotLoading.set(false);
        this.forgotSent.set(true);
      },
      error: (err) => {
        this.forgotLoading.set(false);
        // 204 sempre para e-mails válidos; só mostra erro de validação/limite/conexão.
        this.forgotError.set(apiMessage(err, 'Não foi possível enviar agora. Tente de novo.'));
      },
    });
  }
}
