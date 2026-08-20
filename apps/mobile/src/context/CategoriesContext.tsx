import { Category, fetchCategories } from '@budgetaiapp/shared';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type CategoriesValue = {
  categories: Category[];
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const CategoriesContext = createContext<CategoriesValue | null>(null);

/**
 * Owns the single copy of the category list, so edits in settings reach the
 * transaction pickers and the AI prompt without a restart.
 */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCategories(await fetchCategories());
    } catch {
      // An empty list simply leaves the pickers empty.
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ categories, isLoading, refresh }),
    [categories, isLoading, refresh],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  const context = useContext(CategoriesContext);

  if (!context) {
    throw new Error('useCategories must be used inside a CategoriesProvider');
  }

  return context;
}
