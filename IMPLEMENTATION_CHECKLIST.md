# Scribe Implementation Checklist

## Phase 1 — Foundation (COMPLETE)
- [x] Initialize npm workspaces (apps/web, apps/api, packages/shared)
- [x] Shared types & Zod schemas package (@projectscribe/shared)
- [x] Express backend scaffolding (app.ts, server.ts, logger, error handling, /api/v1)
- [x] Frontend scaffolding (Vite, React, TypeScript, Tailwind, shadcn/ui primitives, React Router, TanStack Query, Lucide)
- [x] Supabase migrations + RLS policies (all entities + storage buckets)
- [x] Supabase Auth client wrapper (frontend) + API auth middleware (server-side JWT verify + profiles)
- [x] Protected route patterns (RequireAuth wrapper)
- [x] Landing page (hero, how-it-works, doc types, templates preview, pricing, FAQ, footer)
- [x] Auth pages (login, signup, password reset)
- [x] Dashboard shell (welcome, plan/credits, recent projects, recent jobs)
- [x] Public template library, pricing, privacy/terms/acceptable-use pages
- [x] Project CRUD (create, list, get, soft-delete) with ownership enforcement
- [x] .env.example + .env (server + frontend vars)
- [x] README with local dev instructions
- [x] Type check, lint, tests, production build all pass

## Phase 2 — Project & Template Management
- [x] Text resource ingestion (POST /resources/text)
- [x] Secure file upload (PDF, DOCX, TXT, MD) with validation + signed URLs
- [x] DOCX text extraction (mammoth)
- [x] PDF text extraction (pdf-parse)
- [x] GitHub resource ingestion (POST /resources/github) — bounded README + source ingestion
- [x] Template upload + DOCX parsing (headings, styles, placeholders, tables)
- [x] Template specification schema + user review/edit (PATCH /specification)
- [x] Template preview & metadata (GET /templates/:id)
- [x] Frontend project resource management UI
- [x] Frontend template upload UI (upload dialog, validation, spec review/edit, new versions)
- [x] Template routes (GET/POST /templates, GET /templates/:id, POST /:id/versions, POST /:id/parse, PATCH /:id/specification)
- [x] Template parsing service + tests
- [x] Template route tests

## Phase 3 — AI Generation
- [x] AI provider abstraction interface (Gemini primary; Grok/Claude extension points)
- [x] Gemini provider integration (official SDK, structured JSON, retries, rate-limit handling)
- [x] Project knowledge extraction (Stage A)
- [x] Template interpretation (Stage B)
- [x] Outline generation + validation (Stage C)
- [x] Section-by-section generation (Stage D)
- [x] Generation validation (Stage E)
- [x] Usage accounting & cost tracking
- [x] Generation job status + polling
- [x] Document assembly (Stage F) - basic DOCX via docx package
- [x] Final validation (Stage G)
- [x] Generation routes (POST/GET/CANCEL/OUTLINE/REGENERATE)
- [x] Background job worker (database-backed queue) — `src/worker.ts` claims via `claim_next_job`; `GENERATION_MODE=worker`
- [x] Frontend generation wizard UI (outline review → generate → progress polling → open document)

## Phase 4 — Documents
- [x] DOCX download endpoint (GET /documents/:id/export?format=docx)
- [x] PDF conversion adapter (LibreOffice headless + NoOp fallback)
- [x] PDF download endpoint (GET /documents/:id/export?format=pdf, 503 when unavailable)
- [x] Document CRUD routes (GET /documents, GET /documents/:id)
- [x] Document section PATCH endpoint (autosave-friendly)
- [x] Document route tests
- [x] Conversion service tests
- [x] Document editor frontend (section nav, editable content, autosave, unsaved-change protection)
- [x] Section regeneration + version history UI (per-section regenerate, snapshot versions, restore)
- [x] Document workspace UI (section nav, editor, warnings, export, history)

## Phase 5 — Monetization
- [x] Plan config (Free ₹0, Student Pro ₹149/month) — constants exist in shared + limits service
- [x] Backend limit enforcement (projects, generations, templates, credits) — limits.ts + middleware
- [x] Usage ledger with idempotency — adjust_credits DB function + reserveCredits
- [x] Razorpay test-mode integration (orders, signature verification, webhooks) — billing.ts + routes
- [x] Mock billing mode when credentials absent — MockBillingProvider
- [x] Billing & usage pages (frontend)

## Phase 6 — Administration and Launch
- [x] Admin API routes (overview, template moderation)
- [x] Admin dashboard frontend (users, plans, template moderation, usage/cost, health)
- [x] Template approval/rejection
- [x] Audit logging (audit_logs table + middleware on key routes)
- [x] E2E tests with Playwright (written; integration tests requiring external credentials)
- [x] Security review (CORS, rate limiting, headers, RLS - implemented)
- [x] Deployment docs (Cloudflare Pages, Node host, Supabase setup, Razorpay test mode)
- [x] Production build verification
