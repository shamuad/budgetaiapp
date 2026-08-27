import { Category, CategoryType, useDebouncedValue } from '@budgetaiapp/shared';
import { useEffect, useRef, useState } from 'react';

import { categorizeTransaction } from '../lib/ai';

const TITLE_DEBOUNCE_MS = 700;
const MIN_TITLE_LENGTH = 3;

/**
 * Suggests a category for the title the user is typing, debounced so it only
 * calls `ask-gemini` once they pause. Purely advisory: it never touches form
 * state itself, so the caller decides whether to apply the suggestion (e.g.
 * only while the user hasn't picked one manually) and can always overrule it.
 */
export function useCategorySuggestion({
  title,
  type,
  categories,
  enabled,
}: {
  title: string;
  /** Null while the transaction is a transfer, which is never categorised. */
  type: CategoryType | null;
  categories: Category[];
  enabled: boolean;
}): { suggestedCategory: Category | null; isSuggesting: boolean } {
  const debouncedTitle = useDebouncedValue(title.trim(), TITLE_DEBOUNCE_MS);
  const [suggestedCategory, setSuggestedCategory] = useState<Category | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  // Guards against a slow, stale request overwriting a newer one's result.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !type || debouncedTitle.length < MIN_TITLE_LENGTH) {
      setSuggestedCategory(null);
      setIsSuggesting(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsSuggesting(true);

    categorizeTransaction(debouncedTitle, categories, type)
      .then((category) => {
        if (requestIdRef.current === requestId) {
          setSuggestedCategory(category);
        }
      })
      .catch(() => {
        if (requestIdRef.current === requestId) {
          setSuggestedCategory(null);
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setIsSuggesting(false);
        }
      });
    // `categories` intentionally excluded: it's stable per session and
    // re-running on every reference change would refire needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, type, enabled]);

  return { suggestedCategory, isSuggesting };
}
