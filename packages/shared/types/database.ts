export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'TRY';

export type TransactionType = 'income' | 'expense';

export type AssetType = 'stock' | 'etf' | 'crypto' | 'cash' | 'commodity';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  icon: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  type: TransactionType;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  // Rate to the user's base currency, stored as of occurred_at so past
  // records keep their original value when rates change.
  exchange_rate: number;
  occurred_at: string;
  created_at: string;
}

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  symbol: string;
  type: AssetType;
  quantity: number;
  average_cost: number;
  currency: CurrencyCode;
  created_at: string;
  updated_at: string;
}
