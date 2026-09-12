import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { getSupabase } from '../lib/supabase';
import type { AuthIntent } from '../lib/authFlow';

type AuthState = {
  session: Session | null;
  user: User | null;
  // True until the session has been read from storage at least once, so the
  // root layout can hold the first paint instead of flashing the login screen.
  isLoading: boolean;
  // True while a recovery link has signed the user in but they haven't set a
  // new password yet. A recovery link issues a real, valid session, so
  // without this flag the root layout's guard would treat it like a normal
  // sign-in and jump straight to the main app before the reset is finished.
  isPasswordRecovery: boolean;
  authLinkStatus: 'idle' | 'processing' | 'error';
  authLinkIntent: AuthIntent;
  authLinkError: string | null;
  setAuthLinkState: (
    status: 'idle' | 'processing' | 'error',
    intent?: AuthIntent,
    error?: string | null,
  ) => void;
  setSession: (session: Session | null) => void;
  setIsPasswordRecovery: (isPasswordRecovery: boolean) => void;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  isPasswordRecovery: false,
  authLinkStatus: 'idle',
  authLinkIntent: 'magiclink',
  authLinkError: null,
  setAuthLinkState: (authLinkStatus, intent, error = null) =>
    set((state) => ({
      authLinkStatus,
      authLinkIntent: intent ?? state.authLinkIntent,
      authLinkError: error,
    })),
  setSession: (session) => set({ session, user: session?.user ?? null, isLoading: false }),
  setIsPasswordRecovery: (isPasswordRecovery) => set({ isPasswordRecovery }),
  signOut: async () => {
    const { error } = await getSupabase().auth.signOut();

    if (error) {
      throw error;
    }

    set({ isPasswordRecovery: false });
  },
}));

/**
 * Mirrors Supabase's auth state into `useAuthStore`: reads whatever session
 * `persistSession` already restored from `AsyncStorage`, then keeps it in
 * sync as the user signs in, signs out, or a token refreshes. Call once, near
 * the root of the app, and dispose the returned unsubscribe on unmount.
 */
export function subscribeToAuthChanges() {
  const supabase = getSupabase();
  const { setSession, setIsPasswordRecovery } = useAuthStore.getState();

  let disposed = false;
  let receivedEvent = false;
  supabase.auth.getSession().then(({ data }) => {
    if (disposed || receivedEvent) return;
    setSession(data.session ?? null);

    if (data.session) {
      void import('../lib/api/avatar').then(({ hydrateAvatarFromProfile }) => {
        void hydrateAvatarFromProfile();
      });
    }
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    receivedEvent = true;
    if (event === 'INITIAL_SESSION' && session) {
      void import('../lib/api/avatar').then(({ hydrateAvatarFromProfile }) => {
        void hydrateAvatarFromProfile();
      });
    }
    // Sent when a recovery link is what established the session. Under the
    // PKCE flow Supabase reports `SIGNED_IN` instead, so the deep link
    // handler flags recovery from the link itself as well — whichever
    // arrives first wins, and both mean the same thing here.
    if (event === 'PASSWORD_RECOVERY') {
      setIsPasswordRecovery(true);
    } else if (
      !session ||
      (event === 'SIGNED_IN' && useAuthStore.getState().authLinkStatus !== 'processing')
    ) {
      // A later normal sign-in or any sign-out must not inherit a recovery
      // guard from an earlier session in the same app process. For PKCE
      // recovery, the deep-link handler has already set the flag before SIGNED_IN.
      setIsPasswordRecovery(false);
    }

    setSession(session);
  });

  return () => {
    disposed = true;
    subscription.unsubscribe();
  };
}
