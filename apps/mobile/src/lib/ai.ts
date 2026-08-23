import {
  Asset,
  Category,
  CategoryType,
  CurrencyCode,
  fromISODate,
  i18n,
  parseAIAmount,
  toISODate,
  TransactionType,
} from '@budgetaiapp/shared';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

// Auto-updating aliases: pinned Gemini versions get retired and start returning 404.
// The lite model is the fallback for when the main one is overloaded; it transcribes
// audio noticeably worse, so it is only reached after the primary model refuses.
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

// Sampling defaults to temperature 1, which returns a different transcription for
// byte-identical audio. Extraction is not a creative task, so sampling is switched off.
const DETERMINISTIC_CONFIG = {
  temperature: 0,
  topP: 1,
  topK: 1,
};

export type AIAction = 'save' | 'cancel' | 'none';

export type TransactionValues = {
  title: string;
  amount: number;
  type: TransactionType;
  date: Date;
  // Null on a transfer, which moves money instead of categorising a spend.
  category: Category | null;
  // Null whenever the user did not name an account, which leaves the current pick alone.
  asset: Asset | null;
  // The destination of a transfer, resolved to one of the user's own accounts.
  toAsset: Asset | null;
  // The holding a transfer bought inside that account, e.g. 'VUSA.AS' or 'BTC'.
  assetSymbol: string | null;
  shares: number | null;
  unitPrice: number | null;
  // Null when no currency was mentioned, which leaves the current selection alone.
  currency: CurrencyCode | null;
};

export type AIResult = {
  action: AIAction;
  values: TransactionValues | null;
};

function isModelOverloaded(err: unknown) {
  const message = err instanceof Error ? err.message : '';

  return message.includes('[503') || message.includes('[429');
}

/** Sends the prompt to Gemini and returns the raw JSON text of the first model that answers. */
export async function askGemini(parts: (string | Part)[]) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(i18n.t('addTransaction.aiMissingKey'));
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          ...DETERMINISTIC_CONFIG,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(parts);

      return result.response.text();
    } catch (err) {
      if (!isModelOverloaded(err)) {
        throw err;
      }
    }
  }

  throw new Error(i18n.t('addTransaction.aiBusy'));
}

export function buildTransactionPrompt(
  categories: Category[],
  assets: Asset[],
  userText?: string,
) {
  const names = (forType: TransactionType) =>
    categories
      .filter((item) => item.type === forType)
      .map((item) => item.name)
      .join(', ');

  const today = new Date();
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' });
  // Naming the kind lets the model tell a brokerage from a current account, which
  // is what a purchase of a stock or an ETF has to be transferred into.
  const accountList = assets
    .map((item) => `${item.name} (${item.type ?? 'account'})`)
    .join(', ');
  const investmentAccounts = assets
    .filter((item) => item.type === 'investment')
    .map((item) => item.name)
    .join(', ');

  return [
    'You are a financial assistant. Extract the transaction details from the user.',
    'Respond ONLY with a JSON object shaped like:',
    '{"title": string, "amount": number, "type": "expense" | "income" | "transfer", "category": string | null, "account_name": string | null, "to_account_name": string | null, "asset_symbol": string | null, "shares": number | null, "unit_price": number | null, "currency": "EUR" | "USD" | "GBP" | "TRY" | null, "date": "YYYY-MM-DD", "action": "save" | "cancel" | "none"}',
    '"amount" must be a JSON number (never a string) with a dot as the decimal separator, in major currency units.',
    'Examples: forty-two euros -> 42 or 42.5, never 4200; one thousand -> 1000.',
    '"currency" must be one of "EUR", "USD", "GBP", "TRY", or null.',
    'Detect any spoken or written currency (e.g. TL, lira, euro, euros, dollar, pounds) and map it to the correct ISO code.',
    'Use null when the user does not mention a currency.',
    `Expense categories: ${names('expense')}.`,
    `Income categories: ${names('income')}.`,
    '"category" must be exactly one of those names, copied without any extra words.',
    `Accounts, with their kind in brackets: ${accountList}.`,
    'Set "account_name" to exactly one of those account names when the user says which account,',
    'card, wallet or bank the money moved through. Use null when they do not mention one.',
    // Buying an asset is not spending: the money is still the user's, it has only
    // changed form. Booking it as an expense would corrupt net cash flow.
    'BUYING AN INVESTMENT IS NEVER AN EXPENSE. If the user describes buying a stock,',
    'an ETF, an index fund, crypto or any other asset (for example "bought S&P 500",',
    '"put 500 euros into VUSA", "invested in Bitcoin"), then:',
    'set "type" to "transfer"; set "account_name" to the account the money came from;',
    `set "to_account_name" to the investment account that receives it${investmentAccounts ? ` (one of: ${investmentAccounts})` : ''};`,
    'set "asset_symbol" to the asset the user named, as an uppercase market ticker when',
    'you recognise one (S&P 500 -> "SPY", Bitcoin -> "BTC", VUSA -> "VUSA.AS"), otherwise',
    'the asset name in uppercase; and set "category" to null, because a transfer has none.',
    'Set "shares" and "unit_price" as JSON numbers only when the user states how many',
    'units they bought or the price per unit. Use null for anything they did not say.',
    'Moving money between two of the user\'s own accounts is also a "transfer".',
    'For "expense" and "income", leave "to_account_name", "asset_symbol", "shares" and "unit_price" null.',
    `Today is ${toISODate(today)} (${weekday}). Resolve relative dates such as "yesterday" or "last friday" against it.`,
    'If the user does not mention a date, use today.',
    'Set "action" to "save" only when the user explicitly asks to save or record it,',
    '"cancel" when they ask to cancel, discard or close, and "none" otherwise.',
    'Keep "title" short and in the same language as the user.',
    userText ? `User text: ${userText}` : 'The user request is in the attached audio.',
  ].join('\n');
}

// The same name can exist for both types (e.g. "Diğer"), so the type has to match too.
// The model sometimes echoes the type as a suffix ("Market (expense)"), so that is stripped.
export function findCategory(categories: Category[], name: string, type: CategoryType) {
  const target = name
    .replace(/\s*\((expense|income)\)\s*$/i, '')
    .trim()
    .toLocaleLowerCase();
  const ofType = categories.filter((item) => item.type === type);
  const exact = ofType.find((item) => item.name.toLocaleLowerCase() === target);

  if (exact) {
    return exact;
  }

  const partial = ofType.find(
    (item) =>
      item.name.toLocaleLowerCase().includes(target) ||
      target.includes(item.name.toLocaleLowerCase())
  );

  // Never block a save on an unrecognised name: fall back to the catch-all category.
  return partial ?? ofType.find((item) => item.name.toLocaleLowerCase() === 'diğer') ?? ofType[0] ?? null;
}

/**
 * Matches a spoken account name against the user's accounts, case-insensitively.
 * Unlike categories there is no catch-all fallback: guessing the wrong account is
 * worse than leaving the current pick in place, so an unknown name returns null.
 */
export function findAsset(assets: Asset[], name: string) {
  const target = name.trim().toLocaleLowerCase();

  if (!target) {
    return null;
  }

  return (
    assets.find((item) => item.name.toLocaleLowerCase() === target) ??
    assets.find((item) => item.symbol.toLocaleLowerCase() === target) ??
    assets.find(
      (item) =>
        item.name.toLocaleLowerCase().includes(target) ||
        target.includes(item.name.toLocaleLowerCase()),
    ) ??
    null
  );
}

/**
 * Where a transfer lands. Falls back to the single investment account when the
 * user plainly bought an asset but never said which brokerage holds it — with
 * only one, there is nothing to guess.
 */
export function findTransferTarget(assets: Asset[], name: string | null | undefined) {
  const named = name ? findAsset(assets, name) : null;

  if (named) {
    return named;
  }

  const investments = assets.filter((item) => item.type === 'investment');

  return investments.length === 1 ? investments[0] : null;
}

/** Symbols are stored uppercase, so "vusa.as" and "VUSA.AS" are one holding. */
export function normalizeAssetSymbol(raw: string | null | undefined) {
  const trimmed = raw?.trim().toUpperCase() ?? '';

  return trimmed.length > 0 ? trimmed : null;
}

/** An optional figure from the model: anything unusable becomes null, never NaN. */
function parsePositiveNumber(value: unknown): number | null {
  const parsed = parseAIAmount(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'TRY'];

/** Maps model output and spoken aliases to a supported ISO currency code. */
export function normalizeCurrency(raw: string | null | undefined): CurrencyCode | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  const upper = trimmed.toUpperCase();

  if (SUPPORTED_CURRENCIES.includes(upper as CurrencyCode)) {
    return upper as CurrencyCode;
  }

  const lower = trimmed.toLowerCase();

  const aliases: Record<string, CurrencyCode> = {
    tl: 'TRY',
    lira: 'TRY',
    'turkish lira': 'TRY',
    'turk lirasi': 'TRY',
    'türk lirası': 'TRY',
    try: 'TRY',
    '₺': 'TRY',
    euro: 'EUR',
    euros: 'EUR',
    eur: 'EUR',
    '€': 'EUR',
    dollar: 'USD',
    dollars: 'USD',
    usd: 'USD',
    '$': 'USD',
    pound: 'GBP',
    pounds: 'GBP',
    gbp: 'GBP',
    '£': 'GBP',
  };

  return aliases[lower] ?? null;
}

/** Turns the model's JSON into form values. Pure: it never touches component state. */
export function parseTransactionResponse(
  responseText: string,
  categories: Category[],
  assets: Asset[],
  fallbackDate: Date
): AIResult {
  let parsed: {
    title?: string;
    amount?: number | string;
    type?: string;
    category?: string | null;
    account_name?: string | null;
    to_account_name?: string | null;
    asset_symbol?: string | null;
    shares?: number | string | null;
    unit_price?: number | string | null;
    currency?: string | null;
    date?: string;
    action?: string;
  };

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error(i18n.t('addTransaction.aiError'));
  }

  const action: AIAction =
    parsed.action === 'save' || parsed.action === 'cancel' ? parsed.action : 'none';

  if (action === 'cancel') {
    return { action, values: null };
  }

  const amount = parseAIAmount(parsed.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(i18n.t('addTransaction.aiNoAmount'));
  }

  const type: TransactionType =
    parsed.type === 'income' || parsed.type === 'transfer' ? parsed.type : 'expense';
  // A transfer is uncategorised by definition, and only a transfer can name a
  // destination or a holding, so anything the model volunteers is dropped.
  const category =
    type === 'transfer' ? null : findCategory(categories, parsed.category ?? 'Diğer', type);
  const asset = parsed.account_name ? findAsset(assets, parsed.account_name) : null;
  const toAsset = type === 'transfer' ? findTransferTarget(assets, parsed.to_account_name) : null;
  const assetSymbol = type === 'transfer' ? normalizeAssetSymbol(parsed.asset_symbol) : null;
  const currency = normalizeCurrency(parsed.currency);
  const date = (parsed.date ? fromISODate(parsed.date) : null) ?? fallbackDate;

  return {
    action,
    values: {
      title: parsed.title?.trim() || category?.name || assetSymbol || '',
      amount,
      type,
      date,
      category,
      asset,
      toAsset,
      assetSymbol,
      shares: type === 'transfer' ? parsePositiveNumber(parsed.shares) : null,
      unitPrice: type === 'transfer' ? parsePositiveNumber(parsed.unit_price) : null,
      currency,
    },
  };
}
