/* CV Builder UI. State lives in localStorage (key below) and is saved as you type.
   ?demo=1 shows the example CV in memory only and never touches the stored data. ?lang=de|en picks the UI language,
   ?format=de|uk|us and ?template=classic|modern|compact pick the output. ?shot=1 hides the demo banner (screenshots). */
(function () {
  'use strict';
  const C = window.CVCore, I18N = window.CVI18N, CFG = window.CVCONFIG || { site: '' };
  const KEY = 'hmsk-cv-builder';
  const params = new URLSearchParams(location.search);
  const DEMO = params.get('demo') === '1';
  const $ = s => document.querySelector(s);
  const main = $('#main');

  let state, canSave = true, lang = 'en', view = 'edit';

  // ---------- storage ----------
  function load() {
    if (DEMO) { canSave = false; return C.demoState(params.get('format') || 'de'); }
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { canSave = false; }
    if (raw) {
      try { return C.migrate(JSON.parse(raw)); }
      catch (e) { try { localStorage.setItem(KEY + '-broken-' + Date.now(), raw); } catch (e2) { /* ignore */ } }
    }
    return C.emptyState(defaultFormat());
  }
  let saveTimer;
  function save(now) {
    if (!canSave) return;
    clearTimeout(saveTimer);
    const go = () => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); $('#saved').textContent = t('saved'); }
      catch (e) { canSave = false; toast(t('saved_err', { e: e.message })); showBanner(); }
    };
    if (now) go(); else saveTimer = setTimeout(go, 300);
  }
  function defaultFormat() {
    const q = params.get('lang');
    if (q === 'de') return 'de';
    const nl = navigator.language || '';
    if (/^de\b/i.test(nl)) return 'de';
    if (/^en-US/i.test(nl)) return 'us';
    return /^en-GB/i.test(nl) ? 'uk' : 'de';
  }

  // ---------- i18n ----------
  function pickLang() {
    const q = params.get('lang');
    if (q === 'de' || q === 'en') return q;
    if (state.settings.lang) return state.settings.lang;
    return /^de\b/i.test(navigator.language || '') ? 'de' : 'en';
  }
  function t(k, vars) {
    let s = (I18N[lang] && I18N[lang][k] !== undefined) ? I18N[lang][k] : I18N.en[k];
    if (vars && typeof s === 'string') for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(b);
    return s;
  }
  const esc = C.esc;
  let toastTimer;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2600); }

  function applyChrome() {
    document.documentElement.lang = lang;
    const site = CFG.site || '';
    $('#lnkHome').href = site + (lang === 'de' ? '/de/tools/cv-builder/' : '/tools/cv-builder/');
    $('#lnkHome').textContent = t('back');
    $('#lnkImprint').href = site + (lang === 'de' ? '/impressum/' : '/imprint/');
    $('#lnkImprint').textContent = t('imprint');
    $('#lnkPrivacy').href = site + (lang === 'de' ? '/datenschutz/' : '/privacy/');
    $('#lnkPrivacy').textContent = t('privacy');
    const lb = $('#langBtn');
    lb.textContent = t('lang_switch'); lb.setAttribute('aria-label', t('lang_switch_label')); lb.lang = lang === 'de' ? 'en' : 'de';
    $('#skipLink').textContent = t('skip');
    document.title = t('app') + ' · hmsk.life';
    showBanner();
  }
  function showBanner() {
    const b = $('#banner');
    if (DEMO && params.get('shot') === '1') b.hidden = true;
    else if (DEMO) {
      const u = new URL(location.href); u.searchParams.delete('demo');
      b.innerHTML = `<span>${esc(t('demo_note'))}</span> <a href="${esc(u.pathname + u.search)}">${esc(t('demo_exit'))}</a>`;
      b.hidden = false;
    } else if (!canSave) { b.textContent = t('storage_off'); b.hidden = false; }
    else b.hidden = true;
  }

  // ---------- toolbar ----------
  function toolbar() {
    const f = state.format;
    const fmts = ['de', 'uk', 'us'].map(k => `<button type="button" data-act="fmt" data-f="${k}" aria-pressed="${k === f}">${esc(t('f_' + k))}</button>`).join('');
    const opts = C.TEMPLATES.map(k => `<option value="${k}"${state.template[f] === k ? ' selected' : ''}>${esc(t(k === 'modern' && f === 'de' ? 'tpl_modern_de' : 'tpl_' + k))}</option>`).join('');
    $('#bar').innerHTML = `<div class="seg" role="group" aria-label="${esc(t('f_label'))}">${fmts}</div>
      <label class="tpl"><span class="flag">${esc(t('tpl'))}</span><select id="tplSel">${opts}</select></label>
      <span class="bar__sp"></span>
      <button type="button" class="btn btn--ghost btn--sm" data-act="export">${icon('json')} ${esc(t('json'))}</button>
      <button type="button" class="btn btn--amber btn--sm" data-act="pdf">${icon('pdf')} ${esc(t('pdf'))}</button>`;
    document.querySelectorAll('#tabs button').forEach(b => {
      b.textContent = t('tab_' + b.dataset.view);
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    main.dataset.view = view;
    main.dataset.fmt = f;
  }
  function icon(n) {
    const d = {
      pdf: 'M4 1h6l4 4v10H4zM10 1v4h4M6.5 9h3M6.5 11.5h3', json: 'M6 2C4 2 4.5 4 4.5 6S3 8 3 8s1.5 0 1.5 2S4 14 6 14M10 2c2 0 1.5 2 1.5 4S13 8 13 8s-1.5 0-1.5 2 .5 4-1.5 4',
      up: 'M8 13V3M4 7l4-4 4 4', down: 'M8 3v10M4 9l4 4 4-4', x: 'M4 4l8 8M12 4l-8 8', plus: 'M8 3v10M3 8h10',
    }[n];
    return `<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // ---------- editor ----------
  const val = k => { const [a, b, c] = k.split('.'); if (a === 'person' || a === 'sign' || a === 'settings') return state[a][b]; if (a === 'statement') return state.statement; const it = state[a].find(x => x.id === b); return it ? it[c] : ''; };
  function field(k, label, o) {
    o = o || {};
    const id = 'f_' + k.replace(/\./g, '_');
    const ph = o.ph ? ` placeholder="${esc(o.ph)}"` : '';
    const note = o.de ? ` <span class="chip-de">${esc(t('only_de'))}</span>` : '';
    const input = o.area
      ? `<textarea id="${id}" data-k="${k}" rows="${o.rows || 4}"${ph}>${esc(val(k))}</textarea>`
      : `<input id="${id}" data-k="${k}" type="${o.type || 'text'}" value="${esc(val(k))}"${ph}${o.auto ? ` autocomplete="${o.auto}"` : ''}${o.list ? ` list="${o.list}"` : ''}>`;
    return `<div class="field${o.de ? ' de-only' : ''}${o.cls ? ' ' + o.cls : ''}"><label class="flag" for="${id}">${esc(label)}${note}</label>${input}</div>`;
  }
  function check(k, label) {
    const id = 'f_' + k.replace(/\./g, '_');
    return `<label class="chk" for="${id}"><input id="${id}" type="checkbox" data-k="${k}"${val(k) ? ' checked' : ''}> ${esc(label)}</label>`;
  }
  function itemTitle(list, it) {
    const a = { experience: [it.role, it.org], education: [it.degree, it.school], skills: [it.name], languages: [it.name, it.level], extras: [it.heading] }[list];
    return a.filter(x => x && x.trim()).join(' · ') || t('untitled');
  }
  function item(list, it, i, n, inner) {
    return `<fieldset class="item" data-id="${it.id}"><legend class="item__h"><span class="item__t" data-title="${list}.${it.id}">${esc(itemTitle(list, it))}</span></legend>
      <div class="item__btns">
        <button type="button" class="ibtn" data-act="up" data-list="${list}" data-id="${it.id}" aria-label="${esc(t('up'))}"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>
        <button type="button" class="ibtn" data-act="down" data-list="${list}" data-id="${it.id}" aria-label="${esc(t('down'))}"${i === n - 1 ? ' disabled' : ''}>${icon('down')}</button>
        <button type="button" class="ibtn ibtn--del" data-act="del" data-list="${list}" data-id="${it.id}" aria-label="${esc(t('del'))}">${icon('x')}</button>
      </div>${inner}</fieldset>`;
  }
  const grid = (...f) => `<div class="fgrid">${f.join('')}</div>`;
  function listSec(list, render, addKey) {
    const arr = state[list];
    return arr.map((it, i) => item(list, it, i, arr.length, render(it))).join('') +
      `<button type="button" class="btn btn--ghost btn--sm add" data-act="add" data-list="${list}">${icon('plus')} ${esc(t(addKey))}</button>`;
  }
  function sec(id, title, inner, open) {
    return `<details class="sec" id="sec-${id}"${open ? ' open' : ''}><summary><span class="ps">$</span> ${esc(t(title).replace(/^\$ /, ''))}</summary><div class="sec__in">${inner}</div></details>`;
  }
  function editorHTML() {
    const p = 'person.';
    const photo = state.person.photo
      ? `<div class="photo"><img src="${esc(state.person.photo)}" alt=""><button type="button" class="btn btn--ghost btn--sm" data-act="photo-remove">${esc(t('photo_remove'))}</button></div>`
      : `<label class="btn btn--ghost btn--sm file-btn">${esc(t('photo_add'))}<input type="file" accept="image/jpeg,image/png,image/webp" id="photoIn" class="sr"></label>`;
    const person = grid(
      field(p + 'name', t('p_name'), { auto: 'name' }), field(p + 'headline', t('p_headline'), { ph: t('p_headline_ph') }),
      field(p + 'email', t('p_email'), { type: 'email', auto: 'email' }), field(p + 'phone', t('p_phone'), { type: 'tel', auto: 'tel' }),
      field(p + 'street', t('p_street'), { de: true, auto: 'street-address' }), field(p + 'city', t('p_city'), { ph: t('p_city_ph') }),
      field(p + 'country', t('p_country'), { auto: 'country-name' }), field(p + 'linkedin', t('p_linkedin'), { ph: 'linkedin.com/in/...' }),
      field(p + 'website', t('p_website'), { type: 'url', ph: 'https://' }), field(p + 'permit', t('p_permit'), { ph: t('p_permit_ph') }),
      field(p + 'birthDate', t('p_birthDate'), { de: true, ph: t('p_birthDate_ph') }), field(p + 'birthPlace', t('p_birthPlace'), { de: true }),
      field(p + 'nationality', t('p_nationality'), { de: true }), field(p + 'marital', t('p_marital'), { de: true }),
    ) + `<div class="field de-only"><span class="flag">${esc(t('p_photo'))} <span class="chip-de">${esc(t('only_de'))}</span></span>${photo}<p class="dim small">${esc(t('photo_note'))}</p></div>`;
    const exp = listSec('experience', it => grid(
      field(`experience.${it.id}.role`, t('e_role')), field(`experience.${it.id}.org`, t('e_org')),
      field(`experience.${it.id}.start`, t('e_start'), { ph: t('date_ph'), cls: 'f-date' }), field(`experience.${it.id}.end`, t('e_end'), { ph: t('date_ph'), cls: 'f-date' }),
      field(`experience.${it.id}.location`, t('e_location')), `<div class="field f-chk">${check(`experience.${it.id}.current`, t('e_current'))}</div>`,
    ) + field(`experience.${it.id}.bullets`, t('e_bullets'), { area: true, ph: t('e_bullets_ph') }), 'add_exp');
    const edu = listSec('education', it => grid(
      field(`education.${it.id}.degree`, t('d_degree')), field(`education.${it.id}.school`, t('d_school')),
      field(`education.${it.id}.start`, t('e_start'), { ph: t('date_ph'), cls: 'f-date' }), field(`education.${it.id}.end`, t('e_end'), { ph: t('date_ph'), cls: 'f-date' }),
      field(`education.${it.id}.location`, t('e_location')), field(`education.${it.id}.grade`, t('d_grade')),
      `<div class="field f-chk">${check(`education.${it.id}.current`, t('d_current'))}</div>`,
    ) + field(`education.${it.id}.details`, t('d_details'), { area: true, rows: 2, ph: t('d_details_ph') }), 'add_edu');
    const skills = listSec('skills', it => grid(field(`skills.${it.id}.name`, t('k_name'), { ph: t('k_name_ph') }), field(`skills.${it.id}.items`, t('k_items'), { ph: t('k_items_ph'), cls: 'f-wide' })), 'add_skill');
    const langs = listSec('languages', it => grid(field(`languages.${it.id}.name`, t('l_name')), field(`languages.${it.id}.level`, t('l_level'), { ph: t('l_level_ph'), list: 'levels' })), 'add_lang');
    const extras = listSec('extras', it => field(`extras.${it.id}.heading`, t('x_heading'), { ph: t('x_heading_ph') }) + field(`extras.${it.id}.lines`, t('x_lines'), { area: true, rows: 3, ph: t('x_lines_ph') }), 'add_extra');
    const sign = grid(field('sign.place', t('sign_place'), { ph: t('sign_place_ph') }), field('sign.date', t('sign_date'), { ph: t('sign_date_ph') })) + `<p class="dim small">${esc(t('sign_note'))}</p>`;
    const data = `<p class="dim small">${esc(t('data_local'))}</p>
      <div class="btn-row">
        <button type="button" class="btn btn--ghost btn--sm" data-act="export">${esc(t('exp_json'))}</button>
        <label class="btn btn--ghost btn--sm file-btn">${esc(t('imp_json'))}<input type="file" accept="application/json,.json" id="importIn" class="sr"></label>
        <button type="button" class="btn btn--ghost btn--sm" data-act="demo">${esc(t('load_demo'))}</button>
        <button type="button" class="btn btn--ghost btn--sm btn--danger" data-act="clear">${esc(t('clear'))}</button>
      </div>
      <label class="chk"><input type="checkbox" data-k="settings.sort"${state.settings.sort ? ' checked' : ''}> ${esc(t('sort'))}</label>`;
    const levels = ['Native', 'Muttersprache', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1', 'Fluent', 'Conversational', 'verhandlungssicher', 'fließend', 'Grundkenntnisse']
      .map(v => `<option value="${v}">`).join('');
    return sec('person', 's_person', person, true) +
      sec('statement', 's_statement', field('statement', '--text', { area: true, rows: 4, ph: t('statement_ph') }) + `<p class="dim small">${esc(t('statement_note'))}</p>`, true) +
      sec('exp', 's_exp', exp, true) + sec('edu', 's_edu', edu, true) + sec('skills', 's_skills', skills, true) +
      sec('langs', 's_langs', langs, true) + sec('extras', 's_extras', extras, state.extras.length > 0) +
      `<div class="de-only">${sec('sign', 's_sign', sign, true)}</div>` + sec('data', 's_data', data, false) +
      `<datalist id="levels">${levels}</datalist><p class="saved dim small" id="saved" aria-live="polite"></p>`;
  }
  function renderEditor() {
    const open = {};
    document.querySelectorAll('#editor details.sec').forEach(d => { open[d.id] = d.open; });
    $('#editor').innerHTML = editorHTML();
    document.querySelectorAll('#editor details.sec').forEach(d => { if (d.id in open) d.open = open[d.id]; });
  }

  // ---------- preview ----------
  let pvTimer;
  function schedulePreview() { clearTimeout(pvTimer); pvTimer = setTimeout(renderPreview, 120); }
  function renderPreview() {
    const f = state.format, page = C.PAGES[C.FORMATS[f].page];
    $('#pageStyle').textContent = `@page { size: ${page.css}; margin: ${page.my}px ${page.mx}px; }`;
    const paper = $('#paper');
    paper.style.width = page.w + 'px';
    paper.style.padding = page.my + 'px ' + page.mx + 'px';
    paper.innerHTML = C.render(state);
    measure();
    renderSide();
  }
  let pages = 1;
  function measure() {
    const f = state.format, page = C.PAGES[C.FORMATS[f].page], paper = $('#paper'), stage = $('#stage');
    const cv = paper.querySelector('.cv');
    if (!cv || !stage.clientWidth) return;
    const usable = page.h - 2 * page.my;
    const h = cv.scrollHeight;
    pages = Math.max(1, Math.ceil((h - 2) / usable));
    paper.style.minHeight = (2 * page.my + pages * usable) + 'px';
    paper.querySelectorAll('.guide').forEach(g => g.remove());
    for (let k = 1; k < pages; k++) {
      const g = document.createElement('div');
      g.className = 'guide'; g.style.top = (page.my + k * usable) + 'px';
      g.dataset.label = (lang === 'de' ? 'Seite ' : 'page ') + (k + 1);
      paper.appendChild(g);
    }
    const scale = Math.min(1, (stage.clientWidth - 2) / page.w);
    paper.style.transform = `scale(${scale})`;
    paper.style.left = Math.max(0, (stage.clientWidth - page.w * scale) / 2) + 'px';
    document.documentElement.style.setProperty('--top-h', document.querySelector('.top').offsetHeight + 'px');
    stage.style.height = Math.ceil(paper.offsetHeight * scale) + 'px';
    const pc = $('#pagecount');
    const max = C.FORMATS[f].maxPages;
    pc.innerHTML = `<b>${esc(t('pages', { n: pages }))}</b> <span class="dim">(${esc(t('pages_est'))})</span>`;
    pc.classList.toggle('over', pages > max);
    $('#over').textContent = pages > max ? t('too_long', { max, fmt: t('f_' + f) }) : '';
  }
  function renderSide() {
    const f = state.format;
    const cs = C.checks(state).map(c => `<li class="ck ck--${c.level}">${esc(t('c_' + c.code))}</li>`).join('');
    $('#checks').innerHTML = cs;
    const tips = t('tips')[f].map(x => `<li>${esc(x)}</li>`).join('');
    const tipsEl = $('#tips');
    const wasOpen = tipsEl.dataset.init ? tipsEl.open : window.matchMedia('(min-width: 1000px)').matches;
    tipsEl.innerHTML = `<summary>${esc(t('tips_h', { fmt: { de: 'lebenslauf', uk: 'cv-uk', us: 'resume-us' }[f] }))}</summary><ul>${tips}</ul><p class="dim small">${esc(t('pdf_hint'))}</p>`;
    tipsEl.open = wasOpen; tipsEl.dataset.init = '1';
    $('#offer').innerHTML = emailOffer();
  }
  function emailOffer() {
    if (DEMO || state.meta.exports < 1 || state.meta.offerHidden) return '';
    const href = (CFG.site || '') + (lang === 'de' ? '/de/newsletter/?topic=cv-builder' : '/subscribe/?topic=cv-builder');
    return `<aside class="offer"><p><span class="ps">&gt;</span> ${esc(t('email_offer'))} <a href="${esc(href)}">${esc(t('email_link'))}</a></p>
      <p class="dim small">${esc(t('email_honest'))}</p><button type="button" class="linkish small" data-act="hide-offer">${esc(t('email_hide'))}</button></aside>`;
  }

  // ---------- actions ----------
  function setVal(k, v) {
    const [a, b, c] = k.split('.');
    if (a === 'person' || a === 'sign' || a === 'settings') state[a][b] = v;
    else if (a === 'statement') state.statement = v;
    else { const it = state[a].find(x => x.id === b); if (it) it[c] = v; }
  }
  function changed(editor) {
    save();
    if (editor) renderEditor();
    schedulePreview();
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function printPdf() {
    clearTimeout(pvTimer); renderPreview();
    const title = document.title;
    document.title = C.fileName(state);
    const done = () => { document.title = title; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1000);
    if (!DEMO) { state.meta.exports++; save(true); renderSide(); }
  }
  async function readPhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = url; });
      const W = 300, H = 400, r = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      return cv.toDataURL('image/jpeg', 0.85);
    } finally { URL.revokeObjectURL(url); }
  }

  main.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k) return;
    setVal(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    const [list, id] = k.split('.');
    const tEl = document.querySelector(`[data-title="${list}.${id}"]`);
    if (tEl) { const it = state[list].find(x => x.id === id); if (it) tEl.textContent = itemTitle(list, it); }
    changed(false);
  });
  document.addEventListener('change', async e => {
    if (e.target.id === 'tplSel') { state.template[state.format] = e.target.value; changed(false); return; }
    if (e.target.id === 'photoIn' && e.target.files[0]) {
      try { state.person.photo = await readPhoto(e.target.files[0]); changed(true); }
      catch (err) { toast(t('import_err', { e: err.message })); }
      return;
    }
    if (e.target.id === 'importIn' && e.target.files[0]) {
      const file = e.target.files[0]; e.target.value = '';
      try {
        const s = C.migrate(JSON.parse(await file.text()));
        if (!confirm(t('confirm_import'))) return;
        state = s; save(true); lang = pickLang(); applyChrome(); toolbar(); renderEditor(); renderPreview(); toast(t('imported'));
      } catch (err) { toast(t('import_err', { e: err.message })); }
    }
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act], #langBtn, #tabs button');
    if (!b) return;
    if (b.id === 'langBtn') {
      lang = lang === 'de' ? 'en' : 'de'; state.settings.lang = lang; save(true);
      applyChrome(); toolbar(); renderEditor(); renderPreview(); return;
    }
    if (b.dataset.view) { view = b.dataset.view; toolbar(); if (view === 'preview') requestAnimationFrame(measure); window.scrollTo(0, 0); return; }
    const act = b.dataset.act, list = b.dataset.list, id = b.dataset.id;
    if (act === 'fmt') { state.format = b.dataset.f; toolbar(); changed(false); return; }
    if (act === 'pdf') return printPdf();
    if (act === 'export') { download(C.fileName(state) + '.json', C.exportJSON(state), 'application/json'); toast(t('exported')); return; }
    if (act === 'add') {
      const it = C.blank(list); state[list].push(it); changed(true);
      const first = document.querySelector(`fieldset[data-id="${it.id}"] input, fieldset[data-id="${it.id}"] textarea`);
      if (first) first.focus();
      return;
    }
    if (act === 'del' || act === 'up' || act === 'down') {
      const arr = state[list], i = arr.findIndex(x => x.id === id);
      if (i < 0) return;
      if (act === 'del') arr.splice(i, 1);
      else { const j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
      changed(true); return;
    }
    if (act === 'photo-remove') { state.person.photo = ''; changed(true); return; }
    if (act === 'demo') {
      if (!confirm(t('confirm_demo'))) return;
      const keep = state.settings.lang; state = C.demoState(state.format); state.settings.lang = keep; save(true); renderEditor(); toolbar(); renderPreview(); return;
    }
    if (act === 'clear') {
      if (!confirm(t('confirm_clear'))) return;
      const f = state.format, keep = state.settings.lang; state = C.emptyState(f); state.settings.lang = keep; save(true); renderEditor(); renderPreview(); return;
    }
    if (act === 'hide-offer') { state.meta.offerHidden = true; save(true); renderSide(); }
  });
  window.addEventListener('beforeprint', () => { clearTimeout(pvTimer); renderPreview(); });
  if (window.ResizeObserver) new ResizeObserver(() => measure()).observe($('#stage'));
  else window.addEventListener('resize', measure);

  // ---------- start ----------
  state = load();
  const qf = params.get('format'), qt = params.get('template');
  if (C.FORMATS[qf]) state.format = qf;
  if (C.TEMPLATES.includes(qt)) state.template[state.format] = qt;
  lang = pickLang();
  if (params.get('view') === 'preview') view = 'preview';
  applyChrome(); toolbar(); renderEditor(); renderPreview();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.CVApp = { get state() { return state; }, measure }; // for tests in the browser
})();
