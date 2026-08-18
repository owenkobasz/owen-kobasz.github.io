# Portfolio Codebase Report

*Written 2026-07-21 after a full read-through of the repository.*

## 1. What this is

A personal portfolio site for Owen Kobasz, live at **owenkobasz.com**. The stack is deliberately simple: vanilla JavaScript, Webpack 5, and Sass — no framework. The repo is `owenkobasz/owen-kobasz.github.io` and the site deploys to **GitHub Pages** via a GitHub Actions workflow (`.github/workflows/deploy.yml`) that runs `npm run build` on every push to `main` and publishes the `dist/` folder. The `CNAME` file (copied into `dist/` by webpack) binds the custom domain.

The site has two logical halves, built by **two completely separate build systems**:

| Half | Source | Build tool | Output |
|---|---|---|---|
| Main single-page site (`/`) | `src/template.html`, `src/index.js`, `src/sass/main.scss` | Webpack 5 | `dist/index.html`, `main.[hash].js/css` |
| Blog (`/blog`) | `src/blog/posts/*.md`, `src/blog/templates/*.html`, `src/sass/blog-bundle.scss` | Custom Node script `scripts/build-blog.js` | `dist/blog/**`, `dist/blog.css`, `dist/sitemap.xml` |

`npm run build` runs webpack first, then the blog script (`build:blog`). Webpack's `clean: true` wipes `dist/` on each build, so the blog script must always run after webpack.

## 2. The main page (webpack half)

- **Single entry point** `src/index.js` imports `sass/main.scss` plus all images/fonts/PDF so webpack fingerprints them (`main.[contenthash].js`, `imgs/`, `fonts/`, `files/`).
- `HtmlWebpackPlugin` processes `src/template.html`; **`html-loader` rewrites every static `src="./assets/..."` reference** into hashed asset URLs. This means images referenced in the HTML are bundled automatically — the many `document.querySelector(...).src = importedImg` assignments in `index.js` are mostly redundant legacy (e.g. the Cleo project image has no JS assignment and still works fine via html-loader).
- `ImageMinimizerPlugin` recompresses JPEG (mozjpeg q72) and PNG (pngquant) at build time.
- `CopyWebpackPlugin` copies: `CNAME`, favicon to `assets/fav.png`, `menu.svg`, and `src/assets/blog` (a directory that **does not exist** — harmless due to `noErrorOnMissing`).
- Page sections are anchors on one page: `#header` (hero), `#about`, `#projects`, `#contact`, plus footer. The nav bar (`.navigation-bar`) highlights items via `IntersectionObserver`, and has a fifth item linking to `/blog`.

### Hero: Met Museum artwork loader
The most intricate feature, all in `src/index.js` (~300 lines):
- Default hero is a bundled AI-reinterpreted *Annunciation* image; a background fetch immediately tries to replace it with a random Met Open Access painting.
- Search IDs cached in `sessionStorage` for 30 min; the chosen artwork cached per-session; a "Load random artwork" button forces a refetch with `AbortController` cancellation.
- 20 candidate objects are fetched in parallel; each image's dimensions are sniffed by fetching only the **first 64 KB via a Range request and parsing JPEG SOF markers** to pick landscape images on desktop / portrait on mobile.
- Preview image swaps to full resolution silently once loaded. An attribution panel (`#met-attr`) doubles as a progress bar during loading.
- On localhost the calls go through `/api/met/*` (Express proxy, avoids CORS in dev); in production they hit the Met API directly.

### Other main-page features
- **Typed.js** cycling subtitle in the hero.
- **Skills grid** with per-skill brand colors: `skillColors` map in `index.js` paints gradient borders and recolors SVG icons via a computed CSS `filter` chain (`rgbToCssFilter`). Colors reapply on theme change.
- **Staggered fade-ins** for the about section via IntersectionObserver + chained `setTimeout`s (desktop only, `scrollWidth > 1300`).
- **Contact form** with regex validation, sent via EmailJS (`src/emailjs.js`, config in `src/config.js` — note: `src/config.js` is listed in `.gitignore` but is actually **tracked** because it was committed before being ignored; CI builds depend on it, so don't untrack it casually).
- **Skill tooltips** (`src/tooltip.js`) from `data-skill-info` attributes.

## 3. The blog (custom static generator)

`scripts/build-blog.js` is a self-contained SSG:

1. **Compiles** `src/sass/blog-bundle.scss` → `dist/blog.css` (Dart Sass, compressed) — separate from webpack's CSS.
2. **Copies static assets** (menu/home icons, favicon, social logos) into `dist/assets/` — only if not already present (webpack may have copied some).
3. **Copies post images** from `src/blog/posts/images/` → `dist/blog/images/` (referenced in markdown as `/blog/images/...`).
4. **Loads posts**: every `.md` in `src/blog/posts/`, parsed with `gray-matter`. Frontmatter fields: `title`, `date`, `description`, `tags[]`, `author`, `image`, `draft`. Posts with `draft: true` are skipped; `src/blog/drafts/` is outside the glob entirely (and gitignored). Slug = filename minus `.md`.
5. **Renders** with `markdown-it` (html on, typographer, linkify) + `markdown-it-anchor` (permalinks) + `highlight.js` (server-side; the CSS themes load from a CDN with light/dark `<link>` toggling).
6. **Emits**: `dist/blog/<slug>/index.html` per post (from `templates/post.html`, `{{placeholder}}` regex replacement), `dist/blog/index.html` listing (post cards from `templates/index.html`), `rss.xml` (latest 20), and **`dist/sitemap.xml`** (home + `/blog` + posts — the sitemap for the whole site lives here).
7. Extras: reading-time estimate (230 wpm), ISO + formatted dates, OG/Twitter/JSON-LD meta, optional analytics snippet via `ANALYTICS_PROVIDER`/`ANALYTICS_ID` env vars (currently none configured).

`npm run watch:blog` uses nodemon to rebuild on markdown/template changes.

### Blog page chrome
Blog pages don't share webpack's JS or nav. They have their own fixed header with a **hamburger → full-screen overlay nav** (Home/About/Projects/Blog/Contact) and their own theme toggle, both implemented as small **inline scripts duplicated in each template**. The footer is a copy of the main footer using `/assets/*` paths. Post pages add a reading-progress bar.

## 4. Theming and styling system

- **Light/dark theme** via `data-theme` on `<html>` + CSS custom properties defined in `src/sass/_base.scss` (`--color-text`, `--color-accent`, `--color-background`, `--color-background-light`, `--color-border`, plus `-rgb` triplet variants for `rgba()` composition). Palette is warm parchment/brass tones.
- A tiny **pre-paint inline script** (duplicated in `template.html`, `templates/index.html`, `templates/post.html`) reads `localStorage['portfolio-theme']` or `prefers-color-scheme` and sets `data-theme` before first paint — any new page must include it to avoid theme flash.
- **Typography**: `Canela` (trial OTFs, self-hosted) for display headings; `Source Serif 4` (variable font) for body. Root font-size trick: `html { font-size: 62.5% }` so `1rem = 10px`, stepped down at 5 breakpoints (1500/1200/770/615/350 px) — all component sizes in rem scale globally.
- **Sass conventions**: one partial per section (`_header.scss`, `_projects.scss`, `_blog.scss`, …), BEM-ish naming (`.post-card__title`, `&--modifier`), old-style `@import` (deprecation silenced in both webpack and the blog script). Two bundles: `main.scss` (main page) and `blog-bundle.scss` (base + animations + footer + blog partials).

## 5. Dev server & scripts

- `npm run dev` = Express (`server.js`, port 3001) + webpack-dev-server (proxies `/api` → 3001) concurrently.
- **`server.js` is dev-only in practice** (production hosting is GitHub Pages). It provides: the Met API proxy, `/blog` static serving from `dist/` (so you can preview built blog pages in dev), a health check, and a fully built but **dormant** `POST /api/hero-image` DALL-E hero generator (rate-limited, GPT-4o image analysis, elaborate neoclassical-poster prompt). It exits at startup if `OPENAI_API_KEY` is missing — a real annoyance if you just want the Met proxy. Its `NODE_ENV=production` static-serving/SPA-fallback branches are unused in the deployed site.
- `.env` holds `OPENAI_API_KEY`, `PORT`, `NODE_ENV`; the blog script also reads optional `SITE_URL`, `ANALYTICS_*`.

## 6. Dormant / vestigial code (intentional, per README)

- **AI hero modal** (`src/aiHeroModal.js` + server endpoint): complete but never instantiated.
- **Canvas animations** (`headerCanvas.js`, `backgroundCanvas.js`): imports commented out; leftover from previous design.
- **Rangefinder overlay**: viewfinder-style corner marks in the hero HTML/CSS, hidden with `display: none` — a photography motif that could be relevant to a photos page.
- `inspo/`, `plan.md`, `research.md`: local working files, gitignored.
- `.gitignore` contains a stray literal `EOF` line (heredoc artifact) — harmless.

## 7. ⚠️ Issues found during review

1. **(Resolved 2026-07-21)** ~~The untracked new post will crash the next blog build.~~ `Blog Post - PKM with Claude Code.md` had **no frontmatter** — `gray-matter` returned `{}` and `toISODate(undefined)` threw `RangeError: Invalid time value`, failing `npm run build`. It also had spaces in the filename (→ broken slug/URL). Fixed: frontmatter added, renamed to `pkm-with-claude-code.md`, parked in `src/blog/drafts/` with `draft: true`. Hardening `build-blog.js` to skip-and-warn on invalid frontmatter remains a good idea.
2. **`src/config.js` is gitignored but tracked.** The CI build imports it, so it must stay tracked (only public keys are in it, so this is fine — just a trap).
3. **Sitemap** only knows about home + blog; new top-level pages must be added in `build-blog.js` (`buildSitemap`) or they'll be missing from it.
4. Minor: duplicated nav/footer/theme-script markup across the three HTML templates means every chrome change is a three-file edit (soon four, with a photos page).

## 8. Patterns to follow when adding a new page

Based on how `/blog` was added, the established pattern for a new top-level static page is:

- Generate it into `dist/<page>/index.html` with a Node build script (or extend `build-blog.js`), templated from an HTML file with `{{placeholders}}`.
- Give it its own Sass bundle (or reuse `blog-bundle.scss`-style composition: `base` + `animations` + `footer` + page partials) compiled to a standalone CSS file.
- Include the pre-paint theme script, the fixed `blog-nav`-style header (theme toggle + hamburger overlay), and the shared footer markup.
- Add a nav link in all templates (`template.html` nav bar + both blog templates' overlay).
- Register the page in the sitemap builder.
- GitHub Pages serves `dist/<page>/index.html` at `/<page>` automatically; the dev Express server would need a static mount for previewing (mirroring the `/blog` mounts).
