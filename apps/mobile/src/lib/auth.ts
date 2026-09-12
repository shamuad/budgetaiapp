import {
  authErrorKey,
  createSessionFromUrl,
  getSupabase,
  parseAuthCallback,
  singleFlightAuthCallback,
  useAuthStore,
  type AuthIntent,
} from '@budgetaiapp/shared';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export function authRedirect(intent: AuthIntent) {
  return Linking.createURL('auth-callback', { scheme: 'budgetai', queryParams: { intent } });
}

export function allowedAuthCallbacks() {
  return [
    Linking.createURL('auth-callback', { scheme: 'budgetai' }),
    Linking.createURL('update-password', { scheme: 'budgetai' }),
    'budgetai://auth-callback',
    'budgetai://update-password',
    'budgree://auth-callback',
    'budgree://update-password',
  ];
}

export const handleAuthCallback = singleFlightAuthCallback(async (url: string) => {
  const callback = parseAuthCallback(url, allowedAuthCallbacks());
  if (!callback) return false;
  const store = useAuthStore.getState();
  const previousRecovery = store.isPasswordRecovery;
  store.setAuthLinkState('processing', callback.intent);
  // Set BEFORE exchanging: SIGNED_IN must never open the dashboard mid-recovery.
  store.setIsPasswordRecovery(callback.intent === 'recovery');
  try {
    const result = await createSessionFromUrl(url, allowedAuthCallbacks());
    store.setAuthLinkState('idle', callback.intent);
    return result.createdSession;
  } catch (error) {
    store.setIsPasswordRecovery(previousRecovery);
    store.setAuthLinkState('error', callback.intent, authErrorKey(error));
    return false;
  }
});

export async function signInWithProvider(provider: 'apple' | 'google') {
  // Expo Go cannot own the custom OAuth return scheme. Email/password remains usable there.
  if (Constants.appOwnership === 'expo')
    throw Object.assign(new Error('Development build required'), { code: 'expoGo' });
  const redirectTo = authRedirect('oauth');
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url)
    throw Object.assign(new Error('Provider unavailable'), { code: 'providerNotReady' });
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled' as const;
  const completed = await handleAuthCallback(result.url);
  if (!completed) throw new Error('Provider callback failed');
  return 'success' as const;
}
