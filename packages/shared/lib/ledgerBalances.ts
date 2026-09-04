import type { Transaction } from '../types/database';

/**
 * Net recorded movement per account, in the user base currency.
 * A transfer is booked as double entry: it leaves the source account and
 * lands in the destination, so both sides move while the combined total
 * stays flat.
 */
export function calculateBalancesByAsset(rows: Pick<Transaction, 'amount' | 'exchange_rate' | 'type' | 'asset_id' | 'to_asset_id'>[]) {
  const totals = new Map<string, number>();

  const add = (assetId: string, delta: number) => {
    totals.set(assetId, (totals.get(assetId) ?? 0) + delta);
  };

  for (const row of rows) {
    const base = row.amount * row.exchange_rate;

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
