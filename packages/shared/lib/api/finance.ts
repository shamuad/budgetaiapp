import { getFinanceApiBaseUrl } from '../../config/apiConfig';
import { getSupabase } from '../supabase';

async function authenticatedRequest(signal?: AbortSignal): Promise<RequestInit> {
  const { data, error } = await getSupabase().auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('A signed-in session is required.');
  }

  return {
    signal,
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  };
}

export type AssetSearchResult = {
  symbol: string;
  name: string;
  exchange: string | null;
  type: string | null;
};

export async function searchAssets(query: string, signal?: AbortSignal): Promise<AssetSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const url = `${getFinanceApiBaseUrl()}/api/finance/search?query=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, await authenticatedRequest(signal));

  if (!response.ok) {
    throw new Error('Asset search is temporarily unavailable.');
  }

  const data = (await response.json()) as { results?: AssetSearchResult[] };
  return data.results ?? [];
}

export type AssetQuote = {
  symbol: string;
  regularMarketPrice: number;
  currency: string | null;
};

export async function getAssetQuote(symbol: string, signal?: AbortSignal): Promise<AssetQuote | null> {
  const trimmed = symbol.trim();
  if (!trimmed) {
    return null;
  }

  const url = `${getFinanceApiBaseUrl()}/api/finance/quote?symbol=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, await authenticatedRequest(signal));

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Partial<AssetQuote>;
  return typeof data.regularMarketPrice === 'number'
    ? { symbol: data.symbol ?? trimmed.toUpperCase(), regularMarketPrice: data.regularMarketPrice, currency: data.currency ?? null }
    : null;
}
