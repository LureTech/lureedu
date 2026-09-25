import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminCreateUserRequest,
  AdminModuleDetailDto,
  AdminModuleDto,
  AdminQuizQuestionDto,
  AdminStatsDto,
  AdminUpdateUserRequest,
  LessonDto,
  LessonInput,
  MaterialDto,
  ModuleInput,
  ModuleUpdateInput,
  QuizQuestionInput,
  SectionCreateRequest,
  SectionDto,
  SectionUpdateRequest,
  UserDto,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  // ------------------------------------------------ visão geral e contas
  stats(): Observable<AdminStatsDto> {
    return this.http.get<AdminStatsDto>('/api/admin/stats');
  }

  users(q?: string): Observable<UserDto[]> {
    const params = q?.trim() ? new HttpParams().set('q', q.trim()) : undefined;
    return this.http.get<UserDto[]>('/api/admin/users', { params });
  }

  createUser(body: AdminCreateUserRequest): Observable<UserDto> {
    return this.http.post<UserDto>('/api/admin/users', body);
  }

  uploadUserAvatar(id: string, file: File): Observable<UserDto> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<UserDto>(`/api/admin/users/${id}/avatar`, fd);
  }

  updateUser(id: string, body: AdminUpdateUserRequest): Observable<UserDto> {
    return this.http.patch<UserDto>(`/api/admin/users/${id}`, body);
  }

  resetUserPassword(id: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`/api/admin/users/${id}/reset-password`, { newPassword });
  }

  // ------------------------------------------------ seções
  createSection(body: SectionCreateRequest): Observable<SectionDto> {
    return this.http.post<SectionDto>('/api/admin/sections', body);
  }

  updateSection(id: string, body: SectionUpdateRequest): Observable<SectionDto> {
    return this.http.put<SectionDto>(`/api/admin/sections/${encodeURIComponent(id)}`, body);
  }

  deleteSection(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/sections/${encodeURIComponent(id)}`);
  }

  // ------------------------------------------------ módulos
  modules(): Observable<AdminModuleDto[]> {
    return this.http.get<AdminModuleDto[]>('/api/admin/modules');
  }

  module(id: string): Observable<AdminModuleDetailDto> {
    return this.http.get<AdminModuleDetailDto>(`/api/admin/modules/${id}`);
  }

  createModule(body: ModuleInput): Observable<AdminModuleDto> {
    return this.http.post<AdminModuleDto>('/api/admin/modules', body);
  }

  updateModule(id: string, body: ModuleUpdateInput): Observable<AdminModuleDto> {
    return this.http.put<AdminModuleDto>(`/api/admin/modules/${id}`, body);
  }

  setModuleLock(id: string, locked: boolean): Observable<AdminModuleDto> {
    return this.http.patch<AdminModuleDto>(`/api/admin/modules/${id}/lock`, { locked });
  }

  uploadCover(id: string, file: File): Observable<AdminModuleDto> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<AdminModuleDto>(`/api/admin/modules/${id}/cover`, fd);
  }

  removeCover(id: string): Observable<AdminModuleDto> {
    return this.http.delete<AdminModuleDto>(`/api/admin/modules/${id}/cover`);
  }

  deleteModule(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/modules/${id}`);
  }

  // ------------------------------------------------ aulas, materiais e prova
  createLesson(moduleId: string, body: LessonInput): Observable<LessonDto> {
    return this.http.post<LessonDto>(`/api/admin/modules/${moduleId}/lessons`, body);
  }

  updateLesson(id: string, body: LessonInput): Observable<LessonDto> {
    return this.http.put<LessonDto>(`/api/admin/lessons/${id}`, body);
  }

  deleteLesson(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/lessons/${id}`);
  }

  reorderLessons(moduleId: string, lessonIds: string[]): Observable<void> {
    return this.http.put<void>(`/api/admin/modules/${moduleId}/lessons/order`, { lessonIds });
  }

  /** Upload com eventos de progresso. */
  uploadMaterial(lessonId: string, file: File, label?: string): Observable<HttpEvent<MaterialDto>> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    if (label?.trim()) fd.append('label', label.trim());
    return this.http.post<MaterialDto>(`/api/admin/lessons/${lessonId}/materials`, fd, {
      reportProgress: true,
      observe: 'events',
    });
  }

  deleteMaterial(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/materials/${id}`);
  }

  saveQuiz(moduleId: string, questions: QuizQuestionInput[]): Observable<AdminQuizQuestionDto[]> {
    return this.http.put<AdminQuizQuestionDto[]>(`/api/admin/modules/${moduleId}/quiz`, { questions });
  }
}
