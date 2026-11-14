import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { type ContentLanguage, isContentLanguage, resolveContentLanguage } from './locales';
import { translate } from './catalog';

export const UI_LANGUAGE_KEY = 'vna_ui_language';
export const SESSION_LANGUAGE_KEY = 'vna_conference_language';
type LanguageContextValue = {
  language: ContentLanguage;
  setLanguage: (language: ContentLanguage) => void;
  restoreProjectLanguage: (language: unknown) => void;
  t: (source: string, values?: Record<string, string | number>) => string;
};
const LanguageContext = createContext<LanguageContextValue>({
  language: 'en', setLanguage: () => {}, restoreProjectLanguage: () => {}, t: source => source,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<ContentLanguage>(() => {
    try {
      const mode = new URLSearchParams(location.search).get('mode');
      const studio = mode === 'studio' || (mode !== 'quick' && sessionStorage.getItem('vna_workspace_mode') === 'studio');
      const preference = studio ? localStorage.getItem(UI_LANGUAGE_KEY) : sessionStorage.getItem(SESSION_LANGUAGE_KEY);
      return isContentLanguage(preference) ? preference : 'en';
    } catch { return 'en'; }
  });
  const setLanguage = useCallback((selected: ContentLanguage) => {
    updateLanguage(selected);
    try { localStorage.setItem(UI_LANGUAGE_KEY, selected); } catch { /* Optional preference storage. */ }
    try { sessionStorage.setItem(SESSION_LANGUAGE_KEY, selected); } catch { /* Optional tab preference. */ }
  }, []);
  // Opening a project changes its workspace language, not the user's explicit
  // preference. Pre-Phase-1 projects without metadata use the legacy Korean rule.
  const restoreProjectLanguage = useCallback((selected: unknown) => {
    updateLanguage(resolveContentLanguage(selected));
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const t = useCallback((source: string, values?: Record<string, string | number>) => translate(language, source, values), [language]);
  return <LanguageContext.Provider value={{ language, setLanguage, restoreProjectLanguage, t }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

// Read-only library playback has its own language. It must never change the
// workspace preference or the language captured by an in-flight generation.
export function StoryLanguageProvider({ language, children }: { language: ContentLanguage; children: React.ReactNode }) {
  const t = useCallback((source: string, values?: Record<string, string | number>) => translate(language, source, values), [language]);
  return <LanguageContext.Provider value={{ language, t, setLanguage: () => {}, restoreProjectLanguage: () => {} }}>
    <div lang={language} className="contents">{children}</div>
  </LanguageContext.Provider>;
}
