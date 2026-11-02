# Scribe

AI Academic Document Generation SaaS for college students. Students upload or select their college's required academic document format, provide project information (text, PDFs, Word documents, GitHub links), and use AI to generate academic documents that follow the selected template.

**Name:** Scribe

**Primary audience:** Engineering and other college students in India  
**Currency:** INR (₹)

---

## Architecture

```
/
  apps/
    web/          # Frontend (React, Vite, TypeScript, Tailwind, shadcn/ui primitives)
    api/          # Backend (Node, Express, TypeScript, Supabase)
  packages/
    shared/       # Shared Zod schemas + TypeScript types
  supabase/
    migrations/   # SQL migrations (001_initial.sql … 010_generation_job_updated_at.sql)
    seed.sql      # Optional seed data
  .env.example    # Environment variable template (no secrets)
```

## Tech Stack

**Frontend:** React 19, Vite, TypeScript (strict), Tailwind CSS, shadcn/ui primitives (Radix), React Router, TanStack Query, React Hook Form + Zod, Lucide icons, Sonner toasts

**Backend:** Node.js, Express, TypeScript, Zod validation, Pino structured logging, Supabase Auth + PostgreSQL + Storage, Gemini AI provider (abstraction layer), Vitest + Supertest

**Database:** Supabase PostgreSQL with Row Level Security (RLS)

---

## Prerequisites

- Node.js >= 20
- npm (or pnpm)
- A Supabase project (free tier is fine for development)

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example files and fill in values:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env  # if you create one
```

### 3. Supabase setup

1. Create a project at https://app.supabase.com
2. Go to Settings → API, copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. Run migrations in order in the Supabase SQL Editor:
   1. `supabase/migrations/001_initial.sql`
   2. `supabase/migrations/002_job_queue.sql`
   3. `supabase/migrations/003_audit_logs.sql`
   4. `supabase/migrations/004_generation_and_versions.sql`
   5. `supabase/migrations/005_profiles_autocreate.sql`
   6. `supabase/migrations/006_security_and_billing_fixes.sql`
   7. `supabase/migrations/007_moderation_hardening.sql`
   8. `supabase/migrations/008_atomic_billing_grant.sql`
   9. `supabase/migrations/009_document_template_spec.sql`
   10. `supabase/migrations/010_generation_job_updated_at.sql`
4. Optionally run `supabase/seed.sql` for sample colleges/departments/templates
5. Create the three storage buckets (or they're created by the migration):
   - `project-resources` (private)
   - `templates` (private)
   - `generated-documents` (private)

### 4. Start the API

```bash
npm run dev:api
```

The API runs on `http://localhost:4000`. Health check: `http://localhost:4000/api/v1/healthz`

### 5. Start the frontend

```bash
npm run dev:web
```

The frontend runs on `http://localhost:5173`.

Open `http://localhost:5173` — register, sign in, and start creating projects.

### 6. Available scripts

From the repo root:

| Script | Description |
|--------|-------------|
| `npm run dev:api` | Start API in watch mode |
| `npm run dev:worker` | Start the generation worker (required when `GENERATION_MODE=worker`) |
| `npm run dev:web` | Start frontend dev server |
| `npm run build` | Build shared, API, and frontend for production |
| `npm run build:shared` / `build:api` / `build:web` | Build a single workspace |
| `npm run typecheck` | Type-check all workspaces |
| `npm run test` | Run all tests |
| `npm run test:shared` / `test:api` | Test a single workspace |
| `npm run lint` | Lint all workspaces |

---

## Environment Variables

### Server (`apps/api/.env` or repo-root `.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | `development`, `production`, or `test` | `development` |
| `PORT` | API port | `4000` |
| `API_URL` | Public API URL | `http://localhost:4000` |
| `FRONTEND_URL` | Frontend URL (CORS) | `http://localhost:5173` |
| `API_PREFIX` | API route prefix | `/api/v1` |
| `SUPABASE_URL` | Supabase project URL | `https://x.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon (publishable) key | `...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server only) | `...` |
| `AI_PROVIDER` | `gemini`, `xai`, or `anthropic` | `gemini` |
| `GEMINI_API_KEY` | Gemini API key | `...` |
| `GEMINI_MODEL` | Gemini model name | `gemini-3.8-flash` |
| `XAI_API_KEY` | xAI Grok API key (optional) | `...` |
| `ANTHROPIC_API_KEY` | Anthropic Claude key (optional) | `...` |
| `RAZORPAY_KEY_ID` | Razorpay key ID (test mode OK) | `...` |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | `...` |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret | `...` |
| `MAX_FILE_SIZE_MB` | Per-file upload limit in MB | `15` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |
| `LOG_LEVEL` | Pino log level | `info` |
| `DOC_CONVERSION_ENABLED` | Enable LibreOffice PDF conversion | `false` |
| `GENERATION_MODE` | `inline` (API process) or `worker` (claimed by worker) | `inline` |
| `WORKER_POLL_INTERVAL_MS` | Worker queue poll interval | `2000` |
| `CONCURRENT_JOBS` | Concurrent jobs per worker process | `2` |

### Frontend (`apps/web/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_API_URL` | API URL |

> **Security:** Never commit `.env` files. They are gitignored. The frontend must never contain the Supabase service-role key, AI keys, or payment secrets.

---

## Deployment

### Frontend — Cloudflare Pages

1. Build: `npm run build:web` (outputs to `apps/web/dist`)
2. Connect your GitHub repo to Cloudflare Pages
3. Build command: `npm run build:web` (or configure via wrangler)
4. Set `VITE_*` environment variables in the Pages dashboard
5. Set `VITE_API_URL` to your production API URL

### Backend — Node.js host (Render, Railway, Fly.io, etc.)

1. Build: `npm run build:api`
2. Start: `npm --workspace apps/api run start` (runs `node dist/server.js`)
3. Set all server environment variables (see table above)
4. Run migrations against your production Supabase project

### Supabase

Run all migrations in order in the SQL Editor of your Supabase project:

1. `supabase/migrations/001_initial.sql` — Core tables, RLS policies, storage buckets
2. `supabase/migrations/002_job_queue.sql` — Job queue RPC function (`claim_next_job`)
3. `supabase/migrations/003_audit_logs.sql` — Audit logging table
4. `supabase/migrations/004_generation_and_versions.sql` — Resource text, outlines, document versions
5. `supabase/migrations/005_profiles_autocreate.sql` — Auto-create profile rows for auth users
6. `supabase/migrations/006_security_and_billing_fixes.sql` — RLS recursion fix, moderation notes, template-version timestamps
7. `supabase/migrations/007_moderation_hardening.sql` — Prevent role escalation and unreviewed public-template changes
8. `supabase/migrations/008_atomic_billing_grant.sql` — Atomic, idempotent 30-day Pro-pass grant
9. `supabase/migrations/009_document_template_spec.sql` — Preserve template formatting when re-exporting edited documents
10. `supabase/migrations/010_generation_job_updated_at.sql` — Add the missing `generation_jobs.updated_at` column used by job progress updates

This creates all tables, indexes, RLS policies, triggers, storage buckets, and server-side functions. Apply every migration in order; `006`–`010` are required for existing projects created before the security, billing, export, and job-timestamp fixes.

### Generation execution model

`GENERATION_MODE` controls where the AI pipeline runs:

- `inline` (default) — the API process starts the pipeline right after the job is
  queued. Simple for local development and single-instance deployments.
- `worker` — the API only enqueues jobs; a separate worker claims them with the
  `claim_next_job` RPC (`FOR UPDATE SKIP LOCKED`) and runs the pipeline. Use this
  in production so long generations do not occupy web workers.

```bash
GENERATION_MODE=worker
CONCURRENT_JOBS=2

# API
npm --workspace apps/api run start
# Worker (separate process, can be scaled horizontally)
npm --workspace apps/api run start:worker
```

The worker also handles resource text loading. GitHub ingestion runs in the API
process as a bounded background task (README plus up to 15 text files, 60k chars)
and records failures on the resource row for display in the UI.

### E2E Tests (Playwright)

These are **integration tests** that require external services:

```bash
# Install browsers (one-time)
npx playwright install chromium

# Start the API and frontend servers
npm run dev:api & npm run dev:web &

# Run E2E tests
npx playwright test
```

E2E tests cover: registration, sign in, project creation, resource ingestion, template upload, document outline generation, AI document generation, section editing, DOCX export, cross-user access protection, free-tier limits, and Razorpay test-mode billing.

**Requirements:**
- A running Supabase project with all migrations applied
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` configured
- API server running on `http://localhost:4000`
- Frontend running on `http://localhost:5173`
- Users must verify their email via Supabase before signing in (email verification is enabled)

---

## AI Provider Configuration

Scribe uses Gemini by default. Configure at least one provider:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-3.8-flash
```

Optional providers (extension points, not yet wired to generation):
```env
XAI_API_KEY=...
XAI_MODEL=grok-3
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-3-haiku-20240307
```

---

## Billing (Razorpay, INR)

Razorpay is prepared for Indian customers in test mode:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Student Pro is a **one-time 30-day access pass**, not an auto-renewing
subscription. Razorpay Orders are used, no card is stored, and access is granted
only after a verified browser signature or a verified `payment.captured` /
`order.paid` webhook. Buying again while a pass is active stacks another 30
days. Ending access removes the remaining days immediately; there is no refund
flow in the app.

When Razorpay credentials are absent, the API falls back to a **safe mock billing
mode** that cannot grant real production entitlements. Live payments must be
tested with real Razorpay credentials before being enabled in production.

---

## Testing

```bash
npm run test            # shared + API unit tests
npm run test:shared     # shared schemas
npm run test:api        # API routes + services
npm run test:web        # frontend component tests
npm run lint            # ESLint (flat config at the repo root)
```

Tests that require external credentials (Supabase, Gemini, Razorpay) are marked as integration tests and must not run without those credentials.

---

## Security

- RLS policies enforce row-level access on every table
- Database triggers prevent profile-role escalation and self-approval of public templates
- Public template browsing only exposes reviewed (`verified`) public rows
- Service-role key is server-only; never in the frontend
- CORS is restricted to allowlisted origins
- Rate limiting on all API routes
- File uploads validated by MIME type, extension, and size (15 MB default)
- Private Supabase Storage buckets with short-lived signed URLs
- Usage-ledger idempotency prevents duplicate credit events
- Credit changes go through the server-side `adjust_credits` function only

---

## Current Status

All core features implemented and tested:

- [x] Monorepo workspace with shared types/schemas
- [x] Express API with `/api/v1` routes, structured logging, centralized error handling
- [x] Supabase migrations + RLS policies for all entities
- [x] Auth: email/password, email verification flow, password reset, sign out, protected routes
- [x] Landing page, auth pages, pricing, legal pages, public template library
- [x] Dashboard, project management, project detail, templates, billing
- [x] Projects CRUD with server-side ownership enforcement
- [x] Resource ingestion: text, file (PDF/DOCX/TXT/MD), GitHub (bounded README + source ingestion)
- [x] Template upload + DOCX parsing with specification JSON, review/edit, and new versions
- [x] AI generation pipeline (Gemini): knowledge extraction, outline, section-by-section generation, validation, DOCX assembly
- [x] Outline review workflow before generation
- [x] Background generation worker with database-backed queue (`GENERATION_MODE=worker`)
- [x] Document editor with autosave, per-section regeneration, version history/restore, DOCX/PDF export
- [x] Usage limits enforcement (free tier: 1 project, 3 generations, 1 template, 1 section regeneration)
- [x] Razorpay one-time 30-day Pro pass (test mode + mock fallback), browser verification and webhook grants
- [x] Admin dashboard with template moderation
- [x] Audit logging
- [x] Type check, tests, and production build all pass

---

## Roadmap

See `IMPLEMENTATION_CHECKLIST.md` for the phase-by-phase status. The remaining
work is operational rather than feature work: running the Playwright E2E suite
against a real Supabase project and enabling LibreOffice for PDF export in
production.

---

## License

MIT
