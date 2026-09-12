/** Presentation-safe errors: never render provider URLs, tokens or raw server messages. */
export function authErrorKey(error: unknown): string {
  const e = error as { code?: string; status?: number; name?: string } | null;
  if (
    e?.status === 429 ||
    ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(e?.code ?? '')
  )
    return 'rateLimited';
  if (e?.code === 'invalid_credentials') return 'invalidCredentials';
  if (e?.code === 'email_not_confirmed') return 'emailUnconfirmed';
  if (e?.code === 'weak_password') return 'weakPassword';
  if (e?.code === 'same_password') return 'samePassword';
  if (
    [
      'otp_expired',
      'flow_state_expired',
      'flow_state_not_found',
      'bad_code_verifier',
      'invalid_grant',
    ].includes(e?.code ?? '')
  )
    return 'expiredLink';
  if (e?.code === 'provider_disabled' || e?.code === 'providerNotReady') return 'providerNotReady';
  if (e?.code === 'expoGo') return 'expoGo';
  if (e?.name === 'AuthRetryableFetchError' || e?.name === 'TypeError') return 'networkError';
  return 'tryAgain';
}

export function isValidAuthEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 254;
}

export type AuthIntent = 'signup' | 'magiclink' | 'recovery' | 'oauth';
export type ParsedAuthCallback = {
  intent: AuthIntent;
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
};

/** Only redeem credentials on exact callback URLs chosen by the native app. */
export function parseAuthCallback(
  url: string,
  allowedUrls: readonly string[],
): ParsedAuthCallback | null {
  const base = url.split(/[?#]/)[0].replace(/\/$/, '');
  if (!allowedUrls.some((allowed) => base === allowed.split(/[?#]/)[0].replace(/\/$/, '')))
    return null;
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  const params: Record<string, string> = Object.create(null);
  try {
    for (const pair of `${query}&${hash}`.split('&')) {
      if (!pair) continue;
      const at = pair.indexOf('=');
      if (at < 0) continue;
      const key = decodeURIComponent(pair.slice(0, at));
      if (Object.prototype.hasOwnProperty.call(params, key)) throw new Error('Ambiguous callback');
      params[key] = decodeURIComponent(pair.slice(at + 1).replace(/\+/g, ' '));
    }
  } catch {
    return {
      intent: base.endsWith('/update-password') ? 'recovery' : 'magiclink',
      error: 'invalid_callback',
    };
  }
  const intent: AuthIntent =
    base.endsWith('/update-password') || params.type === 'recovery' || params.intent === 'recovery'
      ? 'recovery'
      : params.intent === 'signup' || params.type === 'signup'
        ? 'signup'
        : params.intent === 'oauth'
          ? 'oauth'
          : 'magiclink';
  if (params.error || params.error_code || params.error_description)
    return { intent, error: params.error_code || params.error || 'invalid_callback' };
  if (params.code && (params.access_token || params.refresh_token))
    return { intent, error: 'invalid_callback' };
  if (params.code) return { intent, code: params.code };
  if (params.access_token && params.refresh_token)
    return { intent, accessToken: params.access_token, refreshToken: params.refresh_token };
  if (params.access_token || params.refresh_token) return { intent, error: 'invalid_callback' };
  return null;
}

/** A deep-link listener and OAuth browser can deliver the same one-use code together. */
export function singleFlightAuthCallback<T>(handle: (url: string) => Promise<T>) {
  const recent = new Map<string, Promise<T>>();
  let tail: Promise<unknown> = Promise.resolve();
  return (url: string): Promise<T> => {
    const existing = recent.get(url);
    if (existing) return existing;
    const operation = tail.then(() => handle(url));
    tail = operation.catch(() => undefined);
    recent.set(url, operation);
    // A small memory-only deduplication window; never persist callback credentials.
    if (recent.size > 8) recent.delete(recent.keys().next().value!);
    return operation;
  };
}
