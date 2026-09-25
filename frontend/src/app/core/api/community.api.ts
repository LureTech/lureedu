import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Category, CommentDto, CommunityStatsDto, FeedSort, LikeResponse, NewPostsResponse, PostDto } from '../models';

export interface FeedQuery {
  sort?: FeedSort;
  category?: Category | null;
  /** hashtag exata, sem "#" */
  tag?: string | null;
  /** busca no texto e no nome do autor */
  q?: string | null;
  /** só posts sem comentários */
  unanswered?: boolean;
  /** cursor do modo "recent" */
  before?: string | null;
  /** paginação do modo "hot" */
  offset?: number;
  limit?: number;
}

export interface NewPostInput {
  body: string;
  category: Category;
  image?: File | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

@Injectable({ providedIn: 'root' })
export class CommunityApi {
  private readonly http = inject(HttpClient);

  posts(opts: FeedQuery): Observable<PostDto[]> {
    let params = new HttpParams().set('limit', String(opts.limit ?? 20));
    if (opts.sort) params = params.set('sort', opts.sort);
    if (opts.category) params = params.set('category', opts.category);
    if (opts.tag) params = params.set('tag', opts.tag);
    if (opts.q) params = params.set('q', opts.q);
    if (opts.unanswered) params = params.set('unanswered', 'true');
    if (opts.before) params = params.set('before', opts.before);
    if (opts.offset) params = params.set('offset', String(opts.offset));
    return this.http.get<PostDto[]>('/api/community/posts', { params });
  }

  post(id: string): Observable<PostDto> {
    return this.http.get<PostDto>(`/api/community/posts/${id}`);
  }

  newCount(since: string, category?: Category | null): Observable<NewPostsResponse> {
    let params = new HttpParams().set('since', since);
    if (category) params = params.set('category', category);
    return this.http.get<NewPostsResponse>('/api/community/posts/new-count', { params });
  }

  create(input: NewPostInput): Observable<PostDto> {
    const fd = new FormData();
    fd.append('body', input.body);
    fd.append('category', input.category);
    if (input.image) {
      fd.append('image', input.image, input.image.name);
      if (input.imageWidth) fd.append('imageWidth', String(input.imageWidth));
      if (input.imageHeight) fd.append('imageHeight', String(input.imageHeight));
    }
    return this.http.post<PostDto>('/api/community/posts', fd);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/community/posts/${id}`);
  }

  like(id: string): Observable<LikeResponse> {
    return this.http.post<LikeResponse>(`/api/community/posts/${id}/like`, {});
  }

  unlike(id: string): Observable<LikeResponse> {
    return this.http.delete<LikeResponse>(`/api/community/posts/${id}/like`);
  }

  comments(postId: string): Observable<CommentDto[]> {
    return this.http.get<CommentDto[]>(`/api/community/posts/${postId}/comments`);
  }

  addComment(postId: string, body: string): Observable<CommentDto> {
    return this.http.post<CommentDto>(`/api/community/posts/${postId}/comments`, { body });
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`/api/community/comments/${id}`);
  }

  stats(): Observable<CommunityStatsDto> {
    return this.http.get<CommunityStatsDto>('/api/community/stats');
  }
}
