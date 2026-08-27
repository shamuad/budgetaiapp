/**
 * Every prompt the product sends to Gemini.
 *
 * These used to live in `apps/mobile/src/lib/ai.ts`. They sit here so the
 * Edge Function is the single AI microservice: the mobile app and the future
 * web app both post structured data (`categories`, `accounts`, a title, an
 * image) and neither one carries a copy of the wording.
 *
 * The client still owns the mapping back to domain objects, because resolving
 * an id into a `Category` or an `Asset` needs the records it already has
 * loaded.
 */

export type PromptCategory = {
  id: string;
  name: string;
  type: 'expense' | 'income';
};

export type PromptAccount = {
  id: string;
  name: string;
  /** `cash`, `card`, `bank`, `investment`, ... — the payment-clue matcher leans on this. */
  type: string | null;
};

/**
 * The calendar day is supplied by the caller, never computed here: the isolate
 * runs in UTC, so a late-evening scan in UTC+2 would otherwise resolve "today"
 * to yesterday and date every receipt a day early.
 */
export type PromptToday = {
  /** YYYY-MM-DD in the user's own timezone. */
  date: string;
  /** English weekday name, so "last friday" can be resolved. */
  weekday: string;
};

const CURRENCY_UNION = '"EUR" | "USD" | "GBP" | "TRY"';

function namesOfType(categories: PromptCategory[], forType: 'expense' | 'income') {
  return categories
    .filter((item) => item.type === forType)
    .map((item) => item.name)
    .join(', ');
}

/** `id | name (type)` per line, so the model can answer with an id it did not invent. */
function identifiedCategories(categories: PromptCategory[]) {
  return categories.map((item) => `${item.id} | ${item.name} (${item.type})`).join('\n');
}

function identifiedAccounts(accounts: PromptAccount[]) {
  return accounts.map((item) => `${item.id} | ${item.name} (${item.type ?? 'account'})`).join('\n');
}

/**
 * Voice and Smart Text. Ported verbatim from the client so the behaviour these
 * two flows already have — investment transfers, installment splitting,
 * relative dates, the save/cancel intent — is unchanged.
 */
export function buildTransactionPrompt(
  categories: PromptCategory[],
  accounts: PromptAccount[],
  today: PromptToday,
  userText?: string,
) {
  // Naming the kind lets the model tell a brokerage from a current account, which
  // is what a purchase of a stock or an ETF has to be transferred into.
  const accountList = accounts
    .map((item) => `${item.name} (${item.type ?? 'account'})`)
    .join(', ');
  const investmentAccounts = accounts
    .filter((item) => item.type === 'investment')
    .map((item) => item.name)
    .join(', ');

  return [
    'You are a financial assistant. Extract the transaction details from the user.',
    'Respond ONLY with a JSON object shaped like:',
    '{"title": string, "amount": number, "type": "expense" | "income" | "transfer", "category": string | null, "account_name": string | null, "to_account_name": string | null, "asset_symbol": string | null, "shares": number | null, "unit_price": number | null, "currency": "EUR" | "USD" | "GBP" | "TRY" | null, "installments": number, "date": "YYYY-MM-DD", "action": "save" | "cancel" | "none"}',
    '"amount" must be a JSON number (never a string) with a dot as the decimal separator, in major currency units.',
    'Examples: forty-two euros -> 42 or 42.5, never 4200; one thousand -> 1000.',
    '"currency" must be one of "EUR", "USD", "GBP", "TRY", or null.',
    'Detect any spoken or written currency (e.g. TL, lira, euro, euros, dollar, pounds) and map it to the correct ISO code.',
    'Use null when the user does not mention a currency.',
    `Expense categories: ${namesOfType(categories, 'expense')}.`,
    `Income categories: ${namesOfType(categories, 'income')}.`,
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
    '"installments" is how many equal monthly payments to split "amount" into.',
    'Set it when the user mentions paying in installments (e.g. "3 taksit", "taksitli",',
    '"in 6 installments", "split over 12 months", "pay it in 4"). Otherwise set it to 1.',
    'A transfer is never split into installments, so always set it to 1 for a "transfer".',
    `Today is ${today.date} (${today.weekday}). Resolve relative dates such as "yesterday" or "last friday" against it.`,
    'If the user does not mention a date, use today.',
    'Set "action" to "save" only when the user explicitly asks to save or record it,',
    '"cancel" when they ask to cancel, discard or close, and "none" otherwise.',
    'Keep "title" short and in the same language as the user.',
    userText ? `User text: ${userText}` : 'The user request is in the attached audio.',
  ].join('\n');
}

/** The debounced title-to-category guess behind the Category field. */
export function buildCategorizePrompt(
  categories: PromptCategory[],
  type: 'expense' | 'income',
  title: string,
) {
  return [
    'You are a financial assistant. Pick the single best matching category for a transaction title.',
    `Transaction type: ${type}.`,
    `Valid categories: ${namesOfType(categories, type)}.`,
    'Respond ONLY with a JSON object shaped like: {"category": string | null}.',
    '"category" must be exactly one of the valid categories, copied without any extra words,',
    'or null if none of them clearly fits.',
    `Transaction title: ${title}`,
  ].join('\n');
}

/**
 * Receipt scanning. Answers with ids rather than names: the picture already
 * gives the model plenty to hallucinate from, and an id can be verified
 * against the list the caller sent, whereas a near-miss name cannot.
 */
export function buildReceiptPrompt(
  categories: PromptCategory[],
  accounts: PromptAccount[],
  today: PromptToday,
) {
  return [
    'You are a financial assistant reading a photograph of a receipt.',
    'Respond ONLY with a valid JSON object. No markdown, no code fences, no commentary.',
    'The JSON must be shaped exactly like:',
    `{"title": string, "amount": number, "currency": ${CURRENCY_UNION} | null, "date": "YYYY-MM-DD", "category_id": string | null, "account_id": string | null, "type": "expense" | "income", "installments": number}`,
    '',
    '"title": the merchant name, short and clean. Drop legal suffixes, branch numbers,',
    'store codes and slogans: "ALBERT HEIJN 1234 B.V." -> "Albert Heijn", "MIGROS TICARET A.S." -> "Migros".',
    '',
    '"amount": the grand total actually paid, as a JSON number (never a string) with a dot as',
    'the decimal separator, in major currency units. Read the final total line — TOTAL, TOTAAL,',
    'TE BETALEN, TOPLAM, GENEL TOPLAM, SUBTOTAL is NOT it — after discounts and including tax.',
    'When several totals are printed, take the amount actually due. 42,50 -> 42.5, never 4250.',
    '',
    `"currency": the ISO code printed on the receipt, one of ${CURRENCY_UNION}.`,
    'Infer it from the symbol (€, $, £, ₺) or the country of the merchant. Use null if unclear.',
    '',
    `"date": the purchase date printed on the receipt, as YYYY-MM-DD. Today is ${today.date} (${today.weekday}).`,
    'Receipts often print DD-MM-YYYY or DD.MM.YYYY — reorder it, never swap day and month.',
    'Use today only when the receipt shows no date at all. Never return a future date.',
    '',
    '"category_id": the single best match for what was bought, copied EXACTLY from this list.',
    'Never invent an id, and never answer with the name. Use null only if nothing fits.',
    'Judge by the line items when they are readable, otherwise by the type of merchant.',
    identifiedCategories(categories),
    '',
    '"account_id": which of the user\'s own accounts paid, copied EXACTLY from this list:',
    identifiedAccounts(accounts),
    'Look for the payment clues printed near the total: a card brand and its last four digits',
    '("VISA 1234", "MASTERCARD ****5678", "MAESTRO", "AMEX"), the words PIN, CONTACTLESS,',
    'DEBIT, CREDIT, KREDI KARTI, BANKA KARTI, CASH, NAKIT, CONTANT, a bank or issuer name,',
    'or a fragment of an IBAN or account number.',
    'Match those clues against the accounts above: prefer an account whose name contains the',
    'bank or issuer, or whose name ends in the same last four digits. Use the kind in brackets',
    'as a tiebreak — a cash clue points at a "cash" account, a card clue at a "card" account,',
    'a bank transfer at a "bank" account.',
    'Return null when the receipt gives no usable clue or when two accounts match equally well.',
    'Guessing the wrong account is worse than returning null.',
    '',
    '"type": "expense" for a normal purchase. Use "income" only when the document is a refund,',
    'a return or a credit note (IADE, RETOUR, REFUND) that gives money back to the user.',
    '',
    '"installments": how many equal monthly payments the total is split into. Card slips print',
    'this as "3 TAKSIT", "TAKSITLI", "3 TAKSIT x 100,00" or "installments". Use 1 when the',
    'receipt shows a single payment.',
  ].join('\n');
}
