import { createContext, ReactNode, useContext } from 'react';

import { TransactionsValue, useTransactionsState } from '../hooks/useTransactionsState';

const TransactionsContext = createContext<TransactionsValue | null>(null);

/**
 * Owns the single copy of the transaction list. Each screen used to call the
 * fetching hook on its own, so every tab held its own state and a write on one
 * tab left the other showing stale rows until the app restarted.
 */
export function TransactionsProvider({ children }: { children: ReactNode }) {
  const value = useTransactionsState();

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
}

/** Reads the shared list. Any mutation done through it reaches every screen. */
export function useTransactions() {
  const context = useContext(TransactionsContext);

  if (!context) {
    throw new Error('useTransactions must be used inside a TransactionsProvider');
  }

  return context;
}
