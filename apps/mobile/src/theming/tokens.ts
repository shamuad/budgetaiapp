/**
 * Semantic color tokens for the dynamic (dark/light/auto) theme system.
 *
 * `apps/mobile/src/theme.ts` remains the static, light-only palette that the
 * rest of the app already relies on — it is untouched. These tokens are for
 * screens that opt into `useAppTheme()`, starting with the Profile screen.
 * The `light` palette intentionally mirrors `theme.ts` so nothing looks
 * different until a screen migrates.
 */

export const lightColors = {
  background: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.72)',
  border: '#E5E7EB',
  borderGlass: 'rgba(17, 24, 39, 0.08)',
  text: '#111827',
  textMuted: '#6B7280',
  placeholder: '#9CA3AF',
  placeholderFaint: '#D1D5DB',
  chevron: '#C7C7CC',
  // iOS system blue, reserved for interactive text and controls.
  tint: '#007AFF',
  brand: '#4F46E5',
  brandDark: '#312E81',
  brandLight: '#6366F1',
  brandSoft: '#C7D2FE',
  brandSurface: '#EEF2FF',
  income: '#059669',
  expense: '#DC2626',
  danger: '#DC2626',
  dangerText: '#B91C1C',
  dangerSurface: '#FEE2E2',
  // Soft, non-blocking notices (e.g. "this exceeds your recorded balance") —
  // distinct from `danger`, which is reserved for validation/save failures.
  warning: '#D97706',
  warningText: '#92400E',
  warningSurface: 'rgba(217, 119, 6, 0.12)',
  overlay: 'rgba(17, 24, 39, 0.45)',
  onBrand: '#FFFFFF',
  // The AI panel: a saturated indigo block in light mode, and a deep glass
  // surface in dark mode, where a vivid fill would glare against the canvas.
  aiSurface: '#4F46E5',
  aiSurfaceStrong: '#312E81',
  aiBorder: 'transparent',
  aiText: '#FFFFFF',
  aiTextMuted: '#C7D2FE',
  // Warm gold accent, reserved for the premium badge alone.
  premium: '#B45309',
  premiumSurface: '#FEF3C7',
  shadow: '#111827',
} as const;

export const darkColors = {
  background: '#0B0F19',
  surface: '#151A25',
  surfaceElevated: '#1C2330',
  surfaceGlass: 'rgba(255, 255, 255, 0.06)',
  border: '#252C3B',
  borderGlass: 'rgba(255, 255, 255, 0.10)',
  text: '#F5F7FA',
  textMuted: '#94A3B8',
  placeholder: '#64748B',
  placeholderFaint: '#3B4252',
  chevron: '#4B5563',
  // iOS system blue, dark-mode tint.
  tint: '#0A84FF',
  brand: '#6366F1',
  brandDark: '#4338CA',
  brandLight: '#818CF8',
  brandSoft: '#312E81',
  brandSurface: 'rgba(99, 102, 241, 0.16)',
  income: '#34D399',
  expense: '#F87171',
  danger: '#F87171',
  dangerText: '#FCA5A5',
  dangerSurface: 'rgba(248, 113, 113, 0.14)',
  warning: '#FBBF24',
  warningText: '#FDE68A',
  warningSurface: 'rgba(251, 191, 36, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  onBrand: '#FFFFFF',
  aiSurface: 'rgba(99, 102, 241, 0.14)',
  aiSurfaceStrong: '#4338CA',
  aiBorder: 'rgba(129, 140, 248, 0.32)',
  aiText: '#EEF0FF',
  aiTextMuted: '#A5B4FC',
  // Warm gold accent, reserved for the premium badge alone.
  premium: '#F5C451',
  premiumSurface: 'rgba(245, 196, 81, 0.14)',
  shadow: '#000000',
} as const;

export type ColorScheme = 'light' | 'dark';
export type ColorTokens = Record<keyof typeof lightColors, string>;
