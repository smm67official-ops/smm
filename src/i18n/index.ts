import ar from '@/i18n/dictionaries/ar';
import en from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';

const DICTIONARIES: Record<Locale, Dictionary> = { ar, fr, en };

export function getDictionary(locale: string): Dictionary {
  return DICTIONARIES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

export type { Dictionary };
