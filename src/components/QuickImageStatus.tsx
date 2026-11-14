import React from 'react';
import type { VisualNovel } from '../types';
import { useLanguage } from '../i18n/LanguageProvider';
import { isImageGenerationEnabled } from '../services/imageGenerationPolicy';

export function QuickImageStatus({ vn, compact = false, showPreviews = true }: { vn: VisualNovel; compact?: boolean; showPreviews?: boolean }) {
  const { t } = useLanguage();
  const enabled = isImageGenerationEnabled();
  if (enabled && !vn.quickImages) return vn.generationSource === 'ai' ? <p role="status" className="text-sm">{t('Images legacy')}</p> : null;
  const items = [
    { id: 'background', name: t('Background image'), status: vn.quickImages?.background, url: vn.coverUrl },
    ...vn.characters.map(c => ({ id: 'character:' + c.id, name: c.name, status: vn.quickImages?.characters[c.id], url: c.expressions[0]?.imageUrl })),
  ];
  return <section data-testid="quick-images" className="rounded-xl bg-slate-900/95 p-3 space-y-2 text-sm text-slate-100" aria-label={t('Quick images')}>
    <p className="font-semibold">{t(enabled ? 'Quick images' : 'Image generation disabled')}</p>
    <div role="status" aria-live="polite" className={compact ? '' : 'flex flex-wrap gap-4'}>{items.map(item => <div key={item.id}>
      <p>{item.name} · {t(!enabled ? item.url ? 'Existing image' : item.status === 'failed' ? 'Previous image generation failed' : 'Images intentionally omitted' : item.status === 'ready' ? 'Image ready' : item.status === 'failed' ? 'Image fallback' : 'Image pending')}</p>
      {!compact && showPreviews && item.url && <img src={item.url} alt={item.name} className="mt-2 h-28 max-w-48 object-contain rounded-lg" />}
    </div>)}</div>
    {!compact && <p className="text-slate-300">{t(enabled ? 'AI image note' : 'Image generation disabled')}</p>}
  </section>;
}
