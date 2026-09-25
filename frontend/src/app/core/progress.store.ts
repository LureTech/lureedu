import { Injectable, inject, signal } from '@angular/core';
import { CatalogApi } from './api/catalog.api';
import { ProgressSummaryDto } from './models';

/** Resumo de progresso compartilhado (pílula do topo, Home, Meus cursos). */
@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly api = inject(CatalogApi);
  private inflight = false;
  private lastLoad = 0;

  readonly summary = signal<ProgressSummaryDto | null>(null);
  readonly error = signal(false);

  /** Recarrega (ignora chamadas repetidas em menos de `minGapMs`). */
  refresh(minGapMs = 1500): void {
    const now = Date.now();
    if (this.inflight || now - this.lastLoad < minGapMs) return;
    this.inflight = true;
    this.lastLoad = now;
    this.api.progressSummary().subscribe({
      next: (s) => {
        this.summary.set(s);
        this.error.set(false);
        this.inflight = false;
      },
      error: () => {
        this.error.set(true);
        this.inflight = false;
      },
    });
  }

  reset(): void {
    this.summary.set(null);
    this.lastLoad = 0;
  }
}
