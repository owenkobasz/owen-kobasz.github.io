#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');
const sharp = require('sharp');

require('dotenv').config();

const { ROOT, formatDate, toISODate, escapeXml, analyticsSnippet, compileSCSS, copyStaticAssets } = require('./lib/shared');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SITE_URL = process.env.SITE_URL || 'https://owenkobasz.com';

const ALBUMS_DIR = path.join(ROOT, 'src', 'photos', 'albums');
const TEMPLATES_DIR = path.join(ROOT, 'src', 'photos', 'templates');
const SASS_ENTRY = path.join(ROOT, 'src', 'sass', 'photos-bundle.scss');
const CACHE_DIR = path.join(ROOT, '.photos-cache');
const MANIFEST_FILE = path.join(CACHE_DIR, 'manifest.json');
const URLS_FILE = path.join(CACHE_DIR, 'urls.json');
const DIST = path.join(ROOT, 'dist');
const PHOTOS_DIST = path.join(DIST, 'photos');
const IMAGES_DIST = path.join(PHOTOS_DIST, 'images');

const THUMB_EDGE = 1000;
const THUMB_QUALITY = 78;
const LARGE_EDGE = 2000;
const LARGE_QUALITY = 82;
const TARGET_ROW_REM = 26;

const IMAGE_EXT = /\.(jpe?g|png)$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readTemplate(name) {
    return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf-8');
}

// YAML parses strict ISO dates (2026-03-14) into UTC-midnight Date objects,
// which en-US formatting would render a day early; normalize to slash form so
// downstream new Date() calls parse in local time like the blog's dates do.
function normalizeDate(d) {
    if (d instanceof Date) return d.toISOString().slice(0, 10).replace(/-/g, '/');
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d.replace(/-/g, '/');
    return d;
}

function sanitizeBaseName(filename) {
    const base = filename.replace(/\.[^.]+$/, '');
    const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return clean || 'photo';
}

function assignOutputNames(filenames) {
    const taken = new Set();
    const map = new Map();
    for (const f of filenames) {
        let base = sanitizeBaseName(f);
        if (taken.has(base)) {
            let i = 2;
            while (taken.has(`${base}-${i}`)) i++;
            base = `${base}-${i}`;
        }
        taken.add(base);
        map.set(f, base);
    }
    return map;
}

function orderImages(files, order) {
    const sorted = files.slice().sort((a, b) => a.localeCompare(b));
    if (!Array.isArray(order) || !order.length) return { images: sorted, unknown: [] };
    const fileSet = new Set(files);
    const listed = [];
    const unknown = [];
    const seen = new Set();
    for (const name of order) {
        if (fileSet.has(name)) {
            if (!seen.has(name)) {
                listed.push(name);
                seen.add(name);
            }
        } else {
            unknown.push(name);
        }
    }
    return { images: [...listed, ...sorted.filter(f => !seen.has(f))], unknown };
}

function sha1File(filePath) {
    return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

// ---------------------------------------------------------------------------
// Load & validate albums
// ---------------------------------------------------------------------------

function loadAlbums() {
    if (!fs.existsSync(ALBUMS_DIR)) return [];

    const albums = [];
    for (const entry of fs.readdirSync(ALBUMS_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const slug = entry.name;
        const dir = path.join(ALBUMS_DIR, slug);

        if (!SLUG_RE.test(slug)) {
            console.warn(`  WARN: skipping album "${slug}" — folder name must be kebab-case (a-z, 0-9, dashes); rename it`);
            continue;
        }

        const metaPath = path.join(dir, 'album.md');
        if (!fs.existsSync(metaPath)) {
            console.warn(`  WARN: skipping album "${slug}" — no album.md`);
            continue;
        }

        let data;
        try {
            ({ data } = matter(fs.readFileSync(metaPath, 'utf-8')));
        } catch (e) {
            console.warn(`  WARN: skipping album "${slug}" — unparseable frontmatter (${e.message})`);
            continue;
        }

        if (!data.title) {
            console.warn(`  WARN: skipping album "${slug}" — missing title in album.md`);
            continue;
        }
        if (!data.date || isNaN(new Date(data.date))) {
            console.warn(`  WARN: skipping album "${slug}" — missing or invalid date in album.md`);
            continue;
        }
        if (data.draft) continue;

        const files = [];
        for (const f of fs.readdirSync(dir)) {
            if (f === 'album.md') continue;
            if (IMAGE_EXT.test(f)) {
                files.push(f);
            } else {
                console.warn(`  WARN: ignoring non-image file "${slug}/${f}"`);
            }
        }

        if (!files.length) {
            console.warn(`  WARN: skipping album "${slug}" — no usable images (.jpg/.jpeg/.png)`);
            continue;
        }

        const { images, unknown } = orderImages(files, data.order);
        for (const name of unknown) {
            console.warn(`  WARN: album "${slug}" order references missing file "${name}" — ignored`);
        }

        let cover = data.cover;
        if (cover && !files.includes(cover)) {
            console.warn(`  WARN: album "${slug}" cover "${cover}" not found — using first image`);
            cover = null;
        }
        if (!cover) cover = images[0];

        albums.push({
            slug,
            title: data.title,
            date: normalizeDate(data.date),
            description: data.description || '',
            cover,
            images,
        });
    }

    return albums.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ---------------------------------------------------------------------------
// Image processing (sharp + content-hash cache)
// ---------------------------------------------------------------------------

function loadManifest() {
    try {
        return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

async function generateOutputs(srcPath, outDir, base) {
    const meta = await sharp(srcPath).metadata();
    let width = meta.width;
    let height = meta.height;
    if (meta.orientation >= 5) [width, height] = [height, width];

    const img = sharp(srcPath).rotate();
    await img.clone()
        .resize(THUMB_EDGE, THUMB_EDGE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: THUMB_QUALITY })
        .toFile(path.join(outDir, `${base}-thumb.jpg`));
    await img.clone()
        .resize(LARGE_EDGE, LARGE_EDGE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: LARGE_QUALITY })
        .toFile(path.join(outDir, `${base}-large.jpg`));

    return { width, height };
}

function pruneOrphans(manifest, currentKeys) {
    for (const key of Object.keys(manifest)) {
        if (currentKeys.has(key)) continue;
        const slug = key.split('/')[0];
        const outputs = Array.isArray(manifest[key].outputs) ? manifest[key].outputs : [];
        for (const out of outputs) {
            const p = path.join(CACHE_DIR, slug, out);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        delete manifest[key];
    }
    for (const entry of fs.readdirSync(CACHE_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(CACHE_DIR, entry.name);
        if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
    }
}

async function processImages(albums) {
    const manifest = loadManifest();
    const currentKeys = new Set();
    let hits = 0;
    let processed = 0;

    for (const album of albums) {
        const names = assignOutputNames(album.images);
        const cacheAlbumDir = path.join(CACHE_DIR, album.slug);
        fs.mkdirSync(cacheAlbumDir, { recursive: true });
        album.photos = [];

        for (const filename of album.images) {
            const key = `${album.slug}/${filename}`;
            currentKeys.add(key);

            const srcPath = path.join(ALBUMS_DIR, album.slug, filename);
            const hash = sha1File(srcPath);
            const base = names.get(filename);
            const outputs = [`${base}-thumb.jpg`, `${base}-large.jpg`];

            const entry = manifest[key];
            const valid = entry
                && entry.hash === hash
                && Array.isArray(entry.outputs)
                && entry.outputs.join() === outputs.join()
                && outputs.every(o => fs.existsSync(path.join(cacheAlbumDir, o)));

            let width;
            let height;
            if (valid) {
                ({ width, height } = entry);
                hits++;
            } else {
                ({ width, height } = await generateOutputs(srcPath, cacheAlbumDir, base));
                manifest[key] = { hash, outputs, width, height };
                processed++;
            }

            album.photos.push({
                filename,
                base,
                width,
                height,
                thumb: `/photos/images/${album.slug}/${base}-thumb.jpg`,
                large: `/photos/images/${album.slug}/${base}-large.jpg`,
            });
        }

        album.coverPhoto = album.photos.find(p => p.filename === album.cover) || album.photos[0];
    }

    pruneOrphans(manifest, currentKeys);
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
    console.log(`  images: ${hits} cached, ${processed} processed`);
}

function copyImagesToDist(albums) {
    for (const album of albums) {
        const destDir = path.join(IMAGES_DIST, album.slug);
        fs.mkdirSync(destDir, { recursive: true });
        for (const photo of album.photos) {
            for (const out of [`${photo.base}-thumb.jpg`, `${photo.base}-large.jpg`]) {
                fs.copyFileSync(path.join(CACHE_DIR, album.slug, out), path.join(destDir, out));
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Render pages
// ---------------------------------------------------------------------------

function buildIndex(albums) {
    const template = readTemplate('index.html');

    const albumsHtml = albums.length
        ? albums.map(album => `
            <a href="/photos/${album.slug}" class="post-card post-card--has-image">
                <div class="post-card__image"><img src="${album.coverPhoto.thumb}" alt="${escapeXml(album.title)}" loading="lazy" /></div>
                <div class="post-card__body">
                    <div class="post-card__date">${formatDate(album.date)}</div>
                    <h2 class="post-card__title">${escapeXml(album.title)}</h2>
                    <p class="post-card__description">${escapeXml(album.description)}</p>
                </div>
            </a>`).join('\n')
        : '<p class="photos-empty">Albums coming soon.</p>';

    const ogImageBlock = albums.length
        ? `<meta property="og:image" content="${SITE_URL}${albums[0].coverPhoto.large}" />\n    <meta name="twitter:image" content="${SITE_URL}${albums[0].coverPhoto.large}" />`
        : '';

    const page = template
        .replace(/\{\{site_url\}\}/g, SITE_URL)
        .replace(/\{\{albums_html\}\}/g, albumsHtml)
        .replace(/\{\{og_image_block\}\}/g, ogImageBlock)
        .replace(/\{\{analytics_snippet\}\}/g, analyticsSnippet());

    fs.mkdirSync(PHOTOS_DIST, { recursive: true });
    fs.writeFileSync(path.join(PHOTOS_DIST, 'index.html'), page);
    console.log('  /photos/ index');
}

function buildAlbumPages(albums) {
    const template = readTemplate('album.html');

    for (const album of albums) {
        const gridHtml = album.photos.map(p => {
            const r = p.width / p.height;
            const grow = Math.max(1, Math.round(r * 100));
            const basis = (r * TARGET_ROW_REM).toFixed(2);
            return `                <a class="photo-grid__item" href="${p.large}" style="aspect-ratio: ${p.width} / ${p.height}; flex-grow: ${grow}; flex-basis: ${basis}rem">`
                + `<img src="${p.thumb}" width="${p.width}" height="${p.height}" loading="lazy" alt="" /></a>`;
        }).join('\n');

        const canonicalUrl = `${SITE_URL}/photos/${album.slug}`;
        const coverLargeUrl = `${SITE_URL}${album.coverPhoto.large}`;

        const page = template
            .replace(/\{\{title\}\}/g, escapeXml(album.title))
            .replace(/\{\{description\}\}/g, escapeXml(album.description))
            .replace(/\{\{canonical_url\}\}/g, canonicalUrl)
            .replace(/\{\{date_iso\}\}/g, toISODate(album.date))
            .replace(/\{\{date_formatted\}\}/g, formatDate(album.date))
            .replace(/\{\{og_image_tag\}\}/g, `<meta property="og:image" content="${coverLargeUrl}" />`)
            .replace(/\{\{twitter_image_tag\}\}/g, `<meta name="twitter:image" content="${coverLargeUrl}" />`)
            .replace(/\{\{grid_html\}\}/g, gridHtml)
            .replace(/\{\{analytics_snippet\}\}/g, analyticsSnippet());

        const outDir = path.join(PHOTOS_DIST, album.slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), page);
        console.log(`  /photos/${album.slug}/ (${album.photos.length} photos)`);
    }
}

function writeUrlsManifest(albums) {
    const urls = [
        { loc: `${SITE_URL}/photos`, priority: '0.8' },
        ...albums.map(a => ({
            loc: `${SITE_URL}/photos/${a.slug}`,
            lastmod: toISODate(a.date),
            priority: '0.6',
        })),
    ];
    fs.writeFileSync(URLS_FILE, JSON.stringify(urls, null, 2));
    console.log('  urls.json (sitemap handoff)');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('Building photos...');

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    compileSCSS(SASS_ENTRY, path.join(DIST, 'photos.css'));
    copyStaticAssets(DIST);

    const albums = loadAlbums();
    console.log(`Found ${albums.length} published album(s)`);

    await processImages(albums);
    copyImagesToDist(albums);
    buildIndex(albums);
    buildAlbumPages(albums);
    writeUrlsManifest(albums);

    console.log('Photos build complete.');
}

if (require.main === module) {
    main().catch(e => {
        console.error(e);
        process.exit(1);
    });
}

module.exports = { normalizeDate, sanitizeBaseName, assignOutputNames, orderImages };
