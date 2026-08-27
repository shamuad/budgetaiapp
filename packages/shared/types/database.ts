export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'TRY';

// User base currency. Transaction amounts stay in their original currency;
// `exchange_rate` converts them into this one for balances and reports.
export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

// `transfer` moves money between the user's own accounts. It is deliberately
// neither income nor expense, so net cash flow stays accurate.
export type TransactionType = 'income' | 'expense' | 'transfer';

// Transfers are never categorised, so a category only ever describes one of the
// two spending sides.
export type CategoryType = Exclude<TransactionType, 'transfer'>;

/**
 * Tier one of the investment model: a top-level place money sits, never an
 * individual holding. An S&P 500 ETF is not an account — it is a holding inside
 * an `investment` (brokerage) account, recorded on the transactions that bought
 * it. The single-asset kinds below are retained only so historical rows written
 * under the old model still read back.
 */
export type AssetType =
  | 'stock'
  | 'etf'
  | 'crypto'
  | 'commodity'
  | 'cash'
  | 'card'
  | 'bank'
  | 'investment';

/** The 50/30/20 tier an expense category belongs to. Always null for income —
 * Savings is never a selectable category (see `group_code` below). */
export type CategoryGroup = 'needs' | 'wants';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  is_custom: boolean;
  translation_key: string | null;
  is_active: boolean;
  // Null for every income category. Deliberately excludes 'savings': money
  // moved to a savings/investment account is a `transfer`, never an expense
  // category — see `calculateBudgetBreakdown`, which derives Savings from
  // transfers instead.
  group_code: CategoryGroup | null;
  // Hex color driving pickers/charts. Null falls back to categoryPalette.ts's
  // name-hash color (custom categories, income categories).
  color_code: string | null;
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
  // Null on a transfer, which moves money rather than spending it.
  category_id: string | null;
  // The account the money moved through — the debited side of a transfer.
  // Required, enforced by a NOT NULL column.
  asset_id: string;
  // The credited side of a transfer. Null for income and expense.
  to_asset_id: string | null;
  // Tier two of the investment model: which holding inside the destination
  // account this transfer bought, as a market symbol such as `VUSA.AS` or `BTC`.
  // Null for plain cash movements.
  asset_symbol: string | null;
  // Units acquired, so a holding can be tracked across many purchases at
  // different prices rather than as a single lump.
  shares: number | null;
  // Price paid per unit, in `currency`. Pairs with `shares`.
  unit_price: number | null;
  // Calendar day as YYYY-MM-DD, without a time or timezone.
  date: string;
  notes: string | null;
  // Shared by every row an installment plan split into, so they can be edited
  // or deleted together. Null for a normal, one-off transaction.
  installment_group_id: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  type: AssetType | null;
  icon: string | null;
  /** User override for wallet card background. Null uses auto-detected bank color. */
  custom_color: string | null;
  /** Manual list order in manage accounts and dashboard cards. */
  sort_order: number | null;
  // Priced columns describe investment holdings and stay at zero for accounts.
  quantity: number;
  purchase_price: number;
  current_price: number | null;
  currency: CurrencyCode;
  created_at: string;
}
