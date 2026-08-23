import { setFinanceApiBaseUrl } from '@budgetaiapp/shared';

/**
 * Points shared hooks (e.g. `useAssetSearch`) at the Next.js API host.
 *
 * `EXPO_PUBLIC_API_BASE_URL` should be the deployed web app's origin in production.
 * In development it defaults to a local `next dev` server — note that on a physical
 * device / Expo Go this must be your machine's LAN IP (not `localhost`, which on-device
 * resolves to the phone itself), e.g. `http://192.168.1.20:3000`.
 */
const DEV_FALLBACK_BASE_URL = 'http://localhost:3000';

setFinanceApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL ?? (__DEV__ ? DEV_FALLBACK_BASE_URL : undefined));
