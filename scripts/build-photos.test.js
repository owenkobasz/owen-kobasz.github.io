const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDate, sanitizeBaseName, assignOutputNames, orderImages } = require('./build-photos');

test('sanitizeBaseName lowercases, strips extension, collapses non-alphanumerics', () => {
    assert.equal(sanitizeBaseName('IMG 0042 (edit).JPG'), 'img-0042-edit');
    assert.equal(sanitizeBaseName('DSC01234.jpg'), 'dsc01234');
    assert.equal(sanitizeBaseName('--__--.png'), 'photo');
});

test('assignOutputNames resolves collisions with deterministic suffixes', () => {
    const map = assignOutputNames(['DSC 1.jpg', 'DSC_1.jpg', 'dsc-1.png', 'other.jpg']);
    assert.equal(map.get('DSC 1.jpg'), 'dsc-1');
    assert.equal(map.get('DSC_1.jpg'), 'dsc-1-2');
    assert.equal(map.get('dsc-1.png'), 'dsc-1-3');
    assert.equal(map.get('other.jpg'), 'other');
});

test('orderImages sorts by filename when no order given', () => {
    const { images, unknown } = orderImages(['c.jpg', 'a.jpg', 'b.jpg'], undefined);
    assert.deepEqual(images, ['a.jpg', 'b.jpg', 'c.jpg']);
    assert.deepEqual(unknown, []);
});

test('orderImages puts listed files first, remainder sorted, unknowns reported', () => {
    const { images, unknown } = orderImages(
        ['c.jpg', 'a.jpg', 'b.jpg'],
        ['b.jpg', 'missing.jpg', 'b.jpg']
    );
    assert.deepEqual(images, ['b.jpg', 'a.jpg', 'c.jpg']);
    assert.deepEqual(unknown, ['missing.jpg']);
});

test('normalizeDate converts Date objects and strict ISO strings to local-parsing form', () => {
    assert.equal(normalizeDate(new Date(Date.UTC(2026, 2, 14))), '2026/03/14');
    assert.equal(normalizeDate('2026-03-14'), '2026/03/14');
    assert.equal(normalizeDate('2026-3-14'), '2026-3-14');
    const d = new Date('2026/03/14');
    assert.equal(d.getDate(), 14);
    assert.equal(d.getMonth(), 2);
});
