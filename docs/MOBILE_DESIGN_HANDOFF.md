# Mobile design → implementation handoff

Recorded 2026-09-07. This document accompanies `design/mobile-foundation`, based on main `05d7f66`. It does not claim that the branch has merged or all mobile screens have been redesigned.

## Authoritative inputs and delivery order

- GitHub code and project documents define implemented behavior; approved Figma defines visual direction.
- [Budgree Figma file](https://www.figma.com/design/DNCO9VdZXXg89czkRoLqvi/Budgree-Product-Design) retains its existing Foundations, Components, Mobile, Web App, Website, Prototypes and Archive pages.
- The owner accepted Light / Dark B and requested categories, then gradual coding and a working app before more design polish.
- Do not infer cross-task synchronization. Read this file, CURRENT_STATUS, ROADMAP and the current code at each handoff.

## Category design references

All nodes below live in **03 Mobile**. These are editable design references with representative prototype links, not an executable form or persisted data.

| Reference | Figma node |
|---|---|
| Expense list / Light | [83:17](https://www.figma.com/design/DNCO9VdZXXg89czkRoLqvi?node-id=83-17) |
| Expense list / Dark B | [114:289](https://www.figma.com/design/DNCO9VdZXXg89czkRoLqvi?node-id=114-289) |
| Edit default expense / Light | 83:90 |
| Edit default expense / Dark B | 114:340 |
| Income list / edit income | 107:164 / 108:229 |
| New expense / edit custom category | 107:236 / 108:197 |
| Hide confirmation / hidden result / restored result | 109:213 / 111:219 / 111:263 |
| Delete confirmation / used-category rejection | 110:215 / 110:221 |
| Missing expense budget group | 110:228 |

The prototype demonstrates selected routes, including hide/restore and used-category rejection. It does not simulate arbitrary text entry, successful save of arbitrary new values, every emoji choice, unused-category deletion or every theme transition. Those behaviors remain implemented in the native editor. Dark variants establish visual treatment; not every secondary popup has a separate dark prototype.

Existing code audited: `ManageCategoriesModal.tsx`, `EntryEditor.tsx`, category hooks and grouping utilities. Categories are alphabetical, not draggable. Default categories can be hidden/restored; old transactions retain their references. Custom deletion rechecks transaction usage. Expense creation requires needs/wants; income does not. Changing a default name deliberately severs localization while icon-only changes preserve it. No new category color picker is introduced.

## This code slice

1. `theming/tokens.ts`: map approved D2 background, surface, text, interaction and income/expense roles into existing dynamic theme infrastructure. Saturated action fill stays violet with white text in both themes. Legacy static palette consumers have not been migrated.
2. `SegmentedControl.tsx`: filled violet selection, explicit accessibility selected state and at least 44-point touch height. Shared by settings and form selectors. Transaction amount coloring stays semantic; the selector itself follows the shared treatment.
3. `ManageCategoriesModal.tsx`: soft independent rows, 44-point tinted emoji wells, roomier spacing and legible hidden rows. Retains the virtualized SectionList, localized labels and default-category globe indicator from working code. No mutation or persistence changes.
4. Native category editor composition, Dashboard composition and other full-screen migrations remain for the next slices. This is not a claim that every Figma frame has already been implemented.

Figma's 40-point visual segment was implemented with the existing 44-point touch minimum; the track therefore grows slightly. Use system-native typography already shipped in the app; no new font dependency was added. This deliberate adaptation needs native visual review.

## Protected product decisions

- Accounts keep drag-and-drop ordering, real bank identity, account-edit color/gradient choice and preview. Selecting a Dashboard account filters calculations on the same page.
- Settings keeps account/category management; use a recognizable upper-right settings control in the eventual Dashboard migration.
- Dashboard's center plus opens New Transaction; smart text, hold-to-speak and receipt entry belong there. The plus stays anchored to navigation.
- Account pagination is compact dots. Income is green, expense red and monthly net neutral. Keep a compact top-category spending summary with an Analysis link; do not invent a budget percentage when no matching budget model exists.
- Existing receipt/voice/text assistance is separate from the planned full AI Assistant. The latter and conditional family sharing remain in BACKLOG.

## Verification and remaining evidence

- Root lint, all workspace typechecks, 53 existing unit tests and web production build passed locally on 2026-09-07.
- iOS Metro/Hermes bundle export passed. This is a bundle check, not a signed native build or authenticated-device test.
- Figma Light and Dark B list renders inspected. Native rendering, tap paths, long translated labels, large text and theme switching still need review with configured Supabase access.
- No database, RLS, Edge Function, financial calculation, schema or dependency changes. Existing account appearance tests pass. Database integration suites were not rerun for this presentation-only slice.
- This machine used Node 26; repository setup/CI targets Node 22. CI remains the clean-environment gate.
- Fresh checkout has no Supabase environment file. Obtain the owner's existing local project path and reuse the public mobile connection settings without printing or committing secrets. Do not copy production rows into fixtures.

## Next acceptance checklist

1. Open the app using the existing configured environment, review category list/editor in Light, Dark B and Auto.
2. Exercise create, edit, hide, restore and used/unused custom deletion; confirm localization and needs/wants validation.
3. Verify account ordering and Dashboard filtering remain intact; test shared selection controls in Settings and New Transaction.
4. User reviews the PR and native screenshots. Merge only after explicit approval.
5. Continue account/editor and Dashboard migrations as separate bounded deliveries, using the existing behavior inventory. Revisit visual details on the running app.

Rollback: revert the presentation commit through a PR. No data migration is required.
