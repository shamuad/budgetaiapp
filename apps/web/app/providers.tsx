'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}

type QueryProviderProps = {
  children: ReactNode;
};

/** Mirrors the mobile provider. Shared query hooks can be wired in once web uses Supabase. */
export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = useState(() => createQueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
