import { getSupabase } from './supabase';

/**
 * Turns an incoming Supabase auth deep link into a real session.
 *
 * supabase-js v2 dropped v1's `auth.getSessionFromUrl()`, and native apps run
 * with `detectSessionInUrl: false` (there is no browser URL to watch), so the
 * link has to be handed to the client by hand. Supabase sends the credentials
 * back in one of two shapes depending on the client's flow type:
 *
 *   - PKCE (the v2 default): `?code=<auth code>` in the query string, redeemed
 *     with `exchangeCodeForSession`. The verifier lives in AsyncStorage, so
 *     this only works on the device that requested the link.
 *   - Implicit: `#access_token=...&refresh_token=...&type=recovery` in the
 *     fragment, handed straight to `setSession`.
 *
 * Both are handled, since which one arrives depends on project and email
 * template configuration rather than anything this app controls.
 */

export type AuthLinkResult = {
  /** True when the link carried credentials and a session was established. */
  createdSession: boolean;
  /** Supabase's own link type when it sends one, e.g. `recovery` or `magiclink`. */
  type: string | null;
};

const NO_SESSION: AuthLinkResult = { createdSession: false, type: null };

/**
 * Reads every parameter off a deep link, whether it arrived in the query
 * string or the fragment. Hand-rolled because React Native's `URL` polyfill
 * doesn't expose `searchParams`, and the fragment is invisible to
 * `Linking.parse()` either way.
 */
function parseLinkParams(url: string): Record<string, string> {
  const [beforeFragment, fragment = ''] = url.split('#');
  const query = beforeFragment.split('?')[1] ?? '';
  const params: Record<string, string> = {};

  for (const pair of `${query}&${fragment}`.split('&')) {
    if (!pair) {
      continue;
    }

    const separatorIndex = pair.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = decodeURIComponent(pair.slice(0, separatorIndex));
    const value = decodeURIComponent(pair.slice(separatorIndex + 1).replace(/\+/g, ' '));

    if (key) {
      params[key] = value;
    }
  }

  return params;
}

/**
 * Signs the user in from a recovery or magic link. Resolves with
 * `createdSession: false` for any other URL (a cold start, a normal deep
 * link), and throws when the link itself reports an error — expired or
 * already-used links land here.
 */
export async function createSessionFromUrl(url: string): Promise<AuthLinkResult> {
  const params = parseLinkParams(url);
  const errorDescription = params.error_description ?? params.error;

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const type = params.type ?? null;
  const supabase = getSupabase();

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);

    if (error) {
      throw error;
    }

    return { createdSession: true, type };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });

    if (error) {
      throw error;
    }

    return { createdSession: true, type };
  }

  return NO_SESSION;
}
