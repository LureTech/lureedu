import { Injectable, inject, signal } from '@angular/core';
import { CatalogApi } from './api/catalog.api';
import { apiMessage } from './api-error';
import { CatalogSectionDto } from './models';

/** Tempo que o catálogo em memória é considerado atual; depois disso, revalida em segundo plano. */
const FRESH_MS = 60_000;

/**
 * Catálogo compartilhado (Home e seções).
 * <p>
 * Guarda o que já veio do servidor: ao voltar para a Home, a tela aparece na hora com o catálogo
 * anterior e a atualização acontece por baixo — sem esqueleto de carregamento piscando a cada
 * navegação. O esqueleto só aparece na primeira carga, quando ainda não há nada em memória.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly api = inject(CatalogApi);
  private inflight = false;
  private lastLoad = 0;

  readonly sections = signal<CatalogSectionDto[]>([]);
  /** Já houve uma carga bem-sucedida (mesmo que o catálogo esteja vazio). */
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  /** Carrega do servidor. Com dados recentes em memória, não faz nada (use `force` para insistir). */
  load(force = false): void {
    if (this.inflight) return;
    if (!force && this.loaded() && Date.now() - this.lastLoad < FRESH_MS) return;
    this.inflight = true;
    if (!this.loaded()) this.error.set(null);
    this.api.catalog().subscribe({
      next: (list) => {
        this.sections.set(list.filter((s) => s.modules.length > 0));
        this.loaded.set(true);
        this.error.set(null);
        this.lastLoad = Date.now();
        this.inflight = false;
      },
      error: (err) => {
        // Com catálogo na tela, uma falha de revalidação é silenciosa: o aluno continua vendo os módulos.
        if (!this.loaded()) this.error.set(apiMessage(err));
        this.inflight = false;
      },
    });
  }

  /** Reflete na hora o cadeado que o admin acabou de trocar, sem recarregar o catálogo. */
  setLocked(moduleId: string, locked: boolean): void {
    this.sections.update((list) =>
      list.map((s) => ({
        ...s,
        modules: s.modules.map((m) => (m.id === moduleId ? { ...m, locked } : m)),
      })),
    );
  }

  reset(): void {
    this.sections.set([]);
    this.loaded.set(false);
    this.error.set(null);
    this.lastLoad = 0;
  }
}
