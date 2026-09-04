import assert from 'node:assert/strict';
import test from 'node:test';

import { authorizeFinanceRequest } from './financeAccess';

function configuredEnvironment() {
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
}

test('finance access rejects a request without a bearer token', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch');
  const result = await authorizeFinanceRequest(new Request('https://app.test/api'), 'finance_search');

  assert.equal(result.allowed, false);
  assert.equal(result.allowed ? 0 : result.response.status, 401);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('finance access validates the user and returns quota headers', async (context) => {
  configuredEnvironment();
  const fetchMock = context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith('/auth/v1/user')) {
      return Response.json({ id: 'user-a' });
    }

    return Response.json({ allowed: true, remaining: 17, retry_after_seconds: 0 });
  });

  const result = await authorizeFinanceRequest(
    new Request('https://app.test/api', { headers: { Authorization: 'Bearer valid-token' } }),
    'finance_search',
  );

  assert.equal(result.allowed, true);
  assert.equal(result.allowed ? result.responseHeaders['X-RateLimit-Remaining'] : null, '17');
  assert.equal(fetchMock.mock.callCount(), 2);
});

test('finance access rejects an expired Supabase session', async (context) => {
  configuredEnvironment();
  const fetchMock = context.mock.method(
    globalThis,
    'fetch',
    async () => Response.json({ message: 'expired' }, { status: 401 }),
  );

  const result = await authorizeFinanceRequest(
    new Request('https://app.test/api', { headers: { Authorization: 'Bearer expired-token' } }),
    'finance_quote',
  );

  assert.equal(result.allowed, false);
  assert.equal(result.allowed ? 0 : result.response.status, 401);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('finance access forwards a database rate limit as HTTP 429', async (context) => {
  configuredEnvironment();
  context.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith('/auth/v1/user')) {
      return Response.json({ id: 'user-a' });
    }

    return Response.json({ allowed: false, reason: 'rate_limited', retry_after_seconds: 23 });
  });

  const result = await authorizeFinanceRequest(
    new Request('https://app.test/api', { headers: { Authorization: 'Bearer valid-token' } }),
    'finance_quote',
  );

  assert.equal(result.allowed, false);
  assert.equal(result.allowed ? 0 : result.response.status, 429);
  assert.equal(result.allowed ? null : result.response.headers.get('Retry-After'), '23');
});
