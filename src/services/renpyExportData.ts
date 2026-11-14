import type { VisualNovel } from '../types';
import { validateVisualNovel } from './validateVisualNovel';
import { prepareWebPackageAssets, WebPackageAssetError } from './webPackageAssets';

// Ren'Py export preparation only. Reuse the unchanged P01 validator and P02
// inline raster policy; never fetch images or mutate the source project.
const reserved = new Set(('start after_load splashscreen before_main_menu main_menu quit after_warp '
  + 'false none true and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield '
  + 'renpy character persistent config gui narrator adv nvl menu label jump call scene show hide image define default python init screen transform style pause voice play stop window centered').split(' '));
function alias(id: string, fallback: string, used: Set<string>): string {
  const candidate = id.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().slice(0,80);
  let result = /^[a-z][a-z0-9_]*$/.test(candidate) && !reserved.has(candidate) && !used.has(candidate) ? candidate : fallback;
  while (used.has(result) || reserved.has(result)) result += '_';
  used.add(result);
  return result;
}

/** Plain VN text: escape Ren'Py interpolation/tags before quoting the literal.
 * This deliberately does not support authored Ren'Py text tags or expressions.
 */
export function quoteRenpyText(text: string): string {
  return JSON.stringify(text.replace(/\[/g, '[[').replace(/\{/g, '{{'))
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function prepareRenpyExportData(vn: VisualNovel) {
  const validation = validateVisualNovel(vn);
  if (!validation.valid) throw new Error('Ren\'Py export blocked: ' + validation.errors.map(error => `${error.code} at ${error.path || '/'}`).join('; '));
  let prepared: ReturnType<typeof prepareWebPackageAssets>;
  try {
    // The existing Ren'Py player has no cover screen; do not package unused cover.
    prepared = prepareWebPackageAssets({ ...vn, coverUrl: '' });
  } catch (error) {
    if (error instanceof WebPackageAssetError) throw new Error('Ren\'Py image export blocked: ' + error.issues.map(issue => `${issue.code} at ${issue.path}`).join('; '));
    throw error;
  }
  const labels = new Set(['start']);
  const imageTags = new Set<string>();
  const characters = vn.characters.map((character, index) => {
    const name = alias(character.id, `vn_character_${index}`, imageTags);
    const expressions = new Set<string>();
    return { id: character.id, variable: name, imageTag: name,
      expressions: character.expressions.map((expression, ei) => ({ id: expression.id,
        attribute: alias(expression.id, `vn_expression_${ei}`, expressions),
        path: prepared.data.characters[index].expressions[ei].imageUrl?.replace(/^\.\/assets\//, '') || '',
      })),
    };
  });
  const scenes = vn.scenes.map((scene, index) => ({ id: scene.id,
    label: alias(scene.id, `vn_scene_${index}`, labels),
    imageTag: alias('bg_' + scene.id, `vn_background_${index}`, imageTags),
    path: prepared.data.scenes[index].backgroundUrl?.replace(/^\.\/assets\//, '') || '',
    choiceTargets: scene.choices.map(choice => choice.nextSceneId),
  }));
  return { characters, scenes,
    assets: prepared.assets.map(asset => ({ ...asset, path: asset.path.replace(/^assets\//, '') })),
    idMap: { version: 1, startSceneId: vn.startSceneId, characters, scenes },
  };
}
