#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');
const markdownItAnchor = require('markdown-it-anchor');
const hljs = require('highlight.js');
const sass = require('sass');

require('dotenv').config();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SITE_URL = process.env.SITE_URL || 'https://owenkobasz.com';
const ANALYTICS_PROVIDER = (process.env.ANALYTICS_PROVIDER || 'none').toLowerCase();
const ANALYTICS_ID = process.env.ANALYTICS_ID || '';

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'src', 'blog', 'posts');
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
// Analytics snippet builder
// ---------------------------------------------------------------------------

function analyticsSnippet() {
    if (ANALYTICS_PROVIDER === 'plausible' && ANALYTICS_ID) {
        return `<script defer data-domain="${ANALYTICS_ID}" src="https://plausible.io/js/script.js"></script>`;
    }
    if (ANALYTICS_PROVIDER === 'gtag' && ANALYTICS_ID) {
        return [
            `<script async src="https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}"></script>`,
            `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}`,
            `gtag('js',new Date());gtag('config','${ANALYTICS_ID}');</script>`
        ].join('\n');
    }
    return '<!-- analytics: none configured -->';
}

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

function formatDate(d) {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function toISODate(d) {
    return new Date(d).toISOString().split('T')[0];
}

function escapeXml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Compile SCSS
// ---------------------------------------------------------------------------

function compileSCSS() {
    const result = sass.compile(SASS_ENTRY, { style: 'compressed', silenceDeprecations: ['import'] });
    fs.mkdirSync(DIST, { recursive: true });
    fs.writeFileSync(path.join(DIST, 'blog.css'), result.css);
    console.log('  blog.css compiled');
}

function copyStaticAssets() {
    const assets = ['menu.svg', 'fav.png'];
    const assetsDistDir = path.join(DIST, 'assets');
    fs.mkdirSync(assetsDistDir, { recursive: true });
    for (const file of assets) {
        const src = path.join(ROOT, 'src', 'assets', file);
        const dest = path.join(assetsDistDir, file);
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
        }
    }
}

// ---------------------------------------------------------------------------
// Load & parse posts
// ---------------------------------------------------------------------------

function loadPosts() {
    if (!fs.existsSync(POSTS_DIR)) return [];

    return fs.readdirSync(POSTS_DIR)
        .filter(f => f.endsWith('.md'))
        .map(filename => {
            const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
            const { data, content } = matter(raw);
            const slug = filename.replace(/\.md$/, '');
            return { ...data, slug, rawContent: content };
        })
        .filter(p => !p.draft)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ---------------------------------------------------------------------------
// Build individual post pages
// ---------------------------------------------------------------------------

function buildPosts(posts) {
    const template = readTemplate('post.html');
    const analytics = analyticsSnippet();
    const hljsCss = `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" />`;

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
        return `
            <a href="/blog/${post.slug}" class="post-card">
                <div class="post-card__date">${dateFormatted}</div>
                <h2 class="post-card__title">${escapeXml(post.title)}</h2>
                <p class="post-card__description">${escapeXml(post.description || '')}</p>
                ${tagsHtml}
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

    const urls = [...staticUrls, ...postUrls].map(u => {
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

    compileSCSS();
    copyStaticAssets();

    const posts = loadPosts();
    console.log(`Found ${posts.length} published post(s)`);

    buildPosts(posts);
    buildIndex(posts);
    buildRSS(posts);
    buildSitemap(posts);

    console.log('Blog build complete.');
}

main();
