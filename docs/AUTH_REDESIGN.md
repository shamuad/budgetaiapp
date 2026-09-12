# Welcome and authentication redesign

## Scope and source

Product owner requested implementation of the approved welcome and complete authentication flow on 2026-09-12. This is the active Mobile App Development task, from `main` at `8f6871f`, delivered on `feat/auth-redesign`. Merge still requires the owner's approval. Dashboard and financial behavior are outside this change.

Figma file: [Budgree Product Design](https://www.figma.com/design/DNCO9VdZXXg89czkRoLqvi/Budgree?node-id=177-391), `03 Mobile`.

| Design | Figma node | Implementation |
| --- | --- | --- |
| Welcome | `177:346` | `(auth)/welcome.tsx` |
| Login, error, loading | `177:391`, `177:431`, `177:436` | `AuthScreen.tsx`, actual request states |
| Signup | `177:396` | `AuthScreen.tsx` |
| Verify email / resend | `177:401`, `182:539` | `EmailLinkScreen.tsx` |
| Request reset / sent / resend | `177:406`, `177:411`, `182:567` | `EmailLinkScreen.tsx` |
| Set password / success | `177:416`, `177:421` | `(auth)/update-password.tsx` |
| Expired recovery / confirmation | `177:426`, `177:441` | `auth-callback.tsx`, method-specific retry |
| Magic Link request / sent / expired / resend | `191:493`, `191:516`, `191:543`, `191:566` | `EmailLinkScreen.tsx`, `auth-callback.tsx` |
| Social progress / error / cancellation | `191:593`, `191:616`, `191:639` | `AuthScreen.tsx`, system auth browser |
| Callback validation | `194:566` | `auth-callback.tsx` |
| Master logo | `150:358` | Exact outlines exported from its approved screen instances |

## Presentation

- Preserve the approved dark welcome and mint/light auth surfaces, independent of the signed-in Light/Dark/Auto preference. No ledger theme tokens are changed.
- Inter Regular / Semi Bold / Bold are bundled. The wordmark is an SVG outline, never font text.
- Logo top inset is `max(60, safeArea.top + 16)` on auth, following the owner's final spacing correction. Welcome uses `max(56, safeArea.top + 16)`.
- Scrolling, keyboard avoidance, growing text and a maximum content width replace the Figma frame's fixed content heights. Password visibility has a 44x44 right-hand target with changing accessibility label.
- Apple/Google vector marks and benefit icons come directly from Figma. `assets/auth/vectors.ts` contains the unmodified export strings. `growth.svg` and `atmosphere.svg` are original exports; PNGs are deterministic 3x renders with SVG blur preserved, used to avoid native SVG-filter differences.
- All new interface copy is available in English, Turkish, Dutch and Spanish.
- Signup follows the approved email/password-only composition. Name remains editable in the existing profile flow; no financial/profile schema is changed.
- A neutral signup note replaces the design's nonfunctional legal acceptance sentence. Approved Terms/Privacy documents and public links remain a release prerequisite; this PR does not claim they already exist or record consent to missing documents.

## Authentication behavior

Supabase remains the identity provider and session source of truth. Email/password uses the existing client. Magic Link uses `signInWithOtp` with `shouldCreateUser: false`; new users explicitly create an account. Signup supplies the email confirmation redirect and has a confirmation/resend view when the server requires verification. Reset uses the same callback consumer, then holds the authenticated recovery session on the password form until the user confirms success or signs out.

Social buttons start Supabase OAuth in `expo-web-browser`'s system auth session. This replaces the old placeholder alerts. Success is based on a real validated session, not a timed prototype transition. Cancelling retains the form and offers another method. Expo Go shows an actionable development-build message; email/password remains available. Browser OAuth is used on both platforms in this delivery; platform-native provider SDKs are not claimed.

Callbacks are accepted only at exact configured return URLs, support existing implicit-token links and PKCE code exchange, reject malformed or ambiguous credentials, and deduplicate a code delivered by both the browser and the link listener. Distinct callbacks are serialized. Recovery is flagged before exchange to prevent an intermediate `SIGNED_IN` event from opening protected screens. Raw provider errors and tokens are not rendered or logged. A failed callback offers a new link for the relevant method. Email resend has a 60-second UI cooldown; Supabase remains the authoritative rate limiter.

The existing cache-clear rule for login/logout/user switching and RLS boundaries remain in force.

## Configuration and device handoff

No production settings or provider credentials were changed by this PR.

1. In the hosted Supabase Auth redirect allowlist, register the exact app callbacks `budgetai://auth-callback`, `budgetai://update-password`, `budgree://auth-callback`, and `budgree://update-password` (and the expected query parameters as supported by Supabase matching). `budgetai` remains the canonical redirect scheme for compatibility; `budgree` is an additional registered alias. Local Supabase config accepts both schemes.
2. Email confirmation must be enabled on the hosted project if signup verification is required. Local config intentionally keeps the existing confirmation-disabled test baseline; the integration suite independently verifies signup confirmation tokens. Configure a working mail provider and verify confirmation, Magic Link and recovery email templates preserve the redirect.
3. Enable Google and Apple in hosted Supabase Auth, with the appropriate provider client/service IDs and server-side secrets. Register Supabase's provider callback URL in Google/Apple consoles. Never place a client secret or service-role key in `EXPO_PUBLIC_*` variables. Apple secret rotation is an operational requirement.
4. Rebuild the development app after adding the URL scheme and native dependencies. Verify on both iOS and Android; Expo Go is not an OAuth acceptance environment.
5. Use the configured app to test cold and warm links, cancellation, expired/reused links, verification/resend, recovery while already signed in, logout and switching users. Confirm that email links never flash the financial screen during recovery. Verify return behavior after the OS kills the app.

References: [Supabase mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [Expo system auth browser](https://docs.expo.dev/versions/latest/sdk/webbrowser/).

## Validation

Local verification (2026-09-12): all workspace typechecks, web lint/build and 70 unit tests passed; iOS and Android Metro/Hermes exports passed. A browser-rendered Expo check passed welcome → login navigation, password eye toggle, invalid email feedback, Magic Link request/sent/cooldown with a stubbed local response, signup at 320px without horizontal overflow, and expired callback feedback. Actual welcome/login screenshots were visually compared to Figma. This does not prove mail delivery, OAuth provider acceptance or native keyboard behavior.

The test runner used `node --import tsx --test` with the same file globs as `npm test`, because this execution environment rejects the tsx CLI IPC socket. The browser check used temporary React Native Web / matching React DOM tooling; those packages are not application dependencies or changes to the web workspace.

The product owner explicitly approved publishing `feat/auth-redesign` to the public repository and opening a PR on 2026-09-12. Merge requires separate approval. The existing Docker-backed GitHub integration job must pass for the PR head; native/provider acceptance remains pending. Unit tests cover the callback trust boundary, parsing, recovery classification, duplicate deliveries, serialization, input validation and safe errors. The local-Supabase integration suite now covers confirmation without name metadata, requesting/consuming a Magic Link once, recovery/password replacement, user switching and RLS isolation.

Browser-rendered implementation screenshots are recorded in [auth-screenshots/welcome.png](auth-screenshots/welcome.png) and [auth-screenshots/login.png](auth-screenshots/login.png). These are visual review evidence, not native-device acceptance.

This environment has no Docker or physical iOS/Android device. Database integration executes in the existing GitHub Actions database job. Native bundling and a web-rendered visual check do not substitute for the device matrix above.

Rollback: revert the feature commit; both the old `budgetai` scheme and existing auth/data schema remain compatible. No migration rollback or user-data rewrite is required.
