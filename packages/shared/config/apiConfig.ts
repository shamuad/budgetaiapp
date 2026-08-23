/**
 * Central place to point shared data-fetching hooks at the Next.js API host.
 *
 * `packages/shared` is consumed by both the Expo app and the Next.js app, which resolve
 * environment variables under different prefixes (`EXPO_PUBLIC_*` vs `NEXT_PUBLIC_*`).
 * Rather than hardcode either prefix here, each app calls `setFinanceApiBaseUrl` once at
 * startup with the value it resolved itself.
 *
 * - Next.js: leave unset. The API route lives in the same app, so requests stay relative.
 * - Expo: set to the deployed web app's origin (or your local `next dev` URL while testing).
 */
let financeApiBaseUrl = '';

export function setFinanceApiBaseUrl(url: string | null | undefined): void {
  financeApiBaseUrl = url ? url.replace(/\/+$/, '') : '';
}

export function getFinanceApiBaseUrl(): string {
  return financeApiBaseUrl;
}
