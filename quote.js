(() => {
  'use strict';
  const RECIPIENT = '1613423138397917184';
  const LIMIT = 1900; // keep the DM under ~2,000 characters
  const form = document.getElementById('quote-form');
  if (!form) return;
  const $ = (id) => document.getElementById(id);

  // Prices, labels, estimate logic and the quote code live in pricing.js (shared with verify.html).
  const Q = window.BeskyQuote;
  const P = Q.PRODUCTS;
  const QTY = Q.QTY;

  const el = {
    product: $('q-product'), qtyWrap: $('qty-wrap'), qty: $('q-qty'), qtyLabel: $('qty-label'), qtyHint: $('qty-hint'),
    avWrap: $('av-wrap'), av: $('q-av'), aiWrap: $('ai-wrap'), ai: $('q-ai'), permWrap: $('perm-wrap'), perm: $('q-perm'), charFields: $('char-fields'),
    adultWrap: $('adult-wrap'), adult: $('q-adult'), date: $('q-date'), norush: $('q-norush'), rush: $('q-rush'),
    commercialNote: $('commercial-note'), estText: $('est-text'), estDetail: $('est-detail'), preview: $('dm-preview'),
    error: $('form-error'), trimNote: $('trim-note'), copyBtn: $('copy-btn'), copyStatus: $('copy-status')
  };

  const val = (name) => { const f = form.elements[name]; return f ? String(f.value || '').trim() : ''; };
  const radio = (name) => { const r = form.querySelector(`input[name="${name}"]:checked`); return r ? r.value : ''; };
  const qtyNum = () => Q.clampQty(el.qty.value);
  const oneLine = (s) => s.replace(/\s*\n+\s*/g, ' / ').replace(/\s{2,}/g, ' ').trim();
  const isCommercial = () => [...form.querySelectorAll('input[name="use"][data-commercial]')].some((c) => c.checked);
  const setReq = (wrap, input, on) => { wrap.hidden = !on; input.required = on; input.disabled = !on; if (!on) input.checked = false; };

  function estimate() {
    const p = P[el.product.value];
    const est = Q.estimate({
      product: el.product.value, qty: qtyNum(), av: el.av.checked && !!p && p.kind === 'anim',
      aiPack: el.ai.checked && !!p && !!p.refSheet, spicy: radio('spicy') === 'yes',
      commercial: isCommercial(), rush: el.rush.checked
    });
    if (!est) return null;
    if (est.quoted) return { text: 'Quoted by DM', detail: 'Tell me what you need and I will quote it.', total: null, quoted: true };
    return { text: est.text, detail: est.parts.length ? `Includes: ${est.parts.join(', ')}.` : 'Base price from the sheet.', total: est.total };
  }

  function fields() {
    const p = P[el.product.value];
    const lines = [];
    const add = (label, v, free) => { if (v) lines.push({ label, v: free ? oneLine(v) : v, free: !!free }); };
    if (p) add(Q.LABELS.item, Q.itemText(el.product.value));
    if (p && p.qty) add(QTY[p.qty][0], String(qtyNum()));
    if (p && p.kind === 'anim' && el.av.checked) add(Q.LABELS.av, 'Yes (+$10)');
    if (p && p.refSheet && el.ai.checked) add(Q.LABELS.aiPack, 'Yes (+$15)');
    const ch = radio('character');
    add('Character', ch);
    if (ch.startsWith("Yes, someone else") && el.perm.checked) add('Permission', "I have the owner's permission");
    if (ch !== 'Not a character piece') { add('Name and species or type', val('name'), true); add('Key details', val('details'), true); }
    add('References', val('refs').split(/\s*\n+\s*/).filter(Boolean).join(' ; '), true);
    if ($('q-attach').checked) add('Images', "I'll attach images in the DM");
    add('Idea', val('idea'), true);
    const uses = [...form.querySelectorAll('input[name="use"]:checked')].map((c) => c.value);
    if (uses.length) add("What it's for", uses.join(', ') + (isCommercial() ? ' (commercial use, 2×)' : ''));
    if (radio('spicy') === 'yes') {
      add('Spicy (18+)', 'Yes. I am 18+ and all characters are adults.');
      if ($('q-bio').checked) add('X bio', 'Shows my age or 18+');
      if ($('q-acct').checked) add('X account', 'At least 30 days old');
      const h = val('handle').replace(/^@*/, '');
      if (h) add('X handle', '@' + h);
    }
    else add('Spicy (18+)', 'No');
    if (el.norush.checked) add('Deadline', 'No rush');
    else if (el.date.value) add('Deadline', el.date.value);
    if (el.rush.checked) add('Rush', 'Yes (+50%)');
    add('Format or size', val('format'), true);
    add('Budget', val('budget'), true);
    add('Payment', radio('pay'));
    add('Anything else', val('notes'), true);
    const est = estimate();
    if (est) add(Q.LABELS.estimate, est.quoted ? 'Quoted by DM' : `from $${est.total}`);
    if ($('q-ack').checked) add('Confirmed', 'AI-assisted, 100% upfront before work starts');
    return lines;
  }

  const HEAD = Q.HEAD;
  const CODE_ROOM = 30; // room for the 'Quote code: BQ-XXXX-XXXX' line
  const TRIM = ' …[trimmed, more in DM]';
  function buildText() {
    const lines = fields();
    const render = () => [HEAD, ...lines.map((l) => `${l.label}: ${l.v}`)].join('\n');
    let text = render(); let trimmed = false;
    while (text.length > LIMIT - CODE_ROOM) {
      const free = lines.filter((l) => l.free && l.v.length > 40 && !l.v.endsWith(TRIM));
      const pool = free.length ? free : lines.filter((l) => l.free && l.v.length > 40);
      if (!pool.length) break;
      const longest = pool.reduce((a, b) => (b.v.length > a.v.length ? b : a));
      const over = text.length - (LIMIT - CODE_ROOM);
      const base = longest.v.endsWith(TRIM) ? longest.v.slice(0, -TRIM.length) : longest.v;
      const keep = Math.max(40, base.length - over - TRIM.length - 1);
      if (keep >= base.length) break;
      longest.v = base.slice(0, keep).trimEnd() + TRIM;
      trimmed = true; text = render();
    }
    return { text: Q.withCode(text), trimmed };
  }

  function dmUrl(text) { return `https://twitter.com/messages/compose?recipient_id=${RECIPIENT}&text=${encodeURIComponent(text)}`; }

  function update() {
    const p = P[el.product.value];
    if (p && p.qty) { el.qtyWrap.hidden = false; el.qtyLabel.textContent = QTY[p.qty][0]; el.qtyHint.textContent = QTY[p.qty][1]; }
    else { el.qtyWrap.hidden = true; }
    el.avWrap.hidden = !(p && p.kind === 'anim'); if (el.avWrap.hidden) el.av.checked = false;
    el.aiWrap.hidden = !(p && p.refSheet); if (el.aiWrap.hidden) el.ai.checked = false;
    const ch = radio('character');
    setReq(el.permWrap, el.perm, ch.startsWith('Yes, someone else'));
    el.charFields.hidden = ch === 'Not a character piece';
    const sp = radio('spicy') === 'yes';
    $('spicy-checks').hidden = !sp;
    setReq(el.adultWrap, el.adult, sp);
    setReq($('bio-wrap'), $('q-bio'), sp);
    setReq($('acct-wrap'), $('q-acct'), sp);
    const hw = $('handle-wrap'), hi = $('q-handle');
    hw.hidden = !sp; hi.required = sp; hi.disabled = !sp;
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
      if (f.id === 'q-handle') return f.value ? 'Your X handle (like @yourhandle)' : 'Your X handle';
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
