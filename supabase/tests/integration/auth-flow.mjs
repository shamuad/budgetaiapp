import assert from 'node:assert/strict';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(supabaseUrl, 'SUPABASE_URL is required');
assert.ok(anonKey, 'SUPABASE_ANON_KEY is required');
assert.ok(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required');

const hostname = new URL(supabaseUrl).hostname;
assert.ok(
  hostname === '127.0.0.1' || hostname === 'localhost',
  `Refusing to create integration-test users outside local Supabase: ${hostname}`,
);

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

const admin = createClient(supabaseUrl, serviceRoleKey, clientOptions);
const createdUserIds = [];
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const userAEmail = `auth-a-${runId}@example.com`;
const userBEmail = `auth-b-${runId}@example.com`;
const originalPassword = 'Valid-Password-123!';
const replacementPassword = 'Changed-Password-456!';

function client() {
  return createClient(supabaseUrl, anonKey, clientOptions);
}

function assertNoError(error, operation) {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
}

async function signUpUser(email, name) {
  const authClient = client();
  const { data, error } = await authClient.auth.signUp({
    email,
    password: originalPassword,
    options: { data: { name } },
  });

  assertNoError(error, `sign up ${email}`);
  assert.ok(data.session, 'Local signup should create a session when confirmations are disabled');
  assert.ok(data.user?.id, 'Signup should return a user id');
  createdUserIds.push(data.user.id);

  return { authClient, user: data.user };
}

async function waitForRecoveryEmail(email) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch('http://127.0.0.1:54324/api/v1/messages');

    if (response.ok) {
      const inbox = await response.json();
      const messages = Array.isArray(inbox.messages) ? inbox.messages : [];

      if (messages.some((message) => JSON.stringify(message).includes(email))) {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  assert.fail(`Recovery email for ${email} did not arrive in local Mailpit`);
}

try {
  const userA = await signUpUser(userAEmail, 'Auth User A');
  const userB = await signUpUser(userBEmail, 'Auth User B');

  const { count: categoryCount, error: categoryError } = await userA.authClient
    .from('categories')
    .select('id', { count: 'exact', head: true });
  assertNoError(categoryError, 'read seeded categories for user A');
  assert.equal(categoryCount, 30, 'Signup trigger should seed exactly 30 default categories');

  const { data: profile, error: profileError } = await userA.authClient
    .from('profiles')
    .select('id, name')
    .single();
  assertNoError(profileError, 'read profile for user A');
  assert.equal(profile.id, userA.user.id);
  assert.equal(profile.name, 'Auth User A');

  const assetInput = {
    symbol: 'EUR',
    type: 'bank',
    quantity: 0,
    purchase_price: 0,
    current_price: 0,
    currency: 'EUR',
  };

  const { error: assetAError } = await userA.authClient
    .from('assets')
    .insert({ ...assetInput, name: 'User A Account' });
  assertNoError(assetAError, 'create user A account');

  const { error: assetBError } = await userB.authClient
    .from('assets')
    .insert({ ...assetInput, name: 'User B Account' });
  assertNoError(assetBError, 'create user B account');

  const switchingClient = client();
  const { error: signInAError } = await switchingClient.auth.signInWithPassword({
    email: userAEmail,
    password: originalPassword,
  });
  assertNoError(signInAError, 'sign in user A on switching client');

  const { data: assetsForA, error: assetsForAError } = await switchingClient
    .from('assets')
    .select('name');
  assertNoError(assetsForAError, 'read user A accounts');
  assert.deepEqual(assetsForA.map(({ name }) => name), ['User A Account']);

  const { error: signOutAError } = await switchingClient.auth.signOut();
  assertNoError(signOutAError, 'sign out user A');

  const { error: signInBError } = await switchingClient.auth.signInWithPassword({
    email: userBEmail,
    password: originalPassword,
  });
  assertNoError(signInBError, 'sign in user B on the same client');

  const { data: assetsForB, error: assetsForBError } = await switchingClient
    .from('assets')
    .select('name');
  assertNoError(assetsForBError, 'read user B accounts');
  assert.deepEqual(assetsForB.map(({ name }) => name), ['User B Account']);

  const recoveryRequestClient = client();
  const { error: resetRequestError } = await recoveryRequestClient.auth.resetPasswordForEmail(
    userAEmail,
    { redirectTo: 'budgree://update-password' },
  );
  assertNoError(resetRequestError, 'request password recovery email');
  await waitForRecoveryEmail(userAEmail);

  const { data: generatedLink, error: generatedLinkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: userAEmail,
  });
  assertNoError(generatedLinkError, 'generate a local recovery token');
  assert.ok(generatedLink.properties?.hashed_token, 'Recovery link should include a token hash');

  const recoveryClient = client();
  const { data: recoverySession, error: recoveryError } = await recoveryClient.auth.verifyOtp({
    token_hash: generatedLink.properties.hashed_token,
    type: 'recovery',
  });
  assertNoError(recoveryError, 'exchange recovery token for a session');
  assert.equal(recoverySession.user?.id, userA.user.id);

  const { error: updatePasswordError } = await recoveryClient.auth.updateUser({
    password: replacementPassword,
  });
  assertNoError(updatePasswordError, 'update password from recovery session');
  await recoveryClient.auth.signOut();

  const passwordCheckClient = client();
  const oldPasswordAttempt = await passwordCheckClient.auth.signInWithPassword({
    email: userAEmail,
    password: originalPassword,
  });
  assert.ok(oldPasswordAttempt.error, 'The old password must stop working after recovery');

  const newPasswordAttempt = await passwordCheckClient.auth.signInWithPassword({
    email: userAEmail,
    password: replacementPassword,
  });
  assertNoError(newPasswordAttempt.error, 'sign in with replacement password');
  assert.equal(newPasswordAttempt.data.user?.id, userA.user.id);

  console.log('Auth integration passed: recovery, password replacement, switching and RLS isolation.');
} finally {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);

    if (error) {
      console.error(`Failed to delete local integration user ${userId}: ${error.message}`);
    }
  }
}
