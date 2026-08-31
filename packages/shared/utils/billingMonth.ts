import type { TransactionType } from '../types/database';

/** Inclusive cutoff range. 29/30/31 are excluded so every month has the day. */
export const MIN_STATEMENT_DAY = 1;
export const MAX_STATEMENT_DAY = 28;

function isValidStatementDay(statementDay: number): boolean {
  return (
    Number.isInteger(statementDay) &&
    statementDay >= MIN_STATEMENT_DAY &&
    statementDay <= MAX_STATEMENT_DAY
  );
}

/**
 * First day of the statement month a purchase belongs to.
 *
 * Inclusive cutoff: a purchase on `statementDay` still belongs to that month.
 * 10 Aug / statement 15 → August; 16 Aug / statement 15 → September.
 */
export function resolveBillingMonth(purchaseDate: Date, statementDay: number): Date {
  if (!isValidStatementDay(statementDay)) {
    throw new RangeError(
      `statementDay must be an integer ${MIN_STATEMENT_DAY}–${MAX_STATEMENT_DAY}`,
    );
  }

  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth();

  if (purchaseDate.getDate() <= statementDay) {
    return new Date(year, month, 1);
  }

  return new Date(year, month + 1, 1);
}

/** First of month, `months` later. `Date` handles year wrap. */
export function addBillingMonths(billingMonth: Date, months: number): Date {
  return new Date(billingMonth.getFullYear(), billingMonth.getMonth() + months, 1);
}

/**
 * The same calendar day N months later, clamped into a shorter month instead
 * of overflowing into the one after — so a plan started on the 31st still
 * bills once every month rather than skipping one.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();

  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(date.getDate(), daysInTargetMonth),
  );
}

/**
 * Calendar day stored on installment slice `index` of a credit plan.
 * Slice 0 keeps the purchase day; later slices post on `statementDay` of
 * that slice's billing month.
 */
export function installmentSliceDate(
  purchaseDate: Date,
  index: number,
  statementDay: number,
  firstBillingMonth: Date,
): Date {
  if (index <= 0) {
    return new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), purchaseDate.getDate());
  }

  const billing = addBillingMonths(firstBillingMonth, index);

  return new Date(billing.getFullYear(), billing.getMonth(), statementDay);
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toISODateLocal(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Snapshot written onto an income/expense row. Transfers and non-credit
 * accounts return null — paying a card is not statement spending.
 */
export function billingMonthISO(
  type: TransactionType,
  purchaseDate: Date,
  account: { is_credit: boolean; statement_day: number | null } | null | undefined,
): string | null {
  if (type === 'transfer' || !account?.is_credit || account.statement_day == null) {
    return null;
  }

  if (!isValidStatementDay(account.statement_day)) {
    return null;
  }

  return toISODateLocal(resolveBillingMonth(purchaseDate, account.statement_day));
}
