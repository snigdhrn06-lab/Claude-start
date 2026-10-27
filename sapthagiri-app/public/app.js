/* SAPTHAGIRI ENTERPRISES — storefront.
   Talks to the same API as before: /api/store, /api/me, /api/login, /api/logout, /api/my-orders, /api/orders. */
(function () {
  "use strict";

  // ---------- State ----------
  var S = {
    settings: {}, collections: [], products: [], shops: [], byId: {}, colById: {}, me: null,
    cart: [], saved: [], recent: [], searches: [],
    plan: { occ: null, budget: "any" },
    f: { occ: [], price: "", stock: false, sale: false, sort: "rec" },
    route: "", lastOrder: null
  };
  var K = { cart: "se-cart-v1", draft: "se-checkout-v1", saved: "se-saved-v1", recent: "se-recent-v1", searches: "se-searches-v1" };
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Helpers ----------
  function $(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function img(id) { return "/img/" + id; }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function waNum(v) { var d = String(v || "").replace(/\D/g, ""); if (d.length === 10) d = "91" + d; if (d.length === 11 && d[0] === "0") d = "91" + d.slice(1); return d; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function icon(n, cls) { return '<svg class="i ' + (cls || "") + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function debounce(fn, ms) { var t; return function () { var a = arguments, me = this; clearTimeout(t); t = setTimeout(function () { fn.apply(me, a); }, ms); }; }
  function first(name) { return String(name || "").trim().split(/\s+/)[0] || ""; }
  function api(path, opts) {
    opts = opts || {};
    return fetch(path, {
      method: opts.method || "GET", credentials: "same-origin",
      headers: opts.body ? { "content-type": "application/json" } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.message || j.error || "Something went wrong"); e.code = j.error; e.status = r.status; throw e; }
        return j;
      });
    });
  }

  // ---------- Art direction per occasion ----------
  var TONES = [
    [/hallow/, "#2b1638", "#efe6f3"], [/christ|xmas/, "#1f4d3a", "#e6f0ea"], [/diwali|deepa/, "#8f4210", "#faecd8"],
    [/dussehra|dasara|vijaya/, "#8e2a1c", "#f8e4dd"], [/birthday|party/, "#7a1a36", "#f7e6eb"], [/baby|shower|naming|cradle/, "#55648f", "#e8ecf6"],
    [/costume|kid|fancy/, "#5a2a6e", "#f0e7f4"], [/navrat|garba|durga/, "#9c2556", "#f9e4ee"], [/holi/, "#b0432a", "#fbe7df"],
    [/ganesh|ganapati|chaturthi/, "#a3521a", "#fbecda"], [/wedding|marriage|haldi|mehndi/, "#7a1a36", "#f7e6eb"], [/festive|festival|puja|pooja/, "#6b4810", "#f5ecd9"]
  ];
  var CYCLE = [["#5c1128", "#f6e7e4"], ["#8e2a1c", "#f8e4dd"], ["#1f4d3a", "#e6f0ea"], ["#2b1638", "#efe6f3"], ["#8f4210", "#faecd8"], ["#55648f", "#e8ecf6"]];
  function tone(c) {
    if (!c) return { deep: "#5c1128", tint: "#f4eadb" };
    var n = c.name.toLowerCase();
    for (var i = 0; i < TONES.length; i++) if (TONES[i][0].test(n)) return { deep: TONES[i][1], tint: TONES[i][2] };
    var k = CYCLE[Math.max(0, S.collections.indexOf(c)) % CYCLE.length];
    return { deep: k[0], tint: k[1] };
  }
  var THEME_TONE = { magenta: "#5c1128", night: "#2b1638", forest: "#1f4d3a", gold: "#8f4210", sky: "#2c2f6b", candy: "#8a3a5c" };
  function firstCol(p) { return S.colById[p.collections[0]]; }
  function emojiFor(p) { var c = firstCol(p); return (c && c.emoji) || "✦"; }
  function tintFor(p) { return tone(firstCol(p)).tint; }
  function discount(p) { return p.price && p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0; }
  function occLink(c) { return "#/c/" + c.id + "/" + slug(c.name); }
  function prodLink(p) { return "#/p/" + p.id + "/" + slug(p.name); }
  function med(c) { return '<span class="med" aria-hidden="true">' + (c.image_id ? '<img src="' + img(c.image_id) + '" alt="" loading="lazy">' : esc(c.emoji || "✦")) + '</span>'; }
  function productsIn(c) { return S.products.filter(function (p) { return p.collections.indexOf(c.id) >= 0; }); }

  // ---------- Motifs (inline SVG) ----------
  function rangoli(cls) {
    var out = [], c = 200;
    function circ(r, d) { out.push('<circle cx="200" cy="200" r="' + r + '" pathLength="1" style="--d:' + d + '"/>'); }
    function petal(path, n, step, offset, d) {
      for (var k = 0; k < n; k++) out.push('<path d="' + path + '" pathLength="1" transform="rotate(' + (offset + k * step) + ' 200 200)" style="--d:' + (d + k * 0.04).toFixed(2) + '"/>');
    }
    circ(16, 0); circ(32, 1);
    petal("M200 168C214 142 214 114 200 92 186 114 186 142 200 168Z", 8, 45, 0, 2);
    petal("M200 164C207 152 207 142 200 132 193 142 193 152 200 164Z", 8, 45, 22.5, 3);
    circ(112, 4);
    for (var k = 0; k < 16; k++) {
      var a = (k * 22.5) * Math.PI / 180, x = c + 126 * Math.sin(a), y = c - 126 * Math.cos(a);
      out.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="10" pathLength="1" style="--d:' + (5 + k * 0.03).toFixed(2) + '"/>');
    }
    circ(142, 6);
    petal("M200 56C211 44 211 32 200 20 189 32 189 44 200 56Z", 24, 15, 7.5, 7);
    for (var j = 0; j < 24; j++) {
      var b = (j * 15) * Math.PI / 180, dx = c + 160 * Math.sin(b), dy = c - 160 * Math.cos(b);
      out.push('<circle class="fill" cx="' + dx.toFixed(1) + '" cy="' + dy.toFixed(1) + '" r="2.4" style="--d:' + (j * 0.05).toFixed(2) + '"/>');
    }
    circ(184, 8);
    return '<svg class="' + (cls || "rangoli") + '" viewBox="0 0 400 400" aria-hidden="true"><g class="spin">' + out.join("") + '</g></svg>';
  }
  function diya(id, cls) {
    return '<svg class="' + (cls || "diya") + '" viewBox="0 0 120 92" aria-hidden="true"><defs>' +
      '<radialGradient id="dg' + id + '"><stop offset="0" stop-color="#ffd98a" stop-opacity=".95"/><stop offset=".45" stop-color="#f2a33a" stop-opacity=".35"/><stop offset="1" stop-color="#f2a33a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="df' + id + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d9572a"/><stop offset=".55" stop-color="#f2b23a"/><stop offset="1" stop-color="#fff4cf"/></linearGradient>' +
      '<linearGradient id="db' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8693a"/><stop offset="1" stop-color="#7d2d17"/></linearGradient></defs>' +
      '<circle class="glow" cx="60" cy="38" r="44" fill="url(#dg' + id + ')"/>' +
      '<g class="flame"><path d="M60 12C69 27 71 38 60 52 49 38 51 27 60 12Z" fill="url(#df' + id + ')"/><path d="M60 30C64 37 64 43 60 49 56 43 56 37 60 30Z" fill="#fff7da"/></g>' +
      '<path d="M60 52v4" stroke="#3a1a0e" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M10 56Q60 52 110 56Q104 84 60 86Q16 84 10 56Z" fill="url(#db' + id + ')"/>' +
      '<ellipse cx="60" cy="56" rx="50" ry="7" fill="#e08a4a"/><ellipse cx="60" cy="56" rx="42" ry="4.5" fill="#6e2a12" opacity=".55"/>' +
      '<g fill="#e9c27a"><circle cx="34" cy="70" r="2"/><circle cx="47" cy="74" r="2"/><circle cx="60" cy="75" r="2.2"/><circle cx="73" cy="74" r="2"/><circle cx="86" cy="70" r="2"/></g></svg>';
  }
  function toran() {
    var parts = ['<path d="M0 6Q200 34 400 6" fill="none" stroke="#d9b56d" stroke-width="1.6"/>'];
    for (var i = 0; i <= 16; i++) {
      var x = i * 25, t = x / 400, y = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 34 + t * t * 6;
      if (i % 2) {
        parts.push('<path d="M' + x + ' ' + (y + 2) + 'c6 8 5 18 0 26-5-8-6-18 0-26z" fill="#3f7a4f"/>');
      } else {
        parts.push('<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y + 22) + '" stroke="#d9b56d" stroke-width="1"/>' +
          '<circle cx="' + x + '" cy="' + (y + 26) + '" r="6" fill="#e08a2e"/><circle cx="' + x + '" cy="' + (y + 26) + '" r="3" fill="#f2b23a"/>');
      }
      parts.push('<circle cx="' + x + '" cy="' + y + '" r="8.5" fill="#e98a1f"/><circle cx="' + x + '" cy="' + y + '" r="5" fill="#f6b938"/><circle cx="' + x + '" cy="' + y + '" r="1.8" fill="#b85a12"/>');
    }
    return '<svg class="toran" viewBox="-10 0 420 70" aria-hidden="true"><g class="swing">' + parts.join("") + '</g></svg>';
  }
  var ORNAMENT = '<svg class="ornament" viewBox="0 0 120 14" aria-hidden="true"><path d="M0 7h46M74 7h46" stroke="currentColor" stroke-width="1.2"/><path d="M60 1l6 6-6 6-6-6z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="60" cy="7" r="1.6" fill="currentColor"/><circle cx="50" cy="7" r="1.4" fill="currentColor"/><circle cx="70" cy="7" r="1.4" fill="currentColor"/></svg>';
  var FTR_BORDER = '<svg class="ftr-border" viewBox="0 0 1200 26" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="arches" width="40" height="26" patternUnits="userSpaceOnUse"><path d="M0 26V16a20 14 0 0 1 40 0v10" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/><circle cx="20" cy="7" r="2" fill="currentColor" opacity=".8"/></pattern></defs><rect width="1200" height="26" fill="url(#arches)"/></svg>';

  // ---------- Cart, saved, recent ----------
  function cartQty(id) { var l = S.cart.find(function (x) { return x.id === id; }); return l ? l.qty : 0; }
  function setQty(id, qty) {
    qty = Math.max(0, Math.min(999, qty | 0));
    var i = S.cart.findIndex(function (x) { return x.id === id; });
    if (!qty) { if (i >= 0) S.cart.splice(i, 1); } else if (i >= 0) S.cart[i].qty = qty; else S.cart.push({ id: id, qty: qty });
    store(K.cart, S.cart); updateCounts(true);
  }
  function totals() {
    var t = 0, ask = 0, n = 0;
    S.cart.forEach(function (l) { var p = S.byId[l.id]; n += l.qty; if (p.price) t += p.price * l.qty; else ask++; });
    return { total: t, ask: ask, items: n };
  }
  function isSaved(id) { return S.saved.indexOf(id) >= 0; }
  function toggleSaved(id) {
    var i = S.saved.indexOf(id);
    if (i >= 0) S.saved.splice(i, 1); else S.saved.unshift(id);
    store(K.saved, S.saved); updateCounts();
    return i < 0;
  }
  function noteRecent(id) {
    S.recent = [id].concat(S.recent.filter(function (x) { return x !== id; })).slice(0, 12);
    store(K.recent, S.recent);
  }
  function updateCounts(bump) {
    var n = totals().items, sv = S.saved.length;
    [$("cartCount"), $("cartCount2")].forEach(function (el) { el.textContent = n; el.hidden = !n; });
    [$("savedCount"), $("savedCount2")].forEach(function (el) { el.textContent = sv; el.hidden = !sv; });
    if (bump && !reduced) [$("cartBtn"), $("tabBag")].forEach(function (b) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); });
  }

  // ---------- Product pieces ----------
  function priceHtml(p) {
    if (!p.price) return '<div class="price"><span class="ask">Price on request</span></div>';
    var off = discount(p);
    return '<div class="price"><b>' + money(p.price) + '</b>' + (off ? '<s>' + money(p.mrp) + '</s><span class="save">Save ' + money(p.mrp - p.price) + '</span>' : "") + '</div>';
  }
  function actHtml(p) {
    if (!p.in_stock) return '<button class="add" disabled aria-label="' + esc(p.name) + ' is out of stock">' + icon("plus") + '</button>';
    var q = cartQty(p.id);
    if (q) return '<span class="step"><button data-dec="' + p.id + '" aria-label="Remove one">' + icon("minus") + '</button><span aria-live="polite">' + q + '</span><button data-inc="' + p.id + '" aria-label="Add one more">' + icon("plus") + '</button></span>';
    return '<button class="add" data-inc="' + p.id + '" aria-label="Add ' + esc(p.name) + ' to bag">' + icon("plus") + '</button>';
  }
  function thumb(p, cls) {
    return '<span class="' + (cls || "thumb") + '" style="--tint:' + tintFor(p) + '">' + (p.images[0] ? '<img src="' + img(p.images[0]) + '" alt="" loading="lazy">' : '<span aria-hidden="true">' + esc(emojiFor(p)) + '</span>') + '</span>';
  }
  function card(p, i) {
    var off = discount(p), c = firstCol(p), saved = isSaved(p.id);
    return '<article class="card rv" style="--i:' + Math.min(i || 0, 7) + '">' +
      '<a class="card-media" href="' + prodLink(p) + '" style="--tint:' + tintFor(p) + '" aria-label="' + esc(p.name) + '">' +
        (p.images[0] ? '<img src="' + img(p.images[0]) + '" alt="' + esc(p.name) + '" loading="lazy" width="400" height="500">' + (p.images[1] ? '<img class="alt" src="' + img(p.images[1]) + '" alt="" loading="lazy">' : "")
          : '<span class="ph" aria-hidden="true">' + esc(emojiFor(p)) + '</span>') +
        '<span class="badges">' + (!p.in_stock ? '<span class="badge out">Sold out</span>' : "") + (off ? '<span class="badge off">' + off + '% off</span>' : "") + (p.tag ? '<span class="badge">' + esc(p.tag) + '</span>' : "") + '</span>' +
      '</a>' +
      '<button class="heart' + (saved ? " on" : "") + '" data-save="' + p.id + '" aria-pressed="' + saved + '" aria-label="' + (saved ? "Remove from saved" : "Save for later") + '">' + icon("heart") + '</button>' +
      '<div class="card-body">' + (c ? '<span class="card-occ">' + esc(c.name) + '</span>' : "") +
        '<a class="card-name" href="' + prodLink(p) + '">' + esc(p.name) + '</a>' +
        '<div class="card-foot">' + priceHtml(p) + '<span data-act="' + p.id + '">' + actHtml(p) + '</span></div></div>' +
    '</article>';
  }
  function grid(list) { return '<div class="grid">' + list.map(card).join("") + '</div>'; }
  function rail(id, title, eyebrow, list, more) {
    if (!list.length) return "";
    return '<section class="sec sec-tight"><div class="wrap"><div class="sec-head rv"><div>' + (eyebrow ? '<span class="eyebrow">' + eyebrow + '</span>' : "") + '<h2>' + title + '</h2></div>' +
      '<div class="sec-tools">' + (more ? '<a class="link" href="' + more + '">View all ' + icon("arrow", "i-sm") + '</a>' : "") +
      '<div class="rail-ctl"><button data-rail="' + id + '" data-dir="-1" aria-label="Scroll left">' + icon("left") + '</button><button data-rail="' + id + '" data-dir="1" aria-label="Scroll right">' + icon("right") + '</button></div></div></div>' +
      '<div class="rail" id="' + id + '">' + list.map(card).join("") + '</div></div></section>';
  }
  function refreshActs() {
    $$("[data-act]").forEach(function (el) { var p = S.byId[+el.dataset.act]; if (p) el.innerHTML = actHtml(p); });
    $$("[data-save]").forEach(function (b) { var on = isSaved(+b.dataset.save); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    var sq = $("stickyAct"); if (sq) sq.innerHTML = stickyAct(S.byId[+sq.dataset.id]);
  }

  // ---------- Home ----------
  function slides() { var s = []; try { s = JSON.parse(S.settings.hero_slides || "[]"); } catch (e) {} return s; }
  function slideLink(sl) {
    var l = String(sl.link || ""), m = /^occasion:(.+)$/.exec(l);
    if (m) {
      var c = S.collections.find(function (x) { return x.name.toLowerCase() === m[1].trim().toLowerCase() || String(x.id) === m[1].trim(); });
      return c ? occLink(c) : "#/shop";
    }
    if (l === "#all" || !l) return "#/shop";
    return l;
  }
  function headline(t) {
    var m = /^(.+?[,–—:!?])\s+(.+)$/.exec(String(t || ""));
    return m ? esc(m[1]) + "<em>" + esc(m[2]) + "</em>" : esc(t);
  }
  function heroSection() {
    var st = S.settings, s0 = slides()[0] || { title: st.tagline || st.shop_name, subtitle: "", button: "Shop the collection", link: "#all" };
    var occNames = S.collections.slice(0, 3).map(function (c) { return c.name; }).join(" · ");
    var wa = waNum(st.whatsapp);
    return '<section class="hero" aria-label="Welcome"><div class="wrap hero-in">' +
      '<div class="hero-copy"><span class="eyebrow">Party &amp; festival decorations</span>' +
        '<h1 class="sweep">' + headline(s0.title) + '</h1>' +
        '<p class="lead">' + esc(s0.subtitle || (st.about ? st.about.split(".")[0] + "." : st.tagline)) + '</p>' +
        '<div class="hero-ctas"><a class="btn btn-gold" href="' + esc(slideLink(s0)) + '">' + esc(s0.button || "Shop the collection") + icon("arrow", "i-sm") + '</a>' +
        '<a class="btn btn-line-light" href="#/find">Plan a celebration</a></div>' +
        '<div class="hero-trust">' +
          (S.shops.length ? '<span>' + icon("store") + S.shops.length + (S.shops.length > 1 ? " stores to visit" : " store to visit") + '</span>' : "") +
          '<span>' + icon("truck") + 'Home delivery or store pickup</span>' +
          (wa ? '<span>' + icon("wa") + 'Help on WhatsApp</span>' : "") +
        '</div></div>' +
      '<div class="hero-art">' + toran() +
        '<div class="arch">' + (s0.image_id ? '<img class="arch-photo" src="' + img(s0.image_id) + '" alt="">' : "") + rangoli() + diya("h") + '</div>' +
        (occNames ? '<span class="hero-art-label">' + esc(occNames) + '</span>' : "") +
      '</div></div></section>';
  }
  function occasionsSection() {
    var cols = S.collections.filter(function (c) { return productsIn(c).length; });
    if (!cols.length) return "";
    return '<section class="sec" id="occasions"><div class="wrap"><div class="sec-head rv"><div><span class="eyebrow">Shop by occasion</span><h2>Every celebration, <em>covered</em></h2></div><a class="link" href="#/shop">All products ' + icon("arrow", "i-sm") + '</a></div>' +
      '<div class="occ-grid">' + cols.map(function (c, i) {
        var n = productsIn(c).length, t = tone(c);
        return '<a class="occ rv' + (c.image_id ? " has-img" : "") + '" style="--tone:' + t.deep + ';--i:' + Math.min(i, 7) + '" href="' + occLink(c) + '">' +
          (c.image_id ? '<img class="bg" src="' + img(c.image_id) + '" alt="" loading="lazy">' : "") + med(c) +
          '<div><h3>' + esc(c.name) + '</h3><small>' + n + (n === 1 ? " product" : " products") + icon("arrow") + '</small></div></a>';
      }).join("") + '</div></div></section>';
  }

  // Celebration planner — the signature shopping moment.
  var BUDGETS = [["u300", 0, 300, "Under ₹300"], ["300-700", 300, 700, "₹300 – ₹700"], ["700-1500", 700, 1500, "₹700 – ₹1,500"], ["1500+", 1500, Infinity, "₹1,500 & above"]];
  function inBudget(p, key) {
    if (key === "any") return true;
    var b = BUDGETS.find(function (x) { return x[0] === key; });
    return !!(b && p.price && p.price >= b[1] && p.price < b[2]);
  }
  function plannerCols() { return S.collections.filter(function (c) { return productsIn(c).some(function (p) { return p.in_stock; }); }); }
  function plannerSection() {
    var cols = plannerCols();
    if (!cols.length) return "";
    if (!S.plan.occ || !S.colById[S.plan.occ]) S.plan.occ = cols[0].id;
    return '<section class="sec" id="find"><div class="wrap"><div class="planner rv">' +
      '<div class="planner-head"><span class="eyebrow">Celebration planner</span><h2>What are we <em>celebrating?</em></h2>' +
      '<p>Pick an occasion and a budget — we will pull the best picks from our shelves in seconds.</p></div>' +
      '<div class="steps-lbl"><i>1</i>Choose the occasion</div><div class="choices" role="group" aria-label="Occasion">' +
        cols.map(function (c) { return '<button class="choice" data-plan-occ="' + c.id + '" aria-pressed="' + (c.id === S.plan.occ) + '">' + med(c) + esc(c.name) + '</button>'; }).join("") + '</div>' +
      '<div class="steps-lbl"><i>2</i>Pick a budget per item</div><div class="choices" role="group" aria-label="Budget" id="planBudget"></div>' +
      '<div class="planner-results" id="planRes" aria-live="polite"></div>' +
    '</div></div></section>';
  }
  function renderPlanner() {
    var box = $("planRes"); if (!box) return;
    var c = S.colById[S.plan.occ], base = productsIn(c).filter(function (p) { return p.in_stock; });
    var avail = BUDGETS.filter(function (b) { return base.some(function (p) { return inBudget(p, b[0]); }); });
    if (S.plan.budget !== "any" && !avail.some(function (b) { return b[0] === S.plan.budget; })) S.plan.budget = "any";
    $("planBudget").innerHTML = '<button class="choice plain" data-plan-budget="any" aria-pressed="' + (S.plan.budget === "any") + '">Any budget</button>' +
      avail.map(function (b) { return '<button class="choice plain" data-plan-budget="' + b[0] + '" aria-pressed="' + (S.plan.budget === b[0]) + '">' + b[3] + '</button>'; }).join("");
    var list = base.filter(function (p) { return inBudget(p, S.plan.budget); }).sort(function (a, b) {
      return (b.featured - a.featured) || (discount(b) - discount(a)) || ((a.price || 1e9) - (b.price || 1e9));
    });
    var label = S.plan.budget === "any" ? "" : " · " + BUDGETS.find(function (b) { return b[0] === S.plan.budget; })[3];
    box.innerHTML = '<div class="planner-summary"><p>' + list.length + (list.length === 1 ? " pick" : " picks") + ' for ' + esc(c.name) + esc(label) + '</p>' +
      '<a class="link" href="' + occLink(c) + '">See the full ' + esc(c.name) + ' collection ' + icon("arrow", "i-sm") + '</a></div>' +
      (list.length ? grid(list.slice(0, 8)) : '<p class="note">Nothing in this range right now — try another budget.</p>');
    reveal();
  }
  function campaignsSection() {
    var list = slides().slice(1);
    if (!list.length) return "";
    return '<section class="sec sec-tight"><div class="wrap"><div class="campaigns">' + list.map(function (sl, i) {
      return '<a class="campaign rv' + (sl.image_id ? " has-img" : "") + '" style="--tone:' + (THEME_TONE[sl.theme] || "#5c1128") + ';--i:' + i + '" href="' + esc(slideLink(sl)) + '">' +
        (sl.image_id ? '<img src="' + img(sl.image_id) + '" alt="" loading="lazy">' : (sl.emoji ? '<span class="med" aria-hidden="true">' + esc(sl.emoji) + '</span>' : "")) +
        '<span class="eyebrow" style="color:var(--gold-2)">Seasonal edit</span><h3>' + esc(sl.title) + '</h3>' + (sl.subtitle ? '<p>' + esc(sl.subtitle) + '</p>' : "") +
        '<span class="btn btn-ivory btn-sm">' + esc(sl.button || "Explore") + icon("arrow", "i-sm") + '</span></a>';
    }).join("") + '</div></div></section>';
  }
  function whyIcon(t) {
    t = String(t || "").toLowerCase();
    if (/qualit|trust|reliab/.test(t)) return "shield";
    if (/price|value|afford|cheap/.test(t)) return "tag";
    if (/deliver|pickup|ship/.test(t)) return "truck";
    if (/variet|range|choice/.test(t)) return "gift";
    return "sparkle";
  }
  function trustSection() {
    var why = []; try { why = JSON.parse(S.settings.why_us || "[]"); } catch (e) {}
    if (!why.length) return "";
    return '<section class="sec sec-tight"><div class="wrap"><div class="trust rv">' + why.slice(0, 4).map(function (w) {
      return '<div><span class="ic">' + icon(whyIcon(w.title + " " + w.text)) + '</span><div><h3>' + esc(w.title) + '</h3><p>' + esc(w.text) + '</p></div></div>';
    }).join("") + '</div></div></section>';
  }
  function storySection() {
    var st = S.settings;
    if (!st.about) return "";
    return '<section class="sec" id="about"><div class="wrap story"><div class="story-art rv" id="storyArt">' + rangoli("rangoli-static") + '</div>' +
      '<div class="story-copy rv"><span class="eyebrow">Our story</span><h2>' + esc(st.shop_name) + '</h2><p>' + esc(st.about) + '</p>' +
      (st.tagline ? '<p class="sign">' + esc(st.tagline) + '</p>' : "") + '</div></div></section>';
  }
  function storesSection() {
    if (!S.shops.length) return "";
    return '<section class="sec" id="shops"><div class="wrap"><div class="sec-head rv"><div><span class="eyebrow">Visit us</span><h2>Our <em>' + (S.shops.length > 1 ? "stores" : "store") + '</em></h2><p>See the full range in person, or pick up your online order.</p></div></div>' +
      '<div class="stores' + (S.shops.length >= 4 ? " four" : "") + '">' + S.shops.map(function (sh, i) {
        var dir = /^https?:\/\//.test(sh.map_link) ? sh.map_link : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(sh.name + " " + sh.address);
        return '<article class="store rv" style="--i:' + i + '"><div class="store-map">' +
          (sh.address ? '<iframe loading="lazy" title="Map of ' + esc(sh.name) + '" src="https://maps.google.com/maps?q=' + encodeURIComponent(sh.name + ", " + sh.address) + '&z=15&output=embed"></iframe>' : '<span class="pin">' + icon("pin") + '</span>') +
          '</div><div class="store-body"><h3>' + esc(sh.name) + '</h3>' + (sh.about ? '<span class="about">' + esc(sh.about) + '</span>' : "") +
          (sh.address ? '<span class="meta">' + icon("pin") + esc(sh.address) + '</span>' : "") +
          (sh.timings ? '<span class="meta">' + icon("clock") + esc(sh.timings) + '</span>' : "") +
          '<div class="store-acts"><a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="' + esc(dir) + '">Directions</a>' +
          (sh.phone ? '<a class="btn btn-line btn-sm" href="tel:' + esc(String(sh.phone).replace(/[^\d+]/g, "")) + '">' + icon("phone", "i-sm") + 'Call</a>' : "") + '</div></div></article>';
      }).join("") + '</div></div></section>';
  }
  function conciergeSection() {
    var st = S.settings, wa = waNum(st.whatsapp);
    if (!wa) return "";
    return '<section class="sec sec-tight"><div class="wrap"><div class="concierge rv">' + ORNAMENT.replace('class="ornament"', 'class="ornament" style="color:var(--gold-2)"') +
      '<h2>Planning something <em>big?</em></h2><p>Tell us your theme, date and venue — our team will help you put together everything you need.</p><div class="ctas">' +
      '<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent("Hi " + st.shop_name + "! I am planning a celebration and need help with decorations.") + '">' + icon("wa") + 'Chat on WhatsApp</a>' +
      (st.phone ? '<a class="btn btn-line-light" href="tel:' + esc(st.phone.replace(/[^\d+]/g, "")) + '">' + icon("phone", "i-sm") + 'Call ' + esc(st.phone) + '</a>' : "") + '</div></div></div></section>';
  }
  function renderHome() {
    var featured = S.products.filter(function (p) { return p.featured; });
    var fresh = S.products.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 12);
    var recent = S.recent.map(function (id) { return S.byId[id]; }).filter(Boolean);
    $("app").innerHTML = heroSection() + occasionsSection() + plannerSection() +
      rail("railBest", "Bestsellers", "Customer favourites", featured, "#/shop") + campaignsSection() +
      rail("railNew", "New <em>arrivals</em>", "Just in", fresh, "#/shop") +
      (recent.length ? rail("railRecent", "Recently viewed", "Pick up where you left off", recent) : "") +
      trustSection() + storySection() + storesSection() + conciergeSection();
    renderPlanner();
  }

  // ---------- Listing: shop, search, occasion ----------
  function resetFilters() { S.f = { occ: [], price: "", stock: false, sale: false, sort: S.f.sort || "rec" }; }
  function matches(p, q) {
    if (!q) return true;
    var cols = p.collections.map(function (id) { return S.colById[id] ? S.colById[id].name : ""; }).join(" ");
    var hay = (p.name + " " + p.description + " " + p.tag + " " + cols).toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function applyFilters(base, skip) {
    var f = S.f;
    var list = base.filter(function (p) {
      if (skip !== "occ" && f.occ.length && !f.occ.some(function (id) { return p.collections.indexOf(id) >= 0; })) return false;
      if (skip !== "price" && f.price && !inBudget(p, f.price)) return false;
      if (f.stock && !p.in_stock) return false;
      if (f.sale && !discount(p)) return false;
      return true;
    });
    var l = list.slice();
    if (f.sort === "low") l.sort(function (a, b) { return (a.price || 1e9) - (b.price || 1e9); });
    else if (f.sort === "high") l.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    else if (f.sort === "new") l.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    else if (f.sort === "off") l.sort(function (a, b) { return discount(b) - discount(a); });
    else l.sort(function (a, b) { return (b.in_stock - a.in_stock) || (b.featured - a.featured); });
    return l;
  }
  function filtersHtml(base, withOcc) {
    var f = S.f, html = "";
    if (withOcc) {
      var cols = S.collections.filter(function (c) { return base.some(function (p) { return p.collections.indexOf(c.id) >= 0; }); });
      if (cols.length) html += '<div class="fgroup"><h4>Occasion</h4>' + cols.map(function (c) {
        var n = applyFilters(base, "occ").filter(function (p) { return p.collections.indexOf(c.id) >= 0; }).length;
        return '<label class="fopt"><input type="checkbox" data-f-occ="' + c.id + '"' + (f.occ.indexOf(c.id) >= 0 ? " checked" : "") + '>' + esc(c.name) + '<small>' + n + '</small></label>';
      }).join("") + '</div>';
    }
    var withPrice = applyFilters(base, "price");
    html += '<div class="fgroup"><h4>Price</h4><label class="fopt"><input type="radio" name="fprice" data-f-price=""' + (!f.price ? " checked" : "") + '>Any price</label>' +
      BUDGETS.map(function (b) {
        var n = withPrice.filter(function (p) { return inBudget(p, b[0]); }).length;
        return n || f.price === b[0] ? '<label class="fopt"><input type="radio" name="fprice" data-f-price="' + b[0] + '"' + (f.price === b[0] ? " checked" : "") + '>' + b[3] + '<small>' + n + '</small></label>' : "";
      }).join("") + '</div>';
    html += '<div class="fgroup"><h4>Show</h4><label class="fopt"><input type="checkbox" data-f-stock' + (f.stock ? " checked" : "") + '>In stock only</label>' +
      '<label class="fopt"><input type="checkbox" data-f-sale' + (f.sale ? " checked" : "") + '>On offer</label></div>';
    return html;
  }
  function activeChips() {
    var f = S.f, chips = [];
    f.occ.forEach(function (id) { if (S.colById[id]) chips.push(['occ:' + id, S.colById[id].name]); });
    if (f.price) chips.push(["price", BUDGETS.find(function (b) { return b[0] === f.price; })[3]]);
    if (f.stock) chips.push(["stock", "In stock"]);
    if (f.sale) chips.push(["sale", "On offer"]);
    if (!chips.length) return "";
    return '<div class="active-chips">' + chips.map(function (c) { return '<button class="achip" data-clear="' + c[0] + '">' + esc(c[1]) + icon("close") + '</button>'; }).join("") +
      '<button class="link" data-clear="all" style="font-size:.85rem">Clear all</button></div>';
  }
  var L = null; // current listing context
  function renderListing(ctx) {
    L = ctx;
    var base = ctx.base();
    var head = "";
    if (ctx.type === "occ") {
      var c = ctx.col, t = tone(c);
      head = '<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a>' + icon("right") + '<a href="#/shop">Shop</a>' + icon("right") + '<span aria-current="page">' + esc(c.name) + '</span></nav>' +
        '<div class="page-hero' + (c.image_id ? " has-img" : "") + '" style="--tone:' + t.deep + '">' + (c.image_id ? '<img src="' + img(c.image_id) + '" alt="">' : med(c)) +
        '<div><span class="eyebrow" style="color:var(--gold-2)">Occasion</span><h1>' + esc(c.name) + '</h1>' + (c.description ? '<p>' + esc(c.description) + '</p>' : "") + '</div></div>';
    } else {
      head = '<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a>' + icon("right") + '<span aria-current="page">' + (ctx.type === "search" ? "Search" : "Shop") + '</span></nav>' +
        '<div class="list-title"><h1>' + (ctx.type === "search" ? 'Results for “' + esc(ctx.q) + '”' : "All products") + '</h1><p>' + base.length + (base.length === 1 ? " product" : " products") + (ctx.type === "search" ? "" : " across " + S.collections.length + " occasions") + '</p></div>';
    }
    var chips = '<div class="chiprow" role="navigation" aria-label="Occasions">' + (ctx.type === "occ" ? '<a class="chip" href="#/shop" style="padding-left:14px">All products</a>' : "") +
      S.collections.map(function (c) { var on = ctx.col === c; return '<a class="chip' + (on ? " on" : "") + '" href="' + occLink(c) + '"' + (on ? ' aria-current="page"' : "") + '>' + med(c) + esc(c.name) + '</a>'; }).join("") + '</div>';
    $("app").innerHTML = '<div class="wrap">' + head + '<div style="margin-top:16px">' + chips + '</div>' +
      '<div class="layout"><aside class="filters" id="filters" aria-label="Filters">' + filtersHtml(base, ctx.type !== "occ") + '</aside>' +
      '<div><div class="toolbar"><span class="count" id="count"></span><button class="fbtn" data-open-filters>' + icon("filter", "i-sm") + 'Filters</button>' +
        '<label class="select"><span class="sr">Sort by</span><select id="sort">' + [["rec", "Recommended"], ["new", "Newest"], ["low", "Price: low to high"], ["high", "Price: high to low"], ["off", "Biggest savings"]].map(function (o) {
          return '<option value="' + o[0] + '"' + (S.f.sort === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select>' + icon("down") + '</label>' +
        '<div id="chipsActive" style="width:100%"></div></div><div id="grid"></div></div></div></div>';
    refreshListing();
  }
  function focusKey(el) {
    if (!el || !el.dataset) return null;
    var k = ["fOcc", "fPrice", "fStock", "fSale"].find(function (x) { return x in el.dataset; });
    return k ? { k: k, v: el.dataset[k], inDrawer: !!el.closest("#mFilters") } : null;
  }
  function refreshListing() {
    if (!L || !$("grid")) return;
    var fk = focusKey(document.activeElement);
    var base = L.base(), list = applyFilters(base);
    $("count").textContent = list.length + (list.length === 1 ? " product" : " products");
    $("chipsActive").innerHTML = activeChips();
    $("filters").innerHTML = filtersHtml(base, L.type !== "occ");
    $("grid").innerHTML = list.length ? grid(list) : emptyState("Nothing matches those filters", "Try removing a filter, or explore another occasion.", '<button class="btn btn-primary" data-clear="all">Clear filters</button>');
    var mf = $("mFilters"); if (mf) { mf.innerHTML = filtersHtml(base, L.type !== "occ"); $("mFiltersBtn").textContent = "Show " + list.length + (list.length === 1 ? " product" : " products"); }
    if (fk) {
      var attr = "data-" + fk.k.replace(/[A-Z]/g, function (c) { return "-" + c.toLowerCase(); });
      var again = (fk.inDrawer ? $("mFilters") : $("filters")).querySelector("[" + attr + '="' + fk.v + '"]');
      if (again) again.focus();
    }
    reveal();
  }
  function emptyState(title, text, cta) {
    return '<div class="empty">' + diya("e" + Math.random().toString(36).slice(2, 6), "mini-diya") + '<h3>' + title + '</h3><p>' + text + '</p>' + (cta || "") + '</div>';
  }

  // ---------- Product page ----------
  var PQ = 1;
  function stickyAct(p) {
    if (!p) return "";
    if (!p.in_stock) return '<button class="btn btn-line btn-sm" disabled>Out of stock</button>';
    return cartQty(p.id) ? '<button class="btn btn-primary btn-sm" data-open-bag>View bag (' + cartQty(p.id) + ')</button>' : '<button class="btn btn-primary btn-sm" data-padd="' + p.id + '">Add to bag</button>';
  }
  function renderProduct(p) {
    noteRecent(p.id);
    PQ = Math.max(1, cartQty(p.id) || 1);
    var st = S.settings, cols = p.collections.map(function (id) { return S.colById[id]; }).filter(Boolean), c = cols[0];
    var off = discount(p), wa = waNum(st.whatsapp), link = location.origin + "/" + prodLink(p);
    var media = p.images.length ? p.images.map(function (id, i) { return '<img src="' + img(id) + '" alt="' + esc(p.name) + (p.images.length > 1 ? " – photo " + (i + 1) : "") + '" data-zoom="' + i + '"' + (i ? ' loading="lazy"' : "") + '>'; }).join("")
      : '<div class="ph" aria-hidden="true">' + esc(emojiFor(p)) + '</div>';
    var related = S.products.filter(function (x) { return x.id !== p.id && x.collections.some(function (id) { return p.collections.indexOf(id) >= 0; }); })
      .sort(function (a, b) { return (b.in_stock - a.in_stock) || (b.featured - a.featured); }).slice(0, 10);
    var recent = S.recent.filter(function (id) { return id !== p.id; }).map(function (id) { return S.byId[id]; }).filter(Boolean);
    var stores = S.shops.map(function (s) { return s.name; });
    var ask = wa ? "https://wa.me/" + wa + "?text=" + encodeURIComponent("Hi! I'm interested in “" + p.name + "”" + (p.price ? "" : " — could you share the price?") + "\n" + link) : "";
    $("app").innerHTML = '<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a>' + icon("right") +
      (c ? '<a href="' + occLink(c) + '">' + esc(c.name) + '</a>' + icon("right") : "") + '<span aria-current="page">' + esc(p.name) + '</span></nav>' +
      '<div class="pdp"><div class="gallery' + (p.images.length > 1 ? " has-thumbs" : "") + '">' +
        '<div class="g-main" style="--tint:' + tintFor(p) + '"><div class="g-track" id="gTrack">' + media + '</div>' +
          (p.images.length ? '<button class="g-zoom" data-zoom="0" aria-label="Zoom photo">' + icon("zoom") + '</button>' : "") +
          (p.images.length > 1 ? '<div class="g-dots" id="gDots">' + p.images.map(function (_, i) { return '<i class="' + (i ? "" : "on") + '"></i>'; }).join("") + '</div>' : "") + '</div>' +
        (p.images.length > 1 ? '<div class="g-thumbs" id="gThumbs">' + p.images.map(function (id, i) { return '<button class="' + (i ? "" : "on") + '" data-thumb="' + i + '" aria-label="Photo ' + (i + 1) + '"><img src="' + img(id) + '" alt="" loading="lazy"></button>'; }).join("") + '</div>' : "") +
      '</div>' +
      '<div class="pinfo"><span class="card-occ">' + cols.map(function (x) { return '<a href="' + occLink(x) + '">' + esc(x.name) + '</a>'; }).join(" · ") + (p.tag ? " · " + esc(p.tag) : "") + '</span>' +
        '<h1>' + esc(p.name) + '</h1>' +
        '<div class="pprice">' + (p.price ? '<b>' + money(p.price) + '</b>' + (off ? '<s>MRP ' + money(p.mrp) + '</s><span class="save">You save ' + money(p.mrp - p.price) + ' (' + off + '%)</span>' : "") : '<span class="ask">Price on request</span>') + '</div>' +
        (!p.price ? '<p class="ptax">Add it to your bag and we will confirm the price with you, or ask us on WhatsApp.</p>' : "") +
        '<span class="stock' + (p.in_stock ? "" : " out") + '">' + (p.in_stock ? "In stock" : "Currently out of stock") + '</span>' +
        '<div class="buy" id="buyBox">' + (p.in_stock
          ? '<span class="step step-light" aria-label="Quantity"><button data-pq="-1" aria-label="Decrease quantity">' + icon("minus") + '</button><span id="pq" aria-live="polite">' + PQ + '</span><button data-pq="1" aria-label="Increase quantity">' + icon("plus") + '</button></span>' +
            '<button class="btn btn-primary" data-padd="' + p.id + '">' + icon("bag", "i-sm") + (cartQty(p.id) ? "Update bag" : "Add to bag") + '</button>' +
            '<button class="btn btn-line" data-pbuy="' + p.id + '">Buy now</button>'
          : (ask ? '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + esc(ask) + '">' + icon("wa") + 'Ask when it’s back</a>' : '<button class="btn btn-line" disabled>Out of stock</button>')) + '</div>' +
        '<div class="pacts"><button class="btn btn-line btn-sm" data-save="' + p.id + '" aria-pressed="' + isSaved(p.id) + '" id="pSave">' + icon("heart", "i-sm") + '<span>' + (isSaved(p.id) ? "Saved" : "Save") + '</span></button>' +
          '<button class="btn btn-line btn-sm" data-share="' + p.id + '">' + icon("share", "i-sm") + 'Share</button>' +
          (ask ? '<a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="' + esc(ask) + '">' + icon("wa", "i-sm") + 'Ask us</a>' : "") + '</div>' +
        '<div class="perks"><div class="perk">' + icon("truck") + '<div><b>Home delivery</b><p>' + esc(st.delivery_note || "We deliver to your address.") + '</p></div></div>' +
          (stores.length ? '<div class="perk">' + icon("store") + '<div><b>Pick up from our store</b><p>Choose pickup at checkout — ' + esc(stores.slice(0, 2).join(", ")) + (stores.length > 2 ? " and " + (stores.length - 2) + " more" : "") + '.</p></div></div>' : "") +
          (wa ? '<div class="perk">' + icon("wa") + '<div><b>Questions? We’re on WhatsApp</b><p>Sizes, colours, bulk orders — just ask.</p></div></div>' : "") + '</div>' +
        (p.description ? '<details class="acc" open><summary>Description' + icon("down") + '</summary><div class="acc-body">' + esc(p.description) + '</div></details>' : "") +
        (cols.some(function (x) { return x.description; }) ? '<details class="acc"><summary>Perfect for' + icon("down") + '</summary><div class="acc-body">' + cols.map(function (x) {
          return '<a class="occ-line" href="' + occLink(x) + '">' + med(x) + '<span><b>' + esc(x.name) + '</b><br>' + esc(x.description) + '</span></a>'; }).join("") + '</div></details>' : "") +
        '<details class="acc"><summary>Delivery &amp; pickup' + icon("down") + '</summary><div class="acc-body">' + esc(st.delivery_note || "") +
          (stores.length ? "\n\nPickup available at: " + esc(stores.join(", ")) + "." : "") + '</div></details>' +
      '</div></div></div>' +
      rail("railRel", "Complete the <em>celebration</em>", "Goes well with", related) +
      (recent.length ? rail("railRecent", "Recently viewed", "", recent) : "") +
      '<div class="sticky-buy" id="stickyBuy" aria-hidden="true"><div class="t"><b>' + esc(p.name) + '</b><span>' + (p.price ? money(p.price) : "Price on request") + '</span></div><span id="stickyAct" data-id="' + p.id + '">' + stickyAct(p) + '</span></div>';
    bindGallery();
    var sb = $("stickyBuy"), bb = $("buyBox");
    if ("IntersectionObserver" in window && sb && bb) {
      new IntersectionObserver(function (e) { var show = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; sb.classList.toggle("show", show); sb.setAttribute("aria-hidden", !show); }).observe(bb);
    }
    setMeta(p.name + " – " + st.shop_name, p.description || st.tagline);
  }
  function bindGallery() {
    var track = $("gTrack"); if (!track) return;
    var set = function (i) {
      $$("#gDots i").forEach(function (d, k) { d.classList.toggle("on", k === i); });
      $$("#gThumbs button").forEach(function (b, k) { b.classList.toggle("on", k === i); });
    };
    track.addEventListener("scroll", debounce(function () { set(Math.round(track.scrollLeft / track.clientWidth)); }, 60), { passive: true });
    $$("#gThumbs [data-thumb]").forEach(function (b) { b.addEventListener("click", function () { var i = +b.dataset.thumb; track.scrollTo({ left: i * track.clientWidth, behavior: reduced ? "auto" : "smooth" }); set(i); }); });
  }
  function openLightbox(p, i) {
    var lb = document.createElement("div");
    lb.className = "lightbox"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-label", "Photo");
    lb.innerHTML = '<img src="' + img(p.images[i]) + '" alt="' + esc(p.name) + '"><button class="icon-btn modal-x" aria-label="Close">' + icon("close") + '</button>';
    var im = lb.querySelector("img");
    im.addEventListener("click", function (e) {
      var r = im.getBoundingClientRect();
      im.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%";
      im.classList.toggle("zoomed");
    });
    var close = function () { lb.remove(); document.removeEventListener("keydown", key); };
    var key = function (e) { if (e.key === "Escape") close(); };
    lb.querySelector(".modal-x").addEventListener("click", close);
    document.addEventListener("keydown", key);
    document.body.appendChild(lb); lb.querySelector(".modal-x").focus();
  }

  // ---------- Layers (drawers, modal, search) ----------
  var layer = null, lastFocus = null;
  function openLayer(el, html) {
    closeLayer(true);
    lastFocus = document.activeElement;
    if (html != null) el.innerHTML = html;
    el.hidden = false; $("scrim").hidden = false; document.body.style.overflow = "hidden";
    layer = el;
    var f = el.querySelector("[autofocus]") || el.querySelector("input, button, a[href]"); if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeLayer(silent) {
    if (!layer) return;
    layer.hidden = true; $("scrim").hidden = true; document.body.style.overflow = "";
    if (layer === $("modal")) loginThen = null;
    layer = null;
    if (!silent && lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $("scrim").addEventListener("click", function () { closeLayer(); });
  $("search").addEventListener("click", function (e) { if (e.target === $("search")) closeLayer(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { if (layer) closeLayer(); closeMega(); }
    if (e.key === "/" && !layer && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
    if (e.key === "Tab" && layer) { // keep focus inside the open layer
      var f = $$('a[href], button:not([disabled]), input, select, textarea', layer).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (!layer.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); return; }
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // Bag drawer
  function openBag() { openLayer($("bag"), bagHtml()); }
  function bagHtml() {
    var t = totals();
    var headH = '<div class="d-head"><h2>Your bag' + (t.items ? '<small>' + t.items + (t.items === 1 ? " item" : " items") + '</small>' : "") + '</h2><button class="icon-btn" data-close aria-label="Close bag">' + icon("close") + '</button></div>';
    if (!S.cart.length) return headH + '<div class="d-body">' + emptyState("Your bag is empty", "Let’s find something special for your celebration.", '<a class="btn btn-primary" href="#/shop" data-close>Start shopping</a>') + '</div>';
    var inBag = S.cart.map(function (l) { return l.id; });
    var cols = {}; S.cart.forEach(function (l) { S.byId[l.id].collections.forEach(function (c) { cols[c] = 1; }); });
    var ups = S.products.filter(function (p) { return p.in_stock && inBag.indexOf(p.id) < 0 && p.collections.some(function (c) { return cols[c]; }); })
      .sort(function (a, b) { return b.featured - a.featured; }).slice(0, 4);
    return headH + '<div class="d-body">' + S.cart.map(function (l) {
      var p = S.byId[l.id];
      return '<div class="line">' + thumb(p) + '<div><a class="nm" href="' + prodLink(p) + '" data-close>' + esc(p.name) + '</a>' +
        '<div class="pr">' + (p.price ? money(p.price) + (l.qty > 1 ? " × " + l.qty + " = <b>" + money(p.price * l.qty) + "</b>" : "") : "Price on request") + '</div>' +
        '<div class="row"><span class="step step-light"><button data-dec="' + p.id + '" aria-label="Remove one">' + icon("minus") + '</button><span>' + l.qty + '</span><button data-inc="' + p.id + '" aria-label="Add one">' + icon("plus") + '</button></span>' +
        '<button class="rm" data-rm="' + p.id + '">' + icon("trash", "i-sm") + 'Remove</button></div></div></div>';
    }).join("") +
      (ups.length ? '<div class="upsell"><h4>Goes well with</h4>' + ups.map(function (p) {
        return '<div class="mini">' + thumb(p) + '<div class="t"><b>' + esc(p.name) + '</b><span>' + (p.price ? money(p.price) : "Price on request") + '</span></div><button class="add" data-inc="' + p.id + '" aria-label="Add ' + esc(p.name) + '">' + icon("plus") + '</button></div>';
      }).join("") + '</div>' : "") + '</div>' +
      '<div class="d-foot"><div class="sumrow"><span>Subtotal</span><b>' + money(t.total) + '</b></div>' +
      (t.ask ? '<div class="sumrow"><span class="muted">' + t.ask + (t.ask === 1 ? " item" : " items") + ' priced on request</span><span class="muted">we’ll confirm</span></div>' : "") +
      '<p class="note">' + esc(S.settings.delivery_note || "") + '</p>' +
      '<a class="btn btn-primary btn-block" href="#/checkout" data-close>Checkout' + icon("arrow", "i-sm") + '</a></div>';
  }
  function refreshBag() { if (layer === $("bag")) { var y = $("bag").querySelector(".d-body"); var top = y ? y.scrollTop : 0; $("bag").innerHTML = bagHtml(); var b = $("bag").querySelector(".d-body"); if (b) b.scrollTop = top; } }

  // Menu drawer & mega menu
  function openMenu() {
    var st = S.settings, wa = waNum(st.whatsapp);
    openLayer($("drawer"), '<div class="d-head"><a class="brand" href="#/" data-close><span class="brand-mark">' + $("brandMark").innerHTML + '</span><span class="brand-text"><b>' + esc(st.shop_name) + '</b></span></a><button class="icon-btn" data-close aria-label="Close menu">' + icon("close") + '</button></div>' +
      '<div class="d-body"><div class="menu-list"><a href="#/shop" data-close>' + icon("grid") + 'All products' + icon("right") + '</a><a href="#/find" data-close>' + icon("sparkle") + 'Celebration planner' + icon("right") + '</a></div>' +
      '<p class="menu-h">Shop by occasion</p><div class="menu-list">' + S.collections.map(function (c) { return '<a href="' + occLink(c) + '" data-close>' + med(c) + esc(c.name) + icon("right") + '</a>'; }).join("") + '</div>' +
      '<p class="menu-h">Your account</p><div class="menu-list"><a href="#/account" data-close>' + icon("user") + (S.me ? "Hi, " + esc(first(S.me.name)) : "Log in") + icon("right") + '</a><a href="#/saved" data-close>' + icon("heart") + 'Saved items' + icon("right") + '</a><a href="#/account" data-close>' + icon("history") + 'My orders' + icon("right") + '</a></div>' +
      '<p class="menu-h">Help</p><div class="menu-list"><a href="#shops" data-close>' + icon("store") + 'Our stores' + icon("right") + '</a>' +
      (wa ? '<a target="_blank" rel="noopener" href="https://wa.me/' + wa + '">' + icon("wa") + 'WhatsApp us' + icon("right") + '</a>' : "") +
      (st.phone ? '<a href="tel:' + esc(st.phone.replace(/[^\d+]/g, "")) + '">' + icon("phone") + esc(st.phone) + icon("right") + '</a>' : "") + '</div></div>');
  }
  function buildNav() {
    var top = S.collections.slice(0, 3);
    $("navOccasions").innerHTML = top.map(function (c) { return '<a class="nav-link" href="' + occLink(c) + '">' + esc(c.name) + '</a>'; }).join("");
    $("mega").innerHTML = '<div><h4>Shop by occasion</h4><div class="mega-list">' + S.collections.map(function (c) {
      var n = productsIn(c).length;
      return '<a href="' + occLink(c) + '">' + med(c) + '<span><b>' + esc(c.name) + '</b><small>' + n + (n === 1 ? " product" : " products") + '</small></span></a>';
    }).join("") + '</div><p style="margin-top:14px"><a class="link" href="#/shop">Browse all products ' + icon("arrow", "i-sm") + '</a></p></div>' +
      '<a class="mega-feature" href="#/find"><span class="eyebrow" style="color:var(--gold-2)">Not sure where to start?</span><h3>Plan your celebration in two taps</h3><span class="btn btn-gold btn-sm">Open the planner' + icon("arrow", "i-sm") + '</span></a>';
  }
  function openMega() { $("mega").hidden = false; $("megaBtn").setAttribute("aria-expanded", "true"); }
  function closeMega() { if (!$("mega").hidden) { $("mega").hidden = true; $("megaBtn").setAttribute("aria-expanded", "false"); } }
  $("megaBtn").addEventListener("click", function (e) { e.stopPropagation(); if ($("mega").hidden) openMega(); else closeMega(); });
  var megaT;
  $("megaWrap").addEventListener("mouseenter", function () { clearTimeout(megaT); openMega(); });
  $("megaWrap").addEventListener("mouseleave", function () { megaT = setTimeout(closeMega, 180); });
  document.addEventListener("click", function (e) { if (!e.target.closest("#megaWrap")) closeMega(); else if (e.target.closest("#mega a")) closeMega(); });

  // ---------- Search ----------
  function openSearch(q) {
    openLayer($("search"), '<div class="search-panel"><div class="search-bar">' + icon("search") +
      '<input id="sq" type="search" placeholder="Search decorations, costumes, trees…" autocomplete="off" enterkeyhint="search" aria-label="Search" value="' + esc(q || "") + '" autofocus>' +
      '<button class="icon-btn" data-close aria-label="Close search">' + icon("close") + '</button></div><div class="search-body" id="sres"></div></div>');
    renderSuggestions();
  }
  var suggIdx = -1;
  function highlight(text, q) {
    var t = esc(text); if (!q) return t;
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    return i < 0 ? t : esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  }
  function renderSuggestions() {
    var box = $("sres"); if (!box) return;
    var q = ($("sq").value || "").trim(); suggIdx = -1;
    if (!q) {
      var trend = S.products.filter(function (p) { return p.featured; }).slice(0, 4);
      box.innerHTML = (S.searches.length ? '<h4>Recent searches</h4><div class="recent-row">' + S.searches.map(function (s) { return '<button data-sq="' + esc(s) + '">' + icon("history") + esc(s) + '</button>'; }).join("") + '</div>' : "") +
        '<h4>Shop by occasion</h4><div class="recent-row">' + S.collections.map(function (c) { return '<a class="chip" href="' + occLink(c) + '" data-close>' + med(c) + esc(c.name) + '</a>'; }).join("") + '</div>' +
        (trend.length ? '<h4>Trending now</h4>' + trend.map(suggRow("")).join("") : "");
      return;
    }
    var ql = q.toLowerCase();
    var prods = S.products.filter(function (p) { return matches(p, q); }).sort(function (a, b) {
      var sa = a.name.toLowerCase().indexOf(ql), sb = b.name.toLowerCase().indexOf(ql);
      return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb) || (b.featured - a.featured);
    });
    var cols = S.collections.filter(function (c) { return c.name.toLowerCase().indexOf(ql) >= 0; });
    box.innerHTML = (cols.length ? '<h4>Occasions</h4><div class="recent-row">' + cols.map(function (c) { return '<a class="chip" href="' + occLink(c) + '" data-close>' + med(c) + '<span>' + highlight(c.name, q) + '</span></a>'; }).join("") + '</div>' : "") +
      (prods.length ? '<h4>Products</h4>' + prods.slice(0, 6).map(suggRow(q)).join("") +
        '<p style="margin-top:12px"><button class="link" data-search-all>See all ' + prods.length + ' results for “' + esc(q) + '” ' + icon("arrow", "i-sm") + '</button></p>'
        : (!cols.length ? emptyState("No matches for “" + esc(q) + "”", "Try a simpler word like “tree”, “balloon” or “costume”.", "") : ""));
  }
  function suggRow(q) {
    return function (p) {
      var c = firstCol(p);
      return '<a class="sugg" href="' + prodLink(p) + '" data-close data-sugg>' + thumb(p) + '<span class="t"><b>' + highlight(p.name, q) + '</b><small>' + (c ? esc(c.name) : "") + (p.in_stock ? "" : " · Sold out") + '</small></span><span class="p">' + (p.price ? money(p.price) : "On request") + '</span></a>';
    };
  }
  function runSearch(q) {
    q = String(q || "").trim(); if (!q) return;
    S.searches = [q].concat(S.searches.filter(function (s) { return s.toLowerCase() !== q.toLowerCase(); })).slice(0, 6);
    store(K.searches, S.searches);
    closeLayer(true);
    location.hash = "#/search/" + encodeURIComponent(q);
  }

  // ---------- Login ----------
  var loginThen = null;
  function authHtml(opts) {
    return '<div class="auth-top">' + (opts.gate ? "" : '<button class="icon-btn modal-x" data-close aria-label="Close">' + icon("close") + '</button>') + diya("a", "mini-diya") +
      '<h2>' + esc(opts.title || "Welcome to " + S.settings.shop_name) + '</h2><p>' + esc(opts.text || "Log in with your mobile number and email to order and hear about festive offers first.") + '</p>' +
      '<div class="auth-perks"><span>' + icon("gift") + 'Festive offers</span><span>' + icon("history") + 'Track orders</span><span>' + icon("check") + 'Faster checkout</span></div></div>' +
      '<div class="auth-body"><form class="form" id="loginForm" novalidate>' +
        '<label class="field"><span>Your name</span><input name="name" autocomplete="name" required' + (opts.gate ? "" : " autofocus") + '></label>' +
        '<label class="field"><span>Mobile number</span><span class="prefix"><b>+91</b><input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" required></span></label>' +
        '<label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" inputmode="email" required></label>' +
        '<div class="alert bad" id="loginErr" hidden></div>' +
        '<button class="btn btn-primary btn-block" type="submit">' + esc(opts.button || "Continue") + '</button>' +
        '<p class="fineprint">We only use your details for your orders and offers from ' + esc(S.settings.shop_name) + '.</p></form></div>';
  }
  function openLogin(opts) {
    opts = opts || {};
    if (opts.gate) { $("gate").innerHTML = '<div class="gate-card">' + authHtml(opts) + '</div>'; $("gate").hidden = false; loginThen = opts.then || null; return; }
    openLayer($("modal"), authHtml(opts));
    loginThen = opts.then || null;
  }
  function submitLogin(form) {
    var err = form.querySelector(".alert"), btn = form.querySelector("button[type=submit]");
    btn.disabled = true; err.hidden = true;
    api("/api/login", { method: "POST", body: { name: form.elements.name.value, phone: form.elements.phone.value, email: form.elements.email.value } }).then(function (r) {
      S.me = r.customer; updateAccount();
      $("gate").hidden = true;
      toast("Welcome, " + first(S.me.name) + "!");
      var then = loginThen; loginThen = null;
      if (layer === $("modal")) closeLayer(true);
      if (then) then(); else if (S.route === "account") route();
    }).catch(function (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; });
  }
  function needLogin() { return !S.me && S.settings.login_mode !== "optional"; }
  function updateAccount() { $("accountDot").hidden = !S.me; $("accountBtn").setAttribute("aria-label", S.me ? "My account (" + S.me.name + ")" : "Log in"); }

  // ---------- Checkout ----------
  function field(name, label, value, attrs, hint) {
    return '<label class="field" data-field="' + name + '"><span>' + label + '</span>' +
      (attrs === "textarea" ? '<textarea name="' + name + '" rows="3">' + esc(value) + '</textarea>' : '<input name="' + name + '" value="' + esc(value) + '" ' + (attrs || "") + '>') +
      (hint ? '<small class="hint">' + hint + '</small>' : "") + '</label>';
  }
  function renderCheckout() {
    if (!S.cart.length) { $("app").innerHTML = '<div class="wrap">' + emptyState("Your bag is empty", "Add a few things for your celebration, then come back here to check out.", '<a class="btn btn-primary" href="#/shop">Start shopping</a>') + '</div>'; return; }
    var d = store(K.draft) || {}, me = S.me || {}, recv = d.receive || "delivery", t = totals();
    if (recv !== "delivery" && !S.shops.some(function (s) { return "pickup:" + s.id === recv; })) recv = "delivery";
    var summary = '<div class="panel summary"><div class="panel-h"><h2>Order summary</h2></div><div class="lines">' + S.cart.map(function (l) {
        var p = S.byId[l.id];
        return '<div class="sline"><span class="thumb" style="--tint:' + tintFor(p) + '">' + (p.images[0] ? '<img src="' + img(p.images[0]) + '" alt="">' : '<span aria-hidden="true">' + esc(emojiFor(p)) + '</span>') + '<i>' + l.qty + '</i></span>' +
          '<span class="t">' + esc(p.name) + '</span><span class="p">' + (p.price ? money(p.price * l.qty) : "On request") + '</span></div>';
      }).join("") + '</div>' +
      '<div style="padding-top:12px"><div class="sumrow"><span>Subtotal</span><span>' + money(t.total) + '</span></div>' +
      (t.ask ? '<div class="sumrow"><span class="muted">Priced on request</span><span class="muted">' + t.ask + (t.ask === 1 ? " item" : " items") + '</span></div>' : "") +
      '<div class="sumrow"><span class="muted">Delivery</span><span class="muted">confirmed on WhatsApp</span></div>' +
      '<div class="sumrow total"><span>Total</span><span>' + money(t.total) + (t.ask ? " +" : "") + '</span></div></div>' +
      '<div class="paynote">' + icon("shield") + '<span>No online payment needed now. We confirm availability, delivery charges and payment with you on WhatsApp.</span></div>' +
      '<button class="btn btn-primary btn-block only-d" type="submit" form="checkout" style="margin-top:16px" data-place>Place order</button>' +
      '<a class="link" href="#/shop" style="margin-top:14px;font-size:.88rem">' + icon("left", "i-sm") + 'Continue shopping</a></div>';
    $("app").innerHTML = '<div class="wrap"><div class="co"><div>' +
      '<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a>' + icon("right") + '<span aria-current="page">Checkout</span></nav>' +
      '<h1 style="margin-top:12px">Checkout</h1><div class="progress" aria-label="Steps"><span class="is-done"><i>' + icon("check", "i-sm") + '</i>Bag</span><hr><span class="is-on" aria-current="step"><i>2</i>Details</span><hr><span><i>3</i>Confirmation</span></div>' +
      '<form id="checkout" class="form" novalidate>' +
        '<div class="panel"><div class="panel-h"><i>1</i><h2>Your details</h2></div><div class="form">' +
          field("name", "Full name", d.name || me.name, 'autocomplete="name"') +
          '<label class="field" data-field="phone"><span>Mobile number</span><span class="prefix"><b>+91</b><input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" value="' + esc(d.phone || me.phone) + '"></span><small class="hint">We will confirm your order on WhatsApp.</small></label>' +
          field("email", "Email (optional)", d.email || me.email, 'type="email" autocomplete="email" inputmode="email"') + '</div></div>' +
        '<div class="panel"><div class="panel-h"><i>2</i><h2>How would you like to receive it?</h2></div><div class="ropts">' +
          [{ v: "delivery", t: "Ship to my address", s: "We deliver your order directly to you", ic: "truck" }].concat(S.shops.map(function (sh) { return { v: "pickup:" + sh.id, t: "Pick up from " + sh.name, s: sh.about || sh.address || "Collect from our store", ic: "store" }; })).map(function (o) {
            return '<label class="ropt"><input type="radio" name="receive" value="' + o.v + '"' + (o.v === recv ? " checked" : "") + '><span><b>' + esc(o.t) + '</b><small>' + esc(o.s) + '</small></span>' + icon(o.ic) + '</label>';
          }).join("") + '</div></div>' +
        '<div class="panel" id="addrBox"' + (recv !== "delivery" ? " hidden" : "") + '><div class="panel-h"><i>3</i><h2>Shipping address</h2></div><div class="form">' +
          field("line", "House / flat no., building, street", d.line, "textarea") +
          field("landmark", "Area / landmark (optional)", d.landmark, 'placeholder="e.g. near Ganesha temple"') +
          '<div class="two">' + field("city", "City", d.city, 'autocomplete="address-level2"') + field("pincode", "PIN code", d.pincode, 'inputmode="numeric" maxlength="6" autocomplete="postal-code"') + '</div>' +
          field("state", "State", d.state || "Karnataka", 'autocomplete="address-level1"') + '</div></div>' +
        '<div class="panel"><div class="panel-h"><i>' + (recv !== "delivery" ? 3 : 4) + '</i><h2>Date &amp; special instructions</h2></div><div class="form">' +
          field("needed_by", "Needed by (optional)", d.needed_by, 'type="date"') +
          field("notes", "Special instructions (optional)", d.notes, "textarea", "Theme & colours, name or age for the banner, delivery time, gift wrapping — anything we should know.") + '</div></div>' +
        '<div class="alert bad" id="orderErr" hidden></div>' +
        '<div class="co-cta-m"><button class="btn btn-primary btn-block" type="submit" data-place>Place order · ' + money(t.total) + (t.ask ? " +" : "") + '</button></div>' +
      '</form></div>' + summary + '</div></div>';
    if (needLogin()) openLogin({ title: "Almost there", text: "Log in with your mobile number and email to place your order.", button: "Continue to checkout", then: renderCheckout });
  }
  function formDraft(form) {
    var d = {};
    ["name", "phone", "email", "line", "landmark", "city", "pincode", "state", "needed_by", "notes"].forEach(function (k) { d[k] = form.elements[k] ? form.elements[k].value.trim() : ""; });
    var r = form.querySelector('input[name="receive"]:checked'); d.receive = r ? r.value : "delivery";
    return d;
  }
  function validate(d) {
    var bad = {};
    if (!d.name) bad.name = "Please enter your name.";
    if (d.phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").length !== 10) bad.phone = "Please enter a 10-digit mobile number.";
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) bad.email = "Please check your email address.";
    if (d.receive === "delivery") {
      if (!d.line) bad.line = "Please enter your house / street address.";
      if (!d.city) bad.city = "Please enter your city.";
      if (!/^\d{6}$/.test(d.pincode)) bad.pincode = "Please enter a 6-digit PIN code.";
    }
    return bad;
  }
  function showErrors(form, bad) {
    $$(".field", form).forEach(function (f) { f.classList.remove("bad"); var e = f.querySelector(".err-t"); if (e) e.remove(); });
    var firstBad = null;
    Object.keys(bad).forEach(function (k) {
      var f = form.querySelector('[data-field="' + k + '"]'); if (!f) return;
      f.classList.add("bad"); f.insertAdjacentHTML("beforeend", '<small class="err-t">' + esc(bad[k]) + '</small>');
      if (!firstBad) firstBad = f;
    });
    if (firstBad) { firstBad.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }); var inp = firstBad.querySelector("input,textarea"); if (inp) inp.focus({ preventScroll: true }); }
  }
  function placeOrder(form) {
    var d = formDraft(form); store(K.draft, d);
    var bad = validate(d);
    showErrors(form, bad);
    if (Object.keys(bad).length) return;
    if (needLogin()) return openLogin({ title: "Almost there", text: "Log in to place your order.", button: "Continue", then: function () { placeOrder($("checkout")); } });
    var err = $("orderErr"), btns = $$("[data-place]");
    btns.forEach(function (b) { b.disabled = true; b.dataset.label = b.textContent; b.textContent = "Placing your order…"; });
    err.hidden = true;
    api("/api/orders", { method: "POST", body: {
      name: d.name, phone: d.phone, email: d.email, receive: d.receive, needed_by: d.needed_by, notes: d.notes,
      address: { line: d.line, landmark: d.landmark, city: d.city, pincode: d.pincode, state: d.state },
      items: S.cart.map(function (l) { return { id: l.id, qty: l.qty }; })
    } }).then(function (r) {
      S.lastOrder = Object.assign({ name: d.name, sent: {}, lines: S.cart.map(function (l) { return { p: S.byId[l.id], qty: l.qty }; }) }, r);
      S.cart = []; store(K.cart, S.cart); updateCounts();
      store(K.draft, { name: d.name, phone: d.phone, email: d.email, line: d.line, landmark: d.landmark, city: d.city, pincode: d.pincode, state: d.state, receive: d.receive });
      if (r.email) emailOwner(r);
      location.hash = "#/order";
    }).catch(function (e) {
      btns.forEach(function (b) { b.disabled = false; b.textContent = b.dataset.label; });
      if (e.code === "login") { openLogin({ title: "Please log in", text: e.message, button: "Continue", then: function () { placeOrder($("checkout")); } }); return; }
      err.textContent = e.message; err.hidden = false; err.scrollIntoView({ block: "center" });
    });
  }
  // A copy of every order also goes to the owner's Gmail (free FormSubmit service) — unchanged behaviour.
  function emailOwner(r) {
    var b = new URLSearchParams();
    b.append("_subject", "New order " + r.order.code + " – " + r.order.totalText);
    b.append("_template", "box"); b.append("_captcha", "false");
    b.append("Order", r.text.replace(/\*/g, ""));
    fetch("https://formsubmit.co/ajax/" + encodeURIComponent(r.email), { method: "POST", headers: { Accept: "application/json" }, body: b }).catch(function () {});
  }

  // ---------- Confirmation ----------
  function sealSvg() {
    var ring = [];
    for (var k = 0; k < 12; k++) ring.push('<path d="M60 8C64 14 64 19 60 24 56 19 56 14 60 8Z" pathLength="1" transform="rotate(' + (k * 30) + ' 60 60)" style="--d:' + k + '"/>');
    return '<svg class="done-seal" viewBox="0 0 120 120" aria-hidden="true"><g class="ring"><circle cx="60" cy="60" r="34" pathLength="1"/>' + ring.join("") + '</g><path class="tick" d="M45 61l10 10 21-22" pathLength="1"/></svg>';
  }
  function renderOrder() {
    var o = S.lastOrder;
    if (!o) { location.replace("#/account"); return; }
    var many = o.whatsapp.length > 1;
    $("app").innerHTML = '<div class="wrap"><div class="done">' + sealSvg() +
      '<h1>Thank you, ' + esc(first(o.name)) + '!</h1><span class="code">Order ' + esc(o.order.code) + '</span>' +
      '<p class="lead">We have received your order' + (/^pickup/i.test(o.order.how || "") ? " for " + esc(o.order.how.replace(/^Pickup/, "pickup")) : " for home delivery") + '. ' +
        (o.whatsapp.length ? (many ? "<b>Please tap each WhatsApp button below</b> so our team can confirm it quickly." : "Tap below to send it to us on WhatsApp for a quick confirmation.") : "We will be in touch shortly.") + '</p>' +
      (o.whatsapp.length ? '<div class="wa-steps">' + o.whatsapp.map(function (t, i) {
        var n = t.num.slice(-10), sent = o.sent[i];
        return '<a class="wa-step' + (sent ? " sent" : "") + '" data-wa="' + i + '" target="_blank" rel="noopener" href="https://wa.me/' + t.num + '?text=' + encodeURIComponent(o.text) + '">' +
          '<span class="n">' + (sent ? icon("check", "i-sm") : (i + 1)) + '</span><span class="t"><b>' + (sent ? "Sent to " : "Send to ") + esc(t.label) + '</b><small>WhatsApp · ' + n.slice(0, 5) + ' ' + n.slice(5) + '</small></span>' + icon("arrow") + '</a>';
      }).join("") + '</div>' : "") +
      '<details class="receipt"><summary>Order details · ' + esc(o.order.totalText) + '</summary><pre>' + esc(o.text.replace(/\*/g, "")) + '</pre></details>' +
      '<div class="hero-ctas" style="justify-content:center"><a class="btn btn-primary" href="#/shop">Continue shopping</a><a class="btn btn-line" href="#/account">View my orders</a></div></div></div>';
    setMeta("Order placed – " + S.settings.shop_name);
  }

  // ---------- Account & saved ----------
  function renderAccount() {
    if (!S.me) {
      $("app").innerHTML = '<div class="wrap"><div class="acct"><div class="profile"><span class="eyebrow" style="color:var(--gold-2)">My account</span><h1>Your orders, saved items and faster checkout.</h1><p>Log in with your mobile number and email.</p></div><div class="panel" style="padding:0;overflow:hidden" id="acctLogin"></div></div></div>';
      $("acctLogin").innerHTML = authHtml({ gate: true, title: "Log in", button: "Log in" });
      loginThen = function () { route(); };
      return;
    }
    var saved = S.saved.map(function (id) { return S.byId[id]; }).filter(Boolean);
    $("app").innerHTML = '<div class="wrap"><div class="acct"><div><div class="profile"><span class="avatar">' + esc(first(S.me.name).charAt(0).toUpperCase()) + '</span><h1>Hi, ' + esc(first(S.me.name)) + '</h1>' +
      '<p>' + esc(S.me.phone) + (S.me.email ? " · " + esc(S.me.email) : "") + '</p><button class="btn btn-line-light btn-sm" data-logout>Log out</button></div>' +
      '<div class="menu-list" style="margin-top:16px"><a href="#/saved">' + icon("heart") + 'Saved items (' + saved.length + ')' + icon("right") + '</a><a href="#shops">' + icon("store") + 'Our stores' + icon("right") + '</a></div></div>' +
      '<div><div class="sec-head" style="margin-bottom:16px"><div><span class="eyebrow">History</span><h2>My orders</h2></div></div><div id="myOrders"><div class="skel" style="height:96px;margin-bottom:12px"></div><div class="skel" style="height:96px"></div></div></div></div></div>';
    api("/api/my-orders").then(function (r) {
      $("myOrders").innerHTML = r.orders.length ? r.orders.map(function (o) {
        return '<div class="ocard"><div class="top"><b>' + esc(o.code) + '</b><span class="ostatus ' + esc(o.status) + '">' + esc(o.status) + '</span></div>' +
          '<div class="meta">' + new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + ' · ' + (o.receive === "pickup" ? "Store pickup" : "Home delivery") + ' · ' + money(o.total) + (o.on_request ? " + on request" : "") + '</div>' +
          '<ul>' + o.items.map(function (i) { return '<li>' + esc(i.name) + ' × ' + i.qty + '</li>'; }).join("") + '</ul></div>';
      }).join("") : emptyState("No orders yet", "When you place an order, you can follow its status here.", '<a class="btn btn-primary" href="#/shop">Start shopping</a>');
    }).catch(function () { $("myOrders").innerHTML = '<p class="alert bad">We couldn’t load your orders. Please refresh.</p>'; });
  }
  function renderSaved() {
    var list = S.saved.map(function (id) { return S.byId[id]; }).filter(Boolean);
    $("app").innerHTML = '<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a>' + icon("right") + '<span aria-current="page">Saved</span></nav>' +
      '<div class="list-title"><h1>Saved items</h1><p>Saved on this device — tap the heart on any product to add it here.</p></div><div style="padding:24px 0 48px">' +
      (list.length ? grid(list) : emptyState("Nothing saved yet", "Tap the heart on anything you love and it will wait for you here.", '<a class="btn btn-primary" href="#/shop">Explore products</a>')) + '</div></div>';
  }

  // ---------- Footer ----------
  function renderFooter() {
    var st = S.settings, wa = waNum(st.whatsapp);
    var ig = st.instagram ? (/^https?:/.test(st.instagram) ? st.instagram : "https://instagram.com/" + st.instagram.replace(/^@/, "")) : "";
    $("footer").innerHTML = FTR_BORDER + '<div class="wrap"><div class="ftr-in">' +
      '<div><h3>' + esc(st.shop_name) + '</h3><p class="tag">' + esc(st.tagline) + '</p><p style="margin-top:14px;max-width:320px">' + esc((st.about || "").split(".").slice(0, 1).join(".")) + '.</p></div>' +
      '<div><h4>Shop</h4><ul><li><a href="#/shop">All products</a></li>' + S.collections.slice(0, 7).map(function (c) { return '<li><a href="' + occLink(c) + '">' + esc(c.name) + '</a></li>'; }).join("") + '</ul></div>' +
      '<div><h4>Help</h4><ul><li><a href="#/account">My orders</a></li><li><a href="#/saved">Saved items</a></li><li><a href="#/find">Celebration planner</a></li>' +
        (wa ? '<li><a target="_blank" rel="noopener" href="https://wa.me/' + wa + '">' + icon("wa") + 'WhatsApp us</a></li>' : "") +
        (st.phone ? '<li><a href="tel:' + esc(st.phone.replace(/[^\d+]/g, "")) + '">' + icon("phone") + esc(st.phone) + '</a></li>' : "") +
        (st.order_email ? '<li><a href="mailto:' + esc(st.order_email) + '">' + icon("mail") + esc(st.order_email) + '</a></li>' : "") +
        (ig ? '<li><a target="_blank" rel="noopener" href="' + esc(ig) + '">' + icon("insta") + 'Instagram</a></li>' : "") + '</ul></div>' +
      '<div><h4>Our stores</h4><ul>' + S.shops.map(function (sh) {
        var dir = /^https?:\/\//.test(sh.map_link) ? sh.map_link : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(sh.name + " " + sh.address);
        return '<li><a target="_blank" rel="noopener" href="' + esc(dir) + '">' + icon("pin") + esc(sh.name) + '</a></li>';
      }).join("") + '</ul></div></div>' +
      '<div class="ftr-base"><span>© ' + new Date().getFullYear() + ' ' + esc(st.shop_name) + '. All rights reserved.</span><span>' + esc(st.delivery_note || "") + '</span></div></div>';
  }

  // ---------- Router ----------
  function setMeta(title, desc) {
    document.title = title;
    var m = document.querySelector('meta[name="description"]'); if (m && desc) m.setAttribute("content", String(desc).slice(0, 160));
  }
  function route() {
    var h = location.hash || "#/";
    try { h = decodeURIComponent(h); } catch (e) {}
    closeLayer(true); closeMega();
    var key = "home", p, c, m;
    document.body.classList.remove("no-tabbar", "no-fab");
    if ((m = /^#\/p\/(\d+)/.exec(h)) && (p = S.byId[+m[1]])) { key = "product"; renderProduct(p); document.body.classList.add("no-tabbar", "no-fab"); }
    else if ((m = /^#\/c\/(\d+)/.exec(h)) && (c = S.colById[+m[1]])) {
      key = "occ"; if (S.route !== "occ" + c.id) resetFilters();
      renderListing({ type: "occ", col: c, base: function () { return productsIn(c); } });
      setMeta(c.name + " – " + S.settings.shop_name, c.description); key = "occ" + c.id;
    }
    else if (/^#\/search\//.test(h)) {
      var q = h.replace(/^#\/search\//, "");
      if (S.route !== "search:" + q) resetFilters();
      renderListing({ type: "search", q: q, base: function () { return S.products.filter(function (x) { return matches(x, q); }); } });
      setMeta("Search: " + q + " – " + S.settings.shop_name); key = "search:" + q;
    }
    else if (h === "#/shop" || h === "#all") {
      if (S.route !== "shop") resetFilters();
      renderListing({ type: "shop", base: function () { return S.products; } }); key = "shop";
      setMeta("Shop all – " + S.settings.shop_name);
    }
    else if (h === "#/checkout") { key = "checkout"; renderCheckout(); document.body.classList.add("no-tabbar", "no-fab"); setMeta("Checkout – " + S.settings.shop_name); }
    else if (h === "#/order") { key = "order"; renderOrder(); }
    else if (h === "#/account") { key = "account"; renderAccount(); setMeta("My account – " + S.settings.shop_name); }
    else if (h === "#/saved") { key = "saved"; renderSaved(); setMeta("Saved items – " + S.settings.shop_name); }
    else {
      var anchor = /^#\/?(find|shops|about|occasions)$/.exec(h);
      if (S.route !== "home" || !$("occasions") && !$("find")) renderHome();
      S.route = "home"; setMeta(S.settings.shop_name + " – " + (S.settings.tagline || "Party & festival decorations"), S.settings.about);
      setTab("home"); reveal();
      if (anchor && $(anchor[1])) { var el = $(anchor[1]); requestAnimationFrame(function () { window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: reduced ? "auto" : "smooth" }); }); }
      else window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    if (key !== S.route) window.scrollTo({ top: 0, behavior: "instant" });
    S.route = key;
    setTab(key === "shop" || /^occ|^search/.test(key) ? "shop" : key === "saved" ? "saved" : "");
    reveal();
    $("app").focus({ preventScroll: true });
  }
  function setTab(t) { $$(".tabbar [data-tab]").forEach(function (a) { a.classList.toggle("on", a.dataset.tab === t); }); }

  // ---------- Reveal on scroll ----------
  var io = "IntersectionObserver" in window && !reduced ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;
  function reveal() {
    $$(".rv:not(.in)").forEach(function (el) { if (io) io.observe(el); else el.classList.add("in"); });
  }

  // ---------- Feedback ----------
  function toast(msg, action) {
    var t = $("toast");
    t.innerHTML = icon("check") + '<span>' + esc(msg) + '</span>' + (action ? '<button data-toast-act>' + esc(action.label) + '</button>' : "");
    t.classList.add("show");
    t._act = action && action.fn;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  function fly(from) {
    if (reduced || !from || !from.getBoundingClientRect) return;
    var target = [$("cartBtn"), $("tabBag")].find(function (b) { return b.offsetParent !== null && b.getBoundingClientRect().width; });
    if (!target || !document.body.animate) return;
    var a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
    var dot = document.createElement("span"); dot.className = "fly";
    dot.style.left = (a.left + a.width / 2 - 9) + "px"; dot.style.top = (a.top + a.height / 2 - 9) + "px";
    document.body.appendChild(dot);
    var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    dot.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: "translate(" + dx * 0.5 + "px," + (dy * 0.5 - 80) + "px) scale(1.1)", opacity: 1, offset: 0.5 }, { transform: "translate(" + dx + "px," + dy + "px) scale(.4)", opacity: 0.2 }],
      { duration: 700, easing: "cubic-bezier(.45,0,.2,1)" }).onfinish = function () { dot.remove(); };
  }
  function added(p, el) {
    fly(el); refreshActs(); refreshBag();
    toast(p.name.length > 28 ? "Added to your bag" : p.name + " added", { label: "View bag", fn: openBag });
  }

  // ---------- Events ----------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-inc],[data-dec],[data-rm],[data-save],[data-close],[data-open-bag],[data-padd],[data-pbuy],[data-pq],[data-plan-occ],[data-plan-budget],[data-rail],[data-open-filters],[data-clear],[data-logout],[data-wa],[data-share],[data-zoom],[data-sq],[data-search-all],[data-toast-act]");
    if (!t) return;
    var d = t.dataset, p;
    if (d.inc) { p = S.byId[+d.inc]; var was = cartQty(p.id); setQty(p.id, was + 1); if (!was) added(p, t); else { refreshActs(); refreshBag(); } }
    else if (d.dec) { setQty(+d.dec, cartQty(+d.dec) - 1); refreshActs(); refreshBag(); }
    else if (d.rm) { setQty(+d.rm, 0); refreshActs(); refreshBag(); }
    else if (d.save) {
      e.preventDefault();
      var on = toggleSaved(+d.save); refreshActs();
      if (!reduced) { t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop"); }
      var ps = $("pSave"); if (ps) ps.querySelector("span").textContent = isSaved(+ps.dataset.save) ? "Saved" : "Save";
      toast(on ? "Saved for later" : "Removed from saved", on ? { label: "View", fn: function () { location.hash = "#/saved"; } } : null);
    }
    else if (d.openBag !== undefined) openBag();
    else if (d.padd) { p = S.byId[+d.padd]; var had = cartQty(p.id); setQty(p.id, t.closest("#stickyBuy") ? Math.max(1, PQ) : PQ); if (!had) added(p, t); else { refreshActs(); toast("Bag updated", { label: "View bag", fn: openBag }); } var pb = t.closest(".buy"); if (pb) t.lastChild.textContent = "Update bag"; }
    else if (d.pbuy) { p = S.byId[+d.pbuy]; setQty(p.id, PQ); location.hash = "#/checkout"; }
    else if (d.pq) { PQ = Math.max(1, Math.min(999, PQ + Number(d.pq))); $("pq").textContent = PQ; }
    else if (d.planOcc) { S.plan.occ = +d.planOcc; S.plan.budget = "any"; $$("[data-plan-occ]").forEach(function (b) { b.setAttribute("aria-pressed", b === t); }); renderPlanner(); }
    else if (d.planBudget) { S.plan.budget = d.planBudget; renderPlanner(); }
    else if (d.rail) { var r = $(d.rail); r.scrollBy({ left: Number(d.dir) * r.clientWidth * 0.8, behavior: reduced ? "auto" : "smooth" }); }
    else if (d.openFilters !== undefined) {
      openLayer($("drawer"), '<div class="d-head"><h2>Filters</h2><button class="icon-btn" data-close aria-label="Close filters">' + icon("close") + '</button></div><div class="d-body" id="mFilters">' + filtersHtml(L.base(), L.type !== "occ") + '</div>' +
        '<div class="d-foot" style="display:flex;gap:10px"><button class="btn btn-line" data-clear="all">Clear</button><button class="btn btn-primary" style="flex:1" data-close id="mFiltersBtn"></button></div>');
      refreshListing();
    }
    else if (d.clear) {
      if (d.clear === "all") resetFilters();
      else if (d.clear === "price") S.f.price = ""; else if (d.clear === "stock") S.f.stock = false; else if (d.clear === "sale") S.f.sale = false;
      else if (/^occ:/.test(d.clear)) { var id = +d.clear.slice(4); S.f.occ = S.f.occ.filter(function (x) { return x !== id; }); }
      refreshListing();
    }
    else if (d.logout !== undefined) { api("/api/logout", { method: "POST" }).then(function () { S.me = null; updateAccount(); toast("Logged out"); if (S.settings.login_mode === "browse") openLogin({ gate: true }); else route(); }); }
    else if (d.wa !== undefined && S.lastOrder) { S.lastOrder.sent[+d.wa] = true; setTimeout(renderOrder, 400); }
    else if (d.share) {
      p = S.byId[+d.share]; var url = location.origin + "/" + prodLink(p);
      if (navigator.share) navigator.share({ title: p.name, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast("Link copied"); });
    }
    else if (d.zoom !== undefined) { var m = /^#\/p\/(\d+)/.exec(location.hash); p = m && S.byId[+m[1]]; if (p && p.images.length) { var tr = $("gTrack"); openLightbox(p, t.tagName === "IMG" ? +d.zoom : Math.round(tr.scrollLeft / tr.clientWidth)); } }
    else if (d.sq) { $("sq").value = d.sq; renderSuggestions(); $("sq").focus(); }
    else if (d.searchAll !== undefined) runSearch($("sq").value);
    else if (d.toastAct !== undefined) { $("toast").classList.remove("show"); if ($("toast")._act) $("toast")._act(); }
    if (d.close !== undefined) closeLayer();
  });
  document.addEventListener("change", function (e) {
    var t = e.target, d = t.dataset;
    if (t.id === "sort") { S.f.sort = t.value; refreshListing(); }
    else if (d.fOcc) { var id = +d.fOcc; S.f.occ = t.checked ? S.f.occ.concat(id) : S.f.occ.filter(function (x) { return x !== id; }); refreshListing(); }
    else if (d.fPrice !== undefined) { S.f.price = d.fPrice; refreshListing(); }
    else if (d.fStock !== undefined) { S.f.stock = t.checked; refreshListing(); }
    else if (d.fSale !== undefined) { S.f.sale = t.checked; refreshListing(); }
    else if (t.name === "receive") {
      $("addrBox").hidden = t.value !== "delivery";
      var nums = $$("#checkout .panel-h i"); if (nums[3]) nums[3].textContent = t.value === "delivery" ? 4 : 3;
      store(K.draft, formDraft(t.form));
    }
  });
  document.addEventListener("input", function (e) {
    if (e.target.id === "sq") renderSuggestionsDebounced();
    if (e.target.form && e.target.form.id === "checkout") {
      store(K.draft, formDraft(e.target.form));
      var f = e.target.closest(".field.bad"); if (f) { f.classList.remove("bad"); var er = f.querySelector(".err-t"); if (er) er.remove(); }
    }
  });
  var renderSuggestionsDebounced = debounce(renderSuggestions, 90);
  document.addEventListener("keydown", function (e) {
    if (e.target.id !== "sq") return;
    var items = $$("#sres [data-sugg]");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); if (!items.length) return;
      suggIdx = (suggIdx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach(function (x, i) { x.classList.toggle("on", i === suggIdx); }); items[suggIdx].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggIdx >= 0 && items[suggIdx]) { closeLayer(true); location.hash = items[suggIdx].getAttribute("href"); }
      else runSearch(e.target.value);
    }
  });
  document.addEventListener("submit", function (e) {
    if (e.target.id === "loginForm") { e.preventDefault(); submitLogin(e.target); }
    if (e.target.id === "checkout") { e.preventDefault(); placeOrder(e.target); }
  });
  $("cartBtn").addEventListener("click", openBag);
  $("tabBag").addEventListener("click", openBag);
  $("menuBtn").addEventListener("click", openMenu);
  $("searchBtn").addEventListener("click", function () { openSearch(); });
  $("searchBar").addEventListener("click", function () { openSearch(); });
  $("tabSearch").addEventListener("click", function () { openSearch(); });
  var navStack = [];
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("hashchange", function () {
    var h = location.hash || "#/", restore = null;
    if (navStack.length) navStack[navStack.length - 1].y = window.scrollY;
    if (navStack.length >= 2 && navStack[navStack.length - 2].hash === h) { navStack.pop(); restore = navStack[navStack.length - 1].y; }
    else navStack.push({ hash: h, y: 0 });
    route();
    if (restore) requestAnimationFrame(function () { window.scrollTo({ top: restore, behavior: "instant" }); });
  });
  var onScroll = function () { $("hdr").classList.toggle("scrolled", window.scrollY > 8); };
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---------- Start ----------
  Promise.all([api("/api/store"), api("/api/me").catch(function () { return { customer: null }; })]).then(function (res) {
    var data = res[0];
    S.settings = data.settings; S.collections = data.collections; S.products = data.products; S.shops = data.shops; S.me = res[1].customer;
    S.products.forEach(function (p) { S.byId[p.id] = p; });
    S.collections.forEach(function (c) { S.colById[c.id] = c; });
    S.cart = (store(K.cart) || []).filter(function (l) { return S.byId[l.id] && S.byId[l.id].in_stock && l.qty > 0; });
    S.saved = (store(K.saved) || []).filter(function (id) { return S.byId[id]; });
    S.recent = (store(K.recent) || []).filter(function (id) { return S.byId[id]; });
    S.searches = store(K.searches) || [];

    var st = S.settings;
    $("brandName").textContent = st.shop_name;
    $("brandTag").textContent = st.tagline || "Party & festival decorations";
    $("brandMark").innerHTML = st.logo_id ? '<img src="' + img(st.logo_id) + '" alt="">' :
      esc(st.shop_name.split(/\s+/).filter(function (w) { return /^[a-z]/i.test(w); }).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(""));
    if (st.announcement) {
      $("promoText").textContent = st.announcement; $("promo").hidden = false;
      requestAnimationFrame(function () { var pi = $("promo").querySelector(".promo-in"); if (pi.scrollWidth > $("promo").clientWidth) { $("promoText").textContent = st.announcement + "      ✦      " + st.announcement; $("promo").classList.add("scroll"); } });
    }
    var wa = waNum(st.whatsapp);
    if (wa) { $("waFab").href = "https://wa.me/" + wa; $("waFab").hidden = false; }
    var ld = document.createElement("script"); ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Store", name: st.shop_name, description: st.tagline, url: location.origin, telephone: st.phone || undefined, email: st.order_email || undefined });
    document.head.appendChild(ld);
    navStack.push({ hash: location.hash || "#/", y: 0 });
    buildNav(); updateCounts(); updateAccount(); renderFooter(); route(); onScroll();

    if (!S.me && st.login_mode === "browse") openLogin({ gate: true, text: "Log in with your mobile number and email to explore our full collection and offers." });
    else if (!S.me && st.welcome_popup === "on") {
      var seen = false; try { seen = sessionStorage.getItem("se-welcome"); sessionStorage.setItem("se-welcome", "1"); } catch (e) {}
      if (!seen) setTimeout(function () { if (!layer && !S.me && S.route !== "checkout" && S.route !== "account") openLogin(); }, 7000);
    }
  }).catch(function () {
    $("app").innerHTML = '<div class="wrap">' + emptyState("We couldn’t open the store", "Please check your internet connection and try again.", '<button class="btn btn-primary" onclick="location.reload()">Try again</button>') + '</div>';
  });
})();
