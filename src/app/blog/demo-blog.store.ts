import type { BlogPost, BlogPostInput, BlogRevisionSummary } from './blog.types';
import { EXAMPLE_POSTS } from './example-posts';

function clonePosts(): BlogPost[] {
  return structuredClone(EXAMPLE_POSTS);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'post';
}

/** In-memory store used when environment.useDemoData is true. */
export class DemoBlogStore {
  private posts: BlogPost[] = clonePosts();
  private revisions = new Map<string, BlogRevisionSummary[]>();

  reset(): void {
    this.posts = clonePosts();
    this.revisions.clear();
  }

  listPublished(): BlogPost[] {
    return this.posts.filter((p) => p.status === 'published');
  }

  getPublished(slug: string): BlogPost | undefined {
    return this.listPublished().find((p) => p.slug === slug);
  }

  listAdmin(): BlogPost[] {
    return [...this.posts].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  getAdmin(id: string): BlogPost | undefined {
    return this.posts.find((p) => p.id === id);
  }

  createDraft(input: BlogPostInput): BlogPost {
    const now = new Date().toISOString();
    const post: BlogPost = {
      id: `demo-${Date.now()}`,
      slug: input.slug || slugify(input.title),
      title: input.title,
      excerpt: input.excerpt || '',
      body: input.body ?? { format: 'html', html: '' },
      status: 'draft',
      eventDate: input.eventDate,
      publishedAt: null,
      updatedAt: now,
      createdAt: now,
      coverImage: input.coverImage ?? null,
      images: input.images || []
    };
    this.posts.unshift(post);
    this.pushRevision(post, 'create');
    return post;
  }

  updatePost(id: string, input: Partial<BlogPostInput>): BlogPost {
    const post = this.require(id);
    Object.assign(post, {
      ...input,
      updatedAt: new Date().toISOString()
    });
    this.pushRevision(post, 'update');
    return post;
  }

  publish(id: string): BlogPost {
    const post = this.require(id);
    post.status = 'published';
    post.publishedAt = new Date().toISOString();
    post.scheduledFor = null;
    post.updatedAt = post.publishedAt;
    this.pushRevision(post, 'publish');
    return post;
  }

  schedule(id: string, scheduledFor: string): BlogPost {
    const post = this.require(id);
    post.status = 'scheduled';
    post.scheduledFor = scheduledFor;
    post.updatedAt = new Date().toISOString();
    this.pushRevision(post, 'schedule');
    return post;
  }

  unschedule(id: string): BlogPost {
    const post = this.require(id);
    post.status = 'draft';
    post.scheduledFor = null;
    post.updatedAt = new Date().toISOString();
    this.pushRevision(post, 'unschedule');
    return post;
  }

  unpublish(id: string): BlogPost {
    const post = this.require(id);
    post.status = 'draft';
    post.publishedAt = null;
    post.updatedAt = new Date().toISOString();
    this.pushRevision(post, 'unpublish');
    return post;
  }

  deletePost(id: string): void {
    this.posts = this.posts.filter((p) => p.id !== id);
    this.revisions.delete(id);
  }

  listRevisions(id: string): BlogRevisionSummary[] {
    return this.revisions.get(id) || [];
  }

  private require(id: string): BlogPost {
    const post = this.getAdmin(id);
    if (!post) throw new Error('Post not found');
    return post;
  }

  private pushRevision(post: BlogPost, action: BlogRevisionSummary['action']): void {
    const list = this.revisions.get(post.id) || [];
    list.unshift({
      revisionId: `rev-${Date.now()}`,
      postId: post.id,
      action,
      editedBy: 'author@example.com',
      createdAt: new Date().toISOString(),
      changedFields: ['title', 'body', 'status'],
      title: post.title,
      status: post.status || 'draft',
      eventDate: post.eventDate
    });
    this.revisions.set(post.id, list);
  }
}

export const demoBlogStore = new DemoBlogStore();
