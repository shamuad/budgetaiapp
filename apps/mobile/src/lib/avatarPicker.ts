import { i18n } from '@budgetaiapp/shared';
import * as ImagePicker from 'expo-image-picker';

/**
 * Opens the photo library for a square profile crop. Returns a local URI, or
 * `null` when the user cancels. Throws when library access is denied.
 */
export async function pickAvatarImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(i18n.t('profile.avatarPermissionDenied'));
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0]?.uri ?? null;
}
