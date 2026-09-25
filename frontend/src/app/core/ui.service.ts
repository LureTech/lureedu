import { Injectable, signal } from '@angular/core';
import { CertificateDto } from './models';

export const WHATSAPP_SUPPORT =
  'https://wa.me/5585991112424?text=Ol%C3%A1%2C%20estou%20na%20%C3%81rea%20de%20Membros%20e%20preciso%20de%20ajuda';
export const WHATSAPP_LESSON_HELP =
  'https://wa.me/5585991112424?text=Ol%C3%A1%2C%20estou%20assistindo%20uma%20aula%20e%20preciso%20de%20ajuda';
export const WHATSAPP_NO_ACCESS =
  'https://wa.me/5585991112424?text=Ol%C3%A1!%20N%C3%A3o%20tenho%20acesso%20%C3%A0%20%C3%81rea%20de%20Membros%20da%20Lure%20Digital%20e%20gostaria%20de%20solicitar%20meu%20login.';
export const WHATSAPP_FORGOT =
  'https://wa.me/5585991112424?text=Ol%C3%A1!%20Esqueci%20minha%20senha%20da%20%C3%81rea%20de%20Membros%20da%20Lure%20Digital%20e%20preciso%20redefinir%20o%20acesso.';

/** Estado de UI global: modais, drawer e celebração de certificado. */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly profileOpen = signal(false);
  readonly benefitsOpen = signal(false);
  readonly drawerOpen = signal(false);
  readonly mobileSearchOpen = signal(false);
  /** Certificado recém-emitido → modal de comemoração. */
  readonly celebrate = signal<CertificateDto | null>(null);

  openProfile(): void {
    this.drawerOpen.set(false);
    this.profileOpen.set(true);
  }

  closeProfile(): void {
    this.profileOpen.set(false);
  }

  celebrateCertificate(c: CertificateDto | null | undefined): void {
    if (c) this.celebrate.set(c);
  }
}
