import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import i18n from '../i18n';
import {
  createAsset,
  deleteAsset,
  fetchAssets,
  updateAsset,
  type AssetInput,
} from '../lib/api/assets';
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  type CategoryInput,
} from '../lib/api/categories';
import {
  createTransaction,
  deleteAllTransactions,
  deleteTransaction,
  fetchTransactions,
  updateTransaction,
  type TransactionInput,
  type TransactionRow,
} from '../lib/api/transactions';
import { toBaseAmount } from '../lib/format';

/** Stable cache keys shared by every consumer in the monorepo. */
export const queryKeys = {
  transactions: ['transactions'] as const,
  assets: ['assets'] as const,
  categories: ['categories'] as const,
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}

/** Balance is always in the user base currency, using each row's locked-in rate. */
function calculateBalance(rows: TransactionRow[]) {
  return rows.reduce((total, row) => {
    const base = toBaseAmount(row.amount, row.exchange_rate);

    return row.type === 'expense' ? total - base : total + base;
  }, 0);
}

function invalidateTransactions(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
}

function invalidateAssetsAndTransactions(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.assets }),
    invalidateTransactions(queryClient),
  ]);
}

function invalidateCategoriesAndTransactions(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
    invalidateTransactions(queryClient),
  ]);
}

// --- Queries ---

export function useTransactionsQuery() {
  const query = useQuery({
    queryKey: queryKeys.transactions,
    queryFn: fetchTransactions,
  });

  const totalBalance = useMemo(
    () => calculateBalance(query.data ?? []),
    [query.data],
  );

  return {
    transactions: query.data ?? [],
    totalBalance,
    isLoading: query.isLoading,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : i18n.t('common.loadError')
      : null,
    refetch: query.refetch,
  };
}

export function useAssetsQuery() {
  const query = useQuery({
    queryKey: queryKeys.assets,
    queryFn: fetchAssets,
  });

  return {
    assets: query.data ?? [],
    isLoading: query.isLoading,
    refresh: query.refetch,
  };
}

export function useCategoriesQuery() {
  const query = useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    refresh: query.refetch,
  };
}

// --- Transaction mutations ---

export function useCreateTransactionMutation(
  options?: UseMutationOptions<void, Error, TransactionInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransaction,
    onSuccess: async (...args) => {
      await invalidateTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useUpdateTransactionMutation(
  options?: UseMutationOptions<void, Error, { id: string; input: TransactionInput }>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }) => updateTransaction(id, input),
    onSuccess: async (...args) => {
      await invalidateTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useDeleteTransactionMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: async (...args) => {
      await invalidateTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useDeleteAllTransactionsMutation(
  options?: UseMutationOptions<void, Error, void>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAllTransactions,
    onSuccess: async (...args) => {
      await invalidateTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

// --- Asset mutations ---

export function useCreateAssetMutation(
  options?: UseMutationOptions<void, Error, AssetInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAsset,
    onSuccess: async (...args) => {
      await invalidateAssetsAndTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useUpdateAssetMutation(
  options?: UseMutationOptions<void, Error, { id: string; input: AssetInput }>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }) => updateAsset(id, input),
    onSuccess: async (...args) => {
      await invalidateAssetsAndTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useDeleteAssetMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAsset,
    onSuccess: async (...args) => {
      await invalidateAssetsAndTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

// --- Category mutations ---

export function useCreateCategoryMutation(
  options?: UseMutationOptions<void, Error, CategoryInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: async (...args) => {
      await invalidateCategoriesAndTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useUpdateCategoryMutation(
  options?: UseMutationOptions<void, Error, { id: string; input: CategoryInput }>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }) => updateCategory(id, input),
    onSuccess: async (...args) => {
      await invalidateCategoriesAndTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useDeleteCategoryMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: async (...args) => {
      await invalidateCategoriesAndTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

/**
 * Convenience hook that mirrors the old context API.
 * Pass `onDeleteError` from UI layers that need native error feedback.
 */
export function useTransactions(options?: { onDeleteError?: (error: Error) => void }) {
  const snapshot = useTransactionsQuery();
  const deleteMutation = useDeleteTransactionMutation({
    onError: (error) => options?.onDeleteError?.(error),
  });

  return {
    ...snapshot,
    remove: (id: string) => deleteMutation.mutateAsync(id),
  };
}

/** Mirrors the old `useAssets()` context shape. */
export function useAssets() {
  return useAssetsQuery();
}

/** Mirrors the old `useCategories()` context shape. */
export function useCategories() {
  return useCategoriesQuery();
}
