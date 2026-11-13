import type { VisualNovel } from '../types';

export interface WebPackageAsset {
  path: string;
  mime: string;
  bytes: Uint8Array;
}

export interface WebPackageAssetIssue {
  path: string;
  code: 'EXTERNAL_IMAGE' | 'UNRESOLVED_LOCAL_IMAGE' | 'UNSUPPORTED_IMAGE_SOURCE'
    | 'INVALID_DATA_URI' | 'UNSUPPORTED_IMAGE_MIME' | 'IMAGE_MIME_MISMATCH';
}

export class WebPackageAssetError extends Error {
  constructor(readonly issues: WebPackageAssetIssue[]) {
    super('Web ZIP image export blocked: ' + issues.map(issue => `${issue.code} at ${issue.path}`).join('; '));
    this.name = 'WebPackageAssetError';
  }
}

const formats: Record<string, { extension: string; matches: (bytes: Uint8Array) => boolean }> = {
  'image/png': { extension: 'png', matches: b => [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v) },
  'image/jpeg': { extension: 'jpg', matches: b => b[0] === 255 && b[1] === 216 && b[2] === 255 },
  'image/gif': { extension: 'gif', matches: b => /^GIF8[79]a$/.test(String.fromCharCode(...b.slice(0,6))) },
  'image/webp': { extension: 'webp', matches: b => String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP' },
};

function decodeDataUri(source: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/i.exec(source);
  if (!match) throw new Error('INVALID_DATA_URI');
  const mime = match[1].toLowerCase();
  if (!Object.hasOwn(formats, mime)) throw new Error('UNSUPPORTED_IMAGE_MIME');
  let binary = '';
  if (match[2]) {
    const payload = match[3].replace(/[\t\n\r ]/g, '');
    if (!payload || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)) {
      throw new Error('INVALID_DATA_URI');
    }
    binary = atob(payload);
  } else {
    // Percent-encoded raster bytes are not necessarily valid UTF-8 text.
    for (let i = 0; i < match[3].length; i++) {
      const char = match[3][i];
      if (char === '%') {
        const hex = match[3].slice(i+1, i+3);
        if (!/^[\da-f]{2}$/i.test(hex)) throw new Error('INVALID_DATA_URI');
        binary += String.fromCharCode(parseInt(hex, 16));
        i += 2;
      } else {
        if (char.charCodeAt(0) > 127) throw new Error('INVALID_DATA_URI');
        binary += char;
      }
    }
  }
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (!formats[mime].matches(bytes)) throw new Error('IMAGE_MIME_MISMATCH');
  return { mime, bytes };
}

/** One manifest drives both rewritten image references and actual ZIP members.
 * Uploads and IndexedDB project images are inline Data URIs in the current app.
 * Never fetch URLs or invent files for unresolved references. Unsupported images
 * reject the complete export with field locations, without exposing URL values.
 */
export function prepareWebPackageAssets(vn: VisualNovel): { data: VisualNovel; assets: WebPackageAsset[] } {
  const data: VisualNovel = JSON.parse(JSON.stringify(vn));
  const assets: WebPackageAsset[] = [];
  const issues: WebPackageAssetIssue[] = [];
  const paths = new Set<string>();
  const slug = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().slice(0,80) || 'asset';

  function image(source: string, field: string, stem: string): string {
    if (source === '' || source === undefined) return source;
    if (typeof source !== 'string') {
      issues.push({ path: field, code: 'UNSUPPORTED_IMAGE_SOURCE' });
      return '';
    }
    if (!/^data:/i.test(source)) {
      const code = /^(?:https?:)?\/\//i.test(source) ? 'EXTERNAL_IMAGE'
        : /^(?:\.?\.?\/|\/)|^[^:]+$/.test(source) ? 'UNRESOLVED_LOCAL_IMAGE' : 'UNSUPPORTED_IMAGE_SOURCE';
      issues.push({ path: field, code });
      return '';
    }
    try {
      const { mime, bytes } = decodeDataUri(source);
      const extension = formats[mime].extension;
      let path = `${stem}.${extension}`;
      let suffix = 2;
      while (paths.has(path)) path = `${stem}__${suffix++}.${extension}`;
      paths.add(path);
      assets.push({ path, mime, bytes });
      return './' + path;
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      issues.push({ path: field, code: ['INVALID_DATA_URI','UNSUPPORTED_IMAGE_MIME','IMAGE_MIME_MISMATCH'].includes(code)
        ? code as WebPackageAssetIssue['code'] : 'INVALID_DATA_URI' });
      return '';
    }
  }

  data.coverUrl = image(data.coverUrl, '/coverUrl', 'assets/images/cover');
  data.characters.forEach((character, ci) => character.expressions.forEach((expression, ei) => {
    expression.imageUrl = image(expression.imageUrl, `/characters/${ci}/expressions/${ei}/imageUrl`,
      `assets/images/characters/${slug(character.id)}_${slug(expression.id)}`);
  }));
  data.scenes.forEach((scene, si) => {
    scene.backgroundUrl = image(scene.backgroundUrl, `/scenes/${si}/backgroundUrl`, `assets/images/backgrounds/${slug('bg_' + scene.id)}`);
  });
  if (issues.length) throw new WebPackageAssetError(issues);
  return { data, assets };
}
