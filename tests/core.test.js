// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/core.js');

const NOW = new Date(2026, 9, 19);
const demo = f => { const s = C.demoState(f); s.format = f; return s; };
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

test('month parsing accepts what people type', () => {
  assert.deepEqual(C.parseMonth('2021-03'), { y: 2021, m: 3 });
  assert.deepEqual(C.parseMonth('2021-3'), { y: 2021, m: 3 });
  assert.deepEqual(C.parseMonth('03/2021'), { y: 2021, m: 3 });
  assert.deepEqual(C.parseMonth('3.2021'), { y: 2021, m: 3 });
  assert.deepEqual(C.parseMonth('2021'), { y: 2021, m: null });
  assert.equal(C.parseMonth('13/2021'), null);
  assert.equal(C.parseMonth('summer'), null);
});

test('date ranges per format', () => {
  const e = { start: '2021-03', end: '2024-06', current: false };
  assert.equal(C.fmtRange(e, 'de'), '03/2021 – 06/2024');
  assert.equal(C.fmtRange(e, 'uk'), 'Mar 2021 – Jun 2024');
  assert.equal(C.fmtRange({ start: '2021-03', end: '', current: true }, 'de'), '03/2021 – heute');
  assert.equal(C.fmtRange({ start: '2021-03', end: '', current: true }, 'us'), 'Mar 2021 – Present');
  assert.equal(C.fmtRange({ start: '2020', end: '2020' }, 'us'), '2020');
  assert.equal(C.fmtRange({ start: 'Spring 2019', end: '' }, 'uk'), 'Spring 2019');
});

test('entries are sorted newest first, current job on top, undated last', () => {
  const l = [
    { role: 'old', start: '2010-01', end: '2012-01' },
    { role: 'undated', start: '', end: '' },
    { role: 'now', start: '2020-01', end: '', current: true },
    { role: 'mid', start: '2013-01', end: '2019-12' },
  ];
  assert.deepEqual(C.sortEntries(l).map(e => e.role), ['now', 'mid', 'old', 'undated']);
  const s = demo('us'); s.settings.sort = false;
  const h = C.render(s);
  assert.ok(h.indexOf('Studio North') < h.indexOf('Ledgerly'), 'order kept when sorting is off');
});

test('German Lebenslauf: tabular, photo, personal data, Ort Datum Unterschrift', () => {
  for (const tpl of C.TEMPLATES) {
    const s = demo('de'); s.template.de = tpl;
    const h = C.render(s, { now: NOW });
    assert.match(h, /lang="de"/);
    assert.match(h, /class="cv-photo"/);
    assert.match(h, /cv-row/);
    const tx = text(h);
    for (const w of ['Lebenslauf', 'Persönliche Daten', 'Berufserfahrung', 'Ausbildung', 'Geburtsdatum', 'Staatsangehörigkeit', 'Ort, Datum', 'Berlin, 19.10.2026', '04/2022 – heute'])
      assert.ok(tx.includes(w), tpl + ': ' + w);
    assert.ok(tx.indexOf('Senior Product Designer') < tx.indexOf('Studio North'), 'newest first');
  }
});

test('UK CV: no photo, no date of birth, nationality or marital status; statement first', () => {
  const s = demo('uk'); s.person.marital = 'ledig';
  for (const tpl of C.TEMPLATES) {
    s.template.uk = tpl;
    const h = C.render(s), tx = text(h);
    assert.doesNotMatch(h, /<img/);
    for (const w of ['14.05.1993', 'Manchester British', 'British', 'ledig', 'Beispielstraße', 'Ort, Datum']) assert.ok(!tx.includes(w), tpl + ' leaks ' + w);
    assert.ok(tx.indexOf('Personal statement') < tx.indexOf('Work experience'));
    assert.ok(tx.includes('Right to work: EU Blue Card'));
  }
});

test('US résumé: ATS friendly (single column, no tables, no images, standard headings)', () => {
  for (const tpl of C.TEMPLATES) {
    const s = demo('us'); s.template.us = tpl;
    const h = C.render(s);
    assert.doesNotMatch(h, /<(table|img|svg|canvas)\b/);
    assert.doesNotMatch(h, /cv-grid|cv-side|cv-row/);
    const heads = [...h.matchAll(/<h2>([^<]+)<\/h2>/g)].map(m => m[1]);
    assert.deepEqual(heads.slice(0, 4), ['Summary', 'Experience', 'Education', 'Skills']);
    assert.ok(text(h).includes('Languages: English (Native), German (C1)'));
    assert.ok(!text(h).includes('14.05.1993'));
  }
  assert.equal(C.FORMATS.us.page, 'letter');
  assert.equal(C.FORMATS.us.maxPages, 1);
  assert.equal(C.FORMATS.uk.maxPages, 2);
});

test('everything the user types is escaped', () => {
  const s = C.emptyState('us');
  s.person.name = '<script>alert(1)</script>';
  s.person.website = 'javascript:alert(1)';
  s.experience.push(Object.assign(C.blank('experience'), { role: '"><img src=x onerror=alert(1)>', bullets: '<b>x</b>' }));
  const h = C.render(s);
  assert.doesNotMatch(h, /<script|<img|<b>x/);
  assert.doesNotMatch(h, /href="javascript/);
});

test('migrate: round trip, defaults, rejects foreign files and bad photos', () => {
  const s = demo('uk'); s.person.photo = 'data:image/jpeg;base64,AAAA';
  const back = C.migrate(JSON.parse(C.exportJSON(s)));
  assert.deepEqual(back, s);
  assert.throws(() => C.migrate([]));
  assert.throws(() => C.migrate({ foo: 1 }));
  assert.throws(() => C.migrate({ schema: 99, person: {} }));
  const m = C.migrate({ person: { name: 'A', photo: 'https://tracker.example/x.png' }, experience: [{ role: 'R', current: 1 }, null], template: { de: 'weird' } });
  assert.equal(m.person.photo, '');
  assert.equal(m.experience.length, 1);
  assert.equal(m.experience[0].current, true);
  assert.equal(m.template.de, 'classic');
  assert.equal(m.settings.sort, true);
});

test('checks per format', () => {
  const codes = s => C.checks(s).map(c => c.code);
  const uk = demo('uk'); uk.statement = '';
  assert.ok(codes(uk).includes('no_statement'));
  assert.ok(codes(uk).includes('photo_hidden'));
  assert.ok(!codes(demo('de')).includes('photo_hidden'));
  const de = demo('de'); de.sign.place = '';
  assert.ok(codes(de).includes('no_place'));
  assert.deepEqual(codes(C.emptyState('de')).sort(), ['empty', 'no_email', 'no_name', 'no_place']);
});

test('file names', () => {
  const s = demo('de'); s.person.name = 'Jürgen Groß-Müller';
  assert.equal(C.fileName(s), 'Lebenslauf_Jurgen_Gross_Muller');
  s.format = 'us'; assert.equal(C.fileName(s), 'Resume_Jurgen_Gross_Muller');
  s.person.name = ''; s.format = 'uk'; assert.equal(C.fileName(s), 'CV');
});
