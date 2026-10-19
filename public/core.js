/* CV Builder core: data model, dates, format rules and the CV renderer. No DOM, no dependencies.
   Works in the browser (window.CVCore) and in Node (require) for the tests.

   One data model, three outputs:
     de  German Lebenslauf: tabular (dates left), optional photo, personal data, "Ort, Datum" + signature line. A4.
     uk  UK CV: no photo, no date of birth / nationality / marital status, personal statement first, 2 pages max. A4.
     us  US résumé: 1 page, US Letter, single column, standard headings, plain text (ATS friendly). No photo.
   Every format lists entries newest first. The renderer returns an HTML string; the app prints it to PDF
   through the browser, so the PDF holds real, selectable text. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CVCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA = 1;
  const FORMATS = {
    de: { lang: 'de', page: 'a4', maxPages: 2, photo: true },
    uk: { lang: 'en-GB', page: 'a4', maxPages: 2, photo: false },
    us: { lang: 'en-US', page: 'letter', maxPages: 1, photo: false },
  };
  const TEMPLATES = ['classic', 'modern', 'compact'];
  // page geometry in CSS px (96 per inch): size and @page margins
  const PAGES = {
    a4: { css: 'A4', w: 793.7, h: 1122.5, mx: 68, my: 57 },        // 210 × 297 mm, margins 18 / 15 mm
    letter: { css: 'letter', w: 816, h: 1056, mx: 67.2, my: 52.8 }, // 8.5 × 11 in, margins 0.7 / 0.55 in
  };

  // ---------- headings and fixed words per output ----------
  const L = {
    de: {
      title: 'Lebenslauf', personal: 'Persönliche Daten', contact: 'Kontakt', statement: 'Kurzprofil',
      experience: 'Berufserfahrung', education: 'Ausbildung', skills: 'Kenntnisse', languages: 'Sprachen',
      name: 'Name', address: 'Anschrift', phone: 'Telefon', email: 'E-Mail', web: 'Website', linkedin: 'LinkedIn',
      birth: 'Geburtsdatum', birthplace: 'in', nationality: 'Staatsangehörigkeit', marital: 'Familienstand',
      permit: 'Aufenthaltstitel', present: 'heute', grade: 'Abschlussnote', place_date: 'Ort, Datum', signature: 'Unterschrift',
      photo: 'Bewerbungsfoto',
      months: null,
    },
    uk: {
      title: 'Curriculum Vitae', personal: 'Personal details', contact: 'Contact', statement: 'Personal statement',
      experience: 'Work experience', education: 'Education', skills: 'Skills', languages: 'Languages',
      name: 'Name', address: 'Location', phone: 'Phone', email: 'Email', web: 'Website', linkedin: 'LinkedIn',
      permit: 'Right to work', present: 'Present',
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    us: {
      title: 'Résumé', personal: 'Contact', contact: 'Contact', statement: 'Summary',
      experience: 'Experience', education: 'Education', skills: 'Skills', languages: 'Languages',
      name: 'Name', address: 'Location', phone: 'Phone', email: 'Email', web: 'Website', linkedin: 'LinkedIn',
      permit: 'Work authorization', present: 'Present',
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
  };
  const labels = f => L[FORMATS[f] ? f : 'de'];

  // ---------- model ----------
  let seq = 0;
  const uid = () => Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
  const PERSON = ['name', 'headline', 'email', 'phone', 'street', 'city', 'country', 'website', 'linkedin',
    'birthDate', 'birthPlace', 'nationality', 'marital', 'permit', 'photo'];
  const LISTS = {
    experience: ['role', 'org', 'location', 'start', 'end', 'current', 'bullets'],
    education: ['degree', 'school', 'location', 'start', 'end', 'current', 'grade', 'details'],
    skills: ['name', 'items'],
    languages: ['name', 'level'],
    extras: ['heading', 'lines'],
  };
  function blank(list) {
    const o = { id: uid() };
    for (const k of LISTS[list]) o[k] = k === 'current' ? false : '';
    return o;
  }
  function emptyState(format) {
    const person = {};
    for (const k of PERSON) person[k] = '';
    return {
      schema: SCHEMA,
      format: FORMATS[format] ? format : 'de',
      template: { de: 'classic', uk: 'classic', us: 'classic' },
      person, statement: '',
      experience: [], education: [], skills: [], languages: [], extras: [],
      sign: { place: '', date: '' },
      settings: { sort: true, lang: '' },
      meta: { exports: 0, offerHidden: false },
    };
  }
  const str = v => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));
  /** Validate any parsed JSON into a clean state. Throws on things that are clearly not a CV file. */
  function migrate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not a CV file');
    if (raw.schema !== undefined && (typeof raw.schema !== 'number' || raw.schema > SCHEMA)) throw new Error('unknown version ' + raw.schema);
    if (!raw.person && !raw.experience && !raw.education) throw new Error('not a CV file');
    const s = emptyState(raw.format);
    const p = raw.person && typeof raw.person === 'object' ? raw.person : {};
    for (const k of PERSON) s.person[k] = str(p[k]);
    if (s.person.photo && !/^data:image\/(jpeg|png|webp);base64,/.test(s.person.photo)) s.person.photo = '';
    s.statement = str(raw.statement);
    for (const list of Object.keys(LISTS)) {
      const arr = Array.isArray(raw[list]) ? raw[list] : [];
      s[list] = arr.filter(x => x && typeof x === 'object').map(x => {
        const o = blank(list);
        for (const k of LISTS[list]) o[k] = k === 'current' ? !!x[k] : str(x[k]);
        if (typeof x.id === 'string' && x.id) o.id = x.id;
        return o;
      });
    }
    const t = raw.template && typeof raw.template === 'object' ? raw.template : {};
    for (const f of Object.keys(FORMATS)) if (TEMPLATES.includes(t[f])) s.template[f] = t[f];
    if (raw.sign && typeof raw.sign === 'object') { s.sign.place = str(raw.sign.place); s.sign.date = str(raw.sign.date); }
    if (raw.settings && typeof raw.settings === 'object') {
      s.settings.sort = raw.settings.sort !== false;
      s.settings.lang = raw.settings.lang === 'de' || raw.settings.lang === 'en' ? raw.settings.lang : '';
    }
    if (raw.meta && typeof raw.meta === 'object') {
      s.meta.exports = Number.isFinite(raw.meta.exports) ? Math.max(0, raw.meta.exports | 0) : 0;
      s.meta.offerHidden = !!raw.meta.offerHidden;
    }
    return s;
  }
  /** What goes into a JSON backup (same as the stored state). */
  function exportJSON(s) { return JSON.stringify(s, null, 2); }

  // ---------- dates ----------
  /** Parse what people type: 2021-03, 2021-3, 03/2021, 3.2021, 2021. Returns {y, m|null} or null. */
  function parseMonth(v) {
    const s = str(v).trim();
    let m;
    if ((m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s))) return mk(+m[1], +m[2]);
    if ((m = /^(\d{1,2})\s*[./-]\s*(\d{4})$/.exec(s))) return mk(+m[2], +m[1]);
    if ((m = /^(\d{4})$/.exec(s))) return { y: +m[1], m: null };
    return null;
    function mk(y, mo) { return mo >= 1 && mo <= 12 ? { y, m: mo } : null; }
  }
  const pad = n => String(n).padStart(2, '0');
  function fmtMonth(v, format) {
    const d = parseMonth(v);
    if (!d) return str(v).trim();
    if (d.m === null) return String(d.y);
    if (format === 'de') return pad(d.m) + '/' + d.y;
    return labels(format).months[d.m - 1] + ' ' + d.y;
  }
  /** "03/2021 – heute", "Mar 2021 – Present", "2019 – 2022", "2020" */
  function fmtRange(e, format) {
    const a = fmtMonth(e.start, format);
    const b = e.current ? labels(format).present : fmtMonth(e.end, format);
    if (a && b) return a === b ? a : a + ' – ' + b;
    return a || b || '';
  }
  // sort key: yyyymm; current entries count as "now"; undated entries go last
  function key(v, current) {
    if (current) return 999912;
    const d = parseMonth(v);
    return d ? d.y * 100 + (d.m === null ? 12 : d.m) : -1;
  }
  /** Newest first: by end (current = now), then by start. Stable for ties. */
  function sortEntries(list) {
    return list.map((e, i) => ({ e, i })).sort((a, b) => {
      const ea = key(a.e.end || (a.e.current ? '' : a.e.start), a.e.current), eb = key(b.e.end || (b.e.current ? '' : b.e.start), b.e.current);
      if (ea !== eb) return eb - ea;
      const sa = key(a.e.start), sb = key(b.e.start);
      if (sa !== sb) return sb - sa;
      return a.i - b.i;
    }).map(x => x.e);
  }
  /** Signature date: what the user typed, or today as dd.mm.yyyy. */
  function signDate(s, now) {
    if (s.sign.date.trim()) return s.sign.date.trim();
    const d = now || new Date();
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  // ---------- checks (codes; the app translates them) ----------
  function checks(s) {
    const f = s.format, p = s.person, out = [];
    if (!p.name.trim()) out.push({ level: 'warn', code: 'no_name' });
    if (!p.email.trim()) out.push({ level: 'warn', code: 'no_email' });
    if (f !== 'de') {
      if (p.photo) out.push({ level: 'info', code: 'photo_hidden' });
      if (p.birthDate.trim() || p.nationality.trim() || p.marital.trim()) out.push({ level: 'info', code: 'personal_hidden' });
    }
    if (f === 'uk' && !s.statement.trim()) out.push({ level: 'warn', code: 'no_statement' });
    if (f === 'de' && !s.sign.place.trim()) out.push({ level: 'info', code: 'no_place' });
    if (f === 'us') {
      const long = s.experience.some(e => lines(e.bullets).some(l => l.length > 220));
      if (long) out.push({ level: 'info', code: 'long_bullets' });
    }
    if (!s.experience.length && !s.education.length) out.push({ level: 'warn', code: 'empty' });
    return out;
  }

  // ---------- renderer ----------
  const esc = v => str(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lines = v => str(v).split(/\r?\n/).map(l => l.replace(/^\s*[-*•·]\s+/, '').trim()).filter(Boolean);
  const has = v => str(v).trim() !== '';
  const join = (arr, sep) => arr.filter(has).map(esc).join(sep);
  const safeUrl = u => {
    const s = str(u).trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return 'https://' + s;
    return '';
  };
  const shortUrl = u => str(u).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  const link = (u, text) => { const h = safeUrl(u); return h ? `<a href="${esc(h)}">${esc(text || shortUrl(u))}</a>` : esc(text || u); };
  const mail = m => has(m) ? `<a href="mailto:${esc(str(m).trim())}">${esc(str(m).trim())}</a>` : '';
  const ul = arr => arr.length ? `<ul>${arr.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
  const filled = (list, fields) => list.filter(e => fields.some(k => has(e[k])));
  const ordered = (s, list) => s.settings.sort ? sortEntries(list) : list;
  // "2023 | AWS Certified" -> date left, text right
  function splitLine(l) { const i = l.indexOf(' | '); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 3).trim()] : ['', l]; }

  /** Render the CV for s.format. opts.now (Date) for the signature date in tests. */
  function render(s, opts) {
    const f = FORMATS[s.format] ? s.format : 'de';
    const tpl = TEMPLATES.includes(s.template[f]) ? s.template[f] : 'classic';
    const body = f === 'de' ? renderDE(s, tpl, opts || {}) : renderEN(s, f, tpl);
    return `<article class="cv cv--${f} cv--${tpl}" lang="${FORMATS[f].lang}">${body}</article>`;
  }

  // German Lebenslauf: label/date column on the left, content on the right
  function row(left, right, cls) { return `<div class="cv-row${cls ? ' ' + cls : ''}"><div class="cv-l">${left}</div><div class="cv-r">${right}</div></div>`; }
  function sec(title, inner, cls) { return inner ? `<section class="cv-sec${cls ? ' ' + cls : ''}"><h2>${esc(title)}</h2>${inner}</section>` : ''; }

  function renderDE(s, tpl, opts) {
    const t = L.de, p = s.person;
    const addr = [p.street, p.city, p.country].filter(has);
    const birth = has(p.birthDate) ? esc(p.birthDate.trim()) + (has(p.birthPlace) ? ' ' + t.birthplace + ' ' + esc(p.birthPlace.trim()) : '') : '';
    const pdata = [
      [t.address, addr.map(esc).join('<br>')],
      [t.phone, esc(p.phone)],
      [t.email, mail(p.email)],
      [t.web, has(p.website) ? link(p.website) : ''],
      [t.linkedin, has(p.linkedin) ? link(p.linkedin) : ''],
      [t.birth, birth],
      [t.nationality, esc(p.nationality)],
      [t.marital, esc(p.marital)],
      [t.permit, esc(p.permit)],
    ].filter(x => x[1]);
    const exp = ordered(s, filled(s.experience, ['role', 'org', 'bullets'])).map(e => row(esc(fmtRange(e, 'de')),
      `<h3>${esc(e.role)}</h3><p class="cv-org">${join([e.org, e.location], ', ')}</p>${ul(lines(e.bullets))}`, 'cv-entry')).join('');
    const edu = ordered(s, filled(s.education, ['degree', 'school', 'details'])).map(e => row(esc(fmtRange(e, 'de')),
      `<h3>${esc(e.degree)}</h3><p class="cv-org">${join([e.school, e.location], ', ')}</p>` +
      (has(e.grade) ? `<p class="cv-org">${t.grade}: ${esc(e.grade)}</p>` : '') + ul(lines(e.details)), 'cv-entry')).join('');
    const skills = filled(s.skills, ['name', 'items']).map(k => row(esc(k.name), esc(k.items))).join('');
    const langs = filled(s.languages, ['name']).map(k => row(esc(k.name), esc(k.level))).join('');
    const extras = filled(s.extras, ['heading', 'lines']).map(x => sec(x.heading || '', lines(x.lines).map(l => { const [a, b] = splitLine(l); return row(esc(a), esc(b)); }).join(''))).join('');
    const photo = p.photo ? `<img class="cv-photo" src="${esc(p.photo)}" alt="${t.photo}">` : '';
    const sign = `<div class="cv-sign"><div><p>${join([s.sign.place, signDate(s, opts.now)], ', ')}</p><span>${t.place_date}</span></div>` +
      `<div><p class="cv-sign__space"></p><span>${has(p.name) ? esc(p.name) : t.signature}</span></div></div>`;
    const statement = has(s.statement) ? sec(t.statement, `<p class="cv-statement">${esc(s.statement.trim()).replace(/\n+/g, '<br>')}</p>`) : '';
    const head = `<header class="cv-head"><div><p class="cv-kicker">${t.title}</p><h1>${esc(p.name)}</h1>${has(p.headline) ? `<p class="cv-headline">${esc(p.headline)}</p>` : ''}</div>`;

    if (tpl === 'modern') {
      const side = (title, inner) => inner ? `<section class="cv-side__sec"><h2>${esc(title)}</h2>${inner}</section>` : '';
      const dl = pdata.map(([k, v]) => `<p><span>${esc(k)}</span>${v}</p>`).join('');
      const sk = filled(s.skills, ['name', 'items']).map(k => `<p><span>${esc(k.name)}</span>${esc(k.items)}</p>`).join('');
      const lg = filled(s.languages, ['name']).map(k => `<p><span>${esc(k.name)}</span>${esc(k.level)}</p>`).join('');
      return `<div class="cv-grid"><aside class="cv-side">${photo}${side(t.personal, dl)}${side(t.skills, sk)}${side(t.languages, lg)}</aside>` +
        `<div class="cv-main">${head}</header>${statement}${sec(t.experience, exp)}${sec(t.education, edu)}${extras}${sign}</div></div>`;
    }
    return `${head}${photo}</header>${sec(t.personal, pdata.map(([k, v]) => row(esc(k), v)).join(''))}${statement}` +
      `${sec(t.experience, exp)}${sec(t.education, edu)}${sec(t.skills, skills)}${sec(t.languages, langs)}${extras}${sign}`;
  }

  // UK CV and US résumé: one column, real text, standard headings. No photo, no date of birth.
  function renderEN(s, f, tpl) {
    const t = L[f], p = s.person;
    const where = [p.city, p.country];
    const contact = [join(where, ', '), esc(p.phone), mail(p.email), has(p.linkedin) ? link(p.linkedin) : '', has(p.website) ? link(p.website) : '']
      .filter(Boolean).map(x => `<span>${x}</span>`).join('<span class="cv-sep" aria-hidden="true"> | </span>');
    const permit = has(p.permit) ? `<p class="cv-permit">${t.permit}: ${esc(p.permit)}</p>` : '';
    const head = `<header class="cv-head"><h1>${esc(p.name)}</h1>${has(p.headline) ? `<p class="cv-headline">${esc(p.headline)}</p>` : ''}` +
      `<p class="cv-contact">${contact}</p>${permit}</header>`;
    const when = e => `<span class="cv-when">${esc(fmtRange(e, f))}</span>`;
    const exp = ordered(s, filled(s.experience, ['role', 'org', 'bullets'])).map(e =>
      `<div class="cv-entry"><p class="cv-line"><span><strong>${esc(e.role)}</strong>${has(e.org) ? ', ' + esc(e.org) : ''}${has(e.location) ? ', ' + esc(e.location) : ''}</span>${when(e)}</p>${ul(lines(e.bullets))}</div>`).join('');
    const edu = ordered(s, filled(s.education, ['degree', 'school', 'details'])).map(e =>
      `<div class="cv-entry"><p class="cv-line"><span><strong>${esc(e.degree)}</strong>${has(e.school) ? ', ' + esc(e.school) : ''}${has(e.location) ? ', ' + esc(e.location) : ''}</span>${when(e)}</p>` +
      (has(e.grade) ? `<p class="cv-sub">${esc(e.grade)}</p>` : '') + ul(lines(e.details)) + '</div>').join('');
    const skillRows = filled(s.skills, ['name', 'items']).map(k => `<p class="cv-kv">${has(k.name) ? `<strong>${esc(k.name)}:</strong> ` : ''}${esc(k.items)}</p>`);
    const langs = filled(s.languages, ['name']).map(k => esc(k.name) + (has(k.level) ? ' (' + esc(k.level) + ')' : '')).join(', ');
    // US résumés keep languages inside Skills so the headings stay the standard four
    const skillsBlock = f === 'us'
      ? skillRows.join('') + (langs ? `<p class="cv-kv"><strong>${t.languages}:</strong> ${langs}</p>` : '')
      : skillRows.join('');
    const extras = filled(s.extras, ['heading', 'lines']).map(x => sec(x.heading || '', ul(lines(x.lines).map(l => { const [a, b] = splitLine(l); return a ? b + ' (' + a + ')' : b; })))).join('');
    const statement = has(s.statement) ? sec(t.statement, `<p class="cv-statement">${esc(s.statement.trim()).replace(/\n+/g, '<br>')}</p>`) : '';
    return head + statement + sec(t.experience, exp) + sec(t.education, edu) + sec(t.skills, skillsBlock) +
      (f === 'uk' ? sec(t.languages, langs ? `<p>${langs}</p>` : '') : '') + extras;
  }

  /** Suggested PDF file name, e.g. Lebenslauf_Max_Mustermann, CV_Jane_Doe, Resume_Jane_Doe. */
  function fileName(s) {
    const base = { de: 'Lebenslauf', uk: 'CV', us: 'Resume' }[s.format] || 'CV';
    const n = s.person.name.trim().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
    return n ? base + '_' + n : base;
  }

  // ---------- demo ----------
  const b64 = x => (typeof btoa === 'function' ? btoa(x) : Buffer.from(x).toString('base64'));
  function demoState(format) {
    const s = emptyState(format || 'de');
    Object.assign(s.person, {
      name: 'Alex Morgan', headline: 'Product Designer', email: 'alex.morgan@example.com', phone: '+49 170 1234567',
      street: 'Beispielstraße 12', city: '10115 Berlin', country: 'Germany', linkedin: 'linkedin.com/in/alex-morgan-example',
      website: 'alexmorgan.example', birthDate: '14.05.1993', birthPlace: 'Manchester', nationality: 'British',
      permit: 'EU Blue Card (Blaue Karte EU)',
    });
    s.statement = 'Product designer with 7 years in B2B software. I turn messy workflows into simple screens, test them with real users and work closely with engineers until they ship. Moved from London to Berlin in 2022; working in English and German.';
    s.experience = [
      { role: 'Designer', org: 'Studio North', location: 'Manchester', start: '2016-09', end: '2018-12', current: false,
        bullets: 'Designed websites and brand kits for 20+ small businesses\nIntroduced a shared component library in Figma' },
      { role: 'Senior Product Designer', org: 'Ledgerly GmbH', location: 'Berlin', start: '2022-04', end: '', current: true,
        bullets: 'Lead design for invoicing and e-invoice export used by 4,000 small businesses\nCut onboarding drop-off by 31% with a three-step setup and live preview\nRun monthly usability tests with customers in Germany, Austria and Portugal' },
      { role: 'Product Designer', org: 'Brightpath Ltd', location: 'London', start: '2019-01', end: '2022-03', current: false,
        bullets: 'Redesigned the booking flow for 120 clinics; support tickets down 40%\nBuilt the design system (180 components) with two front-end engineers' },
    ].map(x => Object.assign(blank('experience'), x));
    s.education = [
      { degree: 'BA (Hons) Graphic Design', school: 'University of Leeds', location: 'Leeds', start: '2012-09', end: '2015-06', grade: 'First-class honours', details: '' },
      { degree: 'Certificate in UX Research', school: 'Nielsen Norman Group', location: 'online', start: '2020', end: '2020', grade: '', details: '' },
    ].map(x => Object.assign(blank('education'), x));
    s.skills = [
      { name: 'Design', items: 'Figma, prototyping, design systems, accessibility (WCAG 2.2)' },
      { name: 'Research', items: 'Usability testing, interviews, survey design' },
      { name: 'Tools', items: 'HTML, CSS, Jira, Notion, Miro' },
    ].map(x => Object.assign(blank('skills'), x));
    s.languages = [
      { name: 'English', level: 'Native' }, { name: 'German', level: 'C1' }, { name: 'Portuguese', level: 'A2' },
    ].map(x => Object.assign(blank('languages'), x));
    s.extras = [Object.assign(blank('extras'), { heading: 'Volunteering', lines: '2023 | Mentor at a design bootcamp for career changers' })];
    s.sign.place = 'Berlin';
    // neutral placeholder instead of a real face
    s.person.photo = 'data:image/svg+xml;base64,' + b64('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#dfe8e2"/><circle cx="150" cy="150" r="70" fill="#9fb5a7"/><path d="M30 400c0-90 54-150 120-150s120 60 120 150z" fill="#9fb5a7"/></svg>');
    return s;
  }

  return { SCHEMA, FORMATS, TEMPLATES, PAGES, PERSON, LISTS, labels, uid, blank, emptyState, demoState, migrate, exportJSON,
    parseMonth, fmtMonth, fmtRange, sortEntries, signDate, checks, render, fileName, esc, lines };
});
