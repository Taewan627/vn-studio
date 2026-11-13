export const SUPPORTED_LANGUAGES = ['ko', 'ja', 'en'] as const;
export type ContentLanguage = typeof SUPPORTED_LANGUAGES[number];
export interface GenerationOptions { contentLanguage?: ContentLanguage; generationProfile?: 'full' | 'quick' }
export function isContentLanguage(value: unknown): value is ContentLanguage {
  return SUPPORTED_LANGUAGES.includes(value as ContentLanguage);
}
export function resolveContentLanguage(value: unknown): ContentLanguage {
  return isContentLanguage(value) ? value : 'ko';
}
export const LANGUAGE_NAMES: Record<ContentLanguage, string> = {
  ko: '한국어', ja: '日本語', en: 'English',
};

// Applies only to new AI output. Never translate IDs, saved content, or image prompts.
export function contentLanguageInstruction(options: GenerationOptions = {}): string {
  const language = resolveContentLanguage(options.contentLanguage);
  const names = { ko: 'Korean (한국어)', ja: 'Japanese (日本語)', en: 'English' };
  return `\n[OUTPUT LANGUAGE — highest-priority content rule]\nWrite ALL reader-facing content in ${names[language]}: story title, synopsis, character names and descriptions, scene names, dialogue, narration, choices, ending text, tags, follow-up questions, and suggested answers. This overrides Korean examples or language instructions elsewhere in this request. Include a human-readable character description in the "description" field, separate from "aiPrompt". Keep image-generation aiPrompt fields in English. Preserve JSON keys, character IDs, scene IDs, expression IDs and internal expressionName values (중립, 행복, 슬픔, 화남, 놀람). Keep stage values exactly ki, seung, jeon, gyeol. Do not translate or rename existing identifiers.\n`;
}
