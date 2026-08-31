import { getSupabase } from '../supabase';
import type {
  Asset,
  Category,
  CurrencyCode,
  Transaction,
  TransactionType,
} from '../../types/database';

/**
 * A list row: the transaction columns plus its embedded category and account.
 * The raw foreign keys ride along so an edit form can reselect the related rows.
 */
export type TransactionRow = Pick<
  Transaction,
  | 'id'
  | 'title'
  | 'amount'
  | 'currency'
  | 'exchange_rate'
  | 'type'
  | 'date'
  | 'billing_month'
  | 'category_id'
  | 'asset_id'
  | 'to_asset_id'
  | 'asset_symbol'
  | 'shares'
  | 'unit_price'
  | 'installment_group_id'
> & {
  category: Pick<
    Category,
    'icon' | 'name' | 'is_custom' | 'translation_key' | 'group_code' | 'color_code'
  > | null;
  asset: Pick<Asset, 'icon' | 'name'> | null;
  /**
   * The receiving account of a transfer. Null for income and expense.
   * `type` rides along so the 50/30/20 Savings bucket can be derived from
   * transfers landing on an `investment` account — see `calculateBudgetBreakdown`.
   */
  to_asset: Pick<Asset, 'icon' | 'name' | 'type'> | null;
};

/** The fields a form owns. Server-managed columns such as `created_at` stay out. */
export type TransactionInput = {
  title: string;
  amount: number;
  currency: CurrencyCode;
  // Locked in when the row is written, so history never moves with live rates.
  exchange_rate: number;
  type: TransactionType;
  // Calendar day as YYYY-MM-DD.
  date: string;
  // First of the statement month (`YYYY-MM-01`) for credit income/expense.
  // Null for cash/debit and for transfers.
  billing_month: string | null;
  // Null on a transfer: money moved rather than being spent on something.
  category_id: string | null;
  // Required: every transaction is booked against an account.
  asset_id: string;
  // The other half of a transfer's double entry. Null for income and expense.
  to_asset_id: string | null;
  // Which holding inside the destination account was bought, and at what size.
  // Only set when a transfer buys into an investment account.
  asset_symbol: string | null;
  shares: number | null;
  unit_price: number | null;
  // Ties every row an installment plan was split into back together. Null on
  // a normal, one-off transaction.
  installment_group_id: string | null;
};

// Both `asset_id` and `to_asset_id` point at `assets`, so each embed names its
// own foreign key. Without the hint PostgREST cannot tell the two apart.
const COLUMNS =
  'id, title, amount, currency, exchange_rate, type, date, billing_month, category_id, asset_id, to_asset_id, asset_symbol, shares, unit_price, installment_group_id, category:categories(icon, name, is_custom, translation_key, group_code, color_code), asset:assets!asset_id(icon, name), to_asset:assets!to_asset_id(icon, name, type)';

/**
 * Every transaction, latest date first and newest entry first within a date.
 * Both foreign keys are to-one relations, so PostgREST embeds each as a single
 * object. The embeds are left joins, so rows without an account still arrive,
 * carrying null.
 */
export async function fetchTransactions(): Promise<TransactionRow[]> {
  const { data, error } = await getSupabase()
    .from('transactions')
    .select(COLUMNS)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<TransactionRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createTransaction(input: TransactionInput): Promise<void> {
  const { error } = await getSupabase().from('transactions').insert(input);

  if (error) {
    throw new Error(error.message);
  }
}

/** Writes every installment of a plan in one round trip, so the group is never half-saved. */
export async function createTransactions(inputs: TransactionInput[]): Promise<void> {
  const { error } = await getSupabase().from('transactions').insert(inputs);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
  const { error } = await getSupabase().from('transactions').update(input).eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await getSupabase().from('transactions').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

/** Deletes every transaction in an installment plan at once, keeping the group consistent. */
export async function deleteTransactionsByGroup(groupId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('transactions')
    .delete()
    .eq('installment_group_id', groupId);

  if (error) {
    throw new Error(error.message);
  }
}

/** Wipes the ledger, leaving accounts and categories in place. */
export async function deleteAllTransactions(): Promise<void> {
  // PostgREST refuses an unfiltered delete, so this matches every row explicitly.
  const { error } = await getSupabase().from('transactions').delete().not('id', 'is', null);

  if (error) {
    throw new Error(error.message);
  }
}
