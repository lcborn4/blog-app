export type BlogStatus = 'draft' | 'scheduled' | 'published';

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
