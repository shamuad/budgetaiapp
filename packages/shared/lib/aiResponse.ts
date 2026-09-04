import type {
  Asset,
  Category,
  CategoryType,
  CurrencyCode,
  TransactionType,
} from '../types/database';
import { fromISODate, parseAIAmount } from './valueParsing';

export type AIAction = 'save' | 'cancel' | 'none';
export type AiFilledField = 'title' | 'amount' | 'currency' | 'date' | 'category' | 'asset';

// A generous ceiling for a monthly installment plan (5 years), so a garbled
// model response can never blow up into an absurd number of written rows.
export const MAX_INSTALLMENTS = 60;

export type TransactionValues = {
  title: string;
  amount: number;
  type: TransactionType;
  date: Date;
  category: Category | null;
  asset: Asset | null;
  toAsset: Asset | null;
  assetSymbol: string | null;
  shares: number | null;
  unitPrice: number | null;
  currency: CurrencyCode | null;
  installments: number;
};

export type AIResult = {
  action: AIAction;
  values: TransactionValues | null;
  aiFilled: AiFilledField[];
};

export type AIResponseErrorCode = 'invalid_response' | 'no_amount';

export class AIResponseError extends Error {
  constructor(readonly code: AIResponseErrorCode) {
    super(code);
    this.name = 'AIResponseError';
  }
}

// The same name can exist for both types, so the type has to match too. The
// model sometimes echoes the type as a suffix ("Market (expense)"), which is stripped.
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
      target.includes(item.name.toLocaleLowerCase()),
  );

  return partial ?? ofType.find((item) => item.name.toLocaleLowerCase() === 'diğer') ?? ofType[0] ?? null;
}

/** Matches a spoken account name without guessing when there is no match. */
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

/** Resolves a transfer destination, including the unambiguous single-brokerage fallback. */
export function findTransferTarget(assets: Asset[], name: string | null | undefined) {
  const named = name ? findAsset(assets, name) : null;

  if (named) {
    return named;
  }

  const investments = assets.filter((item) => item.type === 'investment');

  return investments.length === 1 ? investments[0] : null;
}

export function normalizeAssetSymbol(raw: string | null | undefined) {
  const trimmed = raw?.trim().toUpperCase() ?? '';

  return trimmed.length > 0 ? trimmed : null;
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = parseAIAmount(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseInstallmentsCount(value: unknown): number {
  const parsed = parseAIAmount(value);

  if (!Number.isFinite(parsed) || parsed <= 1) {
    return 1;
  }

  return Math.min(MAX_INSTALLMENTS, Math.round(parsed));
}

const SUPPORTED_CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'TRY'];

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

  return aliases[trimmed.toLowerCase()] ?? null;
}

function collectAiFilled({
  title,
  currency,
  date,
  category,
  asset,
}: {
  title: string;
  currency: CurrencyCode | null;
  date: Date | null;
  category: Category | null;
  asset: Asset | null;
}): AiFilledField[] {
  const filled: AiFilledField[] = ['amount'];

  if (title) filled.push('title');
  if (currency) filled.push('currency');
  if (date) filled.push('date');
  if (category) filled.push('category');
  if (asset) filled.push('asset');

  return filled;
}

/** Turns a voice/text model response into transaction-form values without platform state. */
export function parseTransactionAIResponse(
  responseText: string,
  categories: Category[],
  assets: Asset[],
  fallbackDate: Date,
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
    installments?: number | string | null;
    date?: string;
    action?: string;
  };

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new AIResponseError('invalid_response');
  }

  const action: AIAction =
    parsed.action === 'save' || parsed.action === 'cancel' ? parsed.action : 'none';

  if (action === 'cancel') {
    return { action, values: null, aiFilled: [] };
  }

  const amount = parseAIAmount(parsed.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AIResponseError('no_amount');
  }

  const type: TransactionType =
    parsed.type === 'income' || parsed.type === 'transfer' ? parsed.type : 'expense';
  const category =
    type === 'transfer' ? null : findCategory(categories, parsed.category ?? 'Diğer', type);
  const asset = parsed.account_name ? findAsset(assets, parsed.account_name) : null;
  const toAsset = type === 'transfer' ? findTransferTarget(assets, parsed.to_account_name) : null;
  const assetSymbol = type === 'transfer' ? normalizeAssetSymbol(parsed.asset_symbol) : null;
  const currency = normalizeCurrency(parsed.currency);
  const installments = type === 'transfer' ? 1 : parseInstallmentsCount(parsed.installments);
  const parsedDate = parsed.date ? fromISODate(parsed.date) : null;
  const date = parsedDate ?? fallbackDate;
  const title = parsed.title?.trim() || category?.name || assetSymbol || '';

  return {
    action,
    values: {
      title,
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
      installments,
    },
    aiFilled: collectAiFilled({ title, currency, date: parsedDate, category, asset }),
  };
}

/** Turns a receipt model response into transaction-form values without platform state. */
export function parseReceiptAIResponse(
  responseText: string,
  categories: Category[],
  assets: Asset[],
  fallbackDate: Date,
): AIResult {
  let parsed: {
    title?: string;
    amount?: number | string;
    currency?: string | null;
    date?: string;
    category_id?: string | null;
    account_id?: string | null;
    type?: string;
    installments?: number | string | null;
  };

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new AIResponseError('invalid_response');
  }

  const amount = parseAIAmount(parsed.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AIResponseError('no_amount');
  }

  const type: CategoryType = parsed.type === 'income' ? 'income' : 'expense';
  const categoryId = parsed.category_id?.trim() || null;
  const category = categoryId
    ? (categories.find((item) => item.id === categoryId && item.type === type) ??
      categories.find(
        (item) =>
          item.type === type && item.name.toLocaleLowerCase() === categoryId.toLocaleLowerCase(),
      ) ??
      null)
    : null;
  const accountId = parsed.account_id?.trim() || null;
  const asset = accountId
    ? (assets.find((item) => item.id === accountId) ?? findAsset(assets, accountId))
    : null;
  const currency = normalizeCurrency(parsed.currency);
  const parsedDate = parsed.date ? fromISODate(parsed.date) : null;
  const date = parsedDate ?? fallbackDate;
  const title = parsed.title?.trim() || category?.name || '';

  return {
    action: 'none',
    values: {
      title,
      amount,
      type,
      date,
      category,
      asset,
      toAsset: null,
      assetSymbol: null,
      shares: null,
      unitPrice: null,
      currency,
      installments: parseInstallmentsCount(parsed.installments),
    },
    aiFilled: collectAiFilled({ title, currency, date: parsedDate, category, asset }),
  };
}
