export const colors = {
  background: '#F3F4F6',
  surface: '#FFFFFF',
  border: '#E5E7EB',
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
  overlay: 'rgba(17, 24, 39, 0.45)',
  onBrand: '#FFFFFF',
} as const;

// One tone per account type, so each dashboard card reads as a distinct product.
export const accountTone = {
  cash: '#047857',
  card: '#4338CA',
  bank: '#0F172A',
  default: '#6D28D9',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

// Minimum tappable size recommended by the iOS human interface guidelines.
export const TOUCH_TARGET = 44;
