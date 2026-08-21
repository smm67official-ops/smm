export const LOCALES = ['ar', 'fr', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Marché cible : arabophone. Changez cette constante pour basculer le site. */
export const DEFAULT_LOCALE: Locale = 'ar';

export const LOCALE_META: Record<Locale, { label: string; dir: 'rtl' | 'ltr'; flag: string }> = {
  ar: { label: 'العربية', dir: 'rtl', flag: '/assets/images/flag-english.png' },
  fr: { label: 'Français', dir: 'ltr', flag: '/assets/images/flag-french.png' },
  en: { label: 'English', dir: 'ltr', flag: '/assets/images/flag-english.png' },
};

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

export const dirOf = (locale: Locale) => LOCALE_META[locale].dir;
