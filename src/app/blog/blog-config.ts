import { environment } from '../../environments/environment';

/** How images present in the editor and public posts. */
export type ImageLayout = 'column' | 'inline';

/**
 * - column: centered stack with captions (trip photo diary)
 * - inline: classic flow; images can sit side by side
 */
export function imageLayout(): ImageLayout {
  const value = (environment as { imageLayout?: ImageLayout }).imageLayout;
  return value === 'inline' ? 'inline' : 'column';
}

export function isColumnImageLayout(): boolean {
  return imageLayout() === 'column';
}
