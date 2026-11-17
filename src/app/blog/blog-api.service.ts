import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../admin/auth.service';

export type BlogStatus = 'draft' | 'scheduled' | 'published';

/** True when the publish calendar day differs from the event date. */
export function postedDayDiffers(eventDate: string, publishedAt?: string | null): boolean {
  if (!publishedAt) return false;
  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return false;
  const pad = (n: number) => String(n).padStart(2, '0');
  const publishedDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return publishedDay !== String(eventDate || '').slice(0, 10);
}

export interface BlogImage {
  url: string;
  alt?: string;
  caption?: string;
  key?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: unknown;
  status?: BlogStatus;
  eventDate: string;
  publishedAt: string | null;
  scheduledFor?: string | null;
  updatedAt: string;
  createdAt?: string;
  coverImage: string | null;
  images: BlogImage[];
}

export interface BlogPostInput {
  title: string;
  eventDate: string;
  excerpt?: string;
  slug?: string;
  body?: unknown;
  coverImage?: string | null;
  images?: BlogImage[];
}

export type BlogRevisionAction =
  | 'create'
  | 'update'
  | 'publish'
  | 'unpublish'
  | 'schedule'
  | 'unschedule'
  | 'restore';

export interface BlogRevisionSummary {
  revisionId: string;
  postId: string;
  action: BlogRevisionAction;
  editedBy: string | null;
  createdAt: string;
  changedFields: string[];
  title: string;
  status: BlogStatus;
  eventDate: string;
}

export interface BlogRevision extends BlogRevisionSummary {
  excerpt: string;
  body: unknown;
  slug: string;
  coverImage: string | null;
  images: BlogImage[];
  publishedAt: string | null;
  scheduledFor: string | null;
}

@Injectable({ providedIn: 'root' })
export class BlogApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = environment.blogApiUrl;

  listPublished(): Observable<{ posts: BlogPost[] }> {
    return this.http.get<{ posts: BlogPost[] }>(`${this.baseUrl}/posts`);
  }

  getPublished(slug: string): Observable<{ post: BlogPost }> {
    return this.http.get<{ post: BlogPost }>(`${this.baseUrl}/posts/${encodeURIComponent(slug)}`);
  }

  listArchive(year: string, month?: string): Observable<{ posts: BlogPost[] }> {
    const path = month
      ? `${this.baseUrl}/archive/${year}/${month}`
      : `${this.baseUrl}/archive/${year}`;
    return this.http.get<{ posts: BlogPost[] }>(path);
  }

  adminMe(): Observable<{ email: string }> {
    return this.http.get<{ email: string }>(`${this.baseUrl}/admin/me`, {
      headers: this.authHeaders()
    });
  }

  adminList(): Observable<{ posts: BlogPost[] }> {
    return this.http.get<{ posts: BlogPost[] }>(`${this.baseUrl}/admin/posts`, {
      headers: this.authHeaders()
    });
  }

  adminGet(id: string): Observable<{ post: BlogPost }> {
    return this.http.get<{ post: BlogPost }>(`${this.baseUrl}/admin/posts/${id}`, {
      headers: this.authHeaders()
    });
  }

  createDraft(input: BlogPostInput): Observable<{ post: BlogPost }> {
    return this.http.post<{ post: BlogPost }>(`${this.baseUrl}/admin/posts`, input, {
      headers: this.authHeaders()
    });
  }

  updatePost(id: string, input: Partial<BlogPostInput>): Observable<{ post: BlogPost }> {
    return this.http.put<{ post: BlogPost }>(`${this.baseUrl}/admin/posts/${id}`, input, {
      headers: this.authHeaders()
    });
  }

  publish(id: string): Observable<{ post: BlogPost }> {
    return this.http.post<{ post: BlogPost }>(
      `${this.baseUrl}/admin/posts/${id}/publish`,
      {},
      { headers: this.authHeaders() }
    );
  }

  schedule(id: string, scheduledFor: string): Observable<{ post: BlogPost }> {
    return this.http.post<{ post: BlogPost }>(
      `${this.baseUrl}/admin/posts/${id}/schedule`,
      { scheduledFor },
      { headers: this.authHeaders() }
    );
  }

  unschedule(id: string): Observable<{ post: BlogPost }> {
    return this.http.post<{ post: BlogPost }>(
      `${this.baseUrl}/admin/posts/${id}/unschedule`,
      {},
      { headers: this.authHeaders() }
    );
  }

  unpublish(id: string): Observable<{ post: BlogPost }> {
    return this.http.post<{ post: BlogPost }>(
      `${this.baseUrl}/admin/posts/${id}/unpublish`,
      {},
      { headers: this.authHeaders() }
    );
  }

  deletePost(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/admin/posts/${id}`, {
      headers: this.authHeaders()
    });
  }

  listRevisions(id: string): Observable<{ revisions: BlogRevisionSummary[] }> {
    return this.http.get<{ revisions: BlogRevisionSummary[] }>(
      `${this.baseUrl}/admin/posts/${id}/revisions`,
      { headers: this.authHeaders() }
    );
  }

  getRevision(id: string, revisionId: string): Observable<{ revision: BlogRevision }> {
    return this.http.get<{ revision: BlogRevision }>(
      `${this.baseUrl}/admin/posts/${id}/revisions/${encodeURIComponent(revisionId)}`,
      { headers: this.authHeaders() }
    );
  }

  restoreRevision(id: string, revisionId: string): Observable<{ post: BlogPost }> {
    return this.http.post<{ post: BlogPost }>(
      `${this.baseUrl}/admin/posts/${id}/revisions/${encodeURIComponent(revisionId)}/restore`,
      {},
      { headers: this.authHeaders() }
    );
  }

  createUpload(contentType: string): Observable<{
    uploadUrl: string;
    publicUrl: string;
    key: string;
    maxImagesPerPost: number;
  }> {
    return this.http.post<{
      uploadUrl: string;
      publicUrl: string;
      key: string;
      maxImagesPerPost: number;
    }>(
      `${this.baseUrl}/admin/uploads`,
      { contentType },
      { headers: this.authHeaders() }
    );
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getIdToken();
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : ''
    });
  }
}
