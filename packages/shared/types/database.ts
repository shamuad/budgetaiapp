export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'TRY';

// User base currency. Transaction amounts stay in their original currency;
// `exchange_rate` converts them into this one for balances and reports.
export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

export type TransactionType = 'income' | 'expense';

// Investment holdings and spending accounts share the `assets` table.
export type AssetType = 'stock' | 'etf' | 'crypto' | 'commodity' | 'cash' | 'card' | 'bank';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  // Original purchase currency. Never rewritten when live rates move.
  currency: CurrencyCode;
  // Multiplier into the user base currency at the time of purchase.
  // base_amount = amount * exchange_rate. Same-currency rows use 1.
  exchange_rate: number;
  type: TransactionType;
  category_id: string | null;
  // The account the money moved through. Required, enforced by a NOT NULL column.
  asset_id: string;
  // Calendar day as YYYY-MM-DD, without a time or timezone.
  date: string;
  notes: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  type: AssetType | null;
  icon: string | null;
  // Priced columns describe investment holdings and stay at zero for accounts.
  quantity: number;
  purchase_price: number;
  current_price: number | null;
  currency: CurrencyCode;
  created_at: string;
}
