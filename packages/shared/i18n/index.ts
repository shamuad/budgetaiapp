import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import { resolveNumberLocaleFromDevice } from '../lib/money';
import en from './locales/en';
import es from './locales/es';
import nl from './locales/nl';
import tr from './locales/tr';

const i18n = new I18n({ en, tr, nl, es });
const deviceLocale = getLocales()[0];

i18n.defaultLocale = 'en';
i18n.locale = deviceLocale?.languageCode ?? 'en';
i18n.enableFallback = true;

/**
 * Region setting wins over language. English (US) + Region Netherlands
 * still reports `languageTag: en-US` — numbers must use `regionCode: NL`.
 */
export const numberLocale = resolveNumberLocaleFromDevice(deviceLocale);

/** Separators the OS itself uses, so grouping never depends on Hermes ICU. */
export const deviceNumberSeparators = {
  group: deviceLocale?.digitGroupingSeparator || undefined,
  decimal: deviceLocale?.decimalSeparator || undefined,
};

export default i18n;
