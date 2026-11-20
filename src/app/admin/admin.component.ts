import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import {
  BlogApiService,
  BlogPost,
  BlogRevision,
  BlogRevisionSummary,
  postedDayDiffers
} from '../blog/blog-api.service';
import { environment } from '../../environments/environment';
import { imageLayout } from '../blog/blog-config';
import { RichTextEditorComponent } from './rich-text-editor.component';

@Component({
  standalone: true,
  selector: 'app-admin',
  imports: [FormsModule, RouterLink, DatePipe, RichTextEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-4xl mx-auto px-4 py-10 space-y-10">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Blog Admin</h1>
          <p class="text-sm text-gray-600 mt-1">Signed in as {{ auth.email() }}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          @if (siteHomeUrl) {
            <a [href]="siteHomeUrl" class="text-sm text-gray-600 hover:text-black">{{ siteHomeLabel }}</a>
          }
          <a routerLink="/" class="text-sm text-gray-600 hover:text-black">View blog</a>
          <button type="button" class="text-sm text-gray-600 hover:text-black" (click)="auth.logout()">
            Sign out
          </button>
        </div>
      </div>

      <section
        id="post-editor"
        class="space-y-4 border-t pt-8"
        [class.edit-mode]="!!editingId()"
      >
        @if (editingId()) {
          <div
            class="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="text-sm font-semibold text-amber-950">Editing existing post</p>
              <p class="text-xs text-amber-900/80 mt-0.5">
                Changes update “{{ editingTitle() }}” — not a new blog entry.
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm text-amber-950 hover:bg-amber-100"
              (click)="cancelEdit()"
            >
              Switch to new draft
            </button>
          </div>
        } @else {
          <div class="rounded-md border border-sky-200 bg-sky-50 px-4 py-3">
            <p class="text-sm font-semibold text-sky-950">New draft</p>
            <p class="text-xs text-sky-900/80 mt-0.5">
              This creates a new post. To change an existing one, use Edit in the list below.
            </p>
          </div>
        }

        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl font-medium">
            {{ editingId() ? 'Edit post' : 'Write a new post' }}
          </h2>
        </div>

        <div
          class="grid gap-3 rounded-md p-1"
          [class.ring-2]="!!editingId()"
          [class.ring-amber-300]="!!editingId()"
          [class.ring-offset-2]="!!editingId()"
        >
          <input
            class="border rounded px-3 py-2"
            placeholder="Subject"
            [(ngModel)]="title"
            name="title"
          />

          <label class="grid gap-1 text-sm text-gray-600">
            <span>Event date</span>
            <input
              class="border rounded px-3 py-2 text-gray-900"
              type="date"
              [(ngModel)]="eventDate"
              name="eventDate"
            />
            <span class="text-xs text-gray-500">When it happened (can differ from publish day).</span>
          </label>

          <app-rich-text-editor (contentChange)="bodyHtml = $event" />

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50"
              (click)="openPostPreview()"
            >
              Preview post
            </button>
            <button
              type="button"
              class="rounded-md px-4 py-2 text-sm text-white"
              [class]="editingId() ? 'bg-amber-700 hover:bg-amber-800' : 'bg-black hover:bg-gray-800'"
              [disabled]="saving()"
              (click)="savePost()"
            >
              @if (saving()) {
                Saving…
              } @else if (editingId()) {
                Save changes
              } @else {
                Save new draft
              }
            </button>
            @if (editingId()) {
              <button
                type="button"
                class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                (click)="cancelEdit()"
              >
                Cancel
              </button>
            }
          </div>
        </div>
      </section>

      <section class="space-y-4 border-t pt-8">
        <h2 class="text-xl font-medium">Posts</h2>
        @if (loading()) {
          <p class="text-sm text-gray-500">Loading…</p>
        } @else if (!posts().length) {
          <p class="text-sm text-gray-500">No posts yet.</p>
        } @else {
          <ul class="divide-y border rounded">
            @for (post of posts(); track post.id) {
              <li
                class="p-4 space-y-3"
                [class.bg-amber-50/60]="editingId() === post.id"
              >
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div class="font-medium flex flex-wrap items-center gap-2">
                      {{ post.title }}
                      @if (editingId() === post.id) {
                        <span
                          class="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950"
                          >Editing</span
                        >
                      }
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      {{ statusLabel(post.status) }} · {{ post.eventDate | date: 'mediumDate' }}
                      @if (post.status === 'scheduled' && post.scheduledFor) {
                        · Goes live {{ post.scheduledFor | date: 'medium' }}
                      }
                      @if (post.status === 'published' && postedDiffers(post)) {
                        · Posted {{ post.publishedAt | date: 'mediumDate' }}
                      }
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                      [disabled]="loadingEdit()"
                      (click)="startEdit(post)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                      (click)="openHistory(post)"
                    >
                      History
                    </button>
                    @if (post.status === 'draft') {
                      <button
                        type="button"
                        class="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                        (click)="askPublish(post)"
                      >
                        Publish now
                      </button>
                      <button
                        type="button"
                        class="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                        (click)="askSchedule(post)"
                      >
                        Schedule
                      </button>
                    } @else if (post.status === 'scheduled') {
                      <button
                        type="button"
                        class="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                        (click)="askPublish(post)"
                      >
                        Publish now
                      </button>
                      <button
                        type="button"
                        class="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                        (click)="askSchedule(post)"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        class="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                        (click)="unschedule(post)"
                      >
                        Unschedule
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                        (click)="unpublish(post)"
                      >
                        Unpublish
                      </button>
                      <a
                        class="text-sm border rounded px-3 py-1 hover:bg-gray-50"
                        [routerLink]="['/', post.slug]"
                        >View</a
                      >
                    }
                    <button
                      type="button"
                      class="text-sm border rounded px-3 py-1 text-red-700 hover:bg-red-50"
                      (click)="askDelete(post)"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            }
          </ul>
        }
      </section>
    </div>

    @if (toast()) {
      <div
        class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-6"
        role="status"
        aria-live="polite"
      >
        <div
          class="pointer-events-auto max-w-md rounded-md border px-4 py-3 text-sm shadow-lg"
          [class]="toastClass()"
        >
          {{ toast() }}
        </div>
      </div>
    }

    @if (confirmModal(); as modal) {
      <div
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
        (click)="closeConfirm()"
        role="presentation"
      >
        <div
          class="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'confirm-title'"
          (click)="$event.stopPropagation()"
        >
          <div class="border-b border-gray-200 px-5 py-4">
            <h3 id="confirm-title" class="text-base font-medium text-gray-900">{{ modal.title }}</h3>
            <p class="mt-1 text-sm text-gray-600">{{ modal.message }}</p>
          </div>

          @if (modal.kind === 'schedule') {
            <div class="px-5 pt-4">
              <label class="grid gap-1 text-sm text-gray-600">
                <span>Publish at</span>
                <input
                  class="border rounded px-3 py-2 text-gray-900"
                  type="datetime-local"
                  [ngModel]="scheduleLocal()"
                  (ngModelChange)="scheduleLocal.set($event)"
                  name="scheduleLocalModal"
                />
              </label>
            </div>
          }

          <div class="flex justify-end gap-2 px-5 py-4">
            <button
              type="button"
              class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              (click)="closeConfirm()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-md px-4 py-2 text-sm text-white"
              [class]="
                modal.kind === 'delete' || modal.kind === 'restore'
                  ? modal.kind === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-700 hover:bg-amber-800'
                  : 'bg-black hover:bg-gray-800'
              "
              [disabled]="confirmBusy()"
              (click)="runConfirm()"
            >
              {{ confirmBusy() ? 'Working…' : modal.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (historyOpen()) {
      <div
        class="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
        (click)="closeHistory()"
        role="presentation"
      >
        <div
          class="my-6 w-full max-w-4xl rounded-lg border border-gray-200 bg-white shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-title"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div>
              <h3 id="history-title" class="text-base font-medium text-gray-900">
                History · {{ historyPost()?.title }}
              </h3>
              <p class="text-xs text-gray-500 mt-0.5">Past snapshots before each change</p>
            </div>
            <button
              type="button"
              class="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
              (click)="closeHistory()"
            >
              Close
            </button>
          </div>

          <div class="grid gap-0 md:grid-cols-[minmax(0,16rem)_1fr]">
            <div class="border-b md:border-b-0 md:border-r border-gray-200 max-h-[70vh] overflow-y-auto">
              @if (historyLoading()) {
                <p class="p-4 text-sm text-gray-500">Loading…</p>
              } @else if (!revisions().length) {
                <p class="p-4 text-sm text-gray-500">
                  No history yet. Edits and status changes will show up here.
                </p>
              } @else {
                <ul class="divide-y">
                  @for (rev of revisions(); track rev.revisionId) {
                    <li>
                      <button
                        type="button"
                        class="w-full text-left px-4 py-3 hover:bg-gray-50"
                        [class.bg-sky-50]="selectedRevisionId() === rev.revisionId"
                        (click)="selectRevision(rev)"
                      >
                        <div class="text-sm font-medium text-gray-900">
                          {{ actionLabel(rev.action) }}
                        </div>
                        <div class="text-xs text-gray-500 mt-0.5">
                          {{ rev.createdAt | date: 'medium' }}
                        </div>
                        @if (rev.editedBy) {
                          <div class="text-xs text-gray-500">{{ rev.editedBy }}</div>
                        }
                        @if (rev.changedFields?.length) {
                          <div class="text-[11px] text-gray-400 mt-1">
                            {{ rev.changedFields.join(', ') }}
                          </div>
                        }
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>

            <div class="min-h-[16rem] max-h-[70vh] overflow-y-auto p-4 sm:p-6">
              @if (revisionLoading()) {
                <p class="text-sm text-gray-500">Loading revision…</p>
              } @else if (selectedRevision(); as rev) {
                <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <p class="text-sm text-gray-600">
                    Snapshot from {{ rev.createdAt | date: 'medium' }}
                  </p>
                  <button
                    type="button"
                    class="rounded-md bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-800"
                    (click)="askRestore(rev)"
                  >
                    Restore this version
                  </button>
                </div>
                <article class="space-y-4">
                  <header class="space-y-1">
                    <h4 class="text-2xl font-semibold tracking-tight">{{ rev.title }}</h4>
                    <p class="text-sm text-gray-500">
                      {{ rev.eventDate | date: 'MMMM d, y' }}
                      · {{ statusLabel(rev.status) }}
                    </p>
                  </header>
                  @if (revisionBodyHtml()) {
                    <div
                      class="prose prose-neutral max-w-none post-preview-body"
                      [class.image-layout-column]="layout === 'column'"
                      [class.image-layout-inline]="layout === 'inline'"
                      [innerHTML]="revisionBodyHtml()"
                    ></div>
                  } @else {
                    <p class="text-sm text-gray-500">No body in this snapshot.</p>
                  }
                </article>
              } @else {
                <p class="text-sm text-gray-500">Select a revision to preview.</p>
              }
            </div>
          </div>
        </div>
      </div>
    }

    @if (previewOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
        (click)="closePostPreview()"
        role="presentation"
      >
        <div
          class="my-6 w-full max-w-3xl rounded-lg border border-gray-200 bg-white shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-preview-title"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <h3 id="post-preview-title" class="text-sm font-medium text-gray-600">
              {{ editingId() ? 'Edit preview' : 'New draft preview' }}
            </h3>
            <button
              type="button"
              class="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
              (click)="closePostPreview()"
            >
              Close
            </button>
          </div>

          <article class="space-y-6 px-6 py-8 sm:px-10">
            <header class="space-y-2">
              <h1 class="text-3xl font-semibold tracking-tight text-gray-900">
                {{ previewTitle() || 'Untitled' }}
              </h1>
              <p class="text-sm text-gray-500">
                {{ previewEventDate() | date: 'MMMM d, y' }}
                <span class="opacity-70">
                  · {{ editingId() ? 'edit preview' : 'new draft preview' }}
                </span>
              </p>
            </header>

            @if (previewBody()) {
              <div
                class="prose prose-neutral max-w-none post-preview-body"
                [class.image-layout-column]="layout === 'column'"
                [class.image-layout-inline]="layout === 'inline'"
                [innerHTML]="previewBody()"
              ></div>
            } @else {
              <p class="text-sm text-gray-500">Nothing to preview yet — add a subject and some text.</p>
            }
          </article>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host ::ng-deep .post-preview-body.image-layout-column .blog-figure,
      :host ::ng-deep .post-preview-body.image-layout-column figure {
        display: block;
        margin: 1.75rem auto;
        max-width: 100%;
        text-align: center;
      }
      :host ::ng-deep .post-preview-body.image-layout-column .blog-figure img,
      :host ::ng-deep .post-preview-body.image-layout-column figure img,
      :host ::ng-deep .post-preview-body.image-layout-column img {
        display: block;
        width: auto;
        max-width: 100%;
        height: auto;
        margin-left: auto;
        margin-right: auto;
        border-radius: 0.375rem;
      }
      :host ::ng-deep .post-preview-body.image-layout-column figcaption {
        margin-top: 0.6rem;
        font-size: 0.9375rem;
        line-height: 1.45;
        color: #57606a;
        text-align: center;
      }
      :host ::ng-deep .post-preview-body.image-layout-inline .blog-figure,
      :host ::ng-deep .post-preview-body.image-layout-inline figure {
        display: inline-block;
        margin: 0.5rem 1rem 0.5rem 0;
        max-width: 100%;
        vertical-align: top;
        text-align: left;
      }
      :host ::ng-deep .post-preview-body.image-layout-inline .blog-figure img,
      :host ::ng-deep .post-preview-body.image-layout-inline figure img,
      :host ::ng-deep .post-preview-body.image-layout-inline img {
        display: block;
        max-width: 100%;
        height: auto;
        border-radius: 0.375rem;
      }
      :host ::ng-deep .post-preview-body.image-layout-inline figcaption {
        margin-top: 0.4rem;
        font-size: 0.875rem;
        line-height: 1.4;
        color: #57606a;
      }
    `
  ]
})
export class AdminComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly api = inject(BlogApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly editor = viewChild(RichTextEditorComponent);

  readonly layout = imageLayout();
  readonly siteHomeUrl = environment.siteHomeUrl;
  readonly siteHomeLabel = environment.siteHomeLabel || environment.siteName;

  readonly posts = signal<BlogPost[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadingEdit = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editingTitle = signal('');
  readonly scheduleLocal = signal('');
  readonly confirmModal = signal<{
    kind: 'publish' | 'schedule' | 'delete' | 'restore';
    post: BlogPost;
    title: string;
    message: string;
    confirmLabel: string;
    revisionId?: string;
  } | null>(null);
  readonly confirmBusy = signal(false);
  readonly toast = signal<string | null>(null);
  readonly toastClass = signal('border-gray-200 bg-gray-900 text-white');
  readonly previewOpen = signal(false);
  readonly previewTitle = signal('');
  readonly previewEventDate = signal('');
  readonly previewBody = signal<SafeHtml | string>('');

  readonly historyOpen = signal(false);
  readonly historyPost = signal<BlogPost | null>(null);
  readonly historyLoading = signal(false);
  readonly revisions = signal<BlogRevisionSummary[]>([]);
  readonly selectedRevisionId = signal<string | null>(null);
  readonly selectedRevision = signal<BlogRevision | null>(null);
  readonly revisionLoading = signal(false);
  readonly revisionBodyHtml = signal<SafeHtml | string>('');

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  title = '';
  eventDate = new Date().toISOString().slice(0, 10);
  bodyHtml = '';

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  reload(): void {
    this.loading.set(true);
    this.api.adminList().subscribe({
      next: (res) => {
        this.posts.set(res.posts);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.flash(`Failed to load posts: ${err?.error?.error || err.message}`, true);
      }
    });
  }

  openPostPreview(): void {
    const html = this.bodyHtml.trim();
    this.previewTitle.set(this.title.trim());
    this.previewEventDate.set(this.eventDate);
    this.previewBody.set(html ? this.sanitizer.bypassSecurityTrustHtml(html) : '');
    this.previewOpen.set(true);
  }

  closePostPreview(): void {
    this.previewOpen.set(false);
  }

  startEdit(post: BlogPost): void {
    this.loadingEdit.set(true);
    this.api.adminGet(post.id).subscribe({
      next: (res) => {
        const p = res.post;
        const html = this.htmlFromBody(p.body);
        this.editingId.set(p.id);
        this.editingTitle.set(p.title);
        this.title = p.title;
        this.eventDate = p.eventDate;
        this.bodyHtml = html;
        this.loadingEdit.set(false);
        queueMicrotask(() => {
          this.editor()?.setHtml(html);
          document.getElementById('post-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      },
      error: (err) => {
        this.loadingEdit.set(false);
        this.flash(`Could not load post: ${err?.error?.error || err.message}`, true);
      }
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingTitle.set('');
    this.title = '';
    this.eventDate = new Date().toISOString().slice(0, 10);
    this.bodyHtml = '';
    this.editor()?.setHtml('');
  }

  savePost(): void {
    if (!this.title.trim()) {
      this.flash('Subject is required', true);
      return;
    }
    const html = this.bodyHtml.trim();
    if (!html || html === '<p></p>') {
      this.flash('Write a paragraph before saving', true);
      return;
    }

    const payload = {
      title: this.title.trim(),
      eventDate: this.eventDate,
      excerpt: this.excerptFromHtml(html),
      body: { format: 'html', html }
    };

    const id = this.editingId();
    this.saving.set(true);

    if (id) {
      this.api.updatePost(id, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.flash('Changes saved');
          this.cancelEdit();
          this.reload();
        },
        error: (err) => {
          this.saving.set(false);
          this.flash(`Save failed: ${err?.error?.error || err.message}`, true);
        }
      });
      return;
    }

    this.api.createDraft(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.title = '';
        this.bodyHtml = '';
        this.editor()?.setHtml('');
        this.flash('New draft saved');
        this.reload();
      },
      error: (err) => {
        this.saving.set(false);
        this.flash(`Save failed: ${err?.error?.error || err.message}`, true);
      }
    });
  }

  openHistory(post: BlogPost): void {
    this.historyPost.set(post);
    this.historyOpen.set(true);
    this.revisions.set([]);
    this.selectedRevision.set(null);
    this.selectedRevisionId.set(null);
    this.revisionBodyHtml.set('');
    this.historyLoading.set(true);
    this.api.listRevisions(post.id).subscribe({
      next: (res) => {
        this.revisions.set(res.revisions);
        this.historyLoading.set(false);
        if (res.revisions[0]) {
          this.selectRevision(res.revisions[0]);
        }
      },
      error: (err) => {
        this.historyLoading.set(false);
        this.flash(`Could not load history: ${err?.error?.error || err.message}`, true);
      }
    });
  }

  closeHistory(): void {
    this.historyOpen.set(false);
    this.historyPost.set(null);
    this.selectedRevision.set(null);
    this.selectedRevisionId.set(null);
  }

  selectRevision(rev: BlogRevisionSummary): void {
    const post = this.historyPost();
    if (!post) return;
    this.selectedRevisionId.set(rev.revisionId);
    this.revisionLoading.set(true);
    this.api.getRevision(post.id, rev.revisionId).subscribe({
      next: (res) => {
        this.selectedRevision.set(res.revision);
        const html = this.htmlFromBody(res.revision.body);
        this.revisionBodyHtml.set(html ? this.sanitizer.bypassSecurityTrustHtml(html) : '');
        this.revisionLoading.set(false);
      },
      error: (err) => {
        this.revisionLoading.set(false);
        this.flash(`Could not load revision: ${err?.error?.error || err.message}`, true);
      }
    });
  }

  askRestore(rev: BlogRevision): void {
    const post = this.historyPost();
    if (!post) return;
    this.confirmModal.set({
      kind: 'restore',
      post,
      revisionId: rev.revisionId,
      title: 'Restore this version?',
      message: `Replace the live post “${post.title}” with the snapshot from ${new Date(rev.createdAt).toLocaleString()}? Current content is saved to history first.`,
      confirmLabel: 'Restore'
    });
  }

  actionLabel(action: string): string {
    const labels: Record<string, string> = {
      create: 'Created',
      update: 'Edited',
      publish: 'Published',
      unpublish: 'Unpublished',
      schedule: 'Scheduled',
      unschedule: 'Unscheduled',
      restore: 'Restored'
    };
    return labels[action] || action;
  }

  private htmlFromBody(body: unknown): string {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (typeof body === 'object') {
      const obj = body as { format?: string; html?: string };
      if (typeof obj.html === 'string') return obj.html;
    }
    return '';
  }

  askPublish(post: BlogPost): void {
    this.confirmModal.set({
      kind: 'publish',
      post,
      title: 'Publish now?',
      message: `Publish “${post.title}” immediately?`,
      confirmLabel: 'Publish now'
    });
  }

  askSchedule(post: BlogPost): void {
    this.scheduleLocal.set(this.toLocalInput(post.scheduledFor));
    this.confirmModal.set({
      kind: 'schedule',
      post,
      title: post.status === 'scheduled' ? 'Reschedule post?' : 'Schedule post?',
      message: `Choose when “${post.title}” should go live.`,
      confirmLabel: post.status === 'scheduled' ? 'Reschedule' : 'Schedule'
    });
  }

  askDelete(post: BlogPost): void {
    this.confirmModal.set({
      kind: 'delete',
      post,
      title: 'Delete post?',
      message: `Delete “${post.title}”? This can’t be undone.`,
      confirmLabel: 'Delete'
    });
  }

  closeConfirm(): void {
    if (this.confirmBusy()) return;
    this.confirmModal.set(null);
  }

  runConfirm(): void {
    const modal = this.confirmModal();
    if (!modal) return;

    if (modal.kind === 'publish') {
      this.confirmBusy.set(true);
      this.api.publish(modal.post.id).subscribe({
        next: () => {
          this.confirmBusy.set(false);
          this.confirmModal.set(null);
          this.flash(`Published “${modal.post.title}”`);
          this.reload();
        },
        error: (err) => {
          this.confirmBusy.set(false);
          this.flash(`Publish failed: ${err?.error?.error || err.message}`, true);
        }
      });
      return;
    }

    if (modal.kind === 'schedule') {
      const local = this.scheduleLocal().trim();
      if (!local) {
        this.flash('Pick a date and time', true);
        return;
      }
      const iso = new Date(local).toISOString();
      if (Number.isNaN(Date.parse(iso))) {
        this.flash('Invalid date/time', true);
        return;
      }
      if (Date.parse(iso) <= Date.now()) {
        this.flash('Schedule time must be in the future', true);
        return;
      }

      this.confirmBusy.set(true);
      this.api.schedule(modal.post.id, iso).subscribe({
        next: () => {
          this.confirmBusy.set(false);
          this.confirmModal.set(null);
          this.flash(`Scheduled “${modal.post.title}”`);
          this.reload();
        },
        error: (err) => {
          this.confirmBusy.set(false);
          this.flash(`Schedule failed: ${err?.error?.error || err.message}`, true);
        }
      });
      return;
    }

    if (modal.kind === 'restore') {
      if (!modal.revisionId) return;
      this.confirmBusy.set(true);
      this.api.restoreRevision(modal.post.id, modal.revisionId).subscribe({
        next: () => {
          this.confirmBusy.set(false);
          this.confirmModal.set(null);
          if (this.editingId() === modal.post.id) {
            this.cancelEdit();
          }
          this.flash(`Restored “${modal.post.title}”`);
          this.closeHistory();
          this.reload();
        },
        error: (err) => {
          this.confirmBusy.set(false);
          this.flash(`Restore failed: ${err?.error?.error || err.message}`, true);
        }
      });
      return;
    }

    this.confirmBusy.set(true);
    this.api.deletePost(modal.post.id).subscribe({
      next: () => {
        this.confirmBusy.set(false);
        this.confirmModal.set(null);
        if (this.editingId() === modal.post.id) {
          this.cancelEdit();
        }
        if (this.historyPost()?.id === modal.post.id) {
          this.closeHistory();
        }
        this.flash(`Deleted “${modal.post.title}”`);
        this.reload();
      },
      error: (err) => {
        this.confirmBusy.set(false);
        this.flash(`Delete failed: ${err?.error?.error || err.message}`, true);
      }
    });
  }

  unschedule(post: BlogPost): void {
    this.api.unschedule(post.id).subscribe({
      next: () => {
        this.flash(`Unscheduled “${post.title}”`);
        this.reload();
      },
      error: (err) => this.flash(`Unschedule failed: ${err?.error?.error || err.message}`, true)
    });
  }

  unpublish(post: BlogPost): void {
    this.api.unpublish(post.id).subscribe({
      next: () => {
        this.flash(`Unpublished “${post.title}”`);
        this.reload();
      },
      error: (err) => this.flash(`Unpublish failed: ${err?.error?.error || err.message}`, true)
    });
  }

  statusLabel(status?: string): string {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  postedDiffers(post: BlogPost): boolean {
    return postedDayDiffers(post.eventDate, post.publishedAt);
  }

  private toLocalInput(iso?: string | null): string {
    const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
    if (Number.isNaN(d.getTime())) {
      const fallback = new Date(Date.now() + 60 * 60 * 1000);
      return this.formatLocal(fallback);
    }
    return this.formatLocal(d);
  }

  private formatLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private excerptFromHtml(html: string): string {
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > 180 ? `${text.slice(0, 177)}…` : text;
  }

  private flash(text: string, isError = false): void {
    this.toast.set(text);
    this.toastClass.set(
      isError
        ? 'border-red-200 bg-red-600 text-white'
        : 'border-gray-700 bg-gray-900 text-white'
    );
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 3200);
  }
}
