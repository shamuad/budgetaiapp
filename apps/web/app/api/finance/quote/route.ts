import { NextRequest } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { authorizeFinanceRequest } from '@/lib/financeAccess';

export const dynamic = 'force-dynamic';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const VALID_SYMBOL = /^[A-Z0-9.^=_-]{1,32}$/i;

export type AssetQuoteResult = {
  symbol: string;
  regularMarketPrice: number;
  currency: string | null;
};

export async function GET(request: NextRequest) {
  const access = await authorizeFinanceRequest(request, 'finance_quote');

  if (!access.allowed) {
    return access.response;
  }

  const symbol = request.nextUrl.searchParams.get('symbol')?.trim();

  if (!symbol) {
    return Response.json(
      { error: 'Missing "symbol" query parameter.' },
      { status: 400, headers: access.responseHeaders },
    );
  }

  if (!VALID_SYMBOL.test(symbol)) {
    return Response.json(
      { error: 'Invalid finance symbol.' },
      { status: 400, headers: access.responseHeaders },
    );
  }

  try {
    const quote = await yahooFinance.quote(symbol);

    if (!quote || typeof quote.regularMarketPrice !== 'number') {
      return Response.json(
        { error: 'No live price available for this symbol.' },
        { status: 404, headers: access.responseHeaders },
      );
    }

    const result: AssetQuoteResult = {
      symbol: quote.symbol || symbol.toUpperCase(),
      regularMarketPrice: quote.regularMarketPrice,
      currency: quote.currency ?? null,
    };

    return Response.json(result, { headers: access.responseHeaders });
  } catch (error) {
    console.error('[finance/quote] Yahoo Finance lookup failed', error);
    return Response.json(
      { error: 'Live price is temporarily unavailable.' },
      { status: 502, headers: access.responseHeaders },
    );
  }
}
