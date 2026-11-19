import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EXAMPLE_POSTS,
  examplePostBySlug,
  examplePublishedPosts
} from '../src/app/blog/example-posts.ts';
import { postedDayDiffers } from '../src/app/blog/posted-day.ts';
import { DemoBlogStore } from '../src/app/blog/demo-blog.store.ts';

describe('example posts', () => {
  it('includes published posts with unique slugs', () => {
    const published = examplePublishedPosts();
    assert.ok(published.length >= 3);
    const slugs = published.map((p) => p.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  it('keeps drafts and scheduled posts out of the public list', () => {
    const publicSlugs = new Set(examplePublishedPosts().map((p) => p.slug));
    for (const post of EXAMPLE_POSTS) {
      if (post.status !== 'published') {
        assert.equal(publicSlugs.has(post.slug), false);
      }
    }
  });

  it('looks up a post by slug', () => {
    const post = examplePostBySlug('weekend-trail-notes');
    assert.ok(post);
    assert.equal(post.title, 'Weekend trail notes');
  });

  it('flags when publish day differs from event day', () => {
    const post = examplePostBySlug('weekend-trail-notes')!;
    assert.equal(postedDayDiffers(post.eventDate, post.publishedAt), true);
    const sameDay = examplePostBySlug('hello-from-demo-mode')!;
    assert.equal(postedDayDiffers(sameDay.eventDate, sameDay.publishedAt), false);
  });
});

describe('DemoBlogStore', () => {
  it('publishes a draft into the public list', () => {
    const store = new DemoBlogStore();
    const draft = store.listAdmin().find((p) => p.status === 'draft');
    assert.ok(draft);
    const before = store.listPublished().length;
    store.publish(draft.id);
    assert.equal(store.listPublished().length, before + 1);
    assert.ok(store.getPublished(draft.slug));
  });

  it('creates a new draft from input', () => {
    const store = new DemoBlogStore();
    const created = store.createDraft({
      title: 'Fresh idea',
      eventDate: '2026-12-01',
      excerpt: 'Scratch pad'
    });
    assert.equal(created.status, 'draft');
    assert.equal(store.getAdmin(created.id)?.title, 'Fresh idea');
  });
});
