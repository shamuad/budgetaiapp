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

### 2026-09-07 — Incremental implementation after the category pass

The product owner authorized moving toward a running app after categories, then iterating on design. Retain the existing repository, authentication, Supabase, business rules and tests. This does not mark every screen or D3–D7 complete. First delivery is D2 palette, filled shared selection and category-list styling on a topic branch, followed by native review and explicit PR approval.

### 2026-09-07 — Preserve existing management behavior

Account colors and gradients remain chosen in account editing; Dashboard account selection filters calculations in place. Account drag ordering and bank identity remain. Categories retain alphabetical grouping, income/expense distinction, needs/wants for expenses, emoji/reset behavior, default hide/restore and guarded deletion of custom categories. Category lists do not acquire account-style drag ordering. Settings retains Manage Accounts and Manage Categories.

### 2026-09-07 — Light and Dark B roles

Dark B uses background `#1B1D22`, surface `#2C2F36` and border `#454953`. Readable interaction accent is `#B6A7FF`; filled actions remain `#5842D8` with white text in both themes. Income and expense retain separate semantic colors. All shared segmented selections use the filled violet treatment; amounts retain their financial direction colors. Account-defined colors and the existing Budgree/AI role are separate.

### 2026-09-07 — Future ideas remain explicit backlog

Family sharing and a full AI Assistant are parked. The approved Assistant navigation icon is a visual placeholder, not evidence of an implemented assistant. These ideas do not expand the current implementation slice. Written GitHub records and approved Figma are the handoff; conversations are not assumed to synchronize automatically.

### 2026-09-08 — Dashboard summaries share Analytics semantics

Dashboard monthly income, expense and category spending use the stored exchange rate and statement-period date already used by Analytics. Transfers never count as income or expense. Account selection scopes balance, cash-flow summary, spending categories, recent activity and the Analysis handoff on the same screen. The spending card is limited to the two largest categories plus a reconciled Other row. The Assistant navigation cell remains a disabled design placeholder.

### 2026-09-08 — Settings opens as the approved bottom sheet

The Dashboard's upper-right settings control opens the approved adaptive bottom sheet rather than the legacy anchored popover. Appearance uses the same filled segmented control as New Transaction. Manage Accounts and Manage Categories remain first-class destinations and preserve their existing behavior; sign-out and transaction-data clearing remain separate, confirmed actions. The sheet adapts to the safe area and to Light, Dark B and system appearance.

### 2026-09-09 — Reporting currency is separate from historical transaction currency

Settings owns one persisted reporting-currency preference for cross-account figures. Transactions retain their entered currency and immutable conversion into canonical EUR; changing the preference never rewrites history. Dashboard, account-card balances, monthly summaries, Analytics charts and Analytics ledgers convert canonical totals with the persisted EUR-to-reporting-currency rate. Individual transaction rows continue to show the original entered currency. The selected rate is saved with its timestamp so a later refresh policy can update it deliberately.

### 2026-09-07 — Management validation and account-editor adaptation

Validate category lifecycle and account-order persistence with disposable local-Supabase users in CI, never by altering the owner's financial records. Keep native gesture/confirmation evidence separate from API persistence tests. Preserve every existing account field even where the Figma reference omits it. Four-choice selectors use two columns to keep labels readable while retaining the shared filled selection style.

## Decisions still required

- Privacy/retention policy for AI-submitted voice and receipt data.
- Notification product/privacy policy before notifications are promoted from backlog.
- Repository branch-protection/ruleset configuration.

### 2026-09-12 — Approved welcome/auth flow moves to mobile implementation

The product owner authorized the approved Figma auth composition for code implementation. The single active task is welcome/authentication on `feat/auth-redesign`, from current main. Use the approved outlined logo, dark welcome, mint/light forms, right-hand password eye and final safe-area spacing. Supabase remains the auth provider; Magic Link is for existing accounts, signup collects email/password, and Google/Apple use system-browser OAuth. Hosted configuration and native validation are completion gates, separate from code implementation. See [AUTH_REDESIGN.md](AUTH_REDESIGN.md). The existing ledger theme and financial behavior stay outside this delivery. Merge still requires explicit user approval.
