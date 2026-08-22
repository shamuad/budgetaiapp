/** True when the stored icon is a remote logo URL rather than an emoji character. */
export function isRemoteIcon(icon: string | null | undefined): boolean {
  if (!icon) {
    return false;
  }

  return icon.startsWith('http://') || icon.startsWith('https://');
}
