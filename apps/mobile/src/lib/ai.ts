import {
  AIResponseError,
  Asset,
  Category,
  CategoryType,
  getSupabase,
  i18n,
  parseReceiptAIResponse,
  parseTransactionAIResponse,
  toISODate,
} from '@budgetaiapp/shared';

export { MAX_INSTALLMENTS, normalizeAssetSymbol } from '@budgetaiapp/shared';
export type { AIAction, AiFilledField, AIResult, TransactionValues } from '@budgetaiapp/shared';

/** Base64 media captured by voice input or receipt scanning. */
export type AIMedia = { base64: string; mimeType: string };

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

function localizeResponseError(error: unknown): never {
  if (error instanceof AIResponseError) {
    const key = error.code === 'no_amount' ? 'addTransaction.aiNoAmount' : 'addTransaction.aiError';

    throw new Error(i18n.t(key));
  }

  throw error;
}

export function parseTransactionResponse(
  responseText: string,
  categories: Category[],
  assets: Asset[],
  fallbackDate: Date,
) {
  try {
    return parseTransactionAIResponse(responseText, categories, assets, fallbackDate);
  } catch (error) {
    return localizeResponseError(error);
  }
}

export function parseReceiptResponse(
  responseText: string,
  categories: Category[],
  assets: Asset[],
  fallbackDate: Date,
) {
  try {
    return parseReceiptAIResponse(responseText, categories, assets, fallbackDate);
  } catch (error) {
    return localizeResponseError(error);
  }
}
