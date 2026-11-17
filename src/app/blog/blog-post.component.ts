import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogApiService, BlogPost, postedDayDiffers } from './blog-api.service';

@Component({
  standalone: true,
  selector: 'app-blog-post',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <a routerLink="/blog" class="text-sm text-gray-600 hover:text-black">← Blog</a>

      @if (loading()) {
        <p class="text-sm text-gray-500">Loading…</p>
      } @else if (error()) {
        <p class="text-sm text-red-600">{{ error() }}</p>
      } @else if (post(); as p) {
        <header class="space-y-2">
          <h1 class="text-3xl font-semibold tracking-tight">{{ p.title }}</h1>
          <p class="text-sm text-gray-500">
            {{ p.eventDate | date: 'MMMM d, y' }}
            @if (postedDiffers(p)) {
              <span class="opacity-70"> · Posted {{ p.publishedAt | date: 'MMM d, y' }}</span>
            }
          </p>
        </header>

        <div
          class="prose prose-neutral max-w-none blog-body"
          [innerHTML]="bodyHtml()"
        ></div>
      }
    </article>
  `,
  styles: [
    `
      :host ::ng-deep .blog-body img {
        display: inline-block;
        max-width: 100%;
        height: auto;
        border-radius: 0.375rem;
        margin: 0.5rem 1rem 0.5rem 0;
        vertical-align: top;
      }
    `
  ]
})
export class BlogPostComponent implements OnInit {
  private readonly api = inject(BlogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  readonly post = signal<BlogPost | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly bodyHtml = signal<SafeHtml>('');

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.api.getPublished(slug).subscribe({
      next: (res) => {
        this.post.set(res.post);
        this.bodyHtml.set(this.sanitizer.bypassSecurityTrustHtml(this.htmlFromBody(res.post.body)));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || 'Post not found');
        this.loading.set(false);
      }
    });
  }

  postedDiffers(post: BlogPost): boolean {
    return postedDayDiffers(post.eventDate, post.publishedAt);
  }

  private htmlFromBody(body: unknown): string {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (typeof body === 'object') {
      const obj = body as { format?: string; html?: string; content?: unknown[] };
      if (obj.format === 'html' && typeof obj.html === 'string') return obj.html;
      // Legacy TipTap-ish JSON: concatenate paragraph text
      if (Array.isArray(obj.content)) {
        return obj.content
          .map((node) => {
            const n = node as { type?: string; content?: Array<{ text?: string }> };
            if (n.type === 'paragraph') {
              const text = (n.content || []).map((t) => t.text || '').join('');
              return text ? `<p>${escapeHtml(text)}</p>` : '';
            }
            return '';
          })
          .join('');
      }
    }
    return '';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
