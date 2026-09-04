import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
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
  hideCategory,
  restoreCategory,
  updateCategory,
  type CategoryInput,
  type CategoryWriteInput,
} from '../lib/api/categories';
import {
  createTransaction,
  createTransactions,
  deleteAllTransactions,
  deleteTransaction,
  deleteTransactionsByGroup,
  fetchTransactions,
  updateTransaction,
  type TransactionInput,
  type TransactionRow,
} from '../lib/api/transactions';
import { getAssetQuote, searchAssets } from '../lib/api/finance';
import { calculateBalancesByAsset } from '../lib/ledgerBalances';

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

  const balanceByAsset = useMemo(
    () => calculateBalancesByAsset(query.data ?? []),
    [query.data],
  );

  // Sum of every account's ledger. Transfers cancel across both sides, so
  // this matches the dashboard cards instead of net cash flow (which skipped
  // transfers and could equal a single income while the cards disagreed).
  const totalBalance = useMemo(() => {
    let total = 0;
    for (const amount of balanceByAsset.values()) {
      total += amount;
    }
    return total;
  }, [balanceByAsset]);

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

const ASSET_SEARCH_DEBOUNCE_MS = 500;
const MIN_ASSET_SEARCH_LENGTH = 1;

/** Delays reacting to a fast-changing value — shared by asset symbol search and AI category suggestion. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Live ticker/company search backed by the Next.js `finance/search` route (Yahoo Finance).
 * Debounces the raw input so we don't spam the API while the user is still typing.
 */
export function useAssetSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query.trim(), ASSET_SEARCH_DEBOUNCE_MS);
  const enabled = debouncedQuery.length >= MIN_ASSET_SEARCH_LENGTH;

  const result = useQuery({
    queryKey: ['finance', 'search', debouncedQuery],
    queryFn: ({ signal }) => searchAssets(debouncedQuery, signal),
    enabled,
    staleTime: 5 * 60_000,
    retry: 0,
  });

  return {
    results: result.data ?? [],
    isSearching: enabled && (result.isFetching || query.trim() !== debouncedQuery),
    error: result.error instanceof Error ? result.error.message : null,
  };
}

/**
 * Live market price for a single symbol, e.g. to prefill "Unit Price" the
 * moment a holding is picked from search. Prices drift slowly enough for our
 * use case that a short cache is fine — this is not a trading terminal.
 */
export function useAssetQuote(symbol: string) {
  const trimmedSymbol = symbol.trim();
  const enabled = trimmedSymbol.length > 0;

  const result = useQuery({
    queryKey: ['finance', 'quote', trimmedSymbol.toUpperCase()],
    queryFn: ({ signal }) => getAssetQuote(trimmedSymbol, signal),
    enabled,
    staleTime: 60_000,
    retry: 0,
  });

  return {
    quote: result.data ?? null,
    isLoading: enabled && result.isFetching,
    error: result.error instanceof Error ? result.error.message : null,
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

/** Saves every installment of a plan in one go, so the group is never half-written. */
export function useCreateTransactionsBatchMutation(
  options?: UseMutationOptions<void, Error, TransactionInput[]>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransactions,
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

/** Deletes an entire linked installment plan at once. */
export function useDeleteTransactionsByGroupMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransactionsByGroup,
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
  options?: UseMutationOptions<void, Error, { id: string; input: CategoryWriteInput }>,
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

/** Soft-deletes a default category (see `hideCategory`). */
export function useHideCategoryMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: hideCategory,
    onSuccess: async (...args) => {
      await invalidateCategoriesAndTransactions(queryClient);
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useRestoreCategoryMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreCategory,
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
  const deleteGroupMutation = useDeleteTransactionsByGroupMutation({
    onError: (error) => options?.onDeleteError?.(error),
  });

  return {
    ...snapshot,
    remove: (id: string) => deleteMutation.mutateAsync(id),
    /** Deletes every transaction sharing an installment plan's group id. */
    removeGroup: (groupId: string) => deleteGroupMutation.mutateAsync(groupId),
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
