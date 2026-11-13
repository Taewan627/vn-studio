import React from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import { LANGUAGE_NAMES, type ContentLanguage } from '../i18n/locales';

export function LanguageSwitcher({ disabled = false, onChange }: { disabled?: boolean; onChange?: (language: ContentLanguage) => void }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <label className="inline-flex items-center gap-1 text-xs text-white shrink-0">
      <span aria-hidden="true">🌐</span>
      <select aria-label={t('UI 언어')} value={language} disabled={disabled}
        onClick={event => event.stopPropagation()}
        onChange={event => (onChange ?? setLanguage)(event.target.value as ContentLanguage)}
        className="bg-gray-900 text-white border border-gray-600 rounded-lg px-2 py-2 max-w-[110px]">
        {(['en', 'ja', 'ko'] as const).map(code => <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>)}
      </select>
    </label>
  );
}
