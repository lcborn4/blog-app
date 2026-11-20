import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';
import type { Editor, NodeViewRendererProps } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { ImageLayout } from '../blog/blog-config';

declare module '@tiptap/extension-image' {
  interface ImageOptions {
    layout: ImageLayout;
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImageWidth: (width: string | null) => ReturnType;
    };
  }
}

function normalizeWidth(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return `${trimmed}px`;
  return trimmed;
}

function applyWidth(
  dom: HTMLElement,
  img: HTMLImageElement,
  width: string | null | undefined,
  layout: ImageLayout
): void {
  const next = normalizeWidth(width) || '100%';
  dom.style.width = next;
  dom.style.maxWidth = '100%';
  if (layout === 'column') {
    dom.style.display = 'block';
    dom.style.marginLeft = 'auto';
    dom.style.marginRight = 'auto';
    dom.style.marginTop = '1.25rem';
    dom.style.marginBottom = '1.25rem';
    dom.style.textAlign = 'center';
    dom.style.verticalAlign = '';
  } else {
    dom.style.display = 'inline-block';
    dom.style.marginLeft = '0';
    dom.style.marginRight = '1rem';
    dom.style.marginTop = '0.5rem';
    dom.style.marginBottom = '0.5rem';
    dom.style.textAlign = '';
    dom.style.verticalAlign = 'top';
  }
  img.style.width = '100%';
  img.style.height = 'auto';
  img.style.maxWidth = '100%';
  img.style.display = 'block';
}

function currentPos(getPos: NodeViewRendererProps['getPos']): number | null {
  if (typeof getPos !== 'function') return null;
  const pos = getPos();
  return typeof pos === 'number' ? pos : null;
}

function syncWidthButtons(toolbar: HTMLElement, width: string | null | undefined): void {
  const normalized = normalizeWidth(width) || '100%';
  toolbar.querySelectorAll<HTMLButtonElement>('[data-width]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset['width'] === normalized);
  });
}

function reselect(editor: Editor, getPos: NodeViewRendererProps['getPos']): void {
  const pos = currentPos(getPos);
  if (pos === null) return;
  // Keep node selected after toolbar actions so the floating menu stays open.
  requestAnimationFrame(() => {
    editor.commands.setNodeSelection(pos);
  });
}

function createImageToolbar(
  editor: Editor,
  getPos: NodeViewRendererProps['getPos'],
  onCaption: () => void,
  onInteract: (active: boolean) => void
): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'rte-image-toolbar';
  toolbar.setAttribute('contenteditable', 'false');

  const sizeLabel = document.createElement('span');
  sizeLabel.className = 'rte-image-toolbar-label';
  sizeLabel.textContent = 'Size';
  toolbar.appendChild(sizeLabel);

  const sizes: Array<{ label: string; width: string; title: string }> = [
    { label: 'S', width: '33%', title: 'Small (33%)' },
    { label: 'M', width: '66%', title: 'Medium (66%)' },
    { label: 'Full', width: '100%', title: 'Full width' }
  ];

  for (const size of sizes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rte-image-toolbar-btn';
    btn.textContent = size.label;
    btn.title = size.title;
    btn.dataset['width'] = size.width;
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onInteract(true);
      const pos = currentPos(getPos);
      if (pos === null) return;
      editor
        .chain()
        .setNodeSelection(pos)
        .updateAttributes('image', { width: size.width })
        .setNodeSelection(pos)
        .run();
      reselect(editor, getPos);
      window.setTimeout(() => onInteract(false), 50);
    });
    toolbar.appendChild(btn);
  }

  const divider = document.createElement('span');
  divider.className = 'rte-image-toolbar-divider';
  toolbar.appendChild(divider);

  const captionBtn = document.createElement('button');
  captionBtn.type = 'button';
  captionBtn.className = 'rte-image-toolbar-btn';
  captionBtn.textContent = 'Caption';
  captionBtn.title = 'Edit caption';
  captionBtn.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onInteract(true);
    onCaption();
  });
  toolbar.appendChild(captionBtn);

  toolbar.addEventListener(
    'pointerdown',
    (event) => {
      event.stopPropagation();
      onInteract(true);
    },
    true
  );

  return toolbar;
}

export const ResizableImage = Image.extend({
  name: 'image',

  addOptions() {
    return {
      ...this.parent!(),
      /** Set from environment.imageLayout at editor bootstrap. */
      layout: 'column' as ImageLayout
    };
  },

  inline() {
    return this.options.layout === 'inline';
  },

  group() {
    return this.options.layout === 'inline' ? 'inline' : 'block';
  },

  draggable: true,
  atom: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (element: HTMLElement) => {
          const img =
            element.tagName === 'IMG'
              ? element
              : element.querySelector?.('img') || element;
          return (
            normalizeWidth(
              (img as HTMLElement).getAttribute?.('width') ||
                (img as HTMLElement).style?.width
            ) || '100%'
          );
        },
        renderHTML: () => ({})
      },
      caption: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          if (element.tagName === 'FIGURE') {
            return element.querySelector('figcaption')?.textContent?.trim() || null;
          }
          return (
            element.getAttribute('data-caption') ||
            element.getAttribute('title') ||
            null
          );
        },
        renderHTML: () => ({})
      },
      title: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const img =
            element.tagName === 'IMG'
              ? element
              : element.querySelector?.('img') || element;
          return (img as HTMLElement).getAttribute?.('title');
        },
        renderHTML: (attributes: { title?: string | null; caption?: string | null; alt?: string | null }) => {
          const title = attributes.title || attributes.caption || attributes.alt;
          return title ? { title } : {};
        }
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure.blog-figure',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const img = element.querySelector('img');
          if (!img) return false;
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
            width:
              normalizeWidth(
                element.style.width ||
                  img.getAttribute('width') ||
                  img.style.width
              ) || '100%',
            caption: element.querySelector('figcaption')?.textContent?.trim() || null
          };
        }
      },
      {
        tag: 'img[src]'
      }
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const layout = (this.options.layout as ImageLayout) || 'column';
    const width = normalizeWidth(node.attrs['width']) || '100%';
    const caption =
      typeof node.attrs['caption'] === 'string' ? node.attrs['caption'].trim() : '';
    const alt = (HTMLAttributes['alt'] as string | undefined) || caption || null;
    const title =
      (HTMLAttributes['title'] as string | undefined) || caption || alt || null;

    const imgAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      class: 'blog-image',
      style: 'width: 100%; height: auto; max-width: 100%;',
      ...(alt ? { alt } : {}),
      ...(title ? { title } : {})
    });
    delete imgAttrs['caption'];
    delete imgAttrs['data-caption'];
    delete imgAttrs['width'];

    const figureAttrs =
      layout === 'column'
        ? {
            class: 'blog-figure',
            style: `width: ${width}; max-width: 100%; margin-left: auto; margin-right: auto;`
          }
        : {
            class: 'blog-figure',
            style: `width: ${width}; max-width: 100%; display: inline-block; vertical-align: top; margin: 0.5rem 1rem 0.5rem 0;`
          };

    if (caption) {
      return [
        'figure',
        figureAttrs,
        ['img', imgAttrs],
        ['figcaption', {}, caption]
      ];
    }
    return ['figure', figureAttrs, ['img', imgAttrs]];
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageWidth:
        (width: string | null) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { width: normalizeWidth(width) || '100%' })
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }: NodeViewRendererProps) => {
      let currentNode: ProseMirrorNode = node;
      let menuLocked = false;
      const layout = (this.options.layout as ImageLayout) || 'column';

      const dom = document.createElement('figure');
      dom.className = `rte-image-node blog-figure rte-image-layout-${layout}`;
      dom.style.position = 'relative';
      dom.style.maxWidth = '100%';
      dom.style.boxSizing = 'border-box';

      const frame = document.createElement('div');
      frame.className = 'rte-image-frame';
      frame.style.position = 'relative';
      frame.style.lineHeight = '0';
      frame.style.width = '100%';

      const img = document.createElement('img');
      img.className = 'blog-image';
      img.src = currentNode.attrs['src'] || '';
      img.alt = currentNode.attrs['alt'] || currentNode.attrs['caption'] || '';
      img.title =
        currentNode.attrs['title'] ||
        currentNode.attrs['caption'] ||
        currentNode.attrs['alt'] ||
        '';
      img.draggable = false;
      img.style.borderRadius = '0.375rem';
      applyWidth(dom, img, currentNode.attrs['width'], layout);

      const captionInput = document.createElement('input');
      captionInput.type = 'text';
      captionInput.className = 'rte-image-caption-input';
      captionInput.placeholder = 'Add a caption…';
      captionInput.value = String(currentNode.attrs['caption'] || '');
      captionInput.setAttribute('contenteditable', 'false');

      const setMenuLocked = (active: boolean) => {
        menuLocked = active;
        if (active) {
          dom.classList.add('is-selected');
        }
      };

      const saveCaption = () => {
        const pos = currentPos(getPos);
        if (pos === null) return;
        const caption = captionInput.value.trim();
        const fallbackAlt = String(currentNode.attrs['alt'] || '');
        editor
          .chain()
          .setNodeSelection(pos)
          .updateAttributes('image', {
            caption: caption || null,
            alt: caption || fallbackAlt || null,
            title: caption || fallbackAlt || null
          })
          .setNodeSelection(pos)
          .run();
        setMenuLocked(false);
        reselect(editor, getPos);
      };

      captionInput.addEventListener('focus', () => setMenuLocked(true));
      captionInput.addEventListener('mousedown', (event) => {
        event.stopPropagation();
        setMenuLocked(true);
      });
      captionInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          captionInput.blur();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          captionInput.value = String(currentNode.attrs['caption'] || '');
          captionInput.blur();
        }
      });
      captionInput.addEventListener('blur', () => {
        saveCaption();
      });

      const toolbar = createImageToolbar(
        editor,
        getPos,
        () => {
          captionInput.focus();
          captionInput.select();
        },
        setMenuLocked
      );
      syncWidthButtons(toolbar, currentNode.attrs['width']);

      const handle = document.createElement('span');
      handle.className = 'rte-image-handle';
      handle.title = 'Drag to resize';
      handle.setAttribute('contenteditable', 'false');

      let startX = 0;
      let startWidth = 0;
      let resizing = false;

      const containerWidth = () =>
        dom.parentElement?.clientWidth || editor.view.dom.clientWidth || 1;

      const onPointerMove = (event: PointerEvent) => {
        if (!resizing) return;
        const delta = event.clientX - startX;
        const nextPx = Math.min(containerWidth(), Math.max(80, startWidth + delta));
        const pct = Math.round((nextPx / containerWidth()) * 100);
        const clamped = Math.min(100, Math.max(10, pct));
        applyWidth(dom, img, `${clamped}%`, layout);
      };

      const stopResize = (event: PointerEvent) => {
        if (!resizing) return;
        resizing = false;
        handle.releasePointerCapture(event.pointerId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', stopResize);

        const pct = Math.round((dom.getBoundingClientRect().width / containerWidth()) * 100);
        const width = `${Math.min(100, Math.max(10, pct))}%`;

        const pos = currentPos(getPos);
        if (pos !== null) {
          editor
            .chain()
            .setNodeSelection(pos)
            .updateAttributes('image', { width })
            .setNodeSelection(pos)
            .run();
        }
        setMenuLocked(false);
        reselect(editor, getPos);
      };

      handle.addEventListener('pointerdown', (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuLocked(true);
        resizing = true;
        startX = event.clientX;
        startWidth = dom.getBoundingClientRect().width;
        handle.setPointerCapture(event.pointerId);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', stopResize);
      });

      frame.appendChild(img);
      frame.appendChild(toolbar);
      frame.appendChild(handle);
      dom.appendChild(frame);
      dom.appendChild(captionInput);

      return {
        dom,
        ignoreMutation: () => true,
        selectNode: () => {
          dom.classList.add('is-selected');
          syncWidthButtons(toolbar, currentNode.attrs['width']);
        },
        deselectNode: () => {
          if (menuLocked || document.activeElement === captionInput) {
            dom.classList.add('is-selected');
            reselect(editor, getPos);
            return;
          }
          dom.classList.remove('is-selected');
        },
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image') return false;
          currentNode = updatedNode;
          img.src = updatedNode.attrs['src'] || '';
          img.alt = updatedNode.attrs['alt'] || updatedNode.attrs['caption'] || '';
          img.title =
            updatedNode.attrs['title'] ||
            updatedNode.attrs['caption'] ||
            updatedNode.attrs['alt'] ||
            '';
          applyWidth(dom, img, updatedNode.attrs['width'], layout);
          syncWidthButtons(toolbar, updatedNode.attrs['width']);
          if (document.activeElement !== captionInput) {
            captionInput.value = String(updatedNode.attrs['caption'] || '');
          }
          if (menuLocked) {
            dom.classList.add('is-selected');
          }
          return true;
        },
        destroy: () => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', stopResize);
        }
      };
    };
  }
});
