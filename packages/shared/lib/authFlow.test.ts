import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  authErrorKey,
  isValidAuthEmail,
  parseAuthCallback,
  singleFlightAuthCallback,
} from './authFlow';

const allowed = [
  'budgetai://auth-callback',
  'budgetai://update-password',
  'budgree://auth-callback',
  'exp://127.0.0.1:8081/--/auth-callback',
];
describe('auth callback boundary', () => {
  it('keeps recovery intent for PKCE before the session event fires', () => {
    assert.deepEqual(
      parseAuthCallback('budgetai://auth-callback?intent=recovery&code=abc', allowed),
      { intent: 'recovery', code: 'abc' },
    );
    assert.deepEqual(parseAuthCallback('budgetai://update-password?code=abc', allowed), {
      intent: 'recovery',
      code: 'abc',
    });
  });
  it('accepts existing implicit email links and the new Budgree alias', () => {
    assert.deepEqual(
      parseAuthCallback(
        'budgree://auth-callback#access_token=a&refresh_token=b&type=magiclink',
        allowed,
      ),
      { intent: 'magiclink', accessToken: 'a', refreshToken: 'b' },
    );
    assert.equal(
      parseAuthCallback(
        'budgetai://auth-callback?intent=signup#access_token=a&refresh_token=b',
        allowed,
      )?.intent,
      'signup',
    );
    assert.equal(
      parseAuthCallback('exp://127.0.0.1:8081/--/auth-callback?intent=oauth&code=abc', allowed)
        ?.intent,
      'oauth',
    );
  });
  it('ignores unrelated routes, lookalike callback paths and untrusted origins', () => {
    for (const url of [
      'https://evil.example/auth-callback?code=a',
      'budgetai://profile?note=update-password&code=a',
      'budgetai://auth-callback-extra?code=a',
      'budgetai://auth-callback/child?code=a',
    ])
      assert.equal(parseAuthCallback(url, allowed), null);
  });
  it('rejects malformed, duplicate and partial credentials without throwing decoding errors', () => {
    for (const query of ['code=%ZZ', 'code=a&code=b', 'access_token=a', 'code=a&refresh_token=b'])
      assert.equal(
        parseAuthCallback(`budgetai://auth-callback?${query}`, allowed)?.error,
        'invalid_callback',
      );
    assert.equal(parseAuthCallback('budgetai://auth-callback', allowed), null);
  });
  it('never exchanges a provider error as credentials', () => {
    assert.deepEqual(
      parseAuthCallback(
        'budgetai://auth-callback?intent=oauth&code=a#error=access_denied',
        allowed,
      ),
      { intent: 'oauth', error: 'access_denied' },
    );
    assert.equal(
      parseAuthCallback('budgetai://auth-callback?intent=recovery#error_code=otp_expired', allowed)
        ?.intent,
      'recovery',
    );
  });
  it('exchanges simultaneous and repeated deliveries of a one-use URL only once', async () => {
    let calls = 0;
    const handle = singleFlightAuthCallback(async () => {
      calls++;
      await Promise.resolve();
      return 'session';
    });
    assert.deepEqual(await Promise.all([handle('one'), handle('one')]), ['session', 'session']);
    await handle('one');
    assert.equal(calls, 1);
    await handle('two');
    assert.equal(calls, 2);
  });
  it('serializes different links so recovery state cannot race an OAuth exchange', async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const handle = singleFlightAuthCallback(async (url) => {
      order.push(url);
      if (url === 'recovery') await wait;
      return url;
    });
    const first = handle('recovery');
    const second = handle('oauth');
    await Promise.resolve();
    assert.deepEqual(order, ['recovery']);
    release();
    await Promise.all([first, second]);
    assert.deepEqual(order, ['recovery', 'oauth']);
  });
  it('allows a fresh link after a failed exchange', async () => {
    const handle = singleFlightAuthCallback(async (url) => {
      if (url === 'expired') throw new Error('expired');
      return 'session';
    });
    await assert.rejects(handle('expired'));
    assert.equal(await handle('fresh'), 'session');
  });
});
describe('auth input and safe error presentation', () => {
  it('validates emails before requests and accepts whitespace trimming', () => {
    for (const email of ['', 'ari', 'ari@', 'ari @mail.com'])
      assert.equal(isValidAuthEmail(email), false);
    assert.equal(isValidAuthEmail(' ari+budget@example.com '), true);
  });
  it('maps expired links, throttling and offline errors without exposing raw details', () => {
    assert.equal(authErrorKey({ code: 'otp_expired' }), 'expiredLink');
    assert.equal(authErrorKey({ status: 429 }), 'rateLimited');
    assert.equal(authErrorKey({ name: 'AuthRetryableFetchError' }), 'networkError');
    assert.equal(authErrorKey({ message: 'secret callback access_token=private' }), 'tryAgain');
  });
});
