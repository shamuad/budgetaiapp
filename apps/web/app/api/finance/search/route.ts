import { NextRequest } from 'next/server';
import YahooFinance from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/** Quote types worth surfacing to retail investors tracking personal holdings. */
const SUPPORTED_QUOTE_TYPES = new Set(['EQUITY', 'ETF', 'MUTUALFUND', 'CRYPTOCURRENCY', 'INDEX', 'CURRENCY']);

/**
 * Exchange codes that price in EUR, used to bump Eurozone listings to the top
 * alongside any `.AS`/`.DE` ticker. Yahoo's search results don't carry a
 * currency field, so this is the closest safe proxy without an extra
 * network round-trip per result.
 */
const EUR_EXCHANGES = new Set(['AMS', 'PAR', 'BRU', 'GER', 'FRA', 'MIL', 'VIE', 'MCE']);

const MAX_RESULTS = 12;

export type AssetSearchResult = {
  symbol: string;
  name: string;
  exchange: string | null;
  type: string | null;
};

/** Narrowed shape of the Yahoo quote variants we care about (equities, ETFs, funds, crypto, indices, currencies). */
type SupportedYahooQuote = {
  symbol: string;
  exchange: string;
  exchDisp?: string;
  shortname?: string;
  longname?: string;
  quoteType: string;
  typeDisp?: string;
};

function asSupportedQuote(quote: object): SupportedYahooQuote | null {
  const quoteType = 'quoteType' in quote ? quote.quoteType : undefined;
  if (typeof quoteType !== 'string' || !SUPPORTED_QUOTE_TYPES.has(quoteType)) {
    return null;
  }
  // Yahoo occasionally mixes in bare web-suggestion entries with no ticker at all.
  if (typeof (quote as { symbol?: unknown }).symbol !== 'string') {
    return null;
  }
  return quote as SupportedYahooQuote;
}

/** `.AS`/`.DE` tickers or a known Eurozone exchange, since this app's base currency is EUR. */
function isEuroPriority(quote: SupportedYahooQuote): boolean {
  const symbol = quote.symbol.toUpperCase();
  return symbol.endsWith('.AS') || symbol.endsWith('.DE') || EUR_EXCHANGES.has(quote.exchange);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')?.trim();

  if (!query) {
    return Response.json({ results: [] satisfies AssetSearchResult[] });
  }

  try {
    const { quotes } = await yahooFinance.search(query, { quotesCount: MAX_RESULTS * 2 });

    const supported = quotes
      .map(asSupportedQuote)
      .filter((quote): quote is SupportedYahooQuote => quote !== null);

    // Stable sort: Euro listings move to the top, but Yahoo's own relevance
    // order is otherwise preserved and nothing is ever dropped — if no Euro
    // match exists, this is just the normal list, unchanged.
    supported.sort((a, b) => Number(isEuroPriority(b)) - Number(isEuroPriority(a)));

    const results: AssetSearchResult[] = supported.slice(0, MAX_RESULTS).map((quote) => ({
      symbol: quote.symbol,
      name: quote.longname || quote.shortname || quote.symbol,
      exchange: quote.exchDisp || quote.exchange || null,
      type: quote.typeDisp ?? quote.quoteType,
    }));

    return Response.json({ results });
  } catch (error) {
    console.error('[finance/search] Yahoo Finance lookup failed', error);
    // A flaky upstream should never break the dropdown — an empty list is always safe.
    return Response.json({ results: [] satisfies AssetSearchResult[] });
  }
}
