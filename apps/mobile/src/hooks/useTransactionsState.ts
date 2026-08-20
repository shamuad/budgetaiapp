import {
  deleteTransaction,
  fetchTransactions,
  i18n,
  toBaseAmount,
  TransactionRow,
} from '@budgetaiapp/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

export type TransactionsValue = {
  transactions: TransactionRow[];
  totalBalance: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/** Balance is always in the user base currency, using each row's locked-in rate. */
function calculateBalance(rows: TransactionRow[]) {
  return rows.reduce((total, row) => {
    const base = toBaseAmount(row.amount, row.exchange_rate);

    return row.type === 'expense' ? total - base : total + base;
  }, 0);
}

/**
 * Loads every transaction through the shared API layer.
 * Call this once, from `TransactionsProvider`, so all screens share one copy.
 * The balance is summed on the client, so this moves to a server-side aggregate
 * once the table outgrows a single request.
 */
export function useTransactionsState(): TransactionsValue {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    try {
      const rows = await fetchTransactions();

      if (!isMountedRef.current) {
        return;
      }

      setTransactions(rows);
      setTotalBalance(calculateBalance(rows));
      setError(null);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : i18n.t('common.loadError'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /** Removes a row, then reloads so every screen and the balance stay in step. */
  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteTransaction(id);
        await refetch();
      } catch (err) {
        // Raised natively rather than through `error`, which would blank the
        // list for what is only a failed delete.
        Alert.alert(
          i18n.t('common.errorTitle'),
          err instanceof Error ? err.message : i18n.t('transactionActions.deleteError'),
        );
      }
    },
    [refetch],
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return useMemo(
    () => ({ transactions, totalBalance, isLoading, error, refetch, remove }),
    [transactions, totalBalance, isLoading, error, refetch, remove],
  );
}
