#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');
const markdownItAnchor = require('markdown-it-anchor');
const hljs = require('highlight.js');

require('dotenv').config();

const { formatDate, toISODate, escapeXml, analyticsSnippet, compileSCSS, copyStaticAssets } = require('./lib/shared');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SITE_URL = process.env.SITE_URL || 'https://owenkobasz.com';

const ROOT = path.resolve(__dirname, '..');
const PHOTOS_URLS_FILE = path.join(ROOT, '.photos-cache', 'urls.json');
const POSTS_DIR = path.join(ROOT, 'src', 'blog', 'posts');
const POSTS_IMAGES_DIR = path.join(POSTS_DIR, 'images');
const TEMPLATES_DIR = path.join(ROOT, 'src', 'blog', 'templates');
const SASS_ENTRY = path.join(ROOT, 'src', 'sass', 'blog-bundle.scss');
const DIST = path.join(ROOT, 'dist');
const BLOG_DIST = path.join(DIST, 'blog');

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight(str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
            } catch (_) { /* fall through */ }
        }
        return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
}).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.ariaHidden({ placement: 'after', symbol: '#', class: 'header-anchor' }),
    slugify: s => s.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, ''),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readTemplate(name) {
    return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf-8');
}

function estimateReadingTime(text) {
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 230));
}

function copyDirRecursive(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) return;
    fs.mkdirSync(destDir, { recursive: true });

    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
            continue;
        }

        if (entry.isFile()) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function copyPostImages() {
    const outDir = path.join(BLOG_DIST, 'images');
    copyDirRecursive(POSTS_IMAGES_DIR, outDir);
    if (fs.existsSync(outDir)) {
        console.log('  /blog/images/ copied');
    }
}

// ---------------------------------------------------------------------------
// Load & parse posts
// ---------------------------------------------------------------------------

function loadPosts() {
    if (!fs.existsSync(POSTS_DIR)) return [];

    const posts = [];
    for (const filename of fs.readdirSync(POSTS_DIR)) {
        if (!filename.endsWith('.md')) continue;
        const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
        let parsed;
        try {
            parsed = matter(raw);
        } catch (e) {
            console.warn(`  WARN: skipping ${filename} — unparseable frontmatter (${e.message})`);
            continue;
        }
        const { data, content } = parsed;
        if (!data.title) {
            console.warn(`  WARN: skipping ${filename} — missing title in frontmatter`);
            continue;
        }
        if (!data.date || isNaN(new Date(data.date))) {
            console.warn(`  WARN: skipping ${filename} — missing or invalid date in frontmatter`);
            continue;
        }
        if (data.draft) continue;
        posts.push({ ...data, slug: filename.replace(/\.md$/, ''), rawContent: content });
    }
    return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ---------------------------------------------------------------------------
// Build individual post pages
// ---------------------------------------------------------------------------

function buildPosts(posts) {
    const template = readTemplate('post.html');
    const analytics = analyticsSnippet();
    const hljsCss = `<link rel="stylesheet" class="hljs-theme-light" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" /><link rel="stylesheet" class="hljs-theme-dark" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" disabled />`;

    for (const post of posts) {
        const html = md.render(post.rawContent);
        const readingTime = estimateReadingTime(post.rawContent);
        const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;
        const dateIso = toISODate(post.date);
        const dateFormatted = formatDate(post.date);

        const tagsHtml = (post.tags && post.tags.length)
            ? `<div class="blog-post__tags">${post.tags.map(t => `<span class="blog-post__tag">${t}</span>`).join('')}</div>`
            : '';

        const ogImageTag = post.image
            ? `<meta property="og:image" content="${SITE_URL}${post.image}" />`
            : '';
        const twitterImageTag = post.image
            ? `<meta name="twitter:image" content="${SITE_URL}${post.image}" />`
            : '';

        const page = template
            .replace(/\{\{title\}\}/g, escapeXml(post.title))
            .replace(/\{\{description\}\}/g, escapeXml(post.description || ''))
            .replace(/\{\{canonical_url\}\}/g, canonicalUrl)
            .replace(/\{\{date_iso\}\}/g, dateIso)
            .replace(/\{\{date_formatted\}\}/g, dateFormatted)
            .replace(/\{\{reading_time\}\}/g, String(readingTime))
            .replace(/\{\{author\}\}/g, escapeXml(post.author || 'Owen Kobasz'))
            .replace(/\{\{content\}\}/g, html)
            .replace(/\{\{tags_html\}\}/g, tagsHtml)
            .replace(/\{\{og_image_tag\}\}/g, ogImageTag)
            .replace(/\{\{twitter_image_tag\}\}/g, twitterImageTag)
            .replace(/\{\{highlight_css\}\}/g, hljsCss)
            .replace(/\{\{analytics_snippet\}\}/g, analytics);

        const outDir = path.join(BLOG_DIST, post.slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), page);
        console.log(`  /blog/${post.slug}/`);
    }
}

// ---------------------------------------------------------------------------
// Build blog index page
// ---------------------------------------------------------------------------

function buildIndex(posts) {
    const template = readTemplate('index.html');
    const analytics = analyticsSnippet();

    const postsHtml = posts.map(post => {
        const dateFormatted = formatDate(post.date);
        const tagsHtml = (post.tags && post.tags.length)
            ? `<div class="post-card__tags">${post.tags.map(t => `<span class="post-card__tag">${t}</span>`).join('')}</div>`
            : '';
        const imageHtml = post.image
            ? `<div class="post-card__image"><img src="${post.image}" alt="${escapeXml(post.title)}" loading="lazy" /></div>`
            : '';
        return `
            <a href="/blog/${post.slug}" class="post-card${post.image ? ' post-card--has-image' : ''}">
                ${imageHtml}
                <div class="post-card__body">
                    <div class="post-card__date">${dateFormatted}</div>
                    <h2 class="post-card__title">${escapeXml(post.title)}</h2>
                    <p class="post-card__description">${escapeXml(post.description || '')}</p>
                    ${tagsHtml}
                </div>
            </a>`;
    }).join('\n');

    const page = template
        .replace(/\{\{site_url\}\}/g, SITE_URL)
        .replace(/\{\{posts_html\}\}/g, postsHtml)
        .replace(/\{\{analytics_snippet\}\}/g, analytics);

    fs.mkdirSync(BLOG_DIST, { recursive: true });
    fs.writeFileSync(path.join(BLOG_DIST, 'index.html'), page);
    console.log('  /blog/ index');
}

// ---------------------------------------------------------------------------
// Generate RSS 2.0 feed
// ---------------------------------------------------------------------------

function buildRSS(posts) {
    const items = posts.slice(0, 20).map(post => {
        const link = `${SITE_URL}/blog/${post.slug}`;
        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.description || '')}</description>
    </item>`;
    }).join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Owen Kobasz Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Writing about software engineering, system design, algorithms, and building things.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    fs.writeFileSync(path.join(BLOG_DIST, 'rss.xml'), rss);
    console.log('  /blog/rss.xml');
}

// ---------------------------------------------------------------------------
// Generate sitemap.xml
// ---------------------------------------------------------------------------

function loadPhotoUrls() {
    if (!fs.existsSync(PHOTOS_URLS_FILE)) {
        console.warn('  WARN: no photo URLs found (.photos-cache/urls.json) — sitemap will omit /photos; run build:photos first');
        return [];
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(PHOTOS_URLS_FILE, 'utf-8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn(`  WARN: could not read photo URLs (${e.message}) — sitemap will omit /photos`);
        return [];
    }
}

function buildSitemap(posts) {
    const staticUrls = [
        { loc: SITE_URL, priority: '1.0' },
        { loc: `${SITE_URL}/blog`, priority: '0.8' },
    ];

    const postUrls = posts.map(post => ({
        loc: `${SITE_URL}/blog/${post.slug}`,
        lastmod: toISODate(post.date),
        priority: '0.6',
    }));

    const urls = [...staticUrls, ...loadPhotoUrls(), ...postUrls].map(u => {
        let entry = `  <url>\n    <loc>${u.loc}</loc>`;
        if (u.lastmod) entry += `\n    <lastmod>${u.lastmod}</lastmod>`;
        entry += `\n    <priority>${u.priority}</priority>\n  </url>`;
        return entry;
    }).join('\n');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);
    console.log('  /sitemap.xml');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    console.log('Building blog...');

    compileSCSS(SASS_ENTRY, path.join(DIST, 'blog.css'));
    copyStaticAssets(DIST);
    copyPostImages();

    const posts = loadPosts();
    console.log(`Found ${posts.length} published post(s)`);

    buildPosts(posts);
    buildIndex(posts);
    buildRSS(posts);
    buildSitemap(posts);

    console.log('Blog build complete.');
}

main();
