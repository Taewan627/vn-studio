import ko from './messages/ko.js';
import ja from './messages/ja.js';
import en from './messages/en.js';
import { type ContentLanguage } from './locales';
import quick from './quick.js';
import library from './library.js';

export const messages = { ko: { ...ko, ...quick.ko, ...library.ko }, ja: { ...ja, ...quick.ja, ...library.ja }, en: { ...en, ...quick.en, ...library.en } };
export function translate(language: ContentLanguage, source: string, values: Record<string, string | number> = {}): string {
  const dictionary: Record<string, string> = messages[language];
  const result = dictionary[source] ?? source;
  return result.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}
