import { getUserAvatarUrl, i18n, uploadAvatar, useAuthStore } from '@budgetaiapp/shared';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { pickAvatarImage } from '../lib/avatarPicker';

/**
 * Picks a square photo, shows it immediately, then uploads it to Storage and
 * persists the public URL on the profile row + auth metadata.
 */
export function useUpdateAvatar() {
  const user = useAuthStore((state) => state.user);
  const persistedUrl = getUserAvatarUrl(user);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inFlight = useRef(false);

  const updateAvatar = useCallback(async () => {
    if (!user || inFlight.current) {
      return;
    }

    inFlight.current = true;

    try {
      const uri = await pickAvatarImage();

      if (!uri) {
        return;
      }

      setLocalUri(uri);
      setIsUploading(true);
      await uploadAvatar(user.id, uri);
    } catch (error) {
      setLocalUri(null);
      Alert.alert(
        i18n.t('common.errorTitle'),
        error instanceof Error && error.message
          ? error.message
          : i18n.t('profile.avatarUploadError'),
      );
    } finally {
      inFlight.current = false;
      setIsUploading(false);
    }
  }, [user]);

  return {
    avatarUri: localUri ?? persistedUrl,
    isUploading,
    updateAvatar,
  };
}
