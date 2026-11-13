# Third-party notices

First-party software is MIT with Copyright (c) 2026 Taewan Kim. This notice does not alter the original third-party copyrights or terms. Third-party works retain their original copyright and license terms.

## Included third-party code

`components/icons.tsx` contains SVG geometry from the official Heroicons v2.2.0 optimized 24/outline files, Copyright (c) Tailwind Labs, Inc., under MIT. Original permission/copyright text is in `THIRD_PARTY_LICENSES/Heroicons-MIT.txt`. Attribute casing, wrapper props and JSX formatting were adapted. The previously unmapped icon paths were replaced, including the three inline navigation/download glyphs in ImagePreviewModal. Their underlying button handlers and image behavior are preserved. `docs/icon-sources.json` maps every exported icon to its upstream source and SHA-256.

## npm dependencies and generated bundles

The repository contains no node_modules, native binaries or compiled application bundles. npm installs dependencies under their own terms. Their package metadata is not relicensed as first-party MIT. The pinned lockfile remains authoritative for versions.

| Component | Terms | Notice supplied |
|---|---|---|
| React / React DOM / scheduler | MIT, original upstream copyrights | React package license texts in THIRD_PARTY_LICENSES |
| JSZip 3.10.2 | MIT option selected from the upstream MIT OR GPL alternative | JSZip-MIT.txt, original authors preserved |
| JSZip-related pako / lie / readable-stream / setimmediate | MIT, separate upstream copyright texts | Corresponding MIT texts; these are not proof of the exact version of every member embedded in JSZip's prebuilt dist |
| Heroicons v2.2.0 | MIT, Tailwind Labs, Inc. | Heroicons-MIT.txt and exact SVG mapping |

A locally generated validation bundle may include additional bundled code. This source repository does not distribute node_modules, native executables, the npm cache or build artifacts. In particular sharp's Apache-2.0 wrapper and native components' Apache/LGPL conditions are distinct. No sharp/native binary is included here. A future binary distribution requires its own exact component/notice/source/linking closure. The full 985-instance audit register is not shipped in this repository. This notice is not a statement that all packages are MIT or that all future binary redistribution obligations have been completed.

No font binaries or stock photographs are included. Previous NanumGothic OFL findings are unchanged; these fonts are not classified as noncommercial-only. Synthetic raster examples contain no personal metadata.
