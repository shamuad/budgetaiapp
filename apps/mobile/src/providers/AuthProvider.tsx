import { createSessionFromUrl, subscribeToAuthChanges, useAuthStore } from '@budgetaiapp/shared';
import * as Linking from 'expo-linking';
import { useEffect, useRef, type ReactNode } from 'react';

/** The path Supabase recovery links are sent back to — see `forgot-password`. */
const RECOVERY_PATH = 'update-password';

type AuthProviderProps = {
  children: ReactNode;
};

/** Wires `useAuthStore` to live Supabase auth state for the lifetime of the app. */
export function AuthProvider({ children }: AuthProviderProps) {
  const setIsPasswordRecovery = useAuthStore((state) => state.setIsPasswordRecovery);
  // Covers both a cold start from a link and links that arrive while the app
  // is already open.
  const url = Linking.useURL();
  const handledUrl = useRef<string | null>(null);

  useEffect(() => subscribeToAuthChanges(), []);

  useEffect(() => {
    // An auth code is single-use, so the same URL must never be redeemed
    // twice — `useURL()` keeps returning it on every later render.
    if (!url || url === handledUrl.current) {
      return;
    }

    handledUrl.current = url;

    createSessionFromUrl(url)
      .then(({ createdSession, type }) => {
        if (!createdSession) {
          return;
        }

        // PKCE links come back without a `type`, so the redirect path — which
        // this app chose when it asked for the email — is the fallback signal.
        if (type === 'recovery' || url.includes(RECOVERY_PATH)) {
          setIsPasswordRecovery(true);
        }
      })
      .catch(() => {
        // An expired or already-used link leaves the user signed out on the
        // login screen, which is the right place to start over from.
      });
  }, [url, setIsPasswordRecovery]);

  return <>{children}</>;
}
