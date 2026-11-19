import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from '../admin/auth.service';
import { demoBlogStore } from './demo-blog.store';

export { postedDayDiffers } from './posted-day';
export type {
  BlogStatus,
  BlogImage,
  BlogPost,
  BlogPostInput,
  BlogRevisionAction,
  BlogRevisionSummary,
  BlogRevision
} from './blog.types';
import type {
  BlogPost,
  BlogPostInput,
  BlogRevision,
  BlogRevisionSummary
} from './blog.types';

@Injectable({ providedIn: 'root' })
export class BlogApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = environment.blogApiUrl;
  private readonly demo = !!(environment as { useDemoData?: boolean }).useDemoData;

  listPublished(): Observable<{ posts: BlogPost[] }> {
    if (this.demo) {
      return of({ posts: demoBlogStore.listPublished() }).pipe(delay(120));
    }
    return this.http.get<{ posts: BlogPost[] }>(`${this.baseUrl}/posts`);
  }

  getPublished(slug: string): Observable<{ post: BlogPost }> {
    if (this.demo) {
      const post = demoBlogStore.getPublished(slug);
      return post
        ? of({ post }).pipe(delay(80))
        : throwError(() => ({ error: { error: 'Post not found' } }));
    }
    return this.http.get<{ post: BlogPost }>(`${this.baseUrl}/posts/${encodeURIComponent(slug)}`);
  }

  listArchive(year: string, month?: string): Observable<{ posts: BlogPost[] }> {
    if (this.demo) {
      const posts = demoBlogStore.listPublished().filter((p) => {
        const d = p.eventDate || '';
        if (month) return d.startsWith(`${year}-${month}`);
        return d.startsWith(year);
      });
      return of({ posts }).pipe(delay(80));
    }
    const path = month
      ? `${this.baseUrl}/archive/${year}/${month}`
      : `${this.baseUrl}/archive/${year}`;
    return this.http.get<{ posts: BlogPost[] }>(path);
  }

  adminMe(): Observable<{ email: string }> {
    if (this.demo) {
      return of({ email: this.auth.email() || 'author@example.com' });
    }
    return this.http.get<{ email: string }>(`${this.baseUrl}/admin/me`, {
      headers: this.authHeaders()
    });
  }

  adminList(): Observable<{ posts: BlogPost[] }> {
    if (this.demo) {
      return of({ posts: demoBlogStore.listAdmin() }).pipe(delay(100));
    }
    return this.http.get<{ posts: BlogPost[] }>(`${this.baseUrl}/admin/posts`, {
      headers: this.authHeaders()
    });
  }

  adminGet(id: string): Observable<{ post: BlogPost }> {
    if (this.demo) {
      const post = demoBlogStore.getAdmin(id);
      return post
        ? of({ post })
        : throwError(() => ({ error: { error: 'Post not found' } }));
    }
    return this.http.get<{ post: BlogPost }>(`${this.baseUrl}/admin/posts/${id}`, {
      headers: this.authHeaders()
    });
  }

  createDraft(input: BlogPostInput): Observable<{ post: BlogPost }> {
    if (this.demo) {
      return of({ post: demoBlogStore.createDraft(input) }).pipe(delay(80));
    }
    return this.http.post<{ post: BlogPost }>(`${this.baseUrl}/admin/posts`, input, {
      headers: this.authHeaders()
    });
  }

  updatePost(id: string, input: Partial<BlogPostInput>): Observable<{ post: BlogPost }> {
    if (this.demo) {
      try {
        return of({ post: demoBlogStore.updatePost(id, input) }).pipe(delay(80));
      } catch {
        return throwError(() => ({ error: { error: 'Post not found' } }));
      }
    }
    return this.http.put<{ post: BlogPost }>(`${this.baseUrl}/admin/posts/${id}`, input, {
      headers: this.authHeaders()
    });
  }

  publish(id: string): Observable<{ post: BlogPost }> {
    if (this.demo) {
      try {
        return of({ post: demoBlogStore.publish(id) }).pipe(delay(80));
      } catch {
        return throwError(() => ({ error: { error: 'Post not found' } }));
      }
    }
    return this.http.post<{ post: BlogPost }>(
      `${this.baseUrl}/admin/posts/${id}/publish`,
      {},
      { headers: this.authHeaders() }
    );
  }

  schedule(id: string, scheduledFor: string): Observable<{ post: BlogPost }> {
    if (this.demo) {
      try {
        return of({ post: demoBlogStore.schedule(id, scheduledFor) }).pipe(delay(80));
      } catch {
        return throwError(() => ({ error: { error: 'Post not found' } }));
      }
    }
    return this.http.post<{ post: BlogPost }>(
      `${this.baseUrl}/admin/posts/${id}/schedule`,
      { scheduledFor },
      { headers: this.authHeaders() }
    );
  }

  unschedule(id: string): Observable<{ post: BlogPost }> {
    if (this.demo) {
      try {
        return of({ post: demoBlogStore.unschedule(id) }).pipe(delay(80));
      } catch {
        return throwError(() => ({ error: { error: 'Post not found' } }));
      }
    }
    return this.http.post<{ post: BlogPost }>(
      `${this.baseUrl}/admin/posts/${id}/unschedule`,
      {},
      { headers: this.authHeaders() }
    );
  }

  unpublish(id: string): Observable<{ post: BlogPost }> {
    if (this.demo) {
      try {
        return of({ post: demoBlogStore.unpublish(id) }).pipe(delay(80));
      } catch {
        return throwError(() => ({ error: { error: 'Post not found' } }));
      }
    }
    return this.http.post<{ post: BlogPost }>(
      `${this.baseUrl}/admin/posts/${id}/unpublish`,
      {},
      { headers: this.authHeaders() }
    );
  }

  deletePost(id: string): Observable<{ ok: boolean }> {
    if (this.demo) {
      demoBlogStore.deletePost(id);
      return of({ ok: true }).pipe(delay(80));
    }
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/admin/posts/${id}`, {
      headers: this.authHeaders()
    });
  }

  listRevisions(id: string): Observable<{ revisions: BlogRevisionSummary[] }> {
    if (this.demo) {
      return of({ revisions: demoBlogStore.listRevisions(id) });
    }
    return this.http.get<{ revisions: BlogRevisionSummary[] }>(
      `${this.baseUrl}/admin/posts/${id}/revisions`,
      { headers: this.authHeaders() }
    );
  }

  getRevision(id: string, revisionId: string): Observable<{ revision: BlogRevision }> {
    if (this.demo) {
      return throwError(() => ({ error: { error: 'Demo mode: revision detail not available' } }));
    }
    return this.http.get<{ revision: BlogRevision }>(
      `${this.baseUrl}/admin/posts/${id}/revisions/${encodeURIComponent(revisionId)}`,
      { headers: this.authHeaders() }
    );
  }

  restoreRevision(id: string, revisionId: string): Observable<{ post: BlogPost }> {
    if (this.demo) {
      return throwError(() => ({ error: { error: 'Demo mode: restore not available' } }));
    }
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
    if (this.demo) {
      const key = `demo/${Date.now()}`;
      return of({
        uploadUrl: '',
        publicUrl: `https://placehold.co/600x400/png?text=${encodeURIComponent(contentType)}`,
        key,
        maxImagesPerPost: 12
      });
    }
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
