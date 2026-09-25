import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const APP_TITLE = 'AssessoriaLure — Área de Membros';

/** "Página — AssessoriaLure"; sem título → "AssessoriaLure — Área de Membros". */
@Injectable({ providedIn: 'root' })
export class LureTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const t = this.buildTitle(snapshot);
    this.title.setTitle(t ? `${t} — AssessoriaLure` : APP_TITLE);
  }
}
