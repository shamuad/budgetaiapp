import i18n from '../i18n';
import type { Category } from '../types/database';

type ResolvableCategory = Pick<Category, 'name' | 'is_custom' | 'translation_key'>;

export function resolveCategoryName(category: ResolvableCategory | null | undefined): string {
  if (!category) {
    return '';
  }

  if (!category.is_custom && category.translation_key) {
    // Translation keys live under the `categories` namespace in every locale
    // file (e.g. `categories.category_water`), while `translation_key` only
    // stores the bare id (`category_water`) — the namespace has to be added
    // back here at lookup time.
    return i18n.t(`categories.${category.translation_key}`, { defaultValue: category.name });
  }

  return category.name;
}

/**
 * Alphabetical by the name the user actually sees — a default category's
 * translated label, not its raw English row. `localeCompare` with the active
 * locale keeps accented/Turkish characters sorted the way a native speaker
 * expects instead of raw code-point order.
 */
export function sortCategoriesByName<T extends ResolvableCategory>(categories: T[]): T[] {
  return [...categories].sort((a, b) =>
    resolveCategoryName(a).localeCompare(resolveCategoryName(b), i18n.locale),
  );
}
