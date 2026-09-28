import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { WHATSAPP_SUPPORT } from '../core/ui.service';

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  to?: string;
  query?: Record<string, string>;
  href?: string;
  action?: 'profile';
}

export const MENU_ITEMS: NavItem[] = [
  { key: 'home', label: 'Início', icon: 'ph-house-simple', to: '/' },
  { key: 'courses', label: 'Meus cursos', icon: 'ph-book-open-text', to: '/meus-cursos', query: { tab: 'andamento' } },
  { key: 'certs', label: 'Certificados', icon: 'ph-certificate', to: '/meus-cursos', query: { tab: 'certificados' } },
  { key: 'community', label: 'Comunidade', icon: 'ph-users-three', to: '/comunidade' },
];

export const GENERAL_ITEMS: NavItem[] = [
  { key: 'support', label: 'Suporte', icon: 'ph-headset', href: WHATSAPP_SUPPORT },
  { key: 'settings', label: 'Configurações', icon: 'ph-gear-six', action: 'profile' },
];

export const ADMIN_ITEMS: NavItem[] = [
  { key: 'accounts', label: 'Contas', icon: 'ph-shield-star', to: '/admin' },
  { key: 'modules', label: 'Módulos', icon: 'layout-grid', to: '/admin/modulos' },
];

export interface UrlState {
  path: string;
  tab: string | null;
}

export function parseUrl(url: string): UrlState {
  const [pathAndQuery] = url.split('#');
  const [path, query] = pathAndQuery.split('?');
  const tab = query ? new URLSearchParams(query).get('tab') : null;
  return { path: path || '/', tab };
}

/** URL atual como signal (atualiza a cada NavigationEnd). */
export function injectUrlState(): Signal<UrlState> {
  const router = inject(Router);
  const url = toSignal(
    router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: router.url },
  );
  return computed(() => parseUrl(url()));
}

/** Item ativo a partir da URL (o original tinha isso fixo no código). */
export function isNavActive(key: string, s: UrlState): boolean {
  const p = s.path;
  switch (key) {
    case 'home':
      return p === '/' || p.startsWith('/secao/');
    case 'courses':
      return p.startsWith('/meus-cursos') && s.tab !== 'certificados';
    case 'certs':
      return p.startsWith('/meus-cursos') && s.tab === 'certificados';
    case 'community':
      return p.startsWith('/comunidade');
    case 'accounts':
      return p === '/admin';
    case 'modules':
      return p.startsWith('/admin/modulos');
    default:
      return false;
  }
}

/** Ícones phosphor ganham peso "duotone"/"fill" quando ativos. */
export function navIcon(icon: string, active: boolean, weight: 'duotone' | 'fill' = 'duotone'): string {
  return active && icon.startsWith('ph-') ? `${icon}-${weight}` : icon;
}
