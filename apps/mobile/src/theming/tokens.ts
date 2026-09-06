/**
 * D2 semantic palette: approved Light and Dark B (Figma Foundations 68:2).
 * `tint` is readable interactive text; `brand` is the saturated filled action
 * paired with `onBrand`. Keep account-selected colors and AI roles separate.
 * Static legacy consumers in theme.ts migrate separately.
 */

export const lightColors = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.72)',
  border: '#E5E7EB',
  borderGlass: 'rgba(17, 24, 39, 0.08)',
  text: '#101425',
  textMuted: '#697086',
  placeholder: '#9CA3AF',
  placeholderFaint: '#D1D5DB',
  chevron: '#C7C7CC',
  // Interactive text and icons follow the D2 accent.
  tint: '#5842D8',
  brand: '#5842D8',
  brandDark: '#312E81',
  brandLight: '#6366F1',
  brandSoft: '#C7D2FE',
  brandSurface: '#EEF2FF',
  // Budgree brand accent — AI assistant surfaces, logo, growth/success
  // moments, glow effects. Never a general button color.
  budgree: '#00C94F',
  budgreeStrong: '#00A840',
  budgreeSurface: 'rgba(0, 201, 79, 0.10)',
  budgreeBorder: 'rgba(0, 201, 79, 0.28)',
  budgreeGlow: 'rgba(0, 232, 92, 0.30)',
  income: '#087F5B',
  expense: '#C72E2E',
  danger: '#C72E2E',
  dangerText: '#B91C1C',
  dangerSurface: '#FEE2E2',
  // Soft, non-blocking notices (e.g. "this exceeds your recorded balance") —
  // distinct from `danger`, which is reserved for validation/save failures.
  warning: '#D97706',
  warningText: '#92400E',
  warningSurface: 'rgba(217, 119, 6, 0.12)',
  overlay: 'rgba(17, 24, 39, 0.45)',
  onBrand: '#FFFFFF',
  // Existing AI entry panel: a saturated green block in light mode, and glass
  // surface in dark mode, where a vivid fill would glare against the canvas.
  aiSurface: '#00C94F',
  aiSurfaceStrong: '#00A840',
  aiBorder: 'transparent',
  aiText: '#FFFFFF',
  aiTextMuted: '#B8F5CE',
  // Warm gold accent, reserved for the premium badge alone.
  premium: '#B45309',
  premiumSurface: '#FEF3C7',
  shadow: '#101425',
} as const;

export const darkColors = {
  background: '#1B1D22',
  surface: '#2C2F36',
  surfaceElevated: '#2C2F36',
  surfaceGlass: 'rgba(255, 255, 255, 0.06)',
  border: '#454953',
  borderGlass: 'rgba(255, 255, 255, 0.10)',
  text: '#F5F5F7',
  textMuted: '#C2BED3',
  placeholder: '#64748B',
  placeholderFaint: '#3B4252',
  chevron: '#4B5563',
  // Light violet is reserved for interactive text on dark surfaces.
  tint: '#B6A7FF',
  brand: '#5842D8',
  brandDark: '#4338CA',
  brandLight: '#818CF8',
  brandSoft: '#312E81',
  brandSurface: 'rgba(99, 102, 241, 0.16)',
  // Budgree brand accent — AI assistant surfaces, logo, growth/success
  // moments, glow effects. Never a general button color.
  budgree: '#00E85C',
  budgreeStrong: '#33F27E',
  budgreeSurface: 'rgba(0, 232, 92, 0.12)',
  budgreeBorder: 'rgba(0, 232, 92, 0.32)',
  budgreeGlow: 'rgba(0, 232, 92, 0.45)',
  income: '#64DBAF',
  expense: '#FF9999',
  danger: '#FF9999',
  dangerText: '#FCA5A5',
  dangerSurface: 'rgba(248, 113, 113, 0.14)',
  warning: '#FBBF24',
  warningText: '#FDE68A',
  warningSurface: 'rgba(251, 191, 36, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  onBrand: '#FFFFFF',
  aiSurface: 'rgba(0, 232, 92, 0.14)',
  aiSurfaceStrong: '#00A840',
  aiBorder: 'rgba(0, 232, 92, 0.32)',
  aiText: '#EAFFF2',
  aiTextMuted: '#7FE8A6',
  // Warm gold accent, reserved for the premium badge alone.
  premium: '#F5C451',
  premiumSurface: 'rgba(245, 196, 81, 0.14)',
  shadow: '#000000',
} as const;

export type ColorScheme = 'light' | 'dark';
export type ColorTokens = Record<keyof typeof lightColors, string>;
