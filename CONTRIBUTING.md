# Contributing to Budgree

## Delivery policy

All changes, including documentation changes that alter durable project state, follow:

`latest main -> scoped branch -> validation -> pull request -> user approval -> merge`

Do not commit feature work directly to `main`. A green `main` is the integration baseline.

## Start a task

1. Confirm that the Main Coordination Room has named the task as the single active task.
2. Confirm acceptance criteria, workstream and authoritative input.
3. Update local `main` from `origin/main`.
4. Create one branch from that exact head.

Branch names:

- `feat/<scope>` — product capability
- `fix/<scope>` — defect
- `design/<scope>` — versioned design-support artifacts or design documentation
- `docs/<scope>` — documentation only
- `test/<scope>` — test coverage
- `refactor/<scope>` — behavior-preserving restructuring
- `chore/<scope>` — tooling or maintenance
- `security/<scope>` — focused security hardening

Use short lowercase kebab-case. One branch should represent one reviewable outcome.

## While working

- Change only what the task requires.
- Preserve working behavior unless the acceptance criteria explicitly change it.
- Keep secrets and personal/production data out of commits, fixtures and logs.
- Add or update tests for behavior changes.
- Update durable documentation when architecture, financial semantics, security, product scope or delivery order changes.
- Rebase or merge the latest `main` before final validation if the base moved materially.

## Validation

The default code gate is:

```sh
npm ci
npm run verify
```

Database, RLS, Edge Function or financial API changes also require the relevant local Supabase checks:

```sh
npm run db:start
npm run verify:db
```

Run the focused integration script when the task touches its flow. Native camera, microphone, notifications, biometrics and platform-specific UI require physical-device evidence in addition to automated checks.

Documentation-only changes require:

- links and referenced paths checked against the branch;
- status, roadmap, backlog and decision log checked for contradictions;
- no claim of implementation without repository evidence.

## Pull request contract

A PR must include:

- problem and intended outcome;
- milestone/workstream;
- scope and notable non-goals;
- changed areas;
- tests/checks with results;
- screenshots or recordings for visual behavior when relevant;
- database/security/privacy impact;
- risks, follow-up work and rollback note when relevant;
- documentation updated.

Keep CI green. Resolve review comments on the branch and rerun affected checks.

## Approval and merge

- The user explicitly approves the PR before merge.
- Passing CI does not equal product approval or design approval.
- Approved Figma is required for final visual acceptance.
- Prefer squash merge for a clean one-outcome history unless preserving distinct commits has a clear reason.
- Delete the topic branch after merge.
- Never force-push `main`.
- Never merge with unresolved release-blocking feedback.

GitHub currently has no repository ruleset enforcing this policy. Until branch protection is configured, this document and the coordination-room gate are the required control.

## After merge

The Main Coordination Room:

1. confirms the merge commit and CI result;
2. updates `CURRENT_STATUS.md` if the active state changed;
3. marks the roadmap or backlog item accurately;
4. records durable decisions;
5. announces exactly one next task and its room.
