import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  input,
  output,
  viewChild,
  inject,
  signal
} from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { BlogApiService } from '../blog/blog-api.service';
import { ResizableImage } from './resizable-image.extension';

@Component({
  standalone: true,
  selector: 'app-rich-text-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rounded-md border border-gray-300 bg-white"
      [class.ring-2]="dragging()"
      [class.ring-blue-500]="dragging()"
      [class.border-blue-400]="dragging()"
      (dragenter)="onDragEnter($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <!-- Toolbar -->
      <div class="relative z-20 flex flex-wrap items-center gap-0.5 overflow-visible rounded-t-md border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <button type="button" class="rte-btn font-semibold" data-tooltip="Bold" aria-label="Bold" [class.rte-btn-active]="editor()?.isActive('bold')" (click)="editor()?.chain().focus().toggleBold().run()">B</button>
        <button type="button" class="rte-btn italic" data-tooltip="Italic" aria-label="Italic" [class.rte-btn-active]="editor()?.isActive('italic')" (click)="editor()?.chain().focus().toggleItalic().run()">I</button>
        <button type="button" class="rte-btn" data-tooltip="Heading" aria-label="Heading" [class.rte-btn-active]="editor()?.isActive('heading', { level: 2 })" (click)="editor()?.chain().focus().toggleHeading({ level: 2 }).run()">H</button>
        <button type="button" class="rte-btn" data-tooltip="Add link" aria-label="Add link" [class.rte-btn-active]="editor()?.isActive('link')" (click)="openLinkModal()">
          <svg class="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M6.5 9.5a3 3 0 0 0 4.24.24l1.76-1.76a3 3 0 0 0-4.24-4.24L7.5 4.5" stroke-linecap="round" />
            <path d="M9.5 6.5a3 3 0 0 0-4.24-.24L3.5 8.02a3 3 0 0 0 4.24 4.24L8.5 11.5" stroke-linecap="round" />
          </svg>
        </button>
        <span class="mx-1 h-4 w-px bg-gray-300" aria-hidden="true"></span>
        <button type="button" class="rte-btn" data-tooltip="Bullet list" aria-label="Bullet list" [class.rte-btn-active]="editor()?.isActive('bulletList')" (click)="editor()?.chain().focus().toggleBulletList().run()">
          <svg class="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3.75-1.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5ZM3 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>
        </button>
        <button type="button" class="rte-btn" data-tooltip="Numbered list" aria-label="Numbered list" [class.rte-btn-active]="editor()?.isActive('orderedList')" (click)="editor()?.chain().focus().toggleOrderedList().run()">
          <svg class="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.003 2.5a.5.5 0 0 0-.723-.447l-1.003.5a.5.5 0 0 0 .446.895l.28-.14V6H.5a.5.5 0 0 0 0 1h2.006a.5.5 0 1 0 0-1h-.503V2.5l.22-.11a.5.5 0 0 0-.22-.89ZM.5 9.5A.5.5 0 0 1 1 9h1.5v.5a.5.5 0 0 1-1 0V10H1a.5.5 0 0 0-.5.5v1A.5.5 0 0 0 1 12h1.5a.5.5 0 0 0 0-1H1.5v-.25a.25.25 0 0 1 .25-.25H2a.5.5 0 0 0 0-1H1a.5.5 0 0 1-.5-.5Zm.5 4.5h.5a.5.5 0 0 1 0 1H1a.5.5 0 0 0-.5.5v.25c0 .138.112.25.25.25H2a.5.5 0 0 1 0 1H.75A.75.75 0 0 1 0 15.25v-.5A1.5 1.5 0 0 1 1.5 13.25H1a.5.5 0 0 1 0-1ZM5.75 2.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5ZM5 8a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 8Zm.75 4.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z"/></svg>
        </button>
      </div>

      <!-- Write surface -->
      <div class="relative overflow-visible">
        <div #host class="prose prose-neutral max-w-none min-h-[180px] px-3 py-3"></div>

        @if (dragging()) {
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-blue-50/80 border-2 border-dashed border-blue-400 m-2 rounded-md">
            <p class="text-sm font-medium text-blue-700">Drop image to upload</p>
          </div>
        }
      </div>

      <!-- Link modal -->
      @if (linkModalOpen()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          (click)="closeLinkModal()"
          role="presentation"
        >
          <div
            class="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-modal-title"
            (click)="$event.stopPropagation()"
          >
            <div class="border-b border-gray-200 px-4 py-3">
              <h3 id="link-modal-title" class="text-base font-semibold text-gray-900">Add link</h3>
            </div>
            <div class="space-y-3 px-4 py-4">
              <label class="block space-y-1 text-sm text-gray-700">
                <span>URL</span>
                <input
                  #linkUrlInput
                  type="url"
                  class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="https://example.com"
                  [value]="linkUrl()"
                  (input)="linkUrl.set($any($event.target).value)"
                  (keydown.enter)="applyLink(); $event.preventDefault()"
                  (keydown.escape)="closeLinkModal()"
                />
              </label>
              @if (linkError()) {
                <p class="text-xs text-red-600">{{ linkError() }}</p>
              }
              <p class="text-xs text-gray-500">
                Select text first to turn it into a link, or the URL will be inserted as the link text.
              </p>
            </div>
            <div class="flex items-center justify-between gap-2 border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                class="text-sm text-red-700 hover:underline disabled:opacity-40"
                [disabled]="!editor()?.isActive('link')"
                (click)="removeLink()"
              >
                Remove link
              </button>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  (click)="closeLinkModal()"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  (click)="applyLink()"
                >
                  Add link
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- GitHub-style attach footer -->
      <div class="border-t border-gray-200 bg-white">
        <label
          class="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 cursor-pointer hover:bg-gray-50"
          [class.pointer-events-none]="uploading()"
          [class.opacity-60]="uploading()"
        >
          <input
            #fileInput
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            class="sr-only"
            [disabled]="uploading()"
            (change)="onFileSelected($event)"
          />
          <svg class="size-4 shrink-0 text-gray-500" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M3.5 2.5a1 1 0 0 1 1-1h3.586a1 1 0 0 1 .707.293l3.414 3.414a1 1 0 0 1 .293.707V12.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-10Zm5.086 0H4.5v10h7V6.914L8.586 2.5Z"/>
            <path d="M8.5 2.5v3.086a1 1 0 0 0 1 1H12.5"/>
          </svg>

          @if (uploading()) {
            <span class="text-blue-700">
              Uploading {{ uploadName() }}… {{ uploadProgress() }}%
            </span>
          } @else {
            <span>Paste, drop, or click to add files</span>
          }
        </label>

        @if (uploadError()) {
          <p class="px-3 pb-2 text-xs text-red-600">{{ uploadError() }}</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .rte-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        color: #57606a;
        background: transparent;
      }
      .rte-btn:hover {
        background: #eaeef2;
      }
      .rte-btn-active {
        background: #eaeef2;
        color: #24292f;
      }
      :host ::ng-deep .rte-image-node {
        position: relative;
        display: inline-block;
        max-width: 100%;
        margin: 0.5rem 1rem 0.5rem 0;
        padding-right: 2px;
        vertical-align: top;
        box-sizing: border-box;
      }
      :host ::ng-deep .rte-image-node.is-selected {
        /* box-shadow instead of outline so selection chrome doesn't cover the caret */
        box-shadow: 0 0 0 2px #0969da;
        border-radius: 0.375rem;
      }
      :host ::ng-deep .rte-image-toolbar {
        position: absolute;
        left: 50%;
        top: 8px;
        transform: translateX(-50%);
        display: none;
        align-items: center;
        gap: 0.2rem;
        padding: 0.25rem 0.35rem;
        border-radius: 0.5rem;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid #d0d7de;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        z-index: 5;
        line-height: 1;
      }
      :host ::ng-deep .rte-image-node.is-selected .rte-image-toolbar,
      :host ::ng-deep .rte-image-node:hover .rte-image-toolbar {
        display: inline-flex;
      }
      :host ::ng-deep .rte-image-toolbar-label {
        padding: 0 0.25rem;
        font-size: 0.6875rem;
        font-weight: 600;
        color: #656d76;
      }
      :host ::ng-deep .rte-image-toolbar-btn {
        border: 0;
        background: transparent;
        border-radius: 0.375rem;
        min-width: 1.5rem;
        height: 1.5rem;
        padding: 0 0.35rem;
        font-size: 0.6875rem;
        font-weight: 600;
        color: #24292f;
        cursor: pointer;
      }
      :host ::ng-deep .rte-image-toolbar-btn:hover,
      :host ::ng-deep .rte-image-toolbar-btn.is-active {
        background: #eaeef2;
      }
      :host ::ng-deep .rte-image-toolbar-divider {
        width: 1px;
        height: 1rem;
        background: #d0d7de;
        margin: 0 0.15rem;
      }
      :host ::ng-deep .rte-image-alt-wrap {
        position: relative;
      }
      :host ::ng-deep .rte-image-alt-panel {
        position: absolute;
        left: 0;
        top: calc(100% + 6px);
        width: 14rem;
        padding: 0.5rem;
        border-radius: 0.5rem;
        border: 1px solid #d0d7de;
        background: #fff;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
        z-index: 6;
      }
      :host ::ng-deep .rte-image-alt-input {
        width: 100%;
        border: 1px solid #d0d7de;
        border-radius: 0.375rem;
        padding: 0.35rem 0.45rem;
        font-size: 0.75rem;
      }
      :host ::ng-deep .rte-image-alt-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.4rem;
      }
      :host ::ng-deep .rte-image-alt-actions button {
        border: 0;
        background: transparent;
        font-size: 0.75rem;
        color: #656d76;
        cursor: pointer;
      }
      :host ::ng-deep .rte-image-alt-actions button.is-primary {
        color: #0969da;
        font-weight: 600;
      }
      :host ::ng-deep .rte-image-handle {
        position: absolute;
        right: -6px;
        bottom: -6px;
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        background: #0969da;
        border: 2px solid #fff;
        box-shadow: 0 0 0 1px rgba(9, 105, 218, 0.35);
        cursor: nwse-resize;
        display: none;
      }
      :host ::ng-deep .rte-image-node.is-selected .rte-image-handle {
        display: block;
      }
      .rte-btn[data-tooltip]::after {
        content: attr(data-tooltip);
        position: absolute;
        left: 50%;
        top: calc(100% + 8px);
        transform: translateX(-50%);
        padding: 0.3rem 0.55rem;
        border-radius: 0.375rem;
        background: #24292f;
        color: #fff;
        font-size: 0.6875rem;
        font-weight: 500;
        font-style: normal;
        line-height: 1.2;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.12s ease;
        z-index: 50;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      .rte-btn[data-tooltip]::before {
        content: '';
        position: absolute;
        left: 50%;
        top: calc(100% + 2px);
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-bottom-color: #24292f;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.12s ease;
        z-index: 50;
      }
      .rte-btn[data-tooltip]:hover::after,
      .rte-btn[data-tooltip]:focus-visible::after,
      .rte-btn[data-tooltip]:hover::before,
      .rte-btn[data-tooltip]:focus-visible::before {
        opacity: 1;
      }
      :host ::ng-deep .ProseMirror {
        outline: none;
        min-height: 160px;
      }
      :host ::ng-deep .ProseMirror p.is-editor-empty:first-child::before {
        color: #6e7781;
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
      }
      :host ::ng-deep .ProseMirror img {
        max-width: 100%;
        height: auto;
        border-radius: 0.375rem;
        margin: 0.75rem 0 0.25rem;
      }
      :host ::ng-deep .ProseMirror img.ProseMirror-selectednode {
        outline: 2px solid #0969da;
      }
    `
  ]
})
export class RichTextEditorComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(BlogApiService);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  readonly content = input<string>('');
  readonly contentChange = output<string>();

  readonly editor = signal<Editor | null>(null);
  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly uploadName = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly dragging = signal(false);
  readonly linkModalOpen = signal(false);
  readonly linkUrl = signal('https://');
  readonly linkError = signal<string | null>(null);

  private skipEmit = false;
  private dragDepth = 0;
  private latestHtml = '';
  private readonly linkUrlInput = viewChild<ElementRef<HTMLInputElement>>('linkUrlInput');

  ngAfterViewInit(): void {
    const ed = new Editor({
      element: this.host().nativeElement,
      extensions: [
        StarterKit.configure({
          // TipTap v3 StarterKit includes Link — disable to avoid duplicates
          link: false
        }),
        ResizableImage.configure({
          inline: true,
          allowBase64: false,
          HTMLAttributes: { class: 'blog-image' }
        }),
        Link.configure({ openOnClick: false }),
        Placeholder.configure({
          placeholder: 'Write your post…'
        })
      ],
      content: this.content() || '',
      onUpdate: ({ editor }) => {
        if (this.skipEmit) return;
        this.latestHtml = editor.getHTML();
        this.contentChange.emit(this.latestHtml);
        this.editor.set(editor);
      },
      onSelectionUpdate: ({ editor }) => {
        this.editor.set(editor);
      },
      editorProps: {
        handlePaste: (_view, event) => {
          const items = event.clipboardData?.items;
          if (!items) return false;
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                event.preventDefault();
                void this.uploadAndInsert(file);
                return true;
              }
            }
          }
          return false;
        }
      }
    });
    this.latestHtml = ed.getHTML();
    this.editor.set(ed);
  }

  ngOnDestroy(): void {
    this.editor()?.destroy();
  }

  setHtml(html: string): void {
    const ed = this.editor();
    if (!ed) return;
    this.skipEmit = true;
    ed.commands.setContent(html || '');
    this.skipEmit = false;
    this.latestHtml = html || '';
    this.uploadName.set(null);
  }

  openLinkModal(): void {
    const ed = this.editor();
    if (!ed) return;
    const previous = (ed.getAttributes('link')['href'] as string | undefined) || 'https://';
    this.linkUrl.set(previous);
    this.linkError.set(null);
    this.linkModalOpen.set(true);
    queueMicrotask(() => {
      const input = this.linkUrlInput()?.nativeElement;
      if (!input) return;
      input.focus();
      input.select();
    });
  }

  closeLinkModal(): void {
    this.linkModalOpen.set(false);
    this.linkError.set(null);
    this.editor()?.chain().focus().run();
  }

  applyLink(): void {
    const ed = this.editor();
    if (!ed) return;

    let url = this.linkUrl().trim();
    if (!url || url === 'https://' || url === 'http://') {
      this.linkError.set('Enter a URL');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    try {
      // Validate URL shape
      new URL(url);
    } catch {
      this.linkError.set('Enter a valid URL');
      return;
    }

    const { empty } = ed.state.selection;
    if (empty) {
      ed.chain()
        .focus()
        .insertContent(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`)
        .run();
    } else {
      ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }

    this.latestHtml = ed.getHTML();
    this.contentChange.emit(this.latestHtml);
    this.closeLinkModal();
  }

  removeLink(): void {
    const ed = this.editor();
    if (!ed) return;
    ed.chain().focus().extendMarkRange('link').unsetLink().run();
    this.latestHtml = ed.getHTML();
    this.contentChange.emit(this.latestHtml);
    this.closeLinkModal();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.uploadAndInsert(file);
  }

  onDragEnter(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth += 1;
    this.dragging.set(true);
  }

  onDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void this.uploadAndInsert(file);
    }
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types && [...event.dataTransfer.types].includes('Files');
  }

  private async uploadAndInsert(file: File): Promise<void> {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      this.uploadError.set('Use jpeg, png, webp, or gif');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set('Image must be under 5MB');
      return;
    }

    this.uploading.set(true);
    this.uploadProgress.set(5);
    this.uploadError.set(null);
    this.uploadName.set(file.name);

    const progressTimer = window.setInterval(() => {
      this.uploadProgress.update((p) => (p < 90 ? p + 7 : p));
    }, 160);

    try {
      const meta = await new Promise<{ uploadUrl: string; publicUrl: string }>((resolve, reject) => {
        this.api.createUpload(file.type).subscribe({
          next: resolve,
          error: (err) => reject(err)
        });
      });

      this.uploadProgress.set(50);

      const put = await fetch(meta.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);

      this.uploadProgress.set(100);
      const alt = file.name.replace(/\.[^.]+$/, '');
      this.editor()
        ?.chain()
        .focus()
        .setImage({ src: meta.publicUrl, alt })
        .updateAttributes('image', { width: '100%', alt, title: alt })
        .run();
      this.latestHtml = this.editor()?.getHTML() || '';
      this.contentChange.emit(this.latestHtml);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: { error?: string } }).error?.error || 'Upload failed')
          : err instanceof Error
            ? err.message
            : 'Upload failed';
      this.uploadError.set(message);
    } finally {
      window.clearInterval(progressTimer);
      this.uploading.set(false);
      this.uploadProgress.set(0);
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

