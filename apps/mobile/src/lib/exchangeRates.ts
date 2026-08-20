import { CurrencyCode, DEFAULT_CURRENCY, i18n } from '@budgetaiapp/shared';

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest';

/** Currencies offered in the transaction picker, base currency first. */
export const PICKABLE_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'TRY'];

/**
 * Live rate of `from` into `to` (base_amount = amount * rate).
 * Same-currency pairs short-circuit to 1 without hitting the network.
 */
export async function fetchExchangeRate(
  from: CurrencyCode,
  to: CurrencyCode = DEFAULT_CURRENCY,
  signal?: AbortSignal,
): Promise<number> {
  if (from === to) {
    return 1;
  }

  const url = `${FRANKFURTER_URL}?from=${from}&to=${to}`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(i18n.t('addTransaction.rateError'));
  }

  const data = (await response.json()) as { rates?: Record<string, number> };
  const rate = data.rates?.[to];

  if (typeof rate !== 'number' || !(rate > 0)) {
    throw new Error(i18n.t('addTransaction.rateError'));
  }

  return rate;
}
