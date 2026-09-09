import { getSupabase } from '../supabase';
import { DEFAULT_CURRENCY, type CurrencyCode } from '../../types/database';

export type ReportingCurrencyPreference = {
  currency: CurrencyCode;
  exchangeRate: number;
  rateUpdatedAt: string | null;
};

export const DEFAULT_REPORTING_CURRENCY_PREFERENCE: ReportingCurrencyPreference = {
  currency: DEFAULT_CURRENCY,
  exchangeRate: 1,
  rateUpdatedAt: null,
};

/** Reads the signed-in user's cross-account display currency. */
export async function fetchReportingCurrencyPreference(
  userId: string,
): Promise<ReportingCurrencyPreference> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('reporting_currency, reporting_exchange_rate, reporting_rate_updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return DEFAULT_REPORTING_CURRENCY_PREFERENCE;
  }

  return {
    currency: data.reporting_currency as CurrencyCode,
    exchangeRate: Number(data.reporting_exchange_rate),
    rateUpdatedAt: data.reporting_rate_updated_at,
  };
}

/** Persists a preference and the EUR conversion captured when it was selected. */
export async function updateReportingCurrencyPreference(
  userId: string,
  currency: CurrencyCode,
  exchangeRate: number,
): Promise<ReportingCurrencyPreference> {
  const now = new Date().toISOString();
  const { error } = await getSupabase().from('profiles').upsert({
    id: userId,
    reporting_currency: currency,
    reporting_exchange_rate: exchangeRate,
    reporting_rate_updated_at: now,
    updated_at: now,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { currency, exchangeRate, rateUpdatedAt: now };
}
