const HEX6 = /^[0-9A-Fa-f]{6}$/;

/** Normalizes `#RRGGBB` or `RRGGBB` input, or null when invalid. */
export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim().replace(/^#/, '');

  if (!HEX6.test(trimmed)) {
    return null;
  }

  return `#${trimmed.toUpperCase()}`;
}

export type HsvColor = {
  h: number;
  s: number;
  v: number;
};

export function hexToHsv(hex: string): HsvColor {
  const normalized = normalizeHexColor(hex) ?? '#6366F1';
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }

    h *= 60;

    if (h < 0) {
      h += 360;
    }
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360;
  const chroma = v * s;
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = v - chroma;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = chroma;
    g = secondary;
  } else if (hue < 120) {
    r = secondary;
    g = chroma;
  } else if (hue < 180) {
    g = chroma;
    b = secondary;
  } else if (hue < 240) {
    g = secondary;
    b = chroma;
  } else if (hue < 300) {
    r = secondary;
    b = chroma;
  } else {
    r = chroma;
    b = secondary;
  }

  const toChannel = (channel: number) =>
    Math.round(Math.min(255, Math.max(0, (channel + match) * 255)))
      .toString(16)
      .padStart(2, '0');

  return `#${toChannel(r)}${toChannel(g)}${toChannel(b)}`.toUpperCase();
}

/** Pure hue at full saturation and brightness — used to tint the SV box. */
export function hueToHex(h: number): string {
  return hsvToHex(h, 1, 1);
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
