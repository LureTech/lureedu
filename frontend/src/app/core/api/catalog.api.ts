import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CatalogSectionDto, ProgressSummaryDto, SearchResultDto, SectionDto } from '../models';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);

  catalog(): Observable<CatalogSectionDto[]> {
    return this.http.get<CatalogSectionDto[]>('/api/catalog');
  }

  sections(): Observable<SectionDto[]> {
    return this.http.get<SectionDto[]>('/api/sections');
  }

  section(id: string): Observable<CatalogSectionDto> {
    return this.http.get<CatalogSectionDto>(`/api/sections/${encodeURIComponent(id)}`);
  }

  progressSummary(): Observable<ProgressSummaryDto> {
    return this.http.get<ProgressSummaryDto>('/api/progress/summary');
  }

  search(q: string): Observable<SearchResultDto> {
    return this.http.get<SearchResultDto>('/api/search', { params: new HttpParams().set('q', q) });
  }
}
