import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Asset } from '../types/database';

import i18n from '../i18n';
import {
  createAsset,
  deleteAsset,
  fetchAssets,
  reorderAssets,
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

/**
 * Balance is always in the user base currency, using each row's locked-in rate.
 * A transfer only shifts money between the user's own accounts, so it leaves the
 * headline figure untouched — counting it would double-report net cash flow.
 */
function calculateBalance(rows: TransactionRow[]) {
  return rows.reduce((total, row) => {
    if (row.type === 'transfer') {
      return total;
    }

    const base = toBaseAmount(row.amount, row.exchange_rate);

    return row.type === 'expense' ? total - base : total + base;
  }, 0);
}

/**
 * Net recorded movement per account. A transfer is booked as double entry: it
 * leaves the source account and lands in the destination, so both sides move
 * while the total above stays flat.
 */
function calculateBalancesByAsset(rows: TransactionRow[]) {
  const totals = new Map<string, number>();

  const add = (assetId: string, delta: number) => {
    totals.set(assetId, (totals.get(assetId) ?? 0) + delta);
  };

  for (const row of rows) {
    const base = toBaseAmount(row.amount, row.exchange_rate);

    if (row.type === 'transfer') {
      if (row.asset_id) {
        add(row.asset_id, -base);
      }

      if (row.to_asset_id) {
        add(row.to_asset_id, base);
      }

      continue;
    }

    if (row.asset_id) {
      add(row.asset_id, row.type === 'expense' ? -base : base);
    }
  }

  return totals;
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

  const balanceByAsset = useMemo(
    () => calculateBalancesByAsset(query.data ?? []),
    [query.data],
  );

  return {
    transactions: query.data ?? [],
    totalBalance,
    balanceByAsset,
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

export function useReorderAssetsMutation(
  options?: UseMutationOptions<void, Error, string[], { previous: Asset[] | undefined }>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderAssets,
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.assets });

      const previous = queryClient.getQueryData<Asset[]>(queryKeys.assets);

      if (previous) {
        const byId = new Map(previous.map((asset) => [asset.id, asset]));
        const next = orderedIds
          .map((id, index) => {
            const asset = byId.get(id);

            if (!asset) {
              return null;
            }

            return { ...asset, sort_order: index };
          })
          .filter(Boolean) as Asset[];

        queryClient.setQueryData(queryKeys.assets, next);
      }

      return { previous };
    },
    onError: (_error, _orderedIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.assets, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.assets });
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
