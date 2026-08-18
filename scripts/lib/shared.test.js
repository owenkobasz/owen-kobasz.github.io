const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatDate, toISODate, escapeXml, analyticsSnippet } = require('./shared');

test('formatDate renders en-US long form for the non-ISO dates the frontmatter uses', () => {
    assert.equal(formatDate('2026-3-14'), 'March 14, 2026');
    assert.equal(formatDate('2026-05-7'), 'May 7, 2026');
});

test('toISODate normalizes to YYYY-MM-DD', () => {
    assert.equal(toISODate('2026-03-14'), '2026-03-14');
    assert.equal(toISODate(new Date(Date.UTC(2026, 0, 5))), '2026-01-05');
});

test('escapeXml escapes all five XML special characters', () => {
    assert.equal(escapeXml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
    assert.equal(escapeXml('plain text'), 'plain text');
});

test('analyticsSnippet returns placeholder comment when unconfigured', () => {
    delete process.env.ANALYTICS_PROVIDER;
    delete process.env.ANALYTICS_ID;
    assert.equal(analyticsSnippet(), '<!-- analytics: none configured -->');
});

test('analyticsSnippet builds plausible tag from env', () => {
    process.env.ANALYTICS_PROVIDER = 'plausible';
    process.env.ANALYTICS_ID = 'example.com';
    assert.match(analyticsSnippet(), /data-domain="example\.com"/);
    delete process.env.ANALYTICS_PROVIDER;
    delete process.env.ANALYTICS_ID;
});
