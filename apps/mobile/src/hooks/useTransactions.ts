import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@budgetaiapp/shared';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer';
  date: string;
}

export interface NewTransaction {
  title: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense';
  date: string;
  category_id: string | null;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabase();

      // 1. Son 10 işlemi liste için çekiyoruz
      const { data: recentTx, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (txError) throw new Error(txError.message);

      // 2. Sadece bakiye hesabı için tüm işlemlerin miktar ve tipini çekiyoruz
      const { data: allTx, error: balanceError } = await supabase
        .from('transactions')
        .select('amount, type');

      if (balanceError) throw new Error(balanceError.message);

      // Bakiyeyi matematiksel olarak hesaplıyoruz (Gelirler - Giderler)
      let calculatedBalance = 0;
      if (allTx) {
        calculatedBalance = allTx.reduce((acc, tx) => {
          return tx.type === 'expense' ? acc - tx.amount : acc + tx.amount;
        }, 0);
      }

      setTransactions((recentTx as Transaction[]) || []);
      setTotalBalance(calculatedBalance);
    } catch (err: any) {
      setError(err.message || 'Veriler yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Kaydettikten sonra listeyi ve bakiyeyi tazeliyoruz
  const addTransaction = useCallback(
    async (transaction: NewTransaction) => {
      const supabase = getSupabase();
      const { error: insertError } = await supabase.from('transactions').insert(transaction);

      if (insertError) throw new Error(insertError.message);

      await fetchData();
    },
    [fetchData]
  );

  return { transactions, totalBalance, isLoading, error, refetch: fetchData, addTransaction };
}
