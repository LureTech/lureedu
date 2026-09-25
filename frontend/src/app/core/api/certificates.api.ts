import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CertificateDto } from '../models';

@Injectable({ providedIn: 'root' })
export class CertificatesApi {
  private readonly http = inject(HttpClient);

  mine(): Observable<CertificateDto[]> {
    return this.http.get<CertificateDto[]>('/api/certificates');
  }

  /** Público — página de verificação. */
  verify(code: string): Observable<CertificateDto> {
    return this.http.get<CertificateDto>(`/api/public/certificates/${encodeURIComponent(code)}`);
  }
}
