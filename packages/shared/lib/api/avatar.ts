import { getSupabase } from '../supabase';
import { useAuthStore } from '../../store/useAuthStore';

const AVATAR_BUCKET = 'avatars';
const AVATAR_FILENAME = 'avatar.jpg';

/** Reads the persisted photo URL off the signed-in user, if one has been saved. */
export function getUserAvatarUrl(user: { user_metadata?: Record<string, unknown> } | null): string | null {
  const value = user?.user_metadata?.avatar_url;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Uploads a local image to `avatars/{userId}/avatar.jpg` (overwriting any
 * previous object), then writes the public URL to `profiles.avatar_url` and
 * `user_metadata.avatar_url` so the session already has it.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const supabase = getSupabase();
  await restoreAuthSession();

  const path = `${userId}/${AVATAR_FILENAME}`;
  const body = await readLocalImage(localUri);

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '3600',
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    avatar_url: avatarUrl,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  applyAvatarToStore(avatarUrl);

  const { error: userError } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl },
  });

  // The profile row is the source of truth. Metadata is a cache — if the
  // in-memory auth client still has no session, the store already shows the
  // new photo and the next hydrate will read it from `profiles`.
  if (userError && userError.message !== 'Auth session missing!') {
    throw new Error(userError.message);
  }

  return avatarUrl;
}

/** Loads `profiles.avatar_url` into the session cache when metadata is empty. */
export async function hydrateAvatarFromProfile() {
  const user = useAuthStore.getState().user;

  if (!user || getUserAvatarUrl(user)) {
    return;
  }

  const { data, error } = await getSupabase()
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data?.avatar_url) {
    return;
  }

  applyAvatarToStore(data.avatar_url);
}

/**
 * React Native often has the session in Zustand / AsyncStorage while the
 * auth client's in-memory copy is empty — `updateUser` then throws
 * "Auth session missing!". Re-seat it from the store before Storage/Auth calls.
 */
async function restoreAuthSession() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    return;
  }

  const stored = useAuthStore.getState().session;

  if (!stored?.access_token || !stored.refresh_token) {
    throw new Error('Auth session missing!');
  }

  const { error } = await supabase.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function applyAvatarToStore(avatarUrl: string) {
  const { session, setSession } = useAuthStore.getState();

  if (!session?.user) {
    return;
  }

  setSession({
    ...session,
    user: {
      ...session.user,
      user_metadata: {
        ...session.user.user_metadata,
        avatar_url: avatarUrl,
      },
    },
  });
}

async function readLocalImage(localUri: string): Promise<ArrayBuffer> {
  const response = await fetch(localUri);

  if (!response.ok) {
    throw new Error(`Could not read image (${response.status})`);
  }

  return response.arrayBuffer();
}
