import { Injectable, inject } from '@angular/core';
import { AdminApi } from './api/admin.api';
import { apiMessage } from './api-error';
import { ToastService } from './toast.service';

/** Trancar/liberar módulo com atualização otimista + rollback. */
@Injectable({ providedIn: 'root' })
export class ModuleLockService {
  private readonly admin = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly busy = new Set<string>();

  /**
   * @param apply aplica o estado localmente (chamado já com o novo valor e, em caso de erro, com o antigo)
   */
  toggle(moduleId: string, currentlyLocked: boolean, apply: (locked: boolean) => void): void {
    if (this.busy.has(moduleId)) return;
    const next = !currentlyLocked;
    this.busy.add(moduleId);
    apply(next);
    this.admin.setModuleLock(moduleId, next).subscribe({
      next: () => {
        this.busy.delete(moduleId);
        this.toast.success(next ? 'Módulo trancado — alunos veem “Em breve”.' : 'Módulo liberado para os alunos.');
      },
      error: (err) => {
        this.busy.delete(moduleId);
        apply(currentlyLocked);
        this.toast.error(apiMessage(err, 'Não foi possível alterar o módulo.'));
      },
    });
  }
}
