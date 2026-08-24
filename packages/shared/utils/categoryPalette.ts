import type { CategoryType } from '../types/database';

/**
 * The app's known category set, in a fixed display/color order. A user can
 * still create custom categories via Manage Categories — those fall back to
 * a deterministic hashed color below, so nothing ever renders without one.
 */
export const EXPENSE_CATEGORY_ORDER = [
  'Mortgage',
  'Energy',
  'Water',
  'Transportation',
  'Market',
  'Eat and Drink',
  'Clothing',
  'Home Needs',
  'House Cleaning',
  'Education',
  'Entertainment',
  'Personal Needs',
  'Gift',
  'Bank Commission',
  'Telecom',
  'Car & Insurance',
  'Municipality',
  'Subscriptions',
] as const;

export const INCOME_CATEGORY_ORDER = [
  'Salary',
  'Rent',
  'Child Benefit',
  'Interest',
  'Other Income',
] as const;

/** One fixed pastel per expense category, so a donut slice always matches its ledger row. */
const EXPENSE_PALETTE: Record<string, string> = {
  Mortgage: '#F87171',
  Energy: '#FBBF24',
  Water: '#38BDF8',
  Transportation: '#818CF8',
  Market: '#34D399',
  'Eat and Drink': '#FB923C',
  Clothing: '#F472B6',
  'Home Needs': '#A78BFA',
  'House Cleaning': '#2DD4BF',
  Education: '#60A5FA',
  Entertainment: '#E879F9',
  'Personal Needs': '#FCD34D',
  Gift: '#FB7185',
  'Bank Commission': '#94A3B8',
  Telecom: '#22D3EE',
  'Car & Insurance': '#C084FC',
  Municipality: '#4ADE80',
  Subscriptions: '#FDBA74',
};

/** One fixed pastel per income category. */
const INCOME_PALETTE: Record<string, string> = {
  Salary: '#34D399',
  Rent: '#60A5FA',
  'Child Benefit': '#F472B6',
  Interest: '#FBBF24',
  'Other Income': '#94A3B8',
};

/** Fallback pastels, cycled by a name hash for any category outside the fixed lists above. */
const FALLBACK_PALETTE = [
  '#F87171',
  '#FB923C',
  '#FBBF24',
  '#A3E635',
  '#34D399',
  '#2DD4BF',
  '#38BDF8',
  '#818CF8',
  '#A78BFA',
  '#E879F9',
  '#F472B6',
  '#FB7185',
] as const;

/** Neutral gray for a transaction with no category at all. */
export const UNCATEGORIZED_COLOR = '#94A3B8';

// Simple, deterministic string hash (djb2) — same name always lands on the same fallback color.
function hashString(value: string): number {
  let hash = 5381;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }

  return Math.abs(hash);
}

/**
 * A fixed, distinct color for a category name — matching between chart slices
 * and list rows everywhere. Known categories use their assigned pastel;
 * anything else (a user's own custom category) still gets a stable color via
 * a name hash, so custom categories never break the visuals.
 */
export function getCategoryColor(name: string | null | undefined, type: CategoryType = 'expense'): string {
  const trimmed = name?.trim();

  if (!trimmed) {
    return UNCATEGORIZED_COLOR;
  }

  const palette = type === 'income' ? INCOME_PALETTE : EXPENSE_PALETTE;
  const known = palette[trimmed];

  if (known) {
    return known;
  }

  return FALLBACK_PALETTE[hashString(trimmed) % FALLBACK_PALETTE.length];
}
