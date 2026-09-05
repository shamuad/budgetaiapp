# Workstreams and Room Operating Model

## Authority model

- **GitHub `shamuad/budgetaiapp`:** source of truth for code, migrations, tests, technical architecture, roadmap, backlog and durable product decisions.
- **Figma approved Budgree file:** source of truth for approved visual design, components, prototypes and design specifications.
- **Main Coordination Room:** controls sequencing, dependencies, milestone status and durable handoffs. It does not override GitHub or Figma.
- **Workstream rooms:** produce scoped outputs and return evidence to the coordination room. Conversation history alone is not a durable decision.

If sources disagree, stop implementation. Reconcile the mismatch in the coordination room, update the authoritative source, then resume.

## Shared handoff contract

Every workstream handoff must state:

1. milestone and scoped task;
2. inputs and source links;
3. assumptions and decisions made;
4. files, Figma frames or PR changed;
5. validation performed and results;
6. unresolved risks or blockers;
7. recommended next task.

A workstream may explore multiple ideas, but only the coordination room marks one task as active across the project.

## Room map

| Room / workstream | Entry condition | Exit condition | Durable output | Key dependencies |
|---|---|---|---|---|
| **Main Coordination** | A new phase, decision, conflict, handoff or idea needs routing | Status, owner, milestone, source of truth and one next task are recorded | `PRODUCT.md`, `CURRENT_STATUS.md`, `ROADMAP.md`, `BACKLOG.md`, `DECISIONS.md` | All workstreams |
| **Product Design** | Product requirement and target flow are clear; prior design gate is approved | Named Figma frames/styles/components are complete, checked in Light/Dark where relevant and explicitly approved | Approved Figma file; implementation notes linked from GitHub when needed | Product, Brand, Mobile/Web |
| **Mobile App Development** | Approved requirement and, for visual work, approved Figma state exist; API contract is known | iOS/Android implementation works, checks pass, relevant device evidence exists and PR is approved | `apps/mobile`, shared code when platform-neutral, tests and PR | Design, Backend, QA |
| **Web App Development** | Web milestone is active; approved requirement/design and reusable shared contract exist | Authenticated web flow works, responsive and accessibility checks pass, preview is approved and PR is approved | `apps/web`, shared code, tests, preview and PR | Design, Backend, QA |
| **Backend / Data / Security** | Domain rule, threat boundary, data owner and migration impact are defined | Migration/API is reproducible, RLS and abuse boundaries are tested, rollback/operations are documented and PR is approved | `supabase`, shared API/types, security tests and decisions | Mobile/Web, QA |
| **QA & Release** | Acceptance criteria and a testable build/PR exist | Required automated/manual matrix passes, defects are routed, release decision and evidence are recorded | Test evidence, release checklist, defect issues and release notes | All delivery streams |
| **Brand & Assets** | Brand use case, format, channel and approved visual direction are known | Master asset plus required variants meet size/contrast/export rules and are approved | Approved Figma assets and versioned product assets where shipped | Product Design, Marketing |
| **Website & Marketing** | Shipped or committed product capability, audience and approved brand/design exist | Claims match the product, legal/privacy links exist, responsive site is approved and publish/release owner accepts it | Website content/code, campaign assets and analytics plan | Product, Brand, Web, QA |

## Workstream-specific gates

### Product Design

Design sequence:

1. D0 — file structure and working conventions;
2. D1 — visual direction;
3. D2 — color system;
4. D3 — typography;
5. D4 — spacing, grid, radius, elevation and icon rules;
6. D5 — core components and states;
7. D6 — critical mobile flows and prototype;
8. D7 — developer handoff and design QA.

For a non-designer, each task must be given as a small Figma operation with:

- exact page, frame or style name;
- where to click;
- exact value to enter;
- expected visual result;
- a short checkpoint before moving on.

No step is considered approved merely because it was created. The user must confirm the checkpoint.

### Mobile App Development

- Start from the latest `main`.
- Visual implementation requires an approved Figma source or an explicitly documented temporary exception.
- Domain changes belong in `packages/shared` when genuinely cross-platform.
- Validate both themes and both platforms when the change can affect them.
- Physical-device work is mandatory for camera, microphone, notifications and biometrics.

### Web App Development

- Do not copy native-only UI patterns blindly.
- Reuse shared business logic, types and queries; adapt interaction and accessibility to web.
- The current starter page is not a shipped Budgree web product.

### Backend / Data / Security

- Schema changes use versioned migrations; never rely on dashboard-only state.
- RLS protects tenant boundaries, including referenced relationships.
- Expensive endpoints require authenticated, per-user controls.
- Financial semantics and privacy decisions must be recorded before irreversible migrations.

### QA & Release

- CI success is necessary but not sufficient for native release.
- Every release candidate needs a platform/device matrix, critical-flow regression, privacy/security check and known-risk record.
- Failed checks return the task to its producing workstream; QA does not silently change product behavior.

### Brand & Assets

- Keep the Budgree wordmark readable and the premium finance character calm and credible.
- Master assets remain editable; exports are derived outputs.
- Asset changes that affect interface use must be reconciled with Product Design.

### Website & Marketing

- Marketing never claims an unshipped or unverified capability.
- Privacy, AI limitations and platform availability must be stated accurately.
- Publishing is a separate approval from creating the site.

## Idea routing

New ideas enter `BACKLOG.md` with a workstream, milestone candidate, value, dependencies and status. An idea moves to active work only when the coordination room:

1. places it in a milestone;
2. defines acceptance criteria;
3. verifies prerequisites;
4. closes or pauses the current active task.

Urgency alone does not bypass security, data or release gates.
