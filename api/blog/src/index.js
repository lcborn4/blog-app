import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const TABLE = process.env.POSTS_TABLE;
const REVISIONS_TABLE = process.env.REVISIONS_TABLE;
const BUCKET = process.env.MEDIA_BUCKET;
const MAX_IMAGES = Number(process.env.MAX_IMAGES_PER_POST || 12);
const MAX_REVISIONS_PER_POST = 50;
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body)
  };
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function eventDateKey(eventDate, id) {
  // ISO date preferred: 2025-07-12 — sort newest first with reverse query later
  return `${eventDate}#${id}`;
}

function getClaims(event) {
  return (
    event.requestContext?.authorizer?.jwt?.claims ||
    event.requestContext?.authorizer?.claims ||
    {}
  );
}

function requireAllowlistedAdmin(event) {
  const claims = getClaims(event);
  const email = String(claims.email || '').toLowerCase();
  const verified = String(claims.email_verified || '') === 'true' || claims.email_verified === true;

  if (!email || !ALLOWED_EMAILS.includes(email)) {
    return { ok: false, error: response(403, { error: 'Forbidden: email not allowlisted' }) };
  }
  if (!verified) {
    return { ok: false, error: response(403, { error: 'Forbidden: email not verified' }) };
  }
  return { ok: true, email, claims };
}

function publicPostView(item) {
  if (!item) return null;
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt || '',
    body: item.body || { type: 'doc', content: [] },
    eventDate: item.eventDate,
    publishedAt: item.publishedAt || null,
    updatedAt: item.updatedAt,
    coverImage: item.coverImage || null,
    images: item.images || []
  };
}

function adminPostView(item) {
  return {
    ...publicPostView(item),
    status: item.status,
    scheduledFor: item.scheduledFor || null,
    createdAt: item.createdAt,
    createdBy: item.createdBy || null
  };
}

function snapshotFromPost(post) {
  return {
    title: post.title,
    excerpt: post.excerpt || '',
    body: post.body || { type: 'doc', content: [] },
    eventDate: post.eventDate,
    status: post.status,
    slug: post.slug,
    coverImage: post.coverImage || null,
    images: post.images || [],
    publishedAt: post.publishedAt || null,
    scheduledFor: post.scheduledFor || null
  };
}

function revisionListView(item) {
  return {
    revisionId: item.revisionId,
    postId: item.postId,
    action: item.action,
    editedBy: item.editedBy || null,
    createdAt: item.createdAt,
    changedFields: item.changedFields || [],
    title: item.title,
    status: item.status,
    eventDate: item.eventDate
  };
}

function revisionDetailView(item) {
  return {
    ...revisionListView(item),
    excerpt: item.excerpt || '',
    body: item.body || { type: 'doc', content: [] },
    slug: item.slug,
    coverImage: item.coverImage || null,
    images: item.images || [],
    publishedAt: item.publishedAt || null,
    scheduledFor: item.scheduledFor || null
  };
}

function diffChangedFields(before, after) {
  const fields = ['title', 'excerpt', 'body', 'eventDate', 'slug', 'coverImage', 'images', 'status', 'publishedAt', 'scheduledFor'];
  const changed = [];
  for (const field of fields) {
    if (JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null)) {
      changed.push(field);
    }
  }
  return changed;
}

async function listRevisions(postId) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: REVISIONS_TABLE,
      KeyConditionExpression: 'postId = :postId',
      ExpressionAttributeValues: { ':postId': postId },
      ScanIndexForward: false
    })
  );
  return res.Items || [];
}

async function getRevision(postId, revisionId) {
  const res = await ddb.send(
    new GetCommand({
      TableName: REVISIONS_TABLE,
      Key: { postId, revisionId }
    })
  );
  return res.Item || null;
}

async function trimRevisions(postId) {
  const items = await listRevisions(postId);
  if (items.length <= MAX_REVISIONS_PER_POST) return;
  const overflow = items.slice(MAX_REVISIONS_PER_POST);
  await Promise.all(
    overflow.map((item) =>
      ddb.send(
        new DeleteCommand({
          TableName: REVISIONS_TABLE,
          Key: { postId: item.postId, revisionId: item.revisionId }
        })
      )
    )
  );
}

async function writeRevision(post, { action, editedBy, changedFields = [] }) {
  if (!REVISIONS_TABLE || !post?.id) return null;
  const now = new Date().toISOString();
  const revisionId = `${now}_${randomUUID()}`;
  const item = {
    postId: post.id,
    revisionId,
    action,
    editedBy: editedBy || null,
    createdAt: now,
    changedFields,
    ...snapshotFromPost(post)
  };
  await ddb.send(new PutCommand({ TableName: REVISIONS_TABLE, Item: item }));
  await trimRevisions(post.id);
  return item;
}

async function deleteRevisionsForPost(postId) {
  if (!REVISIONS_TABLE) return;
  const items = await listRevisions(postId);
  await Promise.all(
    items.map((item) =>
      ddb.send(
        new DeleteCommand({
          TableName: REVISIONS_TABLE,
          Key: { postId: item.postId, revisionId: item.revisionId }
        })
      )
    )
  );
}

async function publishDueScheduledPosts() {
  const scheduled = await listByStatus('scheduled');
  const now = Date.now();
  const published = [];

  for (const item of scheduled) {
    const when = item.scheduledFor ? Date.parse(item.scheduledFor) : NaN;
    if (!Number.isFinite(when) || when > now) continue;

    const publishedAt = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { id: item.id },
        UpdateExpression:
          'SET #status = :status, publishedAt = :publishedAt, updatedAt = :updatedAt, eventDateKey = :eventDateKey REMOVE scheduledFor',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'published',
          ':publishedAt': publishedAt,
          ':updatedAt': publishedAt,
          ':eventDateKey': eventDateKey(item.eventDate, item.id)
        }
      })
    );
    published.push(item.id);
  }

  return published;
}

async function getBySlug(slug) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'bySlug',
      KeyConditionExpression: 'slug = :slug',
      ExpressionAttributeValues: { ':slug': slug },
      Limit: 1
    })
  );
  return res.Items?.[0] || null;
}

async function getById(id) {
  const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  return res.Item || null;
}

async function listByStatus(status, { year, month } = {}) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'byStatusEventDate',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': status },
      ScanIndexForward: false
    })
  );

  let items = res.Items || [];
  if (year) {
    const prefix = month ? `${year}-${String(month).padStart(2, '0')}` : String(year);
    items = items.filter((p) => String(p.eventDate || '').startsWith(prefix));
  }
  return items;
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function validatePostPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') return 'Invalid JSON body';
  if (!partial || body.title !== undefined) {
    if (!body.title || String(body.title).trim().length < 1) return 'title is required';
  }
  if (!partial || body.eventDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.eventDate || ''))) {
      return 'eventDate must be YYYY-MM-DD';
    }
  }
  if (body.images !== undefined) {
    if (!Array.isArray(body.images)) return 'images must be an array';
    if (body.images.length > MAX_IMAGES) return `max ${MAX_IMAGES} images per post`;
  }
  return null;
}

function normalizePath(event) {
  let path = event.requestContext?.http?.path || event.rawPath || event.path || '/';
  // HTTP API stage name can appear as a prefix (e.g. /prod/posts)
  if (path === '/prod') path = '/';
  if (path.startsWith('/prod/')) path = path.slice('/prod'.length);
  return path;
}

export async function handler(event) {
  // EventBridge schedule: publish due posts
  if (event?.source === 'aws.events' || event?.action === 'publishDue') {
    const publishedIds = await publishDueScheduledPosts();
    return response(200, { published: publishedIds.length, ids: publishedIds });
  }

  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = normalizePath(event);
  const params = event.pathParameters || {};

  if (method === 'OPTIONS') {
    return response(204, {});
  }

  try {
    // Promote any due scheduled posts before public reads (near-real-time).
    if (method === 'GET' && (path === '/posts' || path.startsWith('/posts/') || path.startsWith('/archive/'))) {
      await publishDueScheduledPosts();
    }

    // Public
    if (method === 'GET' && path === '/posts') {
      const items = await listByStatus('published');
      return response(200, { posts: items.map(publicPostView) });
    }

    if (method === 'GET' && params.slug && path.startsWith('/posts/')) {
      const item = await getBySlug(params.slug);
      if (!item || item.status !== 'published') {
        return response(404, { error: 'Post not found' });
      }
      return response(200, { post: publicPostView(item) });
    }

    if (method === 'GET' && path.startsWith('/archive/')) {
      const year = params.year;
      const month = params.month;
      const items = await listByStatus('published', { year, month });
      return response(200, { posts: items.map(publicPostView), year, month: month || null });
    }

    // Admin (JWT authorizer already ran; allowlist check here)
    const admin = requireAllowlistedAdmin(event);
    if (path.startsWith('/admin') && !admin.ok) return admin.error;

    if (method === 'GET' && path === '/admin/me') {
      return response(200, { email: admin.email, allowedEmails: ALLOWED_EMAILS });
    }

    if (method === 'GET' && path === '/admin/posts') {
      await publishDueScheduledPosts();
      const [drafts, scheduled, published] = await Promise.all([
        listByStatus('draft'),
        listByStatus('scheduled'),
        listByStatus('published')
      ]);
      const posts = [...drafts, ...scheduled, ...published]
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .map(adminPostView);
      return response(200, { posts });
    }

    if (method === 'POST' && path === '/admin/posts') {
      const body = parseBody(event);
      if (body === null) return response(400, { error: 'Invalid JSON' });
      const err = validatePostPayload(body);
      if (err) return response(400, { error: err });

      const id = randomUUID();
      const now = new Date().toISOString();
      const baseSlug = slugify(body.slug || body.title) || id.slice(0, 8);
      let slug = baseSlug;
      let attempt = 1;
      while (await getBySlug(slug)) {
        attempt += 1;
        slug = `${baseSlug}-${attempt}`;
      }

      const item = {
        id,
        slug,
        title: String(body.title).trim(),
        excerpt: String(body.excerpt || '').trim(),
        body: body.body || { type: 'doc', content: [] },
        status: 'draft',
        eventDate: body.eventDate,
        eventDateKey: eventDateKey(body.eventDate, id),
        publishedAt: null,
        scheduledFor: null,
        createdAt: now,
        updatedAt: now,
        createdBy: admin.email,
        coverImage: body.coverImage || null,
        images: Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : []
      };

      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      await writeRevision(item, {
        action: 'create',
        editedBy: admin.email,
        changedFields: ['title', 'excerpt', 'body', 'eventDate', 'status']
      });
      return response(201, { post: adminPostView(item) });
    }

    if (method === 'GET' && params.id && path.match(/^\/admin\/posts\/[^/]+\/revisions$/)) {
      const existing = await getById(params.id);
      if (!existing) return response(404, { error: 'Post not found' });
      const revisions = await listRevisions(params.id);
      return response(200, { revisions: revisions.map(revisionListView) });
    }

    if (
      method === 'GET' &&
      params.id &&
      params.revisionId &&
      path.match(/^\/admin\/posts\/[^/]+\/revisions\/[^/]+$/)
    ) {
      const existing = await getById(params.id);
      if (!existing) return response(404, { error: 'Post not found' });
      const revision = await getRevision(params.id, params.revisionId);
      if (!revision) return response(404, { error: 'Revision not found' });
      return response(200, { revision: revisionDetailView(revision) });
    }

    if (
      method === 'POST' &&
      params.id &&
      params.revisionId &&
      path.endsWith('/restore')
    ) {
      const existing = await getById(params.id);
      if (!existing) return response(404, { error: 'Post not found' });
      const revision = await getRevision(params.id, params.revisionId);
      if (!revision) return response(404, { error: 'Revision not found' });

      await writeRevision(existing, {
        action: 'restore',
        editedBy: admin.email,
        changedFields: diffChangedFields(snapshotFromPost(existing), snapshotFromPost(revision))
      });

      let slug = revision.slug || existing.slug;
      if (slug !== existing.slug) {
        const clash = await getBySlug(slug);
        if (clash && clash.id !== existing.id) {
          slug = existing.slug;
        }
      }

      const now = new Date().toISOString();
      const item = {
        ...existing,
        slug,
        title: revision.title,
        excerpt: revision.excerpt || '',
        body: revision.body || { type: 'doc', content: [] },
        eventDate: revision.eventDate,
        eventDateKey: eventDateKey(revision.eventDate, existing.id),
        status: revision.status || existing.status,
        publishedAt: revision.publishedAt ?? existing.publishedAt,
        scheduledFor: revision.scheduledFor ?? null,
        coverImage: revision.coverImage ?? null,
        images: Array.isArray(revision.images) ? revision.images.slice(0, MAX_IMAGES) : [],
        updatedAt: now
      };

      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      return response(200, { post: adminPostView(item), restoredFrom: params.revisionId });
    }

    if (method === 'GET' && params.id && path.match(/^\/admin\/posts\/[^/]+$/)) {
      const item = await getById(params.id);
      if (!item) return response(404, { error: 'Post not found' });
      return response(200, { post: adminPostView(item) });
    }

    if (method === 'PUT' && params.id && path.match(/^\/admin\/posts\/[^/]+$/)) {
      const existing = await getById(params.id);
      if (!existing) return response(404, { error: 'Post not found' });

      const body = parseBody(event);
      if (body === null) return response(400, { error: 'Invalid JSON' });
      const err = validatePostPayload(body, { partial: true });
      if (err) return response(400, { error: err });

      const now = new Date().toISOString();
      let slug = existing.slug;
      if (body.slug && slugify(body.slug) !== existing.slug) {
        const candidate = slugify(body.slug);
        const clash = await getBySlug(candidate);
        if (clash && clash.id !== existing.id) {
          return response(409, { error: 'slug already in use' });
        }
        slug = candidate;
      }

      const eventDate = body.eventDate || existing.eventDate;
      const images =
        body.images !== undefined
          ? body.images.slice(0, MAX_IMAGES)
          : existing.images || [];

      const item = {
        ...existing,
        slug,
        title: body.title !== undefined ? String(body.title).trim() : existing.title,
        excerpt: body.excerpt !== undefined ? String(body.excerpt).trim() : existing.excerpt,
        body: body.body !== undefined ? body.body : existing.body,
        eventDate,
        eventDateKey: eventDateKey(eventDate, existing.id),
        coverImage: body.coverImage !== undefined ? body.coverImage : existing.coverImage,
        images,
        updatedAt: now
      };

      const changedFields = diffChangedFields(snapshotFromPost(existing), snapshotFromPost(item));
      await writeRevision(existing, {
        action: 'update',
        editedBy: admin.email,
        changedFields
      });
      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      return response(200, { post: adminPostView(item) });
    }

    if (method === 'POST' && params.id && path.endsWith('/publish')) {
      const existing = await getById(params.id);
      if (!existing) return response(404, { error: 'Post not found' });
      const now = new Date().toISOString();
      const publishedAt = existing.publishedAt || now;
      await writeRevision(existing, {
        action: 'publish',
        editedBy: admin.email,
        changedFields: ['status', 'publishedAt', 'scheduledFor']
      });
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { id: existing.id },
          UpdateExpression:
            'SET #status = :status, publishedAt = :publishedAt, updatedAt = :updatedAt, eventDateKey = :eventDateKey REMOVE scheduledFor',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'published',
            ':publishedAt': publishedAt,
            ':updatedAt': now,
            ':eventDateKey': eventDateKey(existing.eventDate, existing.id)
          }
        })
      );
      const item = {
        ...existing,
        status: 'published',
        publishedAt,
        scheduledFor: null,
        updatedAt: now
      };
      return response(200, { post: adminPostView(item) });
    }

    if (method === 'POST' && params.id && path.endsWith('/unschedule')) {
      const existing = await getById(params.id);
      if (!existing) return response(404, { error: 'Post not found' });
      const now = new Date().toISOString();
      await writeRevision(existing, {
        action: 'unschedule',
        editedBy: admin.email,
        changedFields: ['status', 'scheduledFor']
      });
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { id: existing.id },
          UpdateExpression:
            'SET #status = :status, updatedAt = :updatedAt, eventDateKey = :eventDateKey REMOVE scheduledFor',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'draft',
            ':updatedAt': now,
            ':eventDateKey': eventDateKey(existing.eventDate, existing.id)
          }
        })
      );
      const item = { ...existing, status: 'draft', scheduledFor: null, updatedAt: now };
      return response(200, { post: adminPostView(item) });
    }

    if (method === 'POST' && params.id && /\/schedule$/.test(path)) {
      const existing = await getById(params.id);
      if (!existing) return response(404, { error: 'Post not found' });
      const body = parseBody(event);
      if (body === null) return response(400, { error: 'Invalid JSON' });

      const scheduledFor = String(body.scheduledFor || '').trim();
      const when = Date.parse(scheduledFor);
      if (!Number.isFinite(when)) {
        return response(400, { error: 'scheduledFor must be a valid ISO datetime' });
      }
      if (when <= Date.now()) {
        return response(400, { error: 'scheduledFor must be in the future' });
      }

      const now = new Date().toISOString();
      const iso = new Date(when).toISOString();
      await writeRevision(existing, {
        action: 'schedule',
        editedBy: admin.email,
        changedFields: ['status', 'scheduledFor']
      });
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { id: existing.id },
          UpdateExpression:
            'SET #status = :status, scheduledFor = :scheduledFor, updatedAt = :updatedAt, eventDateKey = :eventDateKey',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'scheduled',
            ':scheduledFor': iso,
            ':updatedAt': now,
            ':eventDateKey': eventDateKey(existing.eventDate, existing.id)
          }
        })
      );
      const item = {
        ...existing,
        status: 'scheduled',
        scheduledFor: iso,
        updatedAt: now
      };
      return response(200, { post: adminPostView(item) });
    }

    if (method === 'POST' && params.id && path.endsWith('/unpublish')) {
      const existing = await getById(params.id);
      if (!existing) return response(404, { error: 'Post not found' });
      const now = new Date().toISOString();
      await writeRevision(existing, {
        action: 'unpublish',
        editedBy: admin.email,
        changedFields: ['status', 'scheduledFor']
      });
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { id: existing.id },
          UpdateExpression:
            'SET #status = :status, updatedAt = :updatedAt, eventDateKey = :eventDateKey REMOVE scheduledFor',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'draft',
            ':updatedAt': now,
            ':eventDateKey': eventDateKey(existing.eventDate, existing.id)
          }
        })
      );
      const item = { ...existing, status: 'draft', scheduledFor: null, updatedAt: now };
      return response(200, { post: adminPostView(item) });
    }

    if (method === 'DELETE' && params.id && path.match(/^\/admin\/posts\/[^/]+$/)) {
      const existing = await getById(params.id);
      if (!existing) return response(404, { error: 'Post not found' });
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id: existing.id } }));
      await deleteRevisionsForPost(existing.id);
      return response(200, { ok: true });
    }

    if (method === 'POST' && path === '/admin/uploads') {
      const body = parseBody(event);
      if (body === null) return response(400, { error: 'Invalid JSON' });

      const contentType = String(body.contentType || '');
      if (!/^image\/(jpeg|png|webp|gif)$/.test(contentType)) {
        return response(400, { error: 'contentType must be image/jpeg|png|webp|gif' });
      }

      const ext =
        contentType === 'image/png'
          ? 'png'
          : contentType === 'image/webp'
            ? 'webp'
            : contentType === 'image/gif'
              ? 'gif'
              : 'jpg';

      const key = `uploads/${admin.email.replace(/[^a-z0-9.@_-]/gi, '_')}/${randomUUID()}.${ext}`;
      const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
      const region = process.env.AWS_REGION || 'us-east-1';
      const publicUrl = `https://${BUCKET}.s3.${region}.amazonaws.com/${key}`;

      return response(200, {
        uploadUrl,
        publicUrl,
        key,
        bucket: BUCKET,
        maxImagesPerPost: MAX_IMAGES
      });
    }

    return response(404, { error: `No route for ${method} ${path}` });
  } catch (err) {
    console.error(err);
    return response(500, { error: 'Internal server error' });
  }
}
