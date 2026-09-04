type FinanceQuotaResource = 'finance_search' | 'finance_quote';

type QuotaDecision = {
  allowed?: boolean;
  remaining?: number;
  retry_after_seconds?: number;
};

export type FinanceAccess =
  | { allowed: true; responseHeaders: Record<string, string> }
  | { allowed: false; response: Response };

const AUTH_TIMEOUT_MS = 5_000;

function errorResponse(error: string, message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error, message }, { status, headers });
}

/**
 * Validates the caller's Supabase access token and atomically consumes their
 * database-backed allowance. No service-role credential is needed or accepted.
 */
export async function authorizeFinanceRequest(
  request: Request,
  resource: FinanceQuotaResource,
): Promise<FinanceAccess> {
  const authorization = request.headers.get('authorization');

  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
    return {
      allowed: false,
      response: errorResponse('unauthorized', 'A signed-in session is required.', 401),
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[finance/auth] Missing SUPABASE_URL or SUPABASE_ANON_KEY.');
    return {
      allowed: false,
      response: errorResponse('service_unavailable', 'Finance service is not configured.', 503),
    };
  }

  const authHeaders = {
    apikey: supabaseAnonKey,
    authorization,
  };

  try {
    const userResponse = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: authHeaders,
      cache: 'no-store',
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });

    if (!userResponse.ok) {
      return {
        allowed: false,
        response: errorResponse('unauthorized', 'The session is invalid or expired.', 401),
      };
    }

    const quotaResponse = await fetch(
      `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/consume_request_quota`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_resource: resource }),
        cache: 'no-store',
        signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      },
    );

    if (!quotaResponse.ok) {
      console.error(`[finance/auth] Quota service returned HTTP ${quotaResponse.status}.`);
      return {
        allowed: false,
        response: errorResponse('service_unavailable', 'Finance service is temporarily unavailable.', 503),
      };
    }

    const quota = (await quotaResponse.json()) as QuotaDecision;
    const retryAfter = Math.max(1, Math.ceil(quota.retry_after_seconds ?? 1));

    if (quota.allowed !== true) {
      return {
        allowed: false,
        response: errorResponse('rate_limited', 'Too many finance requests.', 429, {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Remaining': '0',
        }),
      };
    }

    return {
      allowed: true,
      responseHeaders: {
        'Cache-Control': 'private, no-store',
        Vary: 'Authorization',
        'X-RateLimit-Remaining': String(Math.max(0, quota.remaining ?? 0)),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[finance/auth] Supabase request failed: ${message}`);

    return {
      allowed: false,
      response: errorResponse('service_unavailable', 'Finance service is temporarily unavailable.', 503),
    };
  }
}
