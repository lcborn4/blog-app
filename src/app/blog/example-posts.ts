import type { BlogPost } from './blog.types';

/** Sample posts for local demo mode and README captures. */
export const EXAMPLE_POSTS: BlogPost[] = [
  {
    id: 'demo-1',
    slug: 'hello-from-demo-mode',
    title: 'Hello from demo mode',
    excerpt: 'Ship a portable blog with Cognito admin and a SAM API — no backend running locally.',
    body: {
      format: 'html',
      html: `
        <p>This post is local <strong>demo data</strong>. Flip <code>useDemoData</code> off and point
        <code>blogApiUrl</code> at your deployed API when you are ready for real posts.</p>
        <p>The public index groups by event date, with a GitHub-style year/month rail on the side.</p>
      `
    },
    status: 'published',
    eventDate: '2026-11-18',
    publishedAt: '2026-11-18T15:00:00.000Z',
    updatedAt: '2026-11-18T15:00:00.000Z',
    createdAt: '2026-11-17T12:00:00.000Z',
    coverImage: null,
    images: []
  },
  {
    id: 'demo-2',
    slug: 'weekend-trail-notes',
    title: 'Weekend trail notes',
    excerpt: 'Event date can differ from the day you hit publish.',
    body: {
      format: 'html',
      html: `
        <p>Hiked the ridge before the weather turned. Notes for later:</p>
        <ul>
          <li>Start earlier next time</li>
          <li>Pack a second water bottle</li>
          <li>Phone photos still count as field notes</li>
        </ul>
        <p>Published a few days after the hike — the index still sorts by the event date.</p>
      `
    },
    status: 'published',
    eventDate: '2026-10-12',
    publishedAt: '2026-10-15T18:30:00.000Z',
    updatedAt: '2026-10-15T18:30:00.000Z',
    createdAt: '2026-10-15T17:00:00.000Z',
    coverImage: null,
    images: []
  },
  {
    id: 'demo-3',
    slug: 'shipping-the-admin',
    title: 'Shipping the admin',
    excerpt: 'Drafts, TipTap, schedule, and revision history live behind Google + Cognito.',
    body: {
      format: 'html',
      html: `
        <p>Authors sign in with Google through Cognito Hosted UI (PKCE). An email allowlist keeps the
        editor private while the public blog stays open.</p>
        <p>From admin you can save drafts, publish now, schedule for later, or restore an older revision.</p>
      `
    },
    status: 'published',
    eventDate: '2026-07-04',
    publishedAt: '2026-07-04T12:00:00.000Z',
    updatedAt: '2026-07-04T12:00:00.000Z',
    createdAt: '2026-07-01T09:00:00.000Z',
    coverImage: null,
    images: []
  },
  {
    id: 'demo-4',
    slug: 'spring-reading-list',
    title: 'Spring reading list',
    excerpt: 'A short list from earlier in the year for archive navigation demos.',
    body: {
      format: 'html',
      html: `
        <p>Three books that stuck:</p>
        <ol>
          <li><em>The Design of Everyday Things</em></li>
          <li><em>Staff Engineer</em></li>
          <li><em>Working in Public</em></li>
        </ol>
      `
    },
    status: 'published',
    eventDate: '2025-03-22',
    publishedAt: '2025-03-22T10:00:00.000Z',
    updatedAt: '2025-03-22T10:00:00.000Z',
    createdAt: '2025-03-20T10:00:00.000Z',
    coverImage: null,
    images: []
  },
  {
    id: 'demo-draft',
    slug: 'draft-ideas-for-next-week',
    title: 'Draft: ideas for next week',
    excerpt: 'Only visible in admin while still a draft.',
    body: {
      format: 'html',
      html: `<p>Rough notes — not on the public blog until you publish.</p>`
    },
    status: 'draft',
    eventDate: '2026-11-20',
    publishedAt: null,
    updatedAt: '2026-11-18T16:00:00.000Z',
    createdAt: '2026-11-18T16:00:00.000Z',
    coverImage: null,
    images: []
  },
  {
    id: 'demo-scheduled',
    slug: 'scheduled-release-notes',
    title: 'Scheduled: release notes',
    excerpt: 'Queued to go live later.',
    body: {
      format: 'html',
      html: `<p>This post is scheduled. Public readers will not see it until the cron/API publishes it.</p>`
    },
    status: 'scheduled',
    eventDate: '2026-11-25',
    publishedAt: null,
    scheduledFor: '2026-11-25T14:00:00.000Z',
    updatedAt: '2026-11-18T16:30:00.000Z',
    createdAt: '2026-11-18T16:30:00.000Z',
    coverImage: null,
    images: []
  }
];

export function examplePublishedPosts(): BlogPost[] {
  return EXAMPLE_POSTS.filter((p) => p.status === 'published');
}

export function examplePostBySlug(slug: string): BlogPost | undefined {
  return examplePublishedPosts().find((p) => p.slug === slug);
}

export function examplePostById(id: string): BlogPost | undefined {
  return EXAMPLE_POSTS.find((p) => p.id === id);
}
