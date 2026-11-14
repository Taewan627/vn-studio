import React, { useState } from 'react';

/** Private StoryGenerator artwork, not a policy for stored user project images.
 * Each local candidate is tried once per mount. Errors end in CSS, never a URL
 * from a remote placeholder service, and no effect retries an equivalent value.
 */
export function GenreImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const rasterData = /^data:image\/(?:png|jpeg|gif|webp)[;,]/i.test(src);
  const unsupportedScheme = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src) && !rasterData;
  const candidates = !src.trim() || unsupportedScheme ? []
    : /\.jpg$/i.test(src) && !rasterData ? [src, src.slice(0, -4) + '.png', src.slice(0, -4) + '.jpeg'] : [src];
  const current = candidates.find(candidate => !failed.has(candidate));
  if (!current) return <div role="img" aria-label={alt} data-genre-image="placeholder"
    className={`${className} bg-gradient-to-br from-slate-800 via-slate-950 to-indigo-950`} />;
  return <img src={current} alt={alt} className={className} data-genre-image="image"
    onError={() => setFailed(previous => previous.has(current) ? previous : new Set([...previous, current]))} />;
}
