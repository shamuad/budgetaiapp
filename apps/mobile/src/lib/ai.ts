import {
  Asset,
  Category,
  CategoryType,
  CurrencyCode,
  fromISODate,
  getSupabase,
  i18n,
  parseAIAmount,
  toISODate,
  TransactionType,
} from '@budgetaiapp/shared';

/** Base64 media captured by voice input or receipt scanning. */
export type AIMedia = { base64: string; mimeType: string };

export type AIAction = 'save' | 'cancel' | 'none';

/**
 * Which form fields the model filled in this round, so the UI can mark them
 * with a sparkle and drop the mark the moment the user edits one.
 */
export type AiFilledField = 'title' | 'amount' | 'currency' | 'date' | 'category' | 'asset';

// A generous ceiling for a monthly installment plan (5 years), so a garbled
// model response can never blow up into an absurd number of written rows.
export const MAX_INSTALLMENTS = 60;

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
  // How many equal monthly payments to split this into. 1 means a normal,
  // one-off transaction — never set on a transfer, which is not a spend to split.
  installments: number;
};

export type AIResult = {
  action: AIAction;
  values: TransactionValues | null;
  aiFilled: AiFilledField[];
};

/** The function's error codes, in the user's own language. */
function messageForCode(code: string | null): string | null {
  if (code === 'missing_api_key') {
    return i18n.t('addTransaction.aiMissingKey');
  }

  if (code === 'model_overloaded') {
    return i18n.t('addTransaction.aiBusy');
  }

  if (code === 'rate_limited') {
    return i18n.t('addTransaction.aiRateLimited');
  }

  if (code === 'quota_exhausted') {
    return i18n.t('addTransaction.aiQuotaExhausted');
  }

  if (code === 'payload_too_large') {
    return i18n.t('addTransaction.aiPayloadTooLarge');
  }

  if (code === 'unsupported_media_type') {
    return i18n.t('addTransaction.aiUnsupportedMedia');
  }

  if (code === 'quota_unavailable') {
    return i18n.t('addTransaction.aiBusy');
  }

  return null;
}

/**
 * Digs the real reason out of a failed invoke. `supabase-js` reports every
 * non-2xx as "Edge Function returned a non-2xx status code" and hides the
 * response body on `error.context`, so without this a missing secret, an
 * undeployed function, and an expired session all read identically.
 */
async function describeFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown }).context;

  // No response at all: offline, or the request never left the device.
  if (!(context instanceof Response)) {
    return (error as Error).message;
  }

  let body: Record<string, unknown> | null = null;

  try {
    body = await context.clone().json();
  } catch {
    body = null;
  }

  const localized = messageForCode(typeof body?.error === 'string' ? body.error : null);

  if (localized) {
    return localized;
  }

  // `message` covers both this function's own detail and the platform's
  // gateway errors — a 401 with no session, or a 404 when `ask-gemini` has
  // not been deployed yet.
  const detail = [body?.message, body?.msg].find((value) => typeof value === 'string');

  return detail ? `${detail} (HTTP ${context.status})` : `HTTP ${context.status}`;
}

/**
 * Posts one intent to the `ask-gemini` Edge Function and returns the raw JSON
 * text the model answered with. The key, the model list, the fallback to the
 * lite model and every prompt now live server-side — see
 * `supabase/functions/ask-gemini/index.ts`.
 */
async function invokeAskGemini(body: Record<string, unknown>) {
  const { data, error } = await getSupabase().functions.invoke<{ text: string }>('ask-gemini', {
    body,
  });

  if (error) {
    throw new Error(await describeFunctionError(error));
  }

  if (!data?.text) {
    throw new Error(i18n.t('addTransaction.aiError'));
  }

  return data.text;
}

/** Only the fields the prompts name, so a receipt image is the heaviest thing on the wire. */
function toPromptCategories(categories: Category[]) {
  return categories.map(({ id, name, type }) => ({ id, name, type }));
}

function toPromptAccounts(assets: Asset[]) {
  return assets.map(({ id, name, type, payment_clue }) => ({ id, name, type, payment_clue }));
}

/**
 * The user's own calendar day. The Edge Function runs in UTC, so leaving it to
 * work this out would date a late-evening entry in UTC+2 a day early.
 */
function todayForPrompt() {
  const now = new Date();

  return {
    today: toISODate(now),
    weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
  };
}

/** Smart Text and Voice: one spoken or typed request, parsed into a full transaction. */
export function requestTransactionParse({
  categories,
  assets,
  text,
  audio,
}: {
  categories: Category[];
  assets: Asset[];
  text?: string;
  audio?: AIMedia;
}) {
  return invokeAskGemini({
    action: 'parse_transaction',
    categories: toPromptCategories(categories),
    accounts: toPromptAccounts(assets),
    text: text ?? null,
    audio_base64: audio?.base64 ?? null,
    audio_mime_type: audio?.mimeType ?? null,
    ...todayForPrompt(),
  });
}

/** The debounced guess behind the Category field. */
export function requestCategorize(title: string, categories: Category[], type: CategoryType) {
  return invokeAskGemini({
    action: 'categorize',
    categories: toPromptCategories(categories),
    type,
    title,
  });
}

/** Receipt scanning: Gemini Vision reads the photo and answers with ids. */
export function requestReceiptScan({
  image,
  categories,
  assets,
}: {
  image: AIMedia;
  categories: Category[];
  assets: Asset[];
}) {
  return invokeAskGemini({
    action: 'scan_receipt',
    image_base64: image.base64,
    image_mime_type: image.mimeType,
    categories: toPromptCategories(categories),
    accounts: toPromptAccounts(assets),
    ...todayForPrompt(),
  });
}

/**
 * Best-effort category guess for a title the user is still typing, so it can
 * auto-fill while the rest of the form is untouched. Unlike `findCategory`
 * (used once the user has already committed to saving via the AI parse
 * flow), an unclear title resolves to null rather than a catch-all category —
 * a wrong guess here would silently pick something for a field the user
 * hasn't looked at yet.
 */
export async function categorizeTransaction(
  title: string,
  categories: Category[],
  type: CategoryType,
): Promise<Category | null> {
  const responseText = await requestCategorize(title, categories, type);

  let parsed: { category?: string | null };

  try {
    parsed = JSON.parse(responseText);
  } catch {
    return null;
  }

  if (!parsed.category) {
    return null;
  }

  const target = parsed.category.trim().toLocaleLowerCase();

  return (
    categories.find((item) => item.type === type && item.name.toLocaleLowerCase() === target) ??
    null
  );
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

/** A whole number of payments, clamped to a sane range. Anything unusable is a single payment. */
function parseInstallmentsCount(value: unknown): number {
  const parsed = parseAIAmount(value);

  if (!Number.isFinite(parsed) || parsed <= 1) {
    return 1;
  }

  return Math.min(MAX_INSTALLMENTS, Math.round(parsed));
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
    installments?: number | string | null;
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
    return { action, values: null, aiFilled: [] };
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
  // A transfer moves money rather than spending it, so it is never split.
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

/**
 * Only the fields the model actually answered with. `amount` is always in:
 * a response without a usable one has already thrown by this point.
 */
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

  if (title) {
    filled.push('title');
  }

  if (currency) {
    filled.push('currency');
  }

  if (date) {
    filled.push('date');
  }

  if (category) {
    filled.push('category');
  }

  if (asset) {
    filled.push('asset');
  }

  return filled;
}

/**
 * Turns the `scan_receipt` JSON into form values. Unlike the spoken and typed
 * flows, the model answers with ids: it is reading a photo full of numbers, and
 * an id can be checked against the list that was sent while a near-miss name
 * cannot. A model that echoes the name anyway still resolves, through the same
 * matchers the other flows use.
 */
export function parseReceiptResponse(
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
    throw new Error(i18n.t('addTransaction.aiError'));
  }

  const amount = parseAIAmount(parsed.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(i18n.t('addTransaction.aiNoAmount'));
  }

  // A receipt records a purchase or a refund. It never describes moving money
  // between the user's own accounts, so a transfer is not on the table here.
  const type: CategoryType = parsed.type === 'income' ? 'income' : 'expense';
  const categoryId = parsed.category_id?.trim() || null;
  const category = categoryId
    ? (categories.find((item) => item.id === categoryId && item.type === type) ??
      findCategory(categories, categoryId, type))
    : null;
  const accountId = parsed.account_id?.trim() || null;
  // No catch-all: an unreadable payment method leaves the user's own pick alone.
  const asset = accountId
    ? (assets.find((item) => item.id === accountId) ?? findAsset(assets, accountId))
    : null;
  const currency = normalizeCurrency(parsed.currency);
  const parsedDate = parsed.date ? fromISODate(parsed.date) : null;
  const date = parsedDate ?? fallbackDate;
  const title = parsed.title?.trim() || category?.name || '';

  return {
    // A scan fills the form in and stops there — it is never an instruction to save.
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
