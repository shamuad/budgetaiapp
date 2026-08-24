import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import en from './locales/en';
import es from './locales/es';
import nl from './locales/nl';
import tr from './locales/tr';

const i18n = new I18n({ en, tr, nl, es });

i18n.defaultLocale = 'en';
i18n.locale = getLocales()[0].languageCode ?? 'en';
i18n.enableFallback = true;

export default i18n;
