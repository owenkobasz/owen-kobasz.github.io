const fs = require('fs');
const path = require('path');
const sass = require('sass');

const ROOT = path.resolve(__dirname, '..', '..');

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

function analyticsSnippet() {
    const provider = (process.env.ANALYTICS_PROVIDER || 'none').toLowerCase();
    const id = process.env.ANALYTICS_ID || '';
    if (provider === 'plausible' && id) {
        return `<script defer data-domain="${id}" src="https://plausible.io/js/script.js"></script>`;
    }
    if (provider === 'gtag' && id) {
        return [
            `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
            `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}`,
            `gtag('js',new Date());gtag('config','${id}');</script>`
        ].join('\n');
    }
    return '<!-- analytics: none configured -->';
}

function compileSCSS(entryPath, outPath) {
    const result = sass.compile(entryPath, { style: 'compressed', silenceDeprecations: ['import'] });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, result.css);
    console.log(`  ${path.basename(outPath)} compiled`);
}

function copyStaticAssets(distDir) {
    const assets = [
        { src: 'icons/ui/menu.svg',              dest: 'menu.svg' },
        { src: 'images/favicons/fav.png',        dest: 'fav.png' },
        { src: 'icons/social/github-logo.png',   dest: 'github-logo.png' },
        { src: 'icons/social/mail.png',          dest: 'mail.png' },
        { src: 'icons/social/linkedin-logo.svg', dest: 'linkedin-logo.svg' },
        { src: 'icons/ui/home.svg',              dest: 'home.svg' },
    ];
    const assetsDistDir = path.join(distDir, 'assets');
    fs.mkdirSync(assetsDistDir, { recursive: true });
    for (const { src: srcFile, dest } of assets) {
        const src = path.join(ROOT, 'src', 'assets', srcFile);
        const destPath = path.join(assetsDistDir, dest);
        if (fs.existsSync(src) && !fs.existsSync(destPath)) {
            fs.copyFileSync(src, destPath);
        }
    }
}

module.exports = { ROOT, formatDate, toISODate, escapeXml, analyticsSnippet, compileSCSS, copyStaticAssets };
