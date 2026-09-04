import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MIN_PASSWORD_LENGTH, shouldClearUserScopedCache } from './authSession';

describe('auth session safety', () => {
  it('keeps the client password rule aligned with Supabase', () => {
    assert.equal(MIN_PASSWORD_LENGTH, 8);
  });

  it('does not clear before the initial auth state resolves', () => {
    assert.equal(shouldClearUserScopedCache(undefined, null), false);
    assert.equal(shouldClearUserScopedCache(undefined, 'user-a'), false);
  });

  it('clears on login, logout and direct user switching', () => {
    assert.equal(shouldClearUserScopedCache(null, 'user-a'), true);
    assert.equal(shouldClearUserScopedCache('user-a', null), true);
    assert.equal(shouldClearUserScopedCache('user-a', 'user-b'), true);
  });

  it('does not clear for a token refresh of the same user', () => {
    assert.equal(shouldClearUserScopedCache('user-a', 'user-a'), false);
    assert.equal(shouldClearUserScopedCache(null, null), false);
  });
});
