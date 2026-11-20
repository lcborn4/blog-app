import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { imageLayout } from './blog-config';
import { BlogApiService, BlogPost, postedDayDiffers } from './blog-api.service';

@Component({
  standalone: true,
  selector: 'app-blog-post',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
        @if (siteHomeUrl) {
          <a [href]="siteHomeUrl" class="hover:text-black">← {{ siteHomeLabel }}</a>
        }
        <a routerLink="/" class="hover:text-black">Blog</a>
      </div>

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
          [class.image-layout-column]="layout === 'column'"
          [class.image-layout-inline]="layout === 'inline'"
          [innerHTML]="bodyHtml()"
        ></div>
      }
    </article>
  `,
  styles: [
    `
      :host ::ng-deep .blog-body.image-layout-column .blog-figure,
      :host ::ng-deep .blog-body.image-layout-column figure {
        display: block;
        margin: 1.75rem auto;
        max-width: 100%;
        text-align: center;
      }
      :host ::ng-deep .blog-body.image-layout-column .blog-figure img,
      :host ::ng-deep .blog-body.image-layout-column figure img,
      :host ::ng-deep .blog-body.image-layout-column img.blog-image,
      :host ::ng-deep .blog-body.image-layout-column img {
        display: block;
        width: auto;
        max-width: 100%;
        height: auto;
        margin-left: auto;
        margin-right: auto;
        border-radius: 0.375rem;
      }
      :host ::ng-deep .blog-body.image-layout-column figcaption {
        margin-top: 0.6rem;
        font-size: 0.9375rem;
        line-height: 1.45;
        color: #57606a;
        text-align: center;
      }
      :host ::ng-deep .blog-body.image-layout-inline .blog-figure,
      :host ::ng-deep .blog-body.image-layout-inline figure {
        display: inline-block;
        margin: 0.5rem 1rem 0.5rem 0;
        max-width: 100%;
        vertical-align: top;
        text-align: left;
      }
      :host ::ng-deep .blog-body.image-layout-inline .blog-figure img,
      :host ::ng-deep .blog-body.image-layout-inline figure img,
      :host ::ng-deep .blog-body.image-layout-inline img {
        display: block;
        max-width: 100%;
        height: auto;
        border-radius: 0.375rem;
      }
      :host ::ng-deep .blog-body.image-layout-inline figcaption {
        margin-top: 0.4rem;
        font-size: 0.875rem;
        line-height: 1.4;
        color: #57606a;
      }
    `
  ]
})
export class BlogPostComponent implements OnInit {
  private readonly api = inject(BlogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  readonly layout = imageLayout();
  readonly siteHomeUrl = environment.siteHomeUrl;
  readonly siteHomeLabel = environment.siteHomeLabel || environment.siteName;

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
