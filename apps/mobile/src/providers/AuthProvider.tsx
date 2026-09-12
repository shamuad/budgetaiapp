import { getSupabase, subscribeToAuthChanges, useAuthStore } from '@budgetaiapp/shared';
import * as Linking from 'expo-linking';
import { useEffect, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { handleAuthCallback } from '../lib/auth';

/** One callback consumer for both cold starts and links received while open. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const url = Linking.useURL();
  useEffect(() => {
    try {
      const unsubscribe = subscribeToAuthChanges();
      const auth = getSupabase().auth;
      if (Platform.OS !== 'web') auth.startAutoRefresh();
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') auth.startAutoRefresh();
        else auth.stopAutoRefresh();
      });
      return () => {
        unsubscribe();
        listener.remove();
        auth.stopAutoRefresh();
      };
    } catch {
      useAuthStore.getState().setSession(null);
    }
  }, []);
  useEffect(() => {
    if (url) void handleAuthCallback(url);
  }, [url]);
  return <>{children}</>;
}
