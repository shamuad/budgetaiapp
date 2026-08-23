import { NextRequest } from 'next/server';
import YahooFinance from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export type AssetQuoteResult = {
  symbol: string;
  regularMarketPrice: number;
  currency: string | null;
};

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.trim();

  if (!symbol) {
    return Response.json({ error: 'Missing "symbol" query parameter.' }, { status: 400 });
  }

  try {
    const quote = await yahooFinance.quote(symbol);

    if (!quote || typeof quote.regularMarketPrice !== 'number') {
      return Response.json({ error: 'No live price available for this symbol.' }, { status: 404 });
    }

    const result: AssetQuoteResult = {
      symbol: quote.symbol || symbol.toUpperCase(),
      regularMarketPrice: quote.regularMarketPrice,
      currency: quote.currency ?? null,
    };

    return Response.json(result);
  } catch (error) {
    console.error('[finance/quote] Yahoo Finance lookup failed', error);
    return Response.json({ error: 'Live price is temporarily unavailable.' }, { status: 502 });
  }
}
