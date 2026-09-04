import {
  createQueryClient,
  shouldClearUserScopedCache,
  useAuthStore,
} from '@budgetaiapp/shared';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ReactNode, useEffect, useRef, useState } from 'react';

type QueryProviderProps = {
  children: ReactNode;
};

/** One QueryClient for the whole app so every screen shares the same cache. */
export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={client}>
      <ClearCacheOnAuthChange />
      {children}
    </QueryClientProvider>
  );
}

/**
 * Now that RLS scopes every row to `user_id`, every cached query is scoped
 * to whoever was signed in when it was fetched. A login, logout, or switch
 * to a different account must drop that cache entirely — otherwise the next
 * session can briefly render the previous user's transactions, assets, or
 * categories straight from memory before a real refetch lands.
 *
 * `undefined` only ever means "auth hasn't resolved yet" (first render), so
 * it's excluded from the comparison to avoid clearing on initial mount.
 */
function ClearCacheOnAuthChange() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (shouldClearUserScopedCache(previousUserIdRef.current, userId)) {
      queryClient.clear();
    }

    previousUserIdRef.current = userId;
  }, [userId, queryClient]);

  return null;
}
