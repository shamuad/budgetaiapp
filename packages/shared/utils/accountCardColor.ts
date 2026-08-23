import type { AssetType } from '../types/database';
import { resolveBrand } from './brandDictionary';

/** Curated fintech tones — enough variety to distinguish same-bank accounts. */
export const ACCOUNT_CARD_PALETTE = [
  '#4F46E5',
  '#6366F1',
  '#7C3AED',
  '#8B5CF6',
  '#A855F7',
  '#DB2777',
  '#EC4899',
  '#F43F5E',
  '#E11D48',
  '#EA580C',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#059669',
  '#10B981',
  '#14B8A6',
  '#0D9488',
  '#0284C7',
  '#0EA5E9',
  '#06B6D4',
  '#0891B2',
  '#475569',
  '#64748B',
  '#334155',
  '#1E293B',
  '#0F172A',
  '#BE123C',
  '#7E22CE',
  '#0369A1',
  '#15803D',
] as const;

const TYPE_FALLBACK: Record<string, string> = {
  cash: '#047857',
  card: '#4338CA',
  bank: '#0F172A',
  investment: '#0F766E',
  default: '#6D28D9',
};

export { normalizeHexColor } from './colorSpace';

export function isPaletteColor(color: string | null): boolean {
  if (!color) {
    return false;
  }

  const upper = color.toUpperCase();

  return ACCOUNT_CARD_PALETTE.some((entry) => entry.toUpperCase() === upper);
}

/** Brand hex from the account name, or null when no bank matches. */
export function getBrandColor(accountName: string): string | null {
  return resolveBrand(accountName)?.color ?? null;
}

/** Card background: custom override → bank brand → account-type default. */
export function getAccountCardColor(asset: {
  name: string;
  type: AssetType | null;
  custom_color?: string | null;
}): string {
  return (
    asset.custom_color ??
    getBrandColor(asset.name) ??
    TYPE_FALLBACK[asset.type ?? ''] ??
    TYPE_FALLBACK.default
  );
}
