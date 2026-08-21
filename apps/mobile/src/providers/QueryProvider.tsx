import { createQueryClient } from '@budgetaiapp/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

type QueryProviderProps = {
  children: ReactNode;
};

/** One QueryClient for the whole app so every screen shares the same cache. */
export function QueryProvider({ children }: QueryProviderProps) {
  const [client] = useState(() => createQueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
