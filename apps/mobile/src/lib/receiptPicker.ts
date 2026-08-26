import { i18n } from '@budgetaiapp/shared';
import * as ImagePicker from 'expo-image-picker';

export type ReceiptImage = {
  base64: string;
  mimeType: string;
};

/** Opens the camera for a receipt; falls back to the photo library on simulator. */
export async function pickReceiptImage(): Promise<ReceiptImage | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    base64: true,
    exif: false,
  };

  const camera = await ImagePicker.requestCameraPermissionsAsync();
  let result: ImagePicker.ImagePickerResult;

  try {
    if (camera.granted) {
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await launchLibrary(options);
    }
  } catch {
    result = await launchLibrary(options);
  }

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];

  if (!asset?.base64) {
    throw new Error(i18n.t('addTransaction.receiptError'));
  }

  return {
    base64: asset.base64,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

async function launchLibrary(options: ImagePicker.ImagePickerOptions) {
  const library = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!library.granted) {
    throw new Error(i18n.t('addTransaction.cameraDenied'));
  }

  return ImagePicker.launchImageLibraryAsync(options);
}
