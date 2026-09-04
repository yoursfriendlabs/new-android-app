import { useCallback } from 'react';
import { useLanguageStore, type Language } from '@/src/stores/language-store';
import { en, type TranslationDictionary } from './translations/en';
import { ne } from './translations/ne';

export const dictionaries: Record<Language, TranslationDictionary> = {
  en,
  ne,
};

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationDictionary>;

export function getTranslation(lang: Language, path: string, params?: Record<string, string | number>): string {
  const dictionary = dictionaries[lang] || dictionaries.en;
  const keys = path.split('.');
  let result: any = dictionary;

  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = result[k];
    } else {
      // Fallback to English if key missing in current language
      let fallback: any = dictionaries.en;
      for (const fk of keys) {
        if (fallback && typeof fallback === 'object' && fk in fallback) {
          fallback = fallback[fk];
        } else {
          fallback = undefined;
          break;
        }
      }
      result = fallback !== undefined ? fallback : path;
      break;
    }
  }

  if (typeof result !== 'string') {
    return path;
  }

  if (params) {
    return Object.entries(params).reduce(
      (acc, [key, val]) => acc.replace(new RegExp(`{{${key}}}`, 'g'), String(val)),
      result
    );
  }

  return result;
}

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const t = useCallback(
    (key: TranslationKey | string, params?: Record<string, string | number>): string => {
      return getTranslation(language, key, params);
    },
    [language]
  );

  return {
    t,
    language,
    setLanguage,
    translations: dictionaries[language] || dictionaries.en,
    isNepali: language === 'ne',
  };
}

export function t(key: TranslationKey | string, params?: Record<string, string | number>): string {
  const language = useLanguageStore.getState().language;
  return getTranslation(language, key, params);
}
