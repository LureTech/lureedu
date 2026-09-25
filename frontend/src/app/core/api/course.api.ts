import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CommentDto,
  ModuleDetailDto,
  ProgressUpdateDto,
  ProgressUpdateRequest,
  QuizDto,
  QuizResultDto,
} from '../models';

@Injectable({ providedIn: 'root' })
export class CourseApi {
  private readonly http = inject(HttpClient);

  module(slug: string): Observable<ModuleDetailDto> {
    return this.http.get<ModuleDetailDto>(`/api/modules/${encodeURIComponent(slug)}`);
  }

  updateProgress(lessonId: string, body: ProgressUpdateRequest): Observable<ProgressUpdateDto> {
    return this.http.put<ProgressUpdateDto>(`/api/lessons/${lessonId}/progress`, body);
  }

  reportDuration(lessonId: string, durationSeconds: number): Observable<void> {
    return this.http.post<void>(`/api/lessons/${lessonId}/duration`, { durationSeconds });
  }

  comments(slug: string): Observable<CommentDto[]> {
    return this.http.get<CommentDto[]>(`/api/modules/${encodeURIComponent(slug)}/comments`);
  }

  addComment(slug: string, body: string): Observable<CommentDto> {
    return this.http.post<CommentDto>(`/api/modules/${encodeURIComponent(slug)}/comments`, { body });
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`/api/module-comments/${id}`);
  }

  quiz(slug: string): Observable<QuizDto> {
    return this.http.get<QuizDto>(`/api/modules/${encodeURIComponent(slug)}/quiz`);
  }

  submitQuiz(slug: string, answers: Record<string, number>): Observable<QuizResultDto> {
    return this.http.post<QuizResultDto>(`/api/modules/${encodeURIComponent(slug)}/quiz/attempts`, {
      answers,
    });
  }
}
