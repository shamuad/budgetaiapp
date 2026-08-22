/** Google favicon service — reliable, no API key, works on web and React Native. */
export function getFaviconUrl(domain: string, size = 128): string {
  const host = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}
