import Image from '@tiptap/extension-image';
import type { Editor, NodeViewRendererProps } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

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

function applyWidth(dom: HTMLElement, img: HTMLImageElement, width: string | null | undefined): void {
  const next = normalizeWidth(width) || '100%';
  dom.style.width = next;
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
  getAlt: () => string,
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
      // Keep menu open; release lock shortly after selection is restored.
      window.setTimeout(() => onInteract(false), 50);
    });
    toolbar.appendChild(btn);
  }

  const divider = document.createElement('span');
  divider.className = 'rte-image-toolbar-divider';
  toolbar.appendChild(divider);

  const altWrap = document.createElement('div');
  altWrap.className = 'rte-image-alt-wrap';

  const altBtn = document.createElement('button');
  altBtn.type = 'button';
  altBtn.className = 'rte-image-toolbar-btn';
  altBtn.textContent = 'Alt';
  altBtn.title = 'Edit alt text';

  const altPanel = document.createElement('div');
  altPanel.className = 'rte-image-alt-panel';
  altPanel.hidden = true;

  const altInput = document.createElement('input');
  altInput.type = 'text';
  altInput.className = 'rte-image-alt-input';
  altInput.placeholder = 'Describe this image';

  const altActions = document.createElement('div');
  altActions.className = 'rte-image-alt-actions';

  const closeAlt = () => {
    altPanel.hidden = true;
    onInteract(false);
    reselect(editor, getPos);
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeAlt();
  });

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'is-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pos = currentPos(getPos);
    if (pos === null) return;
    const alt = altInput.value.trim();
    editor
      .chain()
      .setNodeSelection(pos)
      .updateAttributes('image', { alt, title: alt })
      .setNodeSelection(pos)
      .run();
    altPanel.hidden = true;
    onInteract(false);
    reselect(editor, getPos);
  });

  altActions.appendChild(cancelBtn);
  altActions.appendChild(saveBtn);
  altPanel.appendChild(altInput);
  altPanel.appendChild(altActions);

  altBtn.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onInteract(true);
    altInput.value = getAlt();
    altPanel.hidden = !altPanel.hidden;
    if (!altPanel.hidden) {
      queueMicrotask(() => {
        altInput.focus();
        reselect(editor, getPos);
      });
    } else {
      onInteract(false);
      reselect(editor, getPos);
    }
  });

  // Focusing the input would normally clear node selection — keep menu locked open.
  altInput.addEventListener('focus', () => onInteract(true));
  altInput.addEventListener('mousedown', (event) => {
    event.stopPropagation();
    onInteract(true);
  });

  altInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: false, cancelable: true }));
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAlt();
    }
  });

  altWrap.appendChild(altBtn);
  altWrap.appendChild(altPanel);
  toolbar.appendChild(altWrap);

  // Any pointer interaction inside the toolbar should keep selection locked.
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

  inline: true,
  group: 'inline',
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (element: HTMLElement) =>
          normalizeWidth(element.getAttribute('width') || element.style.width) || '100%',
        renderHTML: (attributes: { width?: string | null }) => {
          const width = normalizeWidth(attributes.width) || '100%';
          return {
            width,
            style: `width: ${width}; height: auto; max-width: 100%;`
          };
        }
      },
      title: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('title'),
        renderHTML: (attributes: { title?: string | null; alt?: string | null }) => {
          const title = attributes.title || attributes.alt;
          return title ? { title } : {};
        }
      }
    };
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

      const dom = document.createElement('span');
      dom.className = 'rte-image-node';
      dom.style.display = 'inline-block';
      dom.style.position = 'relative';
      dom.style.lineHeight = '0';
      dom.style.maxWidth = '100%';
      dom.style.verticalAlign = 'top';
      dom.style.margin = '0.5rem 1rem 0.5rem 0';
      dom.style.boxSizing = 'border-box';

      const img = document.createElement('img');
      img.className = 'blog-image';
      img.src = currentNode.attrs['src'] || '';
      img.alt = currentNode.attrs['alt'] || '';
      img.title = currentNode.attrs['title'] || currentNode.attrs['alt'] || '';
      img.draggable = false;
      img.style.borderRadius = '0.375rem';
      applyWidth(dom, img, currentNode.attrs['width']);

      const setMenuLocked = (active: boolean) => {
        menuLocked = active;
        if (active) {
          dom.classList.add('is-selected');
        }
      };

      const toolbar = createImageToolbar(
        editor,
        getPos,
        () => String(currentNode.attrs['alt'] || ''),
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
        applyWidth(dom, img, `${clamped}%`);
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
          editor.chain().setNodeSelection(pos).updateAttributes('image', { width }).setNodeSelection(pos).run();
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

      dom.appendChild(img);
      dom.appendChild(toolbar);
      dom.appendChild(handle);

      return {
        dom,
        ignoreMutation: () => true,
        selectNode: () => {
          dom.classList.add('is-selected');
          syncWidthButtons(toolbar, currentNode.attrs['width']);
        },
        deselectNode: () => {
          // Clicking Size/Alt temporarily clears PM selection — keep menu open while locked
          // or while the alt field is focused.
          const altPanel = toolbar.querySelector<HTMLElement>('.rte-image-alt-panel');
          const altOpen = !!altPanel && !altPanel.hidden;
          if (menuLocked || altOpen || toolbar.contains(document.activeElement)) {
            dom.classList.add('is-selected');
            reselect(editor, getPos);
            return;
          }
          dom.classList.remove('is-selected');
          if (altPanel) altPanel.hidden = true;
        },
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image') return false;
          currentNode = updatedNode;
          img.src = updatedNode.attrs['src'] || '';
          img.alt = updatedNode.attrs['alt'] || '';
          img.title = updatedNode.attrs['title'] || updatedNode.attrs['alt'] || '';
          applyWidth(dom, img, updatedNode.attrs['width']);
          syncWidthButtons(toolbar, updatedNode.attrs['width']);
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
