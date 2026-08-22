import i18n from '../i18n';
import type { CurrencyCode } from '../types/database';

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

export function formatMoney(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat(i18n.locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/** Converts an original amount into the user base currency using the locked-in rate. */
export function toBaseAmount(amount: number, exchangeRate: number) {
  return amount * exchangeRate;
}

/**
 * Parses a typed or AI-returned amount without locale inflation.
 * "42,00" and "42.00" both become 42; "1.234,56" becomes 1234.56.
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

/** Writes an AI-parsed amount into the input using a comma decimal, without thousand separators. */
export function formatAmountForInput(amount: number): string {
  const [whole, fraction = ''] = amount.toFixed(2).split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');

  return trimmedFraction ? `${whole},${trimmedFraction}` : whole;
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

// Strips the number away from a formatted zero, which leaves the symbol on its own.
// formatToParts would be tidier, but it is not available on every Hermes build.
export function currencySymbol(currency: CurrencyCode) {
  return formatMoney(0, currency).replace(/[\d\s.,]/g, '') || currency;
}
