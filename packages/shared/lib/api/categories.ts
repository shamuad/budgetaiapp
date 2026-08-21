import { getSupabase } from '../supabase';
import type { Category, TransactionType } from '../../types/database';

const COLUMNS = 'id, name, icon, type, created_at';

/** The fields a category form owns. */
export type CategoryInput = {
  name: string;
  type: TransactionType;
  icon: string;
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

export async function createCategory(input: CategoryInput): Promise<void> {
  const { error } = await getSupabase().from('categories').insert(input);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  const { error } = await getSupabase().from('categories').update(input).eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await getSupabase().from('categories').delete().eq('id', id);

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
