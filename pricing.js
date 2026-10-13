/*
 * Besky commissions: shared price table, estimate logic and quote codes.
 * Loaded by index.html (the quote form) and verify.html (Besky's checker),
 * so the form and the checker always use the same prices and the same hash.
 *
 * About the "Quote code": it is a short FNV-1a hash of the form's own "Label: value" lines
 * between the greeting and the code (X timestamps and other extra lines are ignored).
 * It only makes casual edits easy to spot (someone changing a price or item
 * in the pasted DM). It is NOT cryptographic security: the algorithm and salt
 * are public, so a determined person could recompute a matching code. The
 * real safeguard is verify.html re-calculating the price from the items.
 */
(function (root) {
  'use strict';

  // retired: no longer offered (removed from the form); kept so old DMs still parse and verify.
  // kind: still | anim | other (decides the spicy add-on). qty: which quantity field applies.
  var PRODUCTS = {
    'img-still':    { cat: 'Images', label: 'Character still: one character, plain background', price: 10, kind: 'still', qty: 'chars' },
    'img-scene':    { cat: 'Images', label: 'Full scene: character plus custom background', price: 18, kind: 'still', qty: 'chars' },
    'img-ych':      { cat: 'Images', label: 'Static YCH slot (your OC in my base)', price: 15, kind: 'still', retired: true },
    'img-edit':     { cat: 'Images', label: 'Outfit or pose edit of your existing ref (one change)', price: 6, kind: 'still', qty: 'edits' },
    'img-design':   { cat: 'Images', label: 'New character design + ref sheet (designed from scratch: front/back turnaround, colors, markings)', price: 50, kind: 'still', refSheet: true },
    'img-refsheet': { cat: 'Images', label: 'Ref sheet of your existing character (front/back turnaround matched to your refs)', price: 40, kind: 'still', refSheet: true },
    'vid-idle':     { cat: 'Video & Loops', label: 'Idle loop, 4–6 s seamless (breathing, blink, tail or ear motion)', price: 35, kind: 'anim' },
    'vid-ych':      { cat: 'Video & Loops', label: 'Animated YCH slot', price: 40, kind: 'anim' },
    'vid-clip':     { cat: 'Video & Loops', label: 'Custom short clip, 5–10 s, single shot', price: 50, kind: 'anim' },
    'vid-emote':    { cat: 'Video & Loops', label: 'Animated emotes', price: 8, kind: 'anim', qty: 'emotes' },
    'app-reskin':   { cat: 'Simple Web Apps', label: 'Reskin of an existing tool (your art, colors, sounds)', price: 40, kind: 'other', retired: true },
    'app-custom':   { cat: 'Simple Web Apps', label: 'Custom one-page app (timer, counter, tracker, mini game)', price: 180, kind: 'other' },
    'app-update':   { cat: 'Simple Web Apps', label: 'Small updates later', price: 15, kind: 'other', qty: 'updates' },
    'mus-loop':     { cat: 'Music', label: 'Seamless loop track, 60–120 s (menu, stream, game)', price: 20, kind: 'other', qty: 'tracks' },
    'mus-pack':     { cat: 'Music', label: '3-track pack (for example menu, gameplay, boss)', price: 50, kind: 'other' },
    'sfx-one':      { cat: 'Sound Effects', label: 'Custom sound effect', price: 3, kind: 'other', qty: 'sfx' },
    'sfx-pack':     { cat: 'Sound Effects', label: 'Pack of 10 (UI, pops, sparkles, game feedback)', price: 20, kind: 'other' },
    'ast-sprite':   { cat: 'Assets', label: 'Game sprite set, about 6 items, transparent PNG', price: 25, kind: 'still' },
    'ast-stream':   { cat: 'Assets', label: 'Stream pack (panels, overlay, starting soon, BRB)', price: 30, kind: 'still' },
    'ast-pfp':      { cat: 'Assets', label: 'Profile picture plus banner set', price: 15, kind: 'still' },
    'other':        { cat: 'Other or not sure', label: 'Other or not sure', price: null, kind: 'other' }
  };

  var QTY = {
    chars:   ['Number of characters', 'Each extra character is +$8.'],
    edits:   ['Number of edits', '$6 per change.'],
    emotes:  ['Number of emotes', '$8 each, or 5 for $35.'],
    updates: ['Number of updates', '$15 each.'],
    tracks:  ['Number of tracks', '$20 per track. The 3-track pack is $50.'],
    sfx:     ['Number of sound effects', '$3 each. A pack of 10 is $20.']
  };

  var PRICES = {
    extraCharacter: 8, soundOnAnimation: 10, aiPack: 15,
    refSheetMin: 20, spicyStill: 35, spicyAnim: 45, spicyAnimMin: 80,
    commercialMultiplier: 2, rushMultiplier: 1.5,
    emotePack: 35, emotePackSize: 5
  };

  // Uses that make an order commercial (2×). Must match the form checkbox values.
  var COMMERCIAL_USES = ['Game', 'Advertisement or promo', 'Merch or products'];

  // DM line labels the checker relies on. The form writes them; verify.html reads them.
  var LABELS = {
    item: 'Item', av: 'Add sound effects or music', aiPack: 'AI-ready pack add-on',
    use: "What it's for", spicy: 'Spicy (18+)', rush: 'Rush', estimate: 'Page estimate', code: 'Quote code'
  };
  var HEAD = 'Hi Besky! Quote request from besky commissions page:';

  function itemText(id) {
    var p = PRODUCTS[id];
    if (!p) return '';
    return id === 'other' ? p.label : p.label + ' (' + p.cat + ')';
  }

  function clampQty(n) { n = parseInt(n, 10); return Math.max(1, Math.min(99, isNaN(n) ? 1 : n)); }

  /*
   * opts: { product, qty, av, aiPack, spicy, commercial, rush }
   * Returns null (no product), { quoted:true } for "Quoted by DM", or { total, parts }.
   */
  function estimate(opts) {
    var p = PRODUCTS[opts.product];
    if (!p) return null;
    if (p.price == null) return { quoted: true, total: null, text: 'Quoted by DM', parts: [] };
    var n = clampQty(opts.qty), parts = [], base = p.price;
    if (p.qty === 'chars') {
      base = p.price + (n - 1) * PRICES.extraCharacter;
      if (n > 1) parts.push((n - 1) + ' extra character' + (n > 2 ? 's' : '') + ' +$' + (n - 1) * PRICES.extraCharacter);
    } else if (p.qty === 'emotes') {
      base = Math.floor(n / PRICES.emotePackSize) * PRICES.emotePack + Math.min((n % PRICES.emotePackSize) * p.price, PRICES.emotePack);
      parts.push(n + ' emote' + (n > 1 ? 's' : ''));
    } else if (p.qty) {
      base = p.price * n;
      if (n > 1) parts.push(n + ' × $' + p.price);
    }
    // Never estimate below the selected item's own listed price.
    var total = Math.max(base, p.price);
    if (opts.av && p.kind === 'anim') { total += PRICES.soundOnAnimation; parts.push('sound or music +$' + PRICES.soundOnAnimation); }
    if (p.refSheet) total = Math.max(total, PRICES.refSheetMin); // every ref sheet is at least $20
    if (opts.aiPack && p.refSheet) { total += PRICES.aiPack; parts.push('AI-ready pack +$' + PRICES.aiPack); }
    if (opts.spicy && p.kind === 'still') { total += PRICES.spicyStill; parts.push('spicy +$' + PRICES.spicyStill); }
    else if (opts.spicy && p.kind === 'anim') {
      total += PRICES.spicyAnim; parts.push('spicy +$' + PRICES.spicyAnim);
      if (total < PRICES.spicyAnimMin) { total = PRICES.spicyAnimMin; parts.push('spicy animation minimum $' + PRICES.spicyAnimMin); }
    } else if (opts.spicy) parts.push('spicy add-on quoted by DM');
    if (opts.commercial) { total *= PRICES.commercialMultiplier; parts.push('commercial use 2×'); }
    if (opts.rush) { total *= PRICES.rushMultiplier; parts.push('rush +50%'); }
    total = Math.ceil(Math.max(total, p.price));
    return { quoted: false, total: total, text: 'Estimated from $' + total + ', final quote by DM', parts: parts };
  }

  function estimateLine(est) {
    if (!est) return '';
    return est.quoted ? 'Quoted by DM' : 'from $' + est.total;
  }

  // ---- normalisation + quote code ----
  // Undo what X or a phone keyboard might change: CRLF, trailing/double spaces,
  // non-breaking spaces, smart quotes, dash variants, emoji variation selectors.
  function normalizeLine(s) {
    s = String(s);
    if (s.normalize) s = s.normalize('NFKC');
    s = s.replace(/[\u200B-\u200D\u2060\uFEFF\uFE0E\uFE0F]/g, '')
         .replace(/[\u2018\u2019\u201A\u201B\u2032\u0060\u00B4]/g, "'")
         .replace(/[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"')
         .replace(/[\u2010-\u2015\u2212]/g, '-')
         .replace(/\u2026/g, '...')
         .replace(/[\s\u00A0\u202F\u3000]+/g, ' ')
         .trim();
    return s;
  }

  function splitLines(text) {
    return String(text).replace(/\r\n?/g, '\n').split('\n');
  }

  // Every label the quote form can write. Only these lines are hashed; anything else
  // (X timestamps like "5:28", "Seen", notes typed around the request) is left out of
  // the code and listed separately by verify.html so nothing is silently hidden.
  var FORM_LABELS = [LABELS.item, LABELS.av, LABELS.aiPack, 'Character', 'Permission', 'Name and species or type',
    'Key details', 'References', 'Images', 'Idea', LABELS.use, LABELS.spicy, 'X bio', 'X account', 'X handle',
    'Deadline', LABELS.rush, 'Format or size', 'Budget', 'Payment', 'Anything else', LABELS.estimate, 'Confirmed'];
  Object.keys(QTY).forEach(function (k) { FORM_LABELS.push(QTY[k][0]); });
  var LABEL_SET = {};
  FORM_LABELS.forEach(function (l) { LABEL_SET[normalizeLine(l).toLowerCase()] = normalizeLine(l); });

  /*
   * Splits a pasted DM into:
   *   fields:  form lines ("Label: value" with a known label) between the greeting and the
   *            first Quote code line, normalised, in pasted order. These are what the code covers.
   *   ignored: every other non-empty line (timestamps, "Seen", text before the greeting,
   *            anything after the code, unknown labels) and where it was found.
   *   legacy:  the original v1 view (every line except greeting and code lines).
   */
  function analyse(text) {
    var lines = splitLines(text).map(normalizeLine), head = normalizeLine(HEAD);
    var headAt = lines.indexOf(head), codeAt = -1;
    lines.forEach(function (l, i) { if (codeAt < 0 && /^quote\s*code\s*:/i.test(l)) codeAt = i; });
    var fields = [], ignored = [], legacy = [];
    lines.forEach(function (l, i) {
      if (!l || l === head) return;
      var m = /^([^:]{1,60}):\s?(.*)$/.exec(l);
      var label = m ? m[1].trim() : '', value = m ? m[2].trim() : l;
      if (m && label === LABELS.code) return;
      legacy.push(m ? label + ': ' + value : l);
      if (/^quote\s*code\s*:/i.test(l)) return;
      var where = (headAt >= 0 && i < headAt) ? 'before' : (codeAt >= 0 && i > codeAt) ? 'after' : 'inside';
      var known = m && LABEL_SET[label.toLowerCase()];
      if (where === 'inside' && known) fields.push({ label: known, value: value, line: known + ': ' + value });
      else ignored.push({ line: l, where: where });
    });
    return { fields: fields, ignored: ignored, legacy: legacy.join('\n') };
  }

  function fieldLines(text) { return analyse(text).fields; }
  function canonical(text) { return fieldLines(text).map(function (f) { return f.line; }).join('\n'); }

  // FNV-1a 64-bit over UTF-8 bytes (BigInt). Not cryptographic; see the note at the top.
  var SALT = 'besky-quote-v1';
  function fnv1a64(str) {
    var bytes = new TextEncoder().encode(SALT + '\n' + str);
    var h = 0xcbf29ce484222325n, prime = 0x100000001b3n, mask = 0xffffffffffffffffn;
    for (var i = 0; i < bytes.length; i++) { h ^= BigInt(bytes[i]); h = (h * prime) & mask; }
    return h;
  }
  var B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (no I, L, O, U)
  function codeOf(str) {
    var h = fnv1a64(str), s = '';
    for (var i = 0; i < 8; i++) { s += B32[Number(h & 31n)]; h >>= 5n; }
    return 'BQ-' + s.slice(0, 4) + '-' + s.slice(4);
  }
  // Same salt and hash as v1: for a clean DM the canonical text is unchanged, so every code
  // made before this fix still verifies; extra lines like X timestamps no longer count.
  function quoteCode(text) { return codeOf(canonical(text)); }
  function readCode(text) {
    var found = '';
    splitLines(text).forEach(function (raw) {
      if (found) return;
      var m = /^quote\s*code\s*:\s*(BQ\s*-?\s*[0-9A-Z]{4}\s*-?\s*[0-9A-Z]{4})(?![0-9A-Z])/i.exec(normalizeLine(raw));
      if (m) found = m[1].toUpperCase().replace(/[\s-]/g, '').replace(/^BQ(.{4})(.{4})$/, 'BQ-$1-$2');
    });
    return found;
  }
  // { ok, how: 'current' | 'legacy' | '', code, expected } for verify.html.
  function checkCode(text) {
    var code = readCode(text), expected = quoteCode(text);
    if (!code) return { ok: false, how: '', code: '', expected: expected };
    if (code === expected) return { ok: true, how: 'current', code: code, expected: expected };
    if (code === codeOf(analyse(text).legacy)) return { ok: true, how: 'legacy', code: code, expected: expected };
    return { ok: false, how: '', code: code, expected: expected };
  }
  function withCode(text) {
    return text + '\n' + LABELS.code + ': ' + quoteCode(text);
  }

  // ---- parsing a pasted DM back into estimate inputs (for verify.html) ----
  function parseRequest(text) {
    var an = analyse(text), fields = an.fields, get = function (label) {
      var f = fields.filter(function (x) { return x.label === label; })[0]; return f ? f.value : '';
    };
    var itemVal = get(LABELS.item), product = '';
    Object.keys(PRODUCTS).forEach(function (id) { if (normalizeLine(itemText(id)) === itemVal) product = id; });
    var p = PRODUCTS[product], qty = 1;
    if (p && p.qty) { var q = get(QTY[p.qty][0]); if (q) qty = clampQty(q); }
    var uses = get(LABELS.use);
    var commercial = COMMERCIAL_USES.some(function (u) { return uses.split(/,\s*/).map(function (x) { return x.replace(/\s*\(commercial use.*$/, ''); }).indexOf(u) >= 0; });
    var spicyVal = get(LABELS.spicy);
    return {
      item: itemVal, product: product, qty: qty,
      av: !!get(LABELS.av), aiPack: !!get(LABELS.aiPack),
      spicy: /^yes/i.test(spicyVal), commercial: commercial, rush: /^yes/i.test(get(LABELS.rush)),
      pageEstimate: get(LABELS.estimate), code: readCode(text), fields: fields, ignored: an.ignored
    };
  }

  root.BeskyQuote = {
    PRODUCTS: PRODUCTS, QTY: QTY, PRICES: PRICES, LABELS: LABELS, HEAD: HEAD, COMMERCIAL_USES: COMMERCIAL_USES,
    itemText: itemText, clampQty: clampQty, estimate: estimate, estimateLine: estimateLine,
    normalizeLine: normalizeLine, canonical: canonical, analyse: analyse, FORM_LABELS: FORM_LABELS,
    quoteCode: quoteCode, readCode: readCode, checkCode: checkCode,
    withCode: withCode, parseRequest: parseRequest
  };
})(typeof window !== 'undefined' ? window : globalThis);
