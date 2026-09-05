# Backlog

This file is the intake queue for work that is not currently active. `ROADMAP.md` owns committed milestone order; `CURRENT_STATUS.md` owns the single active task.

## Backlog rules

- Capture an idea before implementation.
- Give it a workstream, value, dependencies and a milestone candidate.
- Keep status as **Candidate** until the coordination room commits it to the roadmap.
- **Parked** means intentionally deferred, not rejected.
- Remove an item only when it is delivered, rejected with a reason or replaced by a linked decision.
- Product and release claims must not treat backlog items as available features.

## Product and mobile

| Item | Status | Value | Dependencies | Milestone candidate |
|---|---|---|---|---|
| Opt-in push notifications with granular preferences for bills, recurring payments, budget thresholds, unusual changes and important account/security events | Candidate | Timely action without opening the app | Notification product rules, privacy defaults, physical-device testing, backend scheduling | Post-beta |
| Biometric app unlock using iOS LocalAuthentication and Android BiometricPrompt through an Expo-compatible approach | Candidate | Better local privacy and faster return access | Threat model, fallback PIN/session behavior, device testing | Beta or post-beta |
| Recurring bills and subscriptions | Candidate | Forward visibility and fewer missed payments | Recurrence domain model, notifications policy | Post-beta |
| Planned transactions and cash-flow projections | Candidate | Anticipatory budgeting | Recurrence model, forecast UX, server aggregates | Post-beta |
| Bank integrations and recurring-payment detection | Parked | Less manual entry | Provider/legal/privacy selection, reconciliation model | Post-launch |
| Advanced investment analytics | Parked | Deeper portfolio insight | Market-data policy, valuation model, regulatory wording | Post-launch |
| User-configurable base currency with historical conversion rules | Candidate | Correct international use | Product decision, migration design, analytics impact | M2 Maintainability |
| Accessibility audit and remediation | Candidate | Inclusive, higher-quality product | D5/D6 components and test plan | Beta |

## Backend, data and security

| Item | Status | Value | Dependencies | Milestone candidate |
|---|---|---|---|---|
| Privacy/retention policy for AI-submitted voice and receipt data | Candidate | Clear user trust and compliant operations | Legal/product decision, Gemini data-flow inventory | M1 Alpha stabilization |
| Account data export and deletion | Candidate | User control and release readiness | Retention decision, deletion cascade review, UX | M1 Alpha stabilization |
| Privacy-safe mobile diagnostics and error monitoring | Candidate | Operable beta without leaking finance data | Vendor/retention decision, redaction policy | M1 Alpha stabilization |
| Pagination and server-side aggregation thresholds | Candidate | Scalable ledger and analytics | Usage expectations, query profiling | M2 Maintainability |
| Automated backup/restore verification and incident runbook | Candidate | Operational resilience | Hosting plan and recovery objectives | Beta |
| Security review of notification payloads | Parked | Prevent lock-screen leakage | Notification scope committed | Post-beta |

## Product design

| Item | Status | Value | Dependencies | Milestone candidate |
|---|---|---|---|---|
| D3 Typography system | Planned | Consistent hierarchy and readability | D2 approved | Design system |
| D4 Spacing, grid, radius, elevation and icon rules | Planned | Consistent composition | D2 and D3 approved | Design system |
| D5 Core components and interaction states | Planned | Reusable implementation source | D2–D4 approved | Design system |
| D6 Critical mobile flows and prototype | Planned | Validate end-to-end product experience | D5 approved, product flows prioritized | Mobile beta |
| D7 Developer handoff and design QA | Planned | Reduce implementation drift | D6 approved | Mobile beta |
| Empty, loading, error and offline states | Candidate | Complete real-world UX | D5 component patterns | Mobile beta |
| Notification preference and privacy UX | Parked | User control over alerts | Notification milestone committed | Post-beta |

D2 Color System is deliberately not a backlog item: it is the next committed Product Design milestone in `ROADMAP.md`.

## Web app, website and marketing

| Item | Status | Value | Dependencies | Milestone candidate |
|---|---|---|---|---|
| Authenticated Budgree web shell | Candidate | Web access and shared platform foundation | Mobile design system, web product scope | M3 Web product |
| Web preview deployment | Candidate | Reviewable implementation | Authenticated shell, environment strategy | M3 Web product |
| Marketing website information architecture and copy | Candidate | Clear launch story | Validated audience, approved brand, committed launch scope | Pre-launch |
| Privacy, support and AI-limitations pages | Candidate | Trust and store/release readiness | Product/legal decisions | Beta / pre-launch |
| Product analytics measurement plan | Candidate | Evidence for prioritization | Privacy policy, key outcome definition | Beta |

## Brand and assets

| Item | Status | Value | Dependencies | Milestone candidate |
|---|---|---|---|---|
| Final wordmark master and monochrome variants | Candidate | Consistent identity | D2 Color System approval | Design system |
| Mobile app icon and store export set | Candidate | Distribution readiness | Final mark, platform safe-area checks | Pre-launch |
| Social/website brand asset kit | Parked | Efficient marketing production | Final brand and website direction | Pre-launch |

## QA and release

| Item | Status | Value | Dependencies | Milestone candidate |
|---|---|---|---|---|
| Physical iOS/Android camera, microphone and live Gemini validation | Planned | Close the largest native AI evidence gap | Test devices and build | M1 Alpha stabilization |
| Native-screen financial lifecycle regression | Planned | Prove automated domain logic in real UI | Test data and device build | M1 Alpha stabilization |
| EAS development, preview and production profiles | Planned | Repeatable mobile delivery | Environment/secrets plan | M1 Alpha stabilization |
| Release checklist and device/browser matrix | Candidate | Repeatable go/no-go decision | Beta scope | Beta |
| App Store / Play Store submission assets and metadata | Candidate | Public distribution | Brand assets, privacy content, release candidate | Pre-launch |
