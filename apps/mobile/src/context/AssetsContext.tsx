import { Asset, fetchAssets } from '@budgetaiapp/shared';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type AssetsValue = {
  assets: Asset[];
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const AssetsContext = createContext<AssetsValue | null>(null);

/**
 * Owns the single copy of the account list, so adding or renaming an account in
 * settings reaches the dashboard cards and the transaction pickers at once.
 */
export function AssetsProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setAssets(await fetchAssets());
    } catch {
      // An empty list simply leaves the pickers empty.
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ assets, isLoading, refresh }), [assets, isLoading, refresh]);

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}

export function useAssets() {
  const context = useContext(AssetsContext);

  if (!context) {
    throw new Error('useAssets must be used inside an AssetsProvider');
  }

  return context;
}
