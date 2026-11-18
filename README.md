# blog-app

Live (Logan Born): https://loganborn.com/blog · Admin: https://loganborn.com/blog/admin

Public **source** repo for a portable Angular blog (Cognito admin + AWS SAM API). It is **not deployed from this repo**.

## How loganborn.com ships it

1. Push blog changes here (`main`)
2. Push (or manually run) **wolverine** `master` deploy
3. Wolverine’s GitHub Action checks out this repo, builds with wolverine secrets, syncs to the blog S3 bucket
4. CloudFront on loganborn.com routes `/blog*` to that bucket; the portfolio links to `/blog`

Secrets live only on **wolverine** (not here).

A portable **Angular blog** with a Cognito-protected **admin** and an **AWS SAM** backend (API Gateway HTTP API, Lambda, DynamoDB, S3 media, scheduled publish).

Extracted so the same codebase can power multiple sites (different domains / AWS accounts) via config.

## Features

- Public blog index with date filters and year/month archive rail
- Post pages with rich HTML body and images
- Admin UI: drafts, rich-text editor (TipTap), image upload, publish / schedule / unpublish
- Revision history + restore
- Google sign-in via Amazon Cognito (email allowlist)

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Angular 22, Tailwind CSS, TipTap |
| Auth | Cognito Hosted UI + Google IdP (PKCE) |
| API | AWS SAM, Node 22 Lambda, HTTP API |
| Data | DynamoDB (posts + revisions), S3 (media) |

## Repo layout

```
src/app/blog/     Public blog UI + API client
src/app/admin/    Login, auth, admin editor
api/blog/         SAM template + Lambda handler
src/environments/ Per-deploy config (API URL, Cognito, allowlist)
```

## Quick start (frontend)

```bash
npm install
# Edit src/environments/environment.ts with your API + Cognito values
npm start
```

Open `http://localhost:4200/blog` and `http://localhost:4200/blog/admin` (with `baseHref` `/blog/`).

## Deploy API (per site)

1. Create a Cognito user pool + app client + Google IdP + hosted UI domain.
2. Allowlist callback URLs: `https://YOUR_DOMAIN/blog/admin`, localhost equivalents, and matching logout URLs under `/blog/`.
3. From `api/blog`:

```bash
npm install --prefix src
sam build
sam deploy --guided
```

4. For loganborn.com frontend hosting, use **wolverine** CI — do not add deploy secrets to this public repo.

## Multi-site

Use **one repo**, **two AWS accounts** (or stacks):

| Site | Prefix | Domain | Env file values |
|------|--------|--------|-----------------|
| Yours | `yoursite` | your domain | your Cognito + API |
| Family | `theirsite` | their domain | their Cognito + API |

Same code; separate data, billing, and auth.

## Security note

Environment files in this public repo use **placeholders**. Put real Cognito IDs / allowlisted emails only in private deploy config or CI secrets if you need them kept private.

## License

MIT
