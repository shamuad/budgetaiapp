# Decisions

This is the durable decision log for product, design, architecture, security, data semantics and delivery order. Add a dated entry when one of those changes. Exploration and uncommitted ideas belong in `BACKLOG.md`.

## Active decisions

### 2026-09-05 — Source-of-truth hierarchy

GitHub `shamuad/budgetaiapp` is authoritative for code and project documentation. The approved Budgree Figma file is authoritative for visual design. The Main Coordination Room controls sequencing and reconciliation but does not replace either source. Conversation history is context, not durable proof.

### 2026-09-05 — One active task and governed workstreams

Mobile App Development, Web App Development, Backend/Data/Security, Product Design, Website & Marketing, Brand & Assets and QA & Release remain separate, connected workstreams. `CURRENT_STATUS.md` names one active project task; new ideas enter `BACKLOG.md` until the coordination room assigns a milestone and acceptance criteria.

### 2026-09-05 — Topic branch, checks, PR and user approval are mandatory

New work starts from the latest `main`, stays scoped to one topic branch, passes relevant checks, enters a PR and is merged only after explicit user approval. CI success is not itself product or design approval. Squash merge is preferred for one-outcome changes.

### 2026-09-05 — Product Design advances through explicit gates

D0 Figma structure and D1 Visual Direction are complete. D2 Color System is next. Later stages do not start until the current stage is explicitly approved. Because the product owner is not a designer, instructions must use exact beginner-sized Figma steps and checkpoints.

### 2026-09-05 — Visual direction and color roles

The approved direction is premium adaptive fintech with clear hierarchy, polished card structures, restrained glass surfaces, soft corners and clean typography across Light, Dark and Auto. Color roles are distinct: structural `brand`, Budgree/AI accent, and financial income/expense semantics. They must not be consolidated merely because two roles may use green.

### 2026-09-05 — Ideas do not bypass milestones

Notifications, biometrics, recurring bills, bank connections and other new ideas are captured and evaluated in the backlog. They are not implemented opportunistically while another task is active.

### 2026-09-04 — GitHub code is the implementation source of truth

Product history and AI conversations may describe plans, but a capability is implemented only when it is evidenced in the repository and passes its relevant checks.

### 2026-09-04 — One npm workspace and one lockfile

Dependencies are installed from the repository root. Workspace-specific lockfiles are not maintained because they can drift from the root dependency graph used by CI.

### 2026-09-04 — Quality gate before merge

Lint, workspace typechecks, shared unit tests and the web production build run through `npm run verify` locally and in GitHub Actions. Relevant local-Supabase integration and database suites are additional gates for affected work.

### 2026-09-04 — Hosted metadata is the Supabase baseline

The original Dashboard-created core tables were captured from the hosted project's schema metadata without copying production rows. Historical SQL files have unique chronological versions; fresh databases rebuild from the baseline plus incremental migrations and deterministic local seed data.

### 2026-09-04 — Tenant ownership includes relationships

Owning a transaction row is insufficient by itself. RLS also requires its source account, optional destination account and optional category to belong to the same authenticated user. SECURITY DEFINER provisioning functions are trigger-only and are not executable by API roles.

### 2026-09-04 — Expensive APIs use authenticated database quotas

Gemini and Yahoo Finance requests are tied to a validated Supabase user, never an untrusted IP or client-supplied identity. An atomic database function enforces AI limits of 10 requests/minute and 300/month, finance search limits of 30/minute and 500/day, and quote limits of 60/minute and 1,000/day. AI request bodies are capped at 8 MiB, with decoded receipt images capped at 5 MiB and audio at 2 MiB.

### 2026-08-26 — Gemini credentials stay server-side

The mobile client invokes a Supabase Edge Function. Gemini secrets and prompts are not shipped in `EXPO_PUBLIC_*` variables or the application bundle.

### 2026-08-25 — Financial rows are user-owned and protected by RLS

Transactions, accounts/assets and categories belong to one Supabase Auth user. Database policies, rather than UI filtering, form the primary tenant-isolation boundary.

### 2026-08-23 — Internal account movement is a transfer

Money moved between the user's own accounts or into an investment account is neither income nor expense. Transfers carry source and destination accounts so consolidated cash flow is not inflated.

### 2026-08-21 — TanStack Query owns server state

Supabase-backed data uses TanStack Query. Zustand is reserved for authentication projection, theme preference and small client-only UI state.

## Decisions still required

- User-configurable base currency and historical conversion behavior.
- Privacy/retention policy for AI-submitted voice and receipt data.
- Notification product/privacy policy before notifications are promoted from backlog.
- Repository branch-protection/ruleset configuration.
