# VN Studio

VN Studio is a local browser-based editor for creating, editing, saving and exporting branching visual-novel prototypes. It is research software for computational-narrative and interactive-storytelling workflows. Version 1.0.1 is released under the MIT licence; see `LICENSE.txt`. Version 1.0.1 changes only the repository layout of 1.0.0: the application source is under `src/` and the licence file is `LICENSE.txt`; application behaviour and exported files are unchanged. Copyright (c) 2026 Taewan Kim. Third-party works retain their original terms and notices.

## Play the example in a browser

A 2×2 set of controlled variants of the synthetic example (`examples/beacon.json`), each the unmodified offline HTML export of VN Studio 1.0.0 (version 1.0.1 exports byte-identical files), can be played in a web browser without installation: https://huggingface.co/spaces/devmeta/beacon-ledger-variants

## Supported scope

- Import supported VisualNovel JSON with schema and reference checks; imports create a new local project.
- Edit scenes, dialogue, speakers and choices; preserve narrative IDs; guard destructive changes.
- Store projects in browser IndexedDB and reopen them with the same browser profile and origin.
- Keep AI image generation off by default; retain existing supported raster images and manual uploads.
- Export a Web ZIP containing project JSON, executable HTML and supported images, or a self-contained single HTML file.
- Play exported narratives locally and offline, including branches, reconvergence and distinct endings.
- Use the editor interface in English (default), Korean and Japanese.
- Generate an experimental Ren'Py export (script text or ZIP); see the Ren'Py section below.

The application inherits some online features from the parent application: AI image generation (disabled by default and refused by the server) and LLM text generation (works only with a provider API key). These are optional and outside the documented workflow; no key is needed for anything in this README. Other parent-application features (chat, full Quick mode, research collection, surveys, contact tools, guide/PDF generation, hosted deployment and participant studies) are outside the supported workflow. No research-verification algorithm novelty is claimed. The checks reported here are engineering checks, not a user study. No claims of productivity, adoption or general Ren'Py compatibility are made.

## Prerequisites

Use Node.js 22 and npm. The recorded environment for v1.0.1 is Windows 10 Pro 10.0.19045 (x64), Node.js 22.23.4, npm 10.9.9, Microsoft Edge 157.0.4341.46, Google Chrome 157.0.8103.52 and Playwright 1.64.1 (pinned by the lockfile). These are the environment in which the results below were recorded, not a claim that all commands pass in every environment.

A Chromium-based browser must already be installed; the scripts do not download browsers. Set `EDGE_EXECUTABLE` if Edge is outside the two standard Windows installation locations. To run the browser suite with Chrome, set `EDGE_EXECUTABLE` to the Chrome executable and `VN_BROWSER_OUTPUT` to a new directory under the repository root.

No provider credentials are needed for the documented workflow.

## Install, check, build and launch (PowerShell)

From the repository root:

```powershell
# Registry route:
npm ci --no-audit --no-fund
# Alternative with lifecycle scripts disabled:
# npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run build
$env:NODE_ENV = 'production'
npm start
```

Open `http://127.0.0.1:3000`. To use another port, set `$env:PORT` before starting. The production server binds to 127.0.0.1. Stop the terminal process when finished.

The initial install normally obtains the pinned npm packages from your configured registry. Offline installation is a separate case: it requires a previously populated npm cache that contains all needed platform packages. With such a cache, use:

```powershell
npm ci --offline --ignore-scripts --no-audit --no-fund
```

The repository includes neither node_modules nor an npm cache. Offline playback of an export does not show that a first installation on an empty machine needs no package access. If a required native or platform executable is unavailable, report that prerequisite instead of enabling unreviewed install scripts.

## Work through the synthetic example

1. Launch the application and select English if following the labels below.
2. Use the import control to open `examples/beacon.json`; accept the new-project confirmation. The existing project is preserved.
3. Select **Departure** and change its dialogue to `The beacon ledger is open. Edited locally.`
4. Change the destination of **Garden route** from **Garden** to **Bridge**. The destination remains a valid scene.
5. Wait for the IndexedDB save. Close the browser and reopen the same profile at the same origin/port to verify the saved edits. IndexedDB is specific to that browser profile and origin.
6. Under **Export game**, download **Export web package** and **Save as single HTML**.
7. Extract the ZIP without changing its relative asset layout. Open its `index.html`, or open the single HTML directly. Playback uses local bundled assets and does not require the authoring server.
8. Follow Garden route, Continue to the workshop, Review the signals, Blue beacon. Then restart and follow Tower route, Reach the bridge, Continue to the workshop, Review the signals, Amber beacon.

The original example has eight scenes, two synthetic characters, two entry branches, a reconvergence and two endings. After the instructed edit, Garden route goes directly to Bridge. `examples/expected.json` documents the expected saved changes and ending paths. All PNG content is synthetic and stored as Data URIs. The images were rendered from SVG source written for this example with the help of Claude (Anthropic); no image-generation model, stock images, real people or contact data were used.

## Automated verification

```powershell
npm test
npm run test:example
npm run test:browser
```

`npm test` sequentially runs the deterministic regression suites, including a real Edge component suite. `npm run test:example` checks the actual validator and HTML exporter. `npm run test:browser` launches the built production application with a fresh persistent browser profile, imports and edits the sample, closes and reopens the browser, checks IndexedDB, downloads and reopens the ZIP, and executes both generated HTML forms offline to both endings. It uses real browser interactions and read-only state observations, without application or API mocks and without pre-seeded IndexedDB.

Run `npm run build` before `npm run test:browser`. Tests create ignored artifacts under `.local-validation/` by default. The optional variables `VN_TEST_OUTPUT`, `VN_EXAMPLE_OUTPUT` and `VN_BROWSER_OUTPUT` can point to separate writable directories; keep outputs under the repository root so that module resolution works. `npm run test:browser` expects an empty output directory: before running it again in the same copy, delete `.local-validation/browser` or set `VN_BROWSER_OUTPUT` to a new directory.

Recorded results for v1.0.1 in the environment above:

| Command | Result |
|---|---|
| `npm test` | 151 tests, 948 assertions |
| `npm run test:example` | 1 test, 8 assertions |
| `npm run test:browser` | 16 tests, 172 assertions, in Edge and in Chrome |

These are engineering checks, not a user study. A local rerun is not an independent replication.

## Ren'Py export (experimental)

The Ren'Py export is experimental. Evidence so far:

- 20 static tests cover the generated script and ZIP.
- The example export was accepted by Ren'Py 8.5.3 lint without errors (one advisory note) in a minimal project containing only the generated script and images.
- One manual launch reached an ending.

Known limits: Korean text shows missing glyphs because the exporter sets no font and Ren'Py's default font lacks Hangul. In a minimal project, closing the window at a menu raises an exception because such a project lacks the standard screens of a launcher-created project. Copy the export into a project created by the Ren'Py launcher. General Ren'Py compatibility is not claimed.

## Limits and dependency notices

Blank scene.stage legacy imports are rejected without inventing stages. Draft editing and completed JSON import have different contracts. Supported export images include PNG/JPEG/GIF/WebP Data URIs, including supported images retained from manual upload. Unresolved blob/IndexedDB pseudo-URLs, external URLs and unsupported MIME types are explicitly rejected by export instead of being downloaded or referenced as missing files.

Custom font binaries are not included; the editor and the exported player use system fonts. The default starter's external image references have been replaced by synthetic local rasters; its narrative and IDs remain intact. Large-bundle and browser-externalisation build warnings may remain. These checks do not constitute a security certification or a vulnerability-advisory audit.

The lockfile retains existing unused and optional dependencies to avoid unverified dependency changes. See `NOTICE` and `docs/dependencies.md` for third-party obligations. In particular, JSZip has alternative licence terms and sharp/native components have distinct terms; do not assume every package is MIT. Included icon geometry is from Heroicons v2.2.0 with the upstream MIT notice; dependency terms are not replaced by the application licence.

## Licence

The first-party licence is MIT, Copyright (c) 2026 Taewan Kim; see `LICENSE.txt`, `THIRD_PARTY_NOTICES.md` and `docs/license-scope.md`.

## Citation

Citation metadata is in `CITATION.cff`; see also `docs/citation.md`. All versions are archived on Zenodo: https://doi.org/10.5281/zenodo.24201795 (version 1.0.0: https://doi.org/10.5281/zenodo.24201796).
