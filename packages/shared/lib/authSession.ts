/** Must stay aligned with `supabase/config.toml` and the hosted Auth setting. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * The first resolved user establishes the cache owner. Every later transition
 * — login, logout, or A -> B switch — must discard user-scoped query data.
 */
export function shouldClearUserScopedCache(
  previousUserId: string | null | undefined,
  currentUserId: string | null,
): boolean {
  return previousUserId !== undefined && previousUserId !== currentUserId;
}
