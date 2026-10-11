(() => {
  'use strict';
  const RECIPIENT = '1613423138397917184';
  const LIMIT = 1900; // keep the DM under ~2,000 characters
  const form = document.getElementById('quote-form');
  if (!form) return;
  const $ = (id) => document.getElementById(id);

  // Base prices from the commission sheet. kind: still | anim | other (for the spicy add-on)
  const P = {
    'img-still':  { cat: 'Images', price: 10, kind: 'still', qty: 'chars' },
    'img-scene':  { cat: 'Images', price: 18, kind: 'still', qty: 'chars' },
    'img-ych':    { cat: 'Images', price: 15, kind: 'still' },
    'img-edit':   { cat: 'Images', price: 6, kind: 'still', qty: 'edits' },
    'ref-turn':   { cat: 'AI-Ready Ref Pack', price: 25, kind: 'still' },
    'ref-full':   { cat: 'AI-Ready Ref Pack', price: 40, kind: 'still' },
    'vid-idle':   { cat: 'Video & Loops', price: 35, kind: 'anim' },
    'vid-ych':    { cat: 'Video & Loops', price: 30, kind: 'anim' },
    'vid-clip':   { cat: 'Video & Loops', price: 50, kind: 'anim' },
    'vid-emote':  { cat: 'Video & Loops', price: 8, kind: 'anim', qty: 'emotes' },
    'app-reskin': { cat: 'Simple Web Apps', price: 40, kind: 'other' },
    'app-custom': { cat: 'Simple Web Apps', price: 90, kind: 'other' },
    'app-update': { cat: 'Simple Web Apps', price: 15, kind: 'other', qty: 'updates' },
    'mus-loop':   { cat: 'Music', price: 20, kind: 'other', qty: 'tracks' },
    'mus-pack':   { cat: 'Music', price: 50, kind: 'other' },
    'sfx-one':    { cat: 'Sound Effects', price: 3, kind: 'other', qty: 'sfx' },
    'sfx-pack':   { cat: 'Sound Effects', price: 20, kind: 'other' },
    'ast-sprite': { cat: 'Assets', price: 25, kind: 'still' },
    'ast-stream': { cat: 'Assets', price: 30, kind: 'still' },
    'ast-pfp':    { cat: 'Assets', price: 15, kind: 'still' },
    'other':      { cat: 'Other or not sure', price: null, kind: 'other' }
  };
  const QTY = {
    chars:   ['Number of characters', 'Each extra character is +$8.'],
    edits:   ['Number of edits', '$6 per change.'],
    emotes:  ['Number of emotes', '$8 each, or 5 for $35.'],
    updates: ['Number of updates', '$15 each.'],
    tracks:  ['Number of tracks', '$20 per track. The 3-track pack is $50.'],
    sfx:     ['Number of sound effects', '$3 each. A pack of 10 is $20.']
  };

  const el = {
    product: $('q-product'), qtyWrap: $('qty-wrap'), qty: $('q-qty'), qtyLabel: $('qty-label'), qtyHint: $('qty-hint'),
    avWrap: $('av-wrap'), av: $('q-av'), permWrap: $('perm-wrap'), perm: $('q-perm'), charFields: $('char-fields'),
    adultWrap: $('adult-wrap'), adult: $('q-adult'), date: $('q-date'), norush: $('q-norush'), rush: $('q-rush'),
    commercialNote: $('commercial-note'), estText: $('est-text'), estDetail: $('est-detail'), preview: $('dm-preview'),
    error: $('form-error'), trimNote: $('trim-note'), copyBtn: $('copy-btn'), copyStatus: $('copy-status')
  };

  const val = (name) => { const f = form.elements[name]; return f ? String(f.value || '').trim() : ''; };
  const radio = (name) => { const r = form.querySelector(`input[name="${name}"]:checked`); return r ? r.value : ''; };
  const productLabel = () => { const o = el.product.selectedOptions[0]; return o && o.value ? o.textContent.trim() : ''; };
  const qtyNum = () => Math.max(1, Math.min(99, parseInt(el.qty.value, 10) || 1));
  const oneLine = (s) => s.replace(/\s*\n+\s*/g, ' / ').replace(/\s{2,}/g, ' ').trim();
  const isCommercial = () => [...form.querySelectorAll('input[name="use"][data-commercial]')].some((c) => c.checked);
  const setReq = (wrap, input, on) => { wrap.hidden = !on; input.required = on; input.disabled = !on; if (!on) input.checked = false; };

  function estimate() {
    const p = P[el.product.value];
    if (!p) return null;
    if (p.price == null) return { text: 'Estimate by DM', detail: 'Tell me what you need and I will quote it.', total: null };
    const n = qtyNum();
    let base = p.price; const parts = [];
    if (p.qty === 'chars') { base = p.price + (n - 1) * 8; if (n > 1) parts.push(`${n - 1} extra character${n > 2 ? 's' : ''} +$${(n - 1) * 8}`); }
    else if (p.qty === 'emotes') { base = Math.floor(n / 5) * 35 + Math.min((n % 5) * 8, 35); parts.push(`${n} emote${n > 1 ? 's' : ''}`); }
    else if (p.qty) { base = p.price * n; if (n > 1) parts.push(`${n} × $${p.price}`); }
    let total = base;
    if (el.av.checked && p.kind === 'anim') { total += 10; parts.push('sound or music +$10'); }
    const spicy = radio('spicy') === 'yes';
    if (spicy && p.kind === 'still') { total += 5; parts.push('spicy +$5'); }
    else if (spicy && p.kind === 'anim') { total += 10; parts.push('spicy +$10'); }
    else if (spicy) parts.push('spicy add-on quoted by DM');
    if (isCommercial()) { total *= 2; parts.push('commercial use 2×'); }
    if (el.rush.checked) { total *= 1.5; parts.push('rush +50%'); }
    total = Math.ceil(total);
    return { text: `Estimated from $${total}, final quote by DM`, detail: parts.length ? `Includes: ${parts.join(', ')}.` : 'Base price from the sheet.', total };
  }

  function fields() {
    const p = P[el.product.value];
    const lines = [];
    const add = (label, v, free) => { if (v) lines.push({ label, v: free ? oneLine(v) : v, free: !!free }); };
    if (p) add('Item', p.cat === 'Other or not sure' ? 'Other or not sure' : `${productLabel()} (${p.cat})`);
    if (p && p.qty) add(QTY[p.qty][0], String(qtyNum()));
    if (p && p.kind === 'anim' && el.av.checked) add('Add sound effects or music', 'Yes (+$10)');
    const ch = radio('character');
    add('Character', ch);
    if (ch.startsWith("Yes, someone else") && el.perm.checked) add('Permission', "I have the owner's permission");
    if (ch !== 'Not a character piece') { add('Name and species or type', val('name'), true); add('Key details', val('details'), true); }
    add('References', val('refs').split(/\s*\n+\s*/).filter(Boolean).join(' ; '), true);
    if ($('q-attach').checked) add('Images', "I'll attach images in the DM");
    add('Idea', val('idea'), true);
    const uses = [...form.querySelectorAll('input[name="use"]:checked')].map((c) => c.value);
    if (uses.length) add("What it's for", uses.join(', ') + (isCommercial() ? ' (commercial use, 2×)' : ''));
    if (radio('spicy') === 'yes') add('Spicy (18+)', 'Yes. I am 18+ and all characters are adults.');
    else add('Spicy (18+)', 'No');
    if (el.norush.checked) add('Deadline', 'No rush');
    else if (el.date.value) add('Deadline', el.date.value);
    if (el.rush.checked) add('Rush', 'Yes (+50%)');
    add('Format or size', val('format'), true);
    add('Budget', val('budget'), true);
    add('Payment', radio('pay'));
    add('Anything else', val('notes'), true);
    const est = estimate();
    if (est && est.total != null) add('Page estimate', `from $${est.total}`);
    if ($('q-ack').checked) add('Confirmed', 'AI-assisted, 100% upfront before work starts');
    return lines;
  }

  const HEAD = 'Hi Besky! Quote request from besky commissions page:';
  const TRIM = ' …[trimmed, more in DM]';
  function buildText() {
    const lines = fields();
    const render = () => [HEAD, ...lines.map((l) => `${l.label}: ${l.v}`)].join('\n');
    let text = render(); let trimmed = false;
    while (text.length > LIMIT) {
      const free = lines.filter((l) => l.free && l.v.length > 40 && !l.v.endsWith(TRIM));
      const pool = free.length ? free : lines.filter((l) => l.free && l.v.length > 40);
      if (!pool.length) break;
      const longest = pool.reduce((a, b) => (b.v.length > a.v.length ? b : a));
      const over = text.length - LIMIT;
      const base = longest.v.endsWith(TRIM) ? longest.v.slice(0, -TRIM.length) : longest.v;
      const keep = Math.max(40, base.length - over - TRIM.length - 1);
      if (keep >= base.length) break;
      longest.v = base.slice(0, keep).trimEnd() + TRIM;
      trimmed = true; text = render();
    }
    return { text, trimmed };
  }

  function dmUrl(text) { return `https://twitter.com/messages/compose?recipient_id=${RECIPIENT}&text=${encodeURIComponent(text)}`; }

  function update() {
    const p = P[el.product.value];
    if (p && p.qty) { el.qtyWrap.hidden = false; el.qtyLabel.textContent = QTY[p.qty][0]; el.qtyHint.textContent = QTY[p.qty][1]; }
    else { el.qtyWrap.hidden = true; }
    el.avWrap.hidden = !(p && p.kind === 'anim'); if (el.avWrap.hidden) el.av.checked = false;
    const ch = radio('character');
    setReq(el.permWrap, el.perm, ch.startsWith('Yes, someone else'));
    el.charFields.hidden = ch === 'Not a character piece';
    setReq(el.adultWrap, el.adult, radio('spicy') === 'yes');
    el.date.disabled = el.norush.checked;
    el.commercialNote.hidden = !isCommercial();
    const est = estimate();
    el.estText.textContent = est ? est.text : 'Pick a product to see an estimate';
    el.estDetail.textContent = est ? `${est.detail} This is an estimate, not a final price.` : '';
    const { text, trimmed } = buildText();
    el.preview.textContent = text;
    el.trimNote.hidden = !trimmed;
    el.trimNote.textContent = trimmed ? '✂️ Some long answers were shortened to fit an X DM. Paste the rest in the DM.' : '';
    return text;
  }

  const invalidFields = () => [...form.querySelectorAll('input, select, textarea')].filter((f) => !f.disabled && !f.checkValidity());
  function refreshError() {
    if (el.error.hidden) return;
    const invalid = invalidFields();
    if (!invalid.length) { el.error.hidden = true; return; }
    el.error.textContent = `Please fill in: ${describe(invalid)}`;
  }
  function describe(invalid) {
    return [...new Set(invalid.map((f) => {
      const fs = f.closest('fieldset'); const lg = fs && fs.querySelector('legend');
      return f.type === 'checkbox' ? f.closest('label').textContent.replace('(required)', '').trim() : (lg ? lg.textContent.replace(/^\d+\s*/, '').replace(/\(required\)/, '').trim() : f.name);
    }))].join(' · ');
  }
  function validate() {
    update();
    const invalid = invalidFields();
    if (!invalid.length) { el.error.hidden = true; return true; }
    el.error.textContent = `Please fill in: ${describe(invalid)}`;
    el.error.hidden = false;
    invalid[0].focus({ preventScroll: false });
    invalid[0].reportValidity();
    return false;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall back */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }

  form.addEventListener('input', () => { update(); refreshError(); });
  form.addEventListener('change', () => { update(); refreshError(); });
  function copySync(text) {
    // Runs inside the click so browsers allow it; X drops prefilled DM text, so we copy first.
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      ok = document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) { ok = false; }
    try { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {}); ok = ok || !!navigator.clipboard; } catch (e) {}
    return ok;
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;
    const text = update();
    const url = dmUrl(text);
    form.dataset.lastUrl = url;
    const copied = copySync(text);
    el.copyStatus.textContent = copied
      ? '✅ Request copied! In the X chat that opens, tap the message box and paste it, then send.'
      : 'Opening X… Copy failed, so open the preview below, copy it, and paste it into the DM.';
    if (!copied) el.preview.closest('details').open = true;
    window.open(url, '_blank', 'noopener');
  });
  el.copyBtn.addEventListener('click', async () => {
    const text = update();
    const ok = await copyText(text);
    el.copyStatus.textContent = ok ? '✅ Copied! Paste it into a DM to @ToothBeskar.' : 'Copy failed. Select the preview text below and copy it.';
    if (!ok) el.preview.closest('details').open = true;
  });
  update();
})();
