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

// Local calendar day, so a late-night entry is not pushed to tomorrow by UTC.
export function toISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

// Reads a YYYY-MM-DD day as local time, so the value is not shifted by the UTC offset.
export function fromISODate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day] = match.map(Number);
  const parsed = new Date(year, month - 1, day);

  // Rejects rolled-over dates such as 2026-02-31.
  if (parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }

  return parsed;
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

/**
 * Parses a typed or AI-returned amount without locale inflation.
 * "42,00" and "42.00" both become 42; "1.234,56" becomes 1234.56;
 * "1.320.000" becomes 1320000.
 */
export function parseAmountString(input: string): number {
  let text = input.trim().replace(/[^\d.,]/g, '');

  if (!text) {
    return NaN;
  }

  const commaCount = (text.match(/,/g) ?? []).length;
  const dotCount = (text.match(/\./g) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');

    text =
      lastComma > lastDot
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
  } else if (commaCount > 1 || dotCount > 1) {
    // Only one separator character is left in play here, and a number carries at
    // most one decimal point — so repeats are grouping, as in "1.320.000".
    text = text.replace(/[.,]/g, '');
  } else if (commaCount === 1) {
    const [, fraction = ''] = text.split(',');
    const isThousands = fraction.length === 3 && text.indexOf(',') <= 3;

    text = isThousands ? text.replace(',', '') : text.replace(',', '.');
  } else if (dotCount === 1) {
    const [, fraction = ''] = text.split('.');
    const isThousands = fraction.length === 3 && text.indexOf('.') <= 3;

    text = isThousands ? text.replace('.', '') : text;
  }

  const value = Number(text);

  return Number.isFinite(value) ? value : NaN;
}

/** Parses model output whether it arrives as a JSON number or a localized string. */
export function parseAIAmount(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  if (typeof value === 'string') {
    return parseAmountString(value);
  }

  return NaN;
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
