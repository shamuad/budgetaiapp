import type { TransactionInput } from './api/transactions';
import type { Asset, CurrencyCode } from '../types/database';
import { addBillingMonths, addMonthsClamped, installmentSliceDate, resolveBillingMonth } from '../utils/billingMonth';
import { toISODate } from './valueParsing';

/** Build the exact rows used by the mobile batch insert, preserving every cent. */
export function buildInstallmentPlan(input: {
  title: string;
  amount: number;
  installments: number;
  type: 'expense' | 'income';
  date: Date;
  asset: Pick<Asset, 'id' | 'is_credit' | 'statement_day'>;
  categoryId: string | null;
  currency: CurrencyCode;
  exchangeRate: number;
  groupId: string;
}): TransactionInput[] {
  const { installments: count, asset, date } = input;
  const cents = Math.round(input.amount * 100);
  if (!Number.isInteger(count) || count < 2 || count > 60 ||
      !Number.isSafeInteger(cents) || cents < count) {
    throw new RangeError('Each installment must be at least one cent; use 2–60 installments.');
  }
  if (!Number.isFinite(input.exchangeRate) || input.exchangeRate <= 0 ||
      !Number.isFinite(date.getTime())) {
    throw new RangeError('A valid date and positive exchange rate are required.');
  }
  const baseCents = Math.floor(cents / count);
  const remainder = cents % count;
  const day = asset.is_credit ? asset.statement_day : null;
  const firstBilling = day == null ? null : resolveBillingMonth(date, day);
  return Array.from({ length: count }, (_, index) => ({
    title: `${input.title} (${index + 1}/${count})`,
    amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
    currency: input.currency,
    exchange_rate: input.exchangeRate,
    type: input.type,
    date: toISODate(day != null && firstBilling
      ? installmentSliceDate(date, index, day, firstBilling)
      : addMonthsClamped(date, index)),
    billing_month: firstBilling ? toISODate(addBillingMonths(firstBilling, index)) : null,
    category_id: input.categoryId,
    asset_id: asset.id,
    to_asset_id: null,
    asset_symbol: null,
    shares: null,
    unit_price: null,
    installment_group_id: input.groupId,
  }));
}
