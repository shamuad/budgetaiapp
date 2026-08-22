import {
  Asset,
  Category,
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
  category: Category | null;
  // Null whenever the user did not name an account, which leaves the current pick alone.
  asset: Asset | null;
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

  return [
    'You are a financial assistant. Extract the transaction details from the user.',
    'Respond ONLY with a JSON object shaped like:',
    '{"title": string, "amount": number, "type": "expense" | "income", "category": string, "account_name": string | null, "currency": "EUR" | "USD" | "GBP" | "TRY" | null, "date": "YYYY-MM-DD", "action": "save" | "cancel" | "none"}',
    '"amount" must be a JSON number (never a string) with a dot as the decimal separator, in major currency units.',
    'Examples: forty-two euros -> 42 or 42.5, never 4200; one thousand -> 1000.',
    '"currency" must be one of "EUR", "USD", "GBP", "TRY", or null.',
    'Detect any spoken or written currency (e.g. TL, lira, euro, euros, dollar, pounds) and map it to the correct ISO code.',
    'Use null when the user does not mention a currency.',
    `Expense categories: ${names('expense')}.`,
    `Income categories: ${names('income')}.`,
    '"category" must be exactly one of those names, copied without any extra words.',
    `Accounts: ${assets.map((item) => item.name).join(', ')}.`,
    'Set "account_name" to exactly one of those account names when the user says which account,',
    'card, wallet or bank the money moved through. Use null when they do not mention one.',
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
export function findCategory(categories: Category[], name: string, type: TransactionType) {
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
    category?: string;
    account_name?: string | null;
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

  const type: TransactionType = parsed.type === 'income' ? 'income' : 'expense';
  const category = findCategory(categories, parsed.category ?? 'Diğer', type);
  const asset = parsed.account_name ? findAsset(assets, parsed.account_name) : null;
  const currency = normalizeCurrency(parsed.currency);
  const date = (parsed.date ? fromISODate(parsed.date) : null) ?? fallbackDate;

  return {
    action,
    values: {
      title: parsed.title?.trim() || category?.name || '',
      amount,
      type,
      date,
      category,
      asset,
      currency,
    },
  };
}
