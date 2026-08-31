import { getSupabase } from '../supabase';
import type { Asset, AssetType, CurrencyCode } from '../../types/database';

const COLUMNS =
  'id, name, symbol, type, icon, custom_color, payment_clue, is_credit, statement_day, sort_order, quantity, purchase_price, current_price, currency, created_at';

/**
 * The fields an account form owns. An account is a top-level container, so it
 * carries no ticker of its own: the holdings inside an investment account are
 * recorded on the transactions that bought them.
 */
export type AssetInput = {
  name: string;
  symbol: string;
  type: AssetType;
  icon: string;
  currency: CurrencyCode;
  custom_color?: string | null;
  payment_clue?: string | null;
  is_credit?: boolean;
  statement_day?: number | null;
};

// The priced columns are NOT NULL but only mean anything for investments, so
// spending accounts are written with zeros.
const ACCOUNT_PRICING = {
  quantity: 0,
  purchase_price: 0,
  current_price: 0,
};

export async function fetchAssets(): Promise<Asset[]> {
  const { data, error } = await getSupabase()
    .from('assets')
    .select(COLUMNS)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .returns<Asset[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function reorderAssets(orderedIds: string[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      getSupabase().from('assets').update({ sort_order: index }).eq('id', id),
    ),
  );

  const failed = results.find((result) => result.error);

  if (failed?.error) {
    throw new Error(failed.error.message);
  }
}

export async function createAsset(input: AssetInput): Promise<void> {
  const existing = await fetchAssets();
  const sort_order =
    existing.reduce((max, asset) => Math.max(max, asset.sort_order ?? -1), -1) + 1;

  const { error } = await getSupabase()
    .from('assets')
    .insert({ ...input, ...ACCOUNT_PRICING, sort_order });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateAsset(id: string, input: AssetInput): Promise<void> {
  const { error } = await getSupabase().from('assets').update(input).eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAsset(id: string): Promise<void> {
  const { error } = await getSupabase().from('assets').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * How many transactions are booked to this account, on either side of a transfer.
 * Both foreign keys block a delete deep in the database, so callers check this
 * first to say so plainly.
 */
export async function countAssetTransactions(id: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .or(`asset_id.eq.${id},to_asset_id.eq.${id}`);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
