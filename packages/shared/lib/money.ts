/**
 * Locale-aware money formatting and amount-input masking.
 *
 * Display strings always come from `Intl.NumberFormat`. The value written to
 * the database stays a plain number (1200.5). The input field keeps a
 * formatted string only so the user can type a trailing decimal.
 *
 * The region on the language tag owns the punctuation, so an English
 * phone in Amsterdam (`en-NL`) still prints `1.200,50`. Language-only
 * tags fall back to a single default each:
 *   en → en-US  1,200.50
 *   nl → nl-NL  1.200,50
 *   tr → tr-TR  1.200,50
 *   es → es-ES  1.200,50
 */

import type { CurrencyCode } from '../types/database';

export const NUMBER_LOCALES = {
  en: 'en-US',
  nl: 'nl-NL',
  tr: 'tr-TR',
  es: 'es-ES',
} as const;

/** Region owns punctuation. `en-NL` currency style still uses US commas in ICU. */
export const NUMBER_LOCALE_BY_REGION: Record<string, string> = {
  NL: 'nl-NL',
  BE: 'nl-BE',
  DE: 'de-DE',
  AT: 'de-AT',
  FR: 'fr-FR',
  ES: 'es-ES',
  IT: 'it-IT',
  PT: 'pt-PT',
  TR: 'tr-TR',
  US: 'en-US',
  GB: 'en-GB',
  AU: 'en-AU',
  CA: 'en-CA',
};

export type NumberLanguage = keyof typeof NUMBER_LOCALES;

export type DeviceLocaleHint = {
  languageTag?: string | null;
  languageCode?: string | null;
  regionCode?: string | null;
};

export function resolveNumberLocale(language: string | null | undefined): string {
  const normalized = (language ?? 'en').replace('_', '-');
  const [lang, region] = normalized.split('-');
  const regionUpper = region?.toUpperCase();

  if (regionUpper && NUMBER_LOCALE_BY_REGION[regionUpper]) {
    return NUMBER_LOCALE_BY_REGION[regionUpper];
  }

  if (regionUpper) {
    return `${lang}-${regionUpper}`;
  }

  return NUMBER_LOCALES[lang as NumberLanguage] ?? NUMBER_LOCALES.en;
}

/**
 * iOS Language can be English (US) while Region is Netherlands. `languageTag`
 * is then `en-US` and must not win over `regionCode`.
 */
export function resolveNumberLocaleFromDevice(device: DeviceLocaleHint | null | undefined): string {
  const region = device?.regionCode?.toUpperCase();

  if (region && NUMBER_LOCALE_BY_REGION[region]) {
    return NUMBER_LOCALE_BY_REGION[region];
  }

  return resolveNumberLocale(device?.languageTag ?? device?.languageCode);
}

export type NumberSeparators = {
  locale: string;
  group: string;
  decimal: string;
};

/** Grouping and decimal marks for a number locale, without relying on `formatToParts`. */
export function localeNumberParts(
  locale: string,
  overrides?: { group?: string; decimal?: string },
): NumberSeparators {
  const grouped = new Intl.NumberFormat(locale).format(12345.6);
  const match = grouped.match(/\d([^\d]+)\d{3}([^\d]+)\d/);
  const inferred = match
    ? { group: match[1], decimal: match[2] }
    : (() => {
        const withDecimal = new Intl.NumberFormat(locale).format(1.1);
        const decimal = withDecimal.replace(/\d/g, '') || '.';
        return { group: decimal === '.' ? ',' : '.', decimal };
      })();

  return {
    locale,
    group: overrides?.group || inferred.group,
    decimal: overrides?.decimal || inferred.decimal,
  };
}

function currencySymbolFor(currency: CurrencyCode) {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).format(0).replace(/[\d\s.,]/g, '') ||
    currency
  );
}

/** Formats a number with explicit separators so Hermes/ICU cannot force US commas. */
export function formatFixedNumber(amount: number, separators: NumberSeparators, fractionDigits = 2) {
  const sign = amount < 0 ? '-' : '';
  const [whole, fraction = ''] = Math.abs(amount).toFixed(fractionDigits).split('.');
  const grouped = formatGroupedInteger(whole, separators.locale, separators);

  if (fractionDigits === 0) {
    return `${sign}${grouped}`;
  }

  return `${sign}${grouped}${separators.decimal}${fraction}`;
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  locale: string,
  separators?: NumberSeparators,
) {
  const seps = separators ?? localeNumberParts(locale);
  return `${currencySymbolFor(currency)}${formatFixedNumber(amount, seps, 2)}`;
}

/** Groups the integer digits with the locale (or override) grouping mark. */
export function formatGroupedInteger(
  digits: string,
  locale: string,
  separators?: NumberSeparators,
): string {
  const trimmed = digits.replace(/^0+(?=\d)/, '');

  if (!trimmed) {
    return '0';
  }

  const { group } = separators ?? localeNumberParts(locale);
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

/**
 * Writes a stored number into the amount field: grouped, locale decimal,
 * trailing zeros stripped so 1200.00 reads as `1,200` / `1.200`.
 */
export function formatAmountForInput(
  amount: number,
  locale: string,
  separators?: NumberSeparators,
): string {
  if (!Number.isFinite(amount)) {
    return '';
  }

  const seps = separators ?? localeNumberParts(locale);
  const [whole, fraction = ''] = Math.abs(amount).toFixed(2).split('.');
  const grouped = formatGroupedInteger(whole, locale, seps);
  const trimmedFraction = fraction.replace(/0+$/, '');

  return trimmedFraction ? `${grouped}${seps.decimal}${trimmedFraction}` : grouped;
}

export function amountInputPlaceholder(locale: string, separators?: NumberSeparators): string {
  const { decimal } = separators ?? localeNumberParts(locale);
  return `0${decimal}00`;
}

/**
 * Live mask for the amount field. Accepts either locale separator from the
 * system decimal pad, keeps at most one decimal with two fraction digits,
 * and re-applies grouping on every keystroke.
 */
export function maskAmountInput(
  raw: string,
  locale: string,
  maxFractionDigits = 2,
  separators?: NumberSeparators,
): string {
  const seps = separators ?? localeNumberParts(locale);
  const { intDigits, fraction } = splitAmountInput(raw, seps, maxFractionDigits);

  if (!intDigits && fraction === null) {
    return '';
  }

  const grouped = formatGroupedInteger(intDigits || '0', locale, seps);

  if (fraction === null) {
    return grouped;
  }

  return `${grouped}${seps.decimal}${fraction}`;
}

function splitAmountInput(
  raw: string,
  separators: NumberSeparators,
  maxFractionDigits: number,
): { intDigits: string; fraction: string | null } {
  const { decimal } = separators;
  const alt = decimal === ',' ? '.' : ',';
  const decimalAt = raw.indexOf(decimal);

  if (decimalAt !== -1) {
    return {
      intDigits: raw.slice(0, decimalAt).replace(/\D/g, ''),
      fraction: raw.slice(decimalAt + 1).replace(/\D/g, '').slice(0, maxFractionDigits),
    };
  }

  const lastAlt = raw.lastIndexOf(alt);

  // A Dutch pad on an English UI (or the reverse) types the other mark.
  // Treat it as the decimal only when the tail looks like cents, not thousands.
  if (lastAlt !== -1) {
    const after = raw.slice(lastAlt + 1).replace(/\D/g, '');

    if (after.length <= maxFractionDigits) {
      return {
        intDigits: raw.slice(0, lastAlt).replace(/\D/g, ''),
        fraction: after,
      };
    }
  }

  return { intDigits: raw.replace(/\D/g, ''), fraction: null };
}

function countDigits(text: string) {
  return (text.match(/\d/g) ?? []).length;
}

function inferRawCursor(previous: string, raw: string, hintedCursor: number) {
  const prevDigits = previous.replace(/\D/g, '');
  const rawDigits = raw.replace(/\D/g, '');

  if (rawDigits.startsWith(prevDigits) && rawDigits.length === prevDigits.length + 1) {
    return raw.length;
  }

  if (rawDigits === prevDigits && raw.length === previous.length + 1) {
    return raw.length;
  }

  if (prevDigits.startsWith(rawDigits) && prevDigits.length === rawDigits.length + 1) {
    return raw.length;
  }

  if (hintedCursor >= 0 && hintedCursor <= raw.length) {
    return hintedCursor;
  }

  return raw.length;
}

/** Places the caret after the same digit (or trailing decimal) in the masked string. */
export function amountCursorAfterMask(
  previous: string,
  raw: string,
  masked: string,
  hintedCursor: number,
): number {
  const rawCursor = inferRawCursor(previous, raw, hintedCursor);
  const typedSeparator = /[.,]/.test(raw[rawCursor - 1] ?? '');
  const digitsBefore = countDigits(raw.slice(0, rawCursor));

  if (digitsBefore === 0 && !typedSeparator) {
    return 0;
  }

  let seen = 0;
  let pos = 0;

  for (; pos < masked.length; pos += 1) {
    if (/\d/.test(masked[pos])) {
      seen += 1;
      if (seen === digitsBefore) {
        pos += 1;
        break;
      }
    }
  }

  if (typedSeparator && pos < masked.length && /[.,]/.test(masked[pos])) {
    pos += 1;
  }

  return Math.max(0, Math.min(pos, masked.length));
}
