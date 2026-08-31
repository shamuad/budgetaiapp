import type { AssetType } from '../types/database';
import { resolveBrand } from './brandDictionary';
import { normalizeHexColor } from './colorSpace';

export type CardAppearance =
  | { kind: 'flat'; color: string }
  | { kind: 'gradient'; colors: string[]; angle: number };

export type PremiumGradientPreset = {
  id: 'metallicGrey' | 'gold' | 'obsidian' | 'titanium';
  /** i18n key under `manage.*` */
  labelKey:
    | 'gradientMetallicGrey'
    | 'gradientGold'
    | 'gradientObsidian'
    | 'gradientTitanium';
  colors: readonly string[];
  angle: number;
};

/** Curated premium wallet textures — stored as JSON in `assets.custom_color`. */
export const PREMIUM_CARD_GRADIENTS: readonly PremiumGradientPreset[] = [
  {
    id: 'metallicGrey',
    labelKey: 'gradientMetallicGrey',
    colors: ['#2D3748', '#4A5568', '#718096', '#CBD5E0'],
    angle: 145,
  },
  {
    id: 'gold',
    labelKey: 'gradientGold',
    colors: ['#78350F', '#B45309', '#F59E0B', '#FDE68A'],
    angle: 135,
  },
  {
    id: 'obsidian',
    labelKey: 'gradientObsidian',
    colors: ['#0A0A0A', '#171717', '#374151', '#1F2937'],
    angle: 160,
  },
  {
    id: 'titanium',
    labelKey: 'gradientTitanium',
    colors: ['#475569', '#64748B', '#94A3B8', '#E2E8F0'],
    angle: 125,
  },
] as const;

const TYPE_FALLBACK: Record<string, string> = {
  cash: '#047857',
  card: '#4338CA',
  bank: '#0F172A',
  investment: '#0F766E',
  default: '#6D28D9',
};

function normalizeGradientColors(colors: unknown): string[] | null {
  if (!Array.isArray(colors) || colors.length === 0) {
    return null;
  }

  const normalized = colors.map((entry) => normalizeHexColor(String(entry))).filter(Boolean) as string[];

  return normalized.length > 0 ? normalized : null;
}

/** Writes a flat `#RRGGBB` override. */
export function serializeFlatColor(hex: string): string | null {
  return normalizeHexColor(hex);
}

/** Writes a JSON gradient payload for `assets.custom_color`. */
export function serializeGradient(appearance: {
  colors: readonly string[];
  angle: number;
}): string | null {
  const colors = normalizeGradientColors([...appearance.colors]);

  if (!colors) {
    return null;
  }

  return JSON.stringify({
    gradient: colors,
    angle: appearance.angle,
  });
}

/**
 * Reads `custom_color`: flat hex (`#RRGGBB`) or JSON
 * `{"gradient":["#..."],"angle":135}`. Invalid values return null.
 */
export function parseCustomColor(value: string | null | undefined): CardAppearance | null {
  if (!value?.trim()) {
    return null;
  }

  const flat = normalizeHexColor(value);

  if (flat) {
    return { kind: 'flat', color: flat };
  }

  try {
    const parsed = JSON.parse(value) as { gradient?: unknown; angle?: unknown };
    const colors = normalizeGradientColors(parsed.gradient);

    if (!colors) {
      return null;
    }

    const angle =
      typeof parsed.angle === 'number' && Number.isFinite(parsed.angle) ? parsed.angle : 135;

    return { kind: 'gradient', colors, angle };
  } catch {
    return null;
  }
}

export function appearanceToCustomColor(appearance: CardAppearance): string {
  if (appearance.kind === 'flat') {
    return appearance.color;
  }

  return serializeGradient(appearance) ?? appearance.colors[0];
}

function fallbackFlatColor(type: AssetType | null): string {
  return TYPE_FALLBACK[type ?? ''] ?? TYPE_FALLBACK.default;
}

/** Custom override → bank brand → account-type default, as a renderable appearance. */
export function resolveAccountCardAppearance(asset: {
  name: string;
  type: AssetType | null;
  custom_color?: string | null;
}): CardAppearance {
  const custom = parseCustomColor(asset.custom_color ?? null);

  if (custom) {
    return custom;
  }

  const brand = resolveBrand(asset.name)?.color ?? null;

  if (brand) {
    return { kind: 'flat', color: brand };
  }

  return { kind: 'flat', color: fallbackFlatColor(asset.type) };
}

/** Single hex for logo tint and legacy callers — first gradient stop when applicable. */
export function appearancePrimaryColor(appearance: CardAppearance): string {
  return appearance.kind === 'flat' ? appearance.color : appearance.colors[0];
}

export function getAccountCardColor(asset: {
  name: string;
  type: AssetType | null;
  custom_color?: string | null;
}): string {
  return appearancePrimaryColor(resolveAccountCardAppearance(asset));
}

export function gradientMatchesPreset(
  appearance: CardAppearance | null,
  preset: PremiumGradientPreset,
): boolean {
  if (!appearance || appearance.kind !== 'gradient') {
    return false;
  }

  if (appearance.angle !== preset.angle || appearance.colors.length !== preset.colors.length) {
    return false;
  }

  return appearance.colors.every(
    (color, index) => color.toUpperCase() === preset.colors[index].toUpperCase(),
  );
}
