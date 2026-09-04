import i18n, { deviceNumberSeparators, numberLocale } from '../i18n';
import type { CurrencyCode } from '../types/database';
import {
  amountCursorAfterMask as amountCursorAfterMaskAt,
  amountInputPlaceholder as amountInputPlaceholderAt,
  formatAmountForInput as formatAmountForInputAt,
  formatCurrency as formatCurrencyAt,
  localeNumberParts as localeNumberPartsAt,
  maskAmountInput as maskAmountInputAt,
} from './money';
import { fromISODate } from './valueParsing';

export { fromISODate, parseAIAmount, parseAmountString, toISODate } from './valueParsing';

export {
  formatGroupedInteger,
  NUMBER_LOCALES,
  resolveNumberLocale,
} from './money';
export type { NumberLanguage, NumberSeparators } from './money';

function activeNumberLocale() {
  return numberLocale;
}

function activeNumberParts() {
  return localeNumberPartsAt(activeNumberLocale(), deviceNumberSeparators);
}

export function localeNumberParts() {
  return activeNumberParts();
}

export function amountInputPlaceholder() {
  return amountInputPlaceholderAt(activeNumberLocale(), activeNumberParts());
}

export function maskAmountInput(raw: string, maxFractionDigits = 2) {
  return maskAmountInputAt(raw, activeNumberLocale(), maxFractionDigits, activeNumberParts());
}

export function amountCursorAfterMask(
  previous: string,
  raw: string,
  masked: string,
  hintedCursor: number,
) {
  return amountCursorAfterMaskAt(previous, raw, masked, hintedCursor);
}

/**
 * Date used for period membership (analytics, "This Month"). Credit income
 * and expense snapshot a billing month at write time; everything else uses
 * the purchase day.
 */
export function transactionPeriodDate(row: { billing_month: string | null; date: string }) {
  return fromISODate(row.billing_month ?? row.date);
}

type DateInput = Date | string;

export function formatDate(value: DateInput, style: 'long' | 'short' = 'long') {
  const date = typeof value === 'string' ? fromISODate(value) : value;

  if (!date) {
    return typeof value === 'string' ? value : '';
  }

  return date.toLocaleDateString(i18n.locale, {
    day: 'numeric',
    month: style,
    year: 'numeric',
  });
}

/** Currency string for every screen — dashboard, assets, transactions, forms. */
export function formatCurrency(amount: number, currency: CurrencyCode) {
  return formatCurrencyAt(amount, currency, activeNumberLocale(), activeNumberParts());
}

export function formatMoney(amount: number, currency: CurrencyCode) {
  return formatCurrency(amount, currency);
}

/** Converts an original amount into the user base currency using the locked-in rate. */
export function toBaseAmount(amount: number, exchangeRate: number) {
  return amount * exchangeRate;
}

/** Writes a stored amount into the input, grouped and using the active locale decimal. */
export function formatAmountForInput(amount: number): string {
  return formatAmountForInputAt(amount, activeNumberLocale(), activeNumberParts());
}

/** Icon and name of an account, e.g. "💳 Credit Card". Undefined when no account is linked. */
export function formatAssetLabel(asset: { icon: string | null; name: string } | null | undefined) {
  if (!asset) {
    return undefined;
  }

  if (asset.icon && !asset.icon.startsWith('http://') && !asset.icon.startsWith('https://')) {
    return `${asset.icon} ${asset.name}`;
  }

  return asset.name;
}

/**
 * Both sides of a transfer, plus the holding it bought when there is one:
 * "💳 Card → 📈 Brokerage · VUSA.AS".
 */
export function formatTransferLabel(
  from: { icon: string | null; name: string } | null | undefined,
  to: { icon: string | null; name: string } | null | undefined,
  assetSymbol?: string | null,
) {
  const route = [formatAssetLabel(from), formatAssetLabel(to)].filter(Boolean).join(' → ');

  if (!route) {
    return assetSymbol ?? undefined;
  }

  return assetSymbol ? `${route} · ${assetSymbol}` : route;
}

// Strips the number away from a formatted zero, which leaves the symbol on its own.
// formatToParts would be tidier, but it is not available on every Hermes build.
export function currencySymbol(currency: CurrencyCode) {
  return formatMoney(0, currency).replace(/[\d\s.,]/g, '') || currency;
}
