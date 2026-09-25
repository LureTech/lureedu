import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { NotificationPrefsDto, UserDto } from '../models';

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);

  update(fullName: string): Observable<UserDto> {
    return this.http.put<UserDto>('/api/me', { fullName });
  }

  uploadAvatar(file: File): Observable<UserDto> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<UserDto>('/api/me/avatar', fd);
  }

  removeAvatar(): Observable<UserDto> {
    return this.http.delete<UserDto>('/api/me/avatar');
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>('/api/me/password', { currentPassword, newPassword });
  }

  notificationPrefs(): Observable<NotificationPrefsDto> {
    return this.http.get<NotificationPrefsDto>('/api/me/notification-prefs');
  }

  saveNotificationPrefs(prefs: NotificationPrefsDto): Observable<NotificationPrefsDto> {
    return this.http.put<NotificationPrefsDto>('/api/me/notification-prefs', prefs);
  }
}
