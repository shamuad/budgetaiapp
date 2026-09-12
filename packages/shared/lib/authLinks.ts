import { parseAuthCallback, type AuthIntent } from './authFlow';
import { getSupabase } from './supabase';

export type AuthLinkResult = { createdSession: boolean; type: AuthIntent | null };

/** Existing implicit emails and PKCE callbacks; Supabase validates all credentials. */
export async function createSessionFromUrl(
  url: string,
  allowedUrls: readonly string[],
): Promise<AuthLinkResult> {
  const callback = parseAuthCallback(url, allowedUrls);
  if (!callback) return { createdSession: false, type: null };
  if (callback.error)
    throw Object.assign(new Error('Auth callback failed'), { code: callback.error });
  const auth = getSupabase().auth;
  const result = callback.code
    ? await auth.exchangeCodeForSession(callback.code)
    : await auth.setSession({
        access_token: callback.accessToken!,
        refresh_token: callback.refreshToken!,
      });
  if (result.error) throw result.error;
  if (!result.data.session) throw new Error('No session returned');
  return { createdSession: true, type: callback.intent };
}
