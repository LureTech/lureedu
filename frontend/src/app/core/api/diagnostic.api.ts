import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DiagnosticResultDto, DiagnosticSubmissionSummary, PillarDto } from '../models';

@Injectable({ providedIn: 'root' })
export class DiagnosticApi {
  private readonly http = inject(HttpClient);

  pillars(): Observable<PillarDto[]> {
    return this.http.get<PillarDto[]>('/api/diagnostic/pillars');
  }

  submit(answers: Record<string, number>): Observable<DiagnosticResultDto> {
    return this.http.post<DiagnosticResultDto>('/api/diagnostic/submissions', { answers });
  }

  history(): Observable<DiagnosticSubmissionSummary[]> {
    return this.http.get<DiagnosticSubmissionSummary[]>('/api/diagnostic/submissions');
  }

  /** 204 (nunca fez) → null */
  latest(): Observable<DiagnosticResultDto | null> {
    return this.http
      .get<DiagnosticResultDto>('/api/diagnostic/submissions/latest', { observe: 'response' })
      .pipe(map((res) => (res.status === 204 || !res.body ? null : res.body)));
  }

  submission(id: string): Observable<DiagnosticResultDto> {
    return this.http.get<DiagnosticResultDto>(`/api/diagnostic/submissions/${id}`);
  }
}
