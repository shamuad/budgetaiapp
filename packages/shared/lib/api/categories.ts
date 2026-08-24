import { getSupabase } from '../supabase';
import type { Category, CategoryType } from '../../types/database';

const COLUMNS = 'id, name, icon, type, is_custom, translation_key, is_active, created_at';

/** The fields a category form owns. */
export type CategoryInput = {
  name: string;
  type: CategoryType;
  icon: string;
};

/**
 * What an edit actually writes. Renaming a default category severs it from
 * its `translation_key` for good, but changing only its icon or type should
 * not — the caller (which still has the original row) decides which applies,
 * so a "Reset to default icon" stays possible for as long as the name itself
 * was never touched.
 */
export type CategoryWriteInput = CategoryInput & {
  is_custom: boolean;
  translation_key: string | null;
};

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await getSupabase()
    .from('categories')
    .select(COLUMNS)
    .returns<Category[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

// A category the user creates through the app is always custom — only the
// SQL seed inserts the built-in, translated ones.
export async function createCategory(input: CategoryInput): Promise<void> {
  const { error } = await getSupabase()
    .from('categories')
    .insert({ ...input, is_custom: true, translation_key: null, is_active: true });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateCategory(id: string, input: CategoryWriteInput): Promise<void> {
  const { error } = await getSupabase().from('categories').update(input).eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

/** Permanently removes a category. Only safe for custom ones — see `hideCategory` for defaults. */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await getSupabase().from('categories').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Soft-deletes a default category: hides it from pickers and the AI without
 * touching the row, so every transaction that already points at it stays
 * valid and it can be brought back with `restoreCategory`.
 */
export async function hideCategory(id: string): Promise<void> {
  const { error } = await getSupabase().from('categories').update({ is_active: false }).eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function restoreCategory(id: string): Promise<void> {
  const { error } = await getSupabase().from('categories').update({ is_active: true }).eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * How many transactions use this category.
 * `transactions.category_id` is nullable, so a delete would silently strip the
 * category off those rows instead of failing; callers check this first.
 */
export async function countCategoryTransactions(id: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
