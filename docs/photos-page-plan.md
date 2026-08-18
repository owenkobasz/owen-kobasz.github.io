# Plan: Photo Albums Page

*Companion to `codebase-report.md`. Decisions confirmed 2026-07-21: photos live in-repo and are resized at build time; structure is an album index (`/photos`) + per-album pages (`/photos/<album>/`); albums render as a justified grid with a click-to-open lightbox; albums are authored as a folder of images + a small metadata file. Revised 2026-07-21 after a critical review pass — see inline notes.*

## Design principle

Mirror the blog exactly. The blog already established the pattern for a non-webpack static section: a Node build script, `{{placeholder}}` HTML templates, its own Sass bundle, shared chrome (pre-paint theme script, fixed nav with hamburger overlay, footer), and registration in the sitemap. The photos section copies that shape so the codebase stays one coherent system.

**Canonical build order (settled here, referenced throughout):**

```
webpack → build:photos → build:blog
```

Webpack must run first because its `clean: true` wipes `dist/`. Photos must run **before** blog because the blog script owns `sitemap.xml` and reads the photo URL manifest (see §Sitemap). `package.json`:

```json
"build": "webpack --config webpack.prod.js --mode production && npm run build:photos && npm run build:blog"
```

## Authoring model

```
src/photos/
  albums/
    <album-slug>/          # folder name IS the URL slug — must be kebab-case
      album.md             # metadata (gray-matter frontmatter, like blog posts)
      DSC01234.jpg
      DSC01267.jpg
      ...
  templates/
    index.html
    album.html
```

`album.md` frontmatter:

```yaml
---
title: "Desert Rides"
date: 2026-03-14                       # required — albums sort by it
description: "A weekend in the Anza-Borrego backcountry."
cover: DSC01267.jpg                    # optional; defaults to the first image in display order
order: [DSC01267.jpg, DSC01234.jpg]    # optional; listed files come first, all
                                       # remaining images follow in filename sort
draft: false
---
```

Rules the build script enforces (all skip-and-warn, never crash — lesson learned from the blog build's frontmatter crash):

- Album folder without `album.md`, or with unparseable frontmatter, or missing `title`/valid `date` → **skipped with a console warning**.
- Album with zero usable images → skipped with a warning.
- `cover`/`order` entries referencing files that don't exist → warn and fall back (cover → first image; unknown order entries ignored).
- Folder names are validated as URL-safe (`[a-z0-9-]`); anything else is skipped with a warning telling you to rename.

**Accepted inputs / output policy:** `.jpg`, `.jpeg`, `.png` (case-insensitive) are processed; anything else in the folder (`.heic`, `.mov`, `.DS_Store`, …) is ignored with a warning. All outputs are JPEG — PNGs are converted (fine for photographs; the gallery is not for transparency-dependent graphics).

**Output filenames are sanitized**, not passed through: `IMG 0042 (edit).JPG` → `img-0042-edit-thumb.jpg`. This avoids repeating the spaces-in-URL problem the PKM post had. If two source files sanitize to the same name, the collision gets a numeric suffix (`-2`), applied deterministically in display order. The source-name → output-name mapping is recomputed from the album's file list on every build (it's deterministic, so it needs no persistence), and `cover:`/`order:` always use the **original** filenames the author sees in Finder.

## Build pipeline

**New script: `scripts/build-photos.js`** (`npm run build:photos`). Same internal structure as `build-blog.js`: config block → helpers → load albums → render templates → emit.

**New dependency: `sharp`** (in `devDependencies`; CI's `npm ci` installs those, same as every other build tool in this repo).

Per image, the script generates:

- `<name>-thumb.jpg` — max **1000 px** long edge, quality ~78, for the grid. (Reviewed up from an initial 640 px: album pages use a ~120rem container — wider than the blog's 72rem — so grid cells can render ~450–500 CSS px wide, and retina displays need ~2× that.)
- `<name>-large.jpg` — max 2000 px long edge, quality ~82, for the lightbox.

Both resizes use sharp's `withoutEnlargement` — a source smaller than the target is re-encoded at its native size, never upscaled. The dimensions recorded for the HTML are the source's post-rotation dimensions; only the aspect ratio matters to the layout, so this is correct even when an output is smaller than its nominal target.

**EXIF orientation — must be handled explicitly.** Phone/camera JPEGs are frequently stored rotated with an EXIF orientation flag. Two consequences:

1. Every sharp pipeline starts with `.rotate()` (no args = auto-orient from EXIF) so outputs are physically upright.
2. Aspect ratios embedded in the HTML must be the **post-rotation** dimensions: when `sharp.metadata()` reports `orientation` 5–8, width and height are swapped before computing the ratio. Skipping this renders sideways-shot portraits as wrong-shaped grid cells.

Sharp's resize output **strips all metadata by default — this is deliberate and desirable**: EXIF GPS coordinates (home location, etc.) never reach the public site.

### Caching

Resizing is the slow step and must not rerun for unchanged photos — locally or in CI.

The cache lives in **`.photos-cache/`** at the repo root (added to `.gitignore`). Layout:

```
.photos-cache/
  manifest.json                 # cache index
  urls.json                     # sitemap handoff (see §Sitemap)
  <album-slug>/<name>-thumb.jpg # generated outputs, mirrored per album
  <album-slug>/<name>-large.jpg
```

`manifest.json` is keyed by **`<album-slug>/<source-filename>`**, each entry storing `{hash, outputs: [thumb, large], width, height}` where `hash` is the sha1 of the source bytes and width/height are post-rotation. Per image on each run: hash the source → if a manifest entry exists for this key **and** its stored hash matches, reuse the cached outputs and dimensions; otherwise run sharp and rewrite the entry.

> Reviewed twice: (a) an early draft used mtime comparison — **broken in CI** because `git checkout` gives every source file a fresh mtime, so the cache would never hit. (b) The next draft keyed the manifest by hash alone — broken when the **same photo appears in two albums** (or twice in one): both occurrences would share one entry pointing at a single album's output paths, and pruning would conflate them. Keying by album+filename with the hash inside the entry handles editing, renaming, moving, and duplicating photos correctly.

After processing, the script **prunes orphans**: manifest entries whose `<album>/<filename>` key no longer matches any current source file are deleted along with their generated files, so renamed/removed photos don't accumulate stale outputs or ship deleted images.

Final step copies the album subdirectories (JPEGs only — never `manifest.json`/`urls.json`) into `dist/photos/images/<album>/`. Nothing internal is written under `dist/`.

**CI:** an `actions/cache` step in `deploy.yml` caches `.photos-cache/`, keyed `photos-${{ hashFiles('src/photos/albums/**') }}` with a `photos-` restore-key so adding one photo reuses everything else. Restore happens before `npm run build`; since the cache dir is outside `dist/`, webpack's clean never touches it. This step is an optimization — cold builds are correct, just slower.

Note on webpack's `ImageMinimizerPlugin`: it only touches webpack-bundled assets, not `dist/photos/`, so there is no double-compression concern.

## Pages & templates

**Templates in `src/photos/templates/`** (same `{{placeholder}}` convention):

1. `index.html` → `dist/photos/index.html` — the `/photos` page. Header block ("Photos" title + short description), then album cover cards visually consistent with `.post-card` (cover thumb, title, date, description). Sorted by date descending (date is required, so the sort is total).
2. `album.html` → `dist/photos/<slug>/index.html` — one album. Back link ("← All albums"), title, date, description, the justified grid, and the lightbox markup.

Both include the exact chrome from the blog templates: pre-paint theme script, `blog-nav` header (theme toggle + hamburger), nav overlay (with a new **Photos** link, `--active` on photos pages), footer, the `{{analytics_snippet}}` placeholder, and the same inline nav/theme scripts. Canonical URLs use `SITE_URL`; **OG/Twitter image tags must be absolute** (`${SITE_URL}/photos/images/...` — the blog's `og_image_tag` handling already does this and is the model). Album pages use the cover's `-large` variant for OG; the index uses the newest album's cover.

Album cards on the index use the cover's `-thumb` (1000 px — comfortably above the card's rendered size).

**Zero-albums edge case:** if every album is a draft (or none exist yet), `/photos` still builds — empty listing with a short placeholder line ("Albums coming soon."), OG image tags omitted (mirroring how the blog handles posts without an `image:`). The build must not crash or emit a dead nav link.

## Justified grid

No library, no JS. The mechanism (stated precisely, since it's the heart of the layout):

Each item carries three inline values derived from its post-rotation aspect ratio `r = w/h`:

```html
<a class="photo-grid__item" style="aspect-ratio: 3 / 2; flex-grow: 150; flex-basis: 39rem" href="...-large.jpg">
  <img src="...-thumb.jpg" width="1000" height="667" loading="lazy" alt="" />
</a>
```

- `flex-basis = r × targetRowHeight` (targetRowHeight ≈ 26rem) and `flex-grow = r × 100`. Because **both** grow and basis are proportional to `r`, every item in a wrapped row ends up with width ∝ its ratio, hence height = width / r is **equal across the row** — a true justified layout with zero cropping.
- **Last-row fix** (reviewed in — without it, a one-photo final row stretches to a giant full-width image): the grid gets a terminal spacer, `.photo-grid::after { content: ''; flex-grow: 999999; }`, which absorbs the leftover space so last-row items stay near target height.
- `width`/`height` attributes + `aspect-ratio` prevent CLS; `loading="lazy"` on all thumbs.
- `alt` is empty by design — the no-captions decision means there is no per-photo text anywhere; decorative-image semantics are correct here.
- Under ~600 px: single column, full-width, ratios preserved (`flex-basis: 100%`).

## Lightbox

One small vanilla script, inlined in `album.html` (matching how the blog inlines its nav/theme JS — no webpack involvement). Behavior spec:

- Click a grid item → full-screen overlay showing that photo's `-large` image; dark scrim via the `rgba(var(--color-background-rgb), …)` token pattern, `backdrop-filter: blur` like the nav overlay.
- Prev/next arrows + keyboard ←/→ (wrapping at the ends), Esc and scrim-click to close.
- While open: body scroll locked (`document.body.style.overflow = 'hidden'` — same technique as the nav overlay), `role="dialog" aria-modal="true"` on the overlay, and focus moves into it, returning to the originating grid item on close.
- Adjacent images preloaded via `new Image()` when the current one is shown.
- Progressive enhancement: grid anchors point at the `-large` files, the script `preventDefault`s — with JS disabled a click still opens the photo directly.
- The photo data (list of large URLs in display order) is read from the grid DOM itself — no separate JSON blob to keep in sync.

Optional flourish (cheap, on-brand): reuse the dormant rangefinder corner marks from the hero as the lightbox frame styling.

## Styles

**New Sass bundle `src/sass/photos-bundle.scss`** → compiled by `build-photos.js` to `dist/photos.css` (identical to how `build-blog.js` emits `blog.css`):

```scss
@import 'base';        // fonts, tokens, reset — theme comes free
@import 'animations';
@import 'footer';
@import 'blog';        // reuses blog-nav, overlay, theme toggle, card styles
@import 'photos';      // new: _photos.scss — album cards, justified grid, lightbox
```

Importing `_blog.scss` wholesale ships some unused listing CSS to photos pages; that's the same tradeoff the blog bundle already makes with `_footer.scss` etc., and it keeps the nav/toggle styles single-sourced. New partial `src/sass/_photos.scss` follows the BEM conventions (`.photo-grid__item`, `.lightbox--open`), rem sizing, and color tokens. The album page container is `max-width: 120rem` (wider than the blog's 72rem reading column — grids want width; thumbnail sizing above assumes this).

## Shared build helpers

Reviewed in — running photos **before** blog exposed a hidden dependency: the chrome icons (`/assets/menu.svg`, `home.svg`, favicon, social logos) are copied by `build-blog.js`'s `copyStaticAssets()`, so `build:photos` alone would produce pages with broken icon references.

Fix: extract the genuinely shared helpers into **`scripts/lib/shared.js`** — `copyStaticAssets()`, `formatDate()`/`toISODate()`, `escapeXml()`, `analyticsSnippet()`, and the SCSS-compile helper — and have both build scripts import them. Both scripts stay independently runnable in any order; copy-if-missing semantics make the double call idempotent. (Deduplicating the *HTML chrome* across templates is a separate, larger refactor and stays out of scope.)

## Sitemap

`build-photos.js` writes the photo URL list (`/photos` + each `/photos/<slug>` with the album date as lastmod) into `.photos-cache/urls.json` — **not** into `dist/`, so internal build artifacts never deploy. `buildSitemap()` in `build-blog.js` reads that file if present and merges the entries (priority 0.8 for `/photos`, 0.6 for albums, matching the blog's weights). Because the canonical build order runs photos first, the sitemap is always complete; if the blog script runs standalone, it emits the blog-only sitemap and warns that photo URLs were absent.

Albums are deliberately **not** added to the RSS feed — it's a blog feed.

## Integration edits (the "everything else")

1. **Nav links** — add Photos to: the main page `.navigation` in `src/template.html`, and the overlay `<ul>` in `src/blog/templates/index.html` + `post.html`. With the two new photos templates, five files now carry copy-pasted chrome; consolidation is a worthwhile follow-up, not part of this change. The main page's IntersectionObserver nav highlighting is anchor-based and needs no change — Photos, like Blog, is a plain link.
2. **Dev server** — add static mounts in `server.js` mirroring the blog ones: `/photos` → `dist/photos`, `/photos.css` → `dist/photos.css`. (webpack-dev-server also serves `./dist` statically, so `/photos` previews on the webpack port too, exactly like `/blog` today.)
3. **npm scripts** — `build` (new order, see §Design principle), `build:photos`, `watch:photos` (nodemon on `src/photos` **and `src/sass`** — grid/lightbox style tweaks live there — `--ext md,html,jpg,jpeg,png,scss`).
4. **`.gitignore`** — add `.photos-cache/`.
5. **CI** — the `actions/cache` step (§Caching). Optional at first; correctness never depends on it.
6. **README** — document the album authoring workflow (folder, frontmatter, formats, kebab-case rule).

## Pre-existing blocker — ✅ resolved

~~The frontmatter-less PKM post crashes `npm run build`.~~ Fixed 2026-07-21: the post gained frontmatter, a kebab-case filename, and now lives in `src/blog/drafts/` with `draft: true`. Still worthwhile as part of this work: harden `loadPosts()`/`buildPosts()` in `build-blog.js` to skip-and-warn on missing/invalid frontmatter (the photos script is specced with that behavior from day one; the blog script should match).

## Implementation order

1. Extract `scripts/lib/shared.js`; refit `build-blog.js` to use it; harden its frontmatter handling. Verify blog output is byte-identical (minus hardening warnings).
2. `scripts/build-photos.js` core: album discovery + validation, sharp resize with `.rotate()`, content-hash cache + orphan pruning, filename sanitization, dimension extraction.
3. Templates + `_photos.scss` + `photos-bundle.scss`; build index + album pages with the justified grid.
4. Lightbox script.
5. Integration: nav links, sitemap merge, server mounts, npm scripts, `.gitignore`.
6. Seed one real album (include at least one EXIF-rotated portrait shot and one PNG to exercise the edge cases); run full `npm run build`; verify locally via `npm run dev`; re-run to confirm the cache hits.
7. CI cache step; deploy.

Estimated new code: ~350 lines of Node (script + shared-lib extraction), ~250 lines of SCSS, ~100 lines of lightbox JS, two templates.

## Todo list

### Phase 1 — Shared build helpers + blog hardening ✅

- [x] 1.1 Create `scripts/lib/shared.js` exporting only what both scripts use: `copyStaticAssets(distDir)` (copy-if-missing semantics, current asset list from `build-blog.js`), `formatDate()`, `toISODate()`, `escapeXml()`, `analyticsSnippet()`, and `compileSCSS(entryPath, outPath)`. Blog-only helpers (`estimateReadingTime()`, markdown setup) stay in `build-blog.js`.
- [x] 1.2 Refit `scripts/build-blog.js` to import those helpers; delete the now-duplicated local definitions. No behavior change intended.
- [x] 1.3 Harden `loadPosts()` in `build-blog.js`: posts with missing/unparseable frontmatter, missing `title`, or invalid `date` (`isNaN(new Date(d))`) are skipped with a `console.warn` naming the file and the problem — never crash.
- [x] 1.4 Verify: run `npm run build:blog` before and after the refactor and diff `dist/blog/` — output identical. Drop a deliberately broken `.md` into `posts/`, confirm warn-and-skip, remove it.

### Phase 2 — `build-photos.js` core ✅

- [x] 2.1 `npm install --save-dev sharp`.
- [x] 2.2 Create `scripts/build-photos.js` skeleton mirroring `build-blog.js` (config block, `SITE_URL`/analytics env, main()).
- [x] 2.3 Album discovery: scan `src/photos/albums/*/`, parse `album.md` with gray-matter. Implement every skip-and-warn rule from §Authoring model (no `album.md`, bad frontmatter, missing `title`/valid `date`, non-kebab-case folder name, `draft: true`, zero usable images).
- [x] 2.4 Image enumeration: accept `.jpg`/`.jpeg`/`.png` case-insensitively; warn-and-ignore everything else. Apply `order:` semantics (listed first, validated against real files; remainder filename-sorted). Resolve `cover:` with fallback to first image in display order.
- [x] 2.5 Output-filename sanitizer: lowercase, non-alphanumerics → `-`, collapse/trim dashes, strip extension → `<base>-thumb.jpg` / `<base>-large.jpg`; deterministic `-2`, `-3` suffixes on collision (in display order). Keep original→sanitized mapping in memory per album.
- [x] 2.6 Content-hash cache: sha1 each source file; `.photos-cache/manifest.json` keyed by `<album-slug>/<source-filename>` → `{hash, outputs, width, height}`. Hit requires the key to exist **and** stored hash to match; otherwise process with sharp and rewrite the entry.
- [x] 2.7 Sharp pipeline per image: `.rotate()` (EXIF auto-orient) → resize to 1000px long edge (q78, `withoutEnlargement`) and 2000px long edge (q82) → JPEG out to `.photos-cache/`. Record **post-rotation** dimensions (swap width/height when `metadata().orientation` ∈ 5–8, or read dimensions from the generated output, which is simpler and always correct).
- [x] 2.8 Orphan pruning: after processing, delete manifest entries + generated files whose `<album>/<filename>` key matches no current source file.
- [x] 2.9 Copy generated album subdirectories (JPEGs only — never `manifest.json`/`urls.json`) `.photos-cache/<album>/` → `dist/photos/images/<album>/`; call shared `copyStaticAssets()`.
- [x] 2.10 Write `.photos-cache/urls.json`: `[{loc, lastmod, priority}]` for `/photos` (0.8) and each `/photos/<slug>` (0.6, lastmod = album date).
- [x] 2.11 Add `.photos-cache/` to `.gitignore`.
- [x] 2.12 Verify with two throwaway test albums (EXIF-rotated portrait, a PNG, a filename with spaces, an ignored `.txt`, and the same photo file present in both albums): run twice — second run is near-instant (all cache hits); the duplicated photo gets outputs in both album folders; delete a photo → orphan pruned; check output dimensions/orientation by eye.

### Phase 3 — Templates, styles, pages ✅

- [x] 3.1 Create `src/photos/templates/index.html`: chrome copied from `src/blog/templates/index.html` (pre-paint theme script, favicon link, blog-nav header, nav overlay with Photos link marked `--active`, footer, inline nav/theme scripts, `{{analytics_snippet}}`), `<link rel="stylesheet" href="/photos.css">`, header block, `{{albums_html}}`, meta/OG/canonical placeholders (OG image absolute via `SITE_URL`).
- [x] 3.2 Create `src/photos/templates/album.html`: same chrome, back link, `{{title}}`/`{{date_formatted}}`/`{{description}}`, `{{grid_html}}`, lightbox markup (overlay, image element, prev/next/close buttons), OG tags using cover `-large`.
- [x] 3.3 In `build-photos.js`: render album cards (cover `-thumb`, title, date, description; sorted date-desc) → `dist/photos/index.html`, with the zero-albums empty state ("Albums coming soon.", OG image omitted); render per-album grid items (`aspect-ratio`, `flex-grow: r×100`, `flex-basis: r×26rem` inline; `width`/`height` attrs; `loading="lazy"`; empty `alt`; anchor → `-large`) → `dist/photos/<slug>/index.html`.
- [x] 3.4 Create `src/sass/_photos.scss`: album-card tweaks, `.photo-grid` (flex wrap, gap, `::after` spacer with `flex-grow: 999999`), `.photo-grid__item`, 120rem container, <600px single-column fallback, lightbox styles (scrim with `--color-background-rgb`, arrows, close, `--open` state). Optional: rangefinder-corner frame.
- [x] 3.5 Create `src/sass/photos-bundle.scss` (`base`, `animations`, `footer`, `blog`, `photos`); compile via shared `compileSCSS()` → `dist/photos.css`.
- [x] 3.6 Verify both pages in dev: theme toggle + no-flash pre-paint, hamburger overlay, justified rows with equal heights, last row not stretched, no CLS on load, dark and light mode. *(Verified via HTTP serve + markup/CSS inspection; a visual pass in a real browser is still recommended.)*

### Phase 4 — Lightbox ✅

- [x] 4.1 Inline script in `album.html`: collect large-URLs from grid anchors in DOM order; open on click (`preventDefault`); render current image.
- [x] 4.2 Navigation: prev/next buttons, ←/→ with wrap-around, Esc + scrim-click close.
- [x] 4.3 Accessibility/behavior: `role="dialog" aria-modal="true"`, focus into overlay on open and back to originating item on close, body scroll lock on open/unlock on close.
- [x] 4.4 Preload adjacent large images on show (`new Image()`).
- [x] 4.5 Verify: keyboard-only walkthrough; JS-disabled click opens the raw image; mobile tap targets. *(Script parse-checked and JS-disabled path holds by construction — anchors point at the large JPEGs; keyboard/tap verification in a real browser is still recommended.)*

### Phase 5 — Integration ✅

- [x] 5.1 Add Photos nav link: `src/template.html` `.navigation` (after Blog), overlay `<ul>` in `src/blog/templates/index.html` and `post.html`.
- [x] 5.2 Sitemap merge in `build-blog.js` `buildSitemap()`: read `.photos-cache/urls.json` if present, merge entries; warn if absent.
- [x] 5.3 `server.js`: static mounts `/photos` → `dist/photos`, `/photos.css` → `dist/photos.css`.
- [x] 5.4 `package.json`: `build:photos`; `build` = webpack → `build:photos` → `build:blog`; `watch:photos` (nodemon, `--watch src/photos --watch src/sass --ext md,html,jpg,jpeg,png,scss`).
- [x] 5.5 README: album authoring workflow (folder = slug, frontmatter fields, formats, kebab-case rule, draft flag).

### Phase 6 — End-to-end verification ✅

- [x] 6.1 Replace the test album with at least one real album. *(Seeded `sample-album` from photos already in the repo (`about.jpg`, `old_about.jpg`, `spindle.jpg`) as a working placeholder — swap in a real photo set before deploying, or set `draft: true` to ship the empty state.)*
- [x] 6.2 Full `npm run build` from clean `dist/`; inspect `dist/photos/**`, `dist/photos.css`, `dist/sitemap.xml` (photos URLs present), `dist/blog/**` untouched in behavior.
- [x] 6.3 Immediate rebuild → confirm cache hits (near-instant photo step).
- [x] 6.4 `npm run dev`: click through home → Photos → album → lightbox → back; nav links from blog pages; both themes; mobile viewport. *(All routes verified 200 over a static HTTP serve of `dist/`; interactive click-through in a browser is still recommended.)*
- [x] 6.5 Sanity-check total `dist/` size stays well under GitHub Pages' 1 GB limit.

### Phase 7 — CI + deploy ⏳ (7.1 done; 7.2–7.3 await push)

- [x] 7.1 `deploy.yml`: `actions/cache` on `.photos-cache/`, key `photos-${{ hashFiles('src/photos/albums/**') }}`, restore-key `photos-`, inserted in the `build` job **before** the "Build" step (after checkout/setup-node).
- [ ] 7.2 Push to `main`; watch the Actions run; confirm the deployed site serves `/photos`, `/photos/<slug>`, sitemap includes them, and images are upright. *(Blocked on a commit/push, which needs the go-ahead — nothing has been committed.)*
- [ ] 7.3 Push a trivial commit; confirm the CI cache hits and the photo step is fast. *(Same — pending deploy.)*
