(function () {
  "use strict";

  // ---------- State ----------
  var S = { settings: {}, collections: [], products: [], shops: [], byId: {}, colById: {}, me: null, cart: [], query: "", filter: "all", sort: "featured" };
  var CART_KEY = "se-cart-v1", DRAFT_KEY = "se-checkout-v1";
  var GRADS = [
    "linear-gradient(135deg,#ff9a3d,#e23d7a)", "linear-gradient(135deg,#31104d,#ff6a00)", "linear-gradient(135deg,#136b3b,#c62828)",
    "linear-gradient(135deg,#a78bfa,#ec4899)", "linear-gradient(135deg,#60a5fa,#f472b6)", "linear-gradient(135deg,#f59e0b,#b45309)",
    "linear-gradient(135deg,#ef4444,#f59e0b)", "linear-gradient(135deg,#8b1e6b,#ffb703)"
  ];
  var SOFT = ["#fff1e6", "#f3e8ff", "#e9f7ef", "#fdf2f8", "#eef4ff", "#fff7e0", "#fff0f0", "#fcefff"];

  // ---------- Helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function img(id) { return "/img/" + id; }
  function waNum(v) { var d = String(v || "").replace(/\D/g, ""); if (d.length === 10) d = "91" + d; return d; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.add("hidden"); }, 2000); }
  function api(path, opts) {
    opts = opts || {};
    return fetch(path, {
      method: opts.method || "GET", credentials: "same-origin",
      headers: opts.body ? { "content-type": "application/json" } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || j.error || "Something went wrong"); e.code = j.error; e.status = r.status; throw e; } return j; }); });
  }
  function colIndex(id) { var c = S.colById[id]; return c ? S.collections.indexOf(c) : 0; }
  function firstCol(p) { return S.colById[p.collections[0]]; }
  function emojiFor(p) { var c = firstCol(p); return (c && c.emoji) || "🎉"; }
  function soft(p) { return SOFT[colIndex(p.collections[0]) % SOFT.length]; }
  function discount(p) { return p.price && p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0; }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  // ---------- Cart ----------
  function cartQty(id) { var l = S.cart.find(function (x) { return x.id === id; }); return l ? l.qty : 0; }
  function setQty(id, qty) {
    qty = Math.max(0, Math.min(999, qty | 0));
    var i = S.cart.findIndex(function (x) { return x.id === id; });
    if (!qty) { if (i >= 0) S.cart.splice(i, 1); } else if (i >= 0) S.cart[i].qty = qty; else S.cart.push({ id: id, qty: qty });
    saveCart();
  }
  function saveCart() {
    store(CART_KEY, S.cart);
    $("cartCount").textContent = S.cart.reduce(function (a, l) { return a + l.qty; }, 0);
    var b = $("cartBtn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  }
  function totals() {
    var t = 0, ask = 0;
    S.cart.forEach(function (l) { var p = S.byId[l.id]; if (p.price) t += p.price * l.qty; else ask++; });
    return { total: t, ask: ask };
  }

  // ---------- Pieces ----------
  function priceHtml(p) {
    if (!p.price) return '<div class="price"><span class="ask">Price on request</span></div>';
    return '<div class="price"><b>' + money(p.price) + '</b>' + (p.mrp && p.mrp > p.price ? '<s>' + money(p.mrp) + '</s>' : "") + '</div>';
  }
  function actHtml(p) {
    if (!p.in_stock) return '<button class="add" disabled>Out of stock</button>';
    var q = cartQty(p.id);
    if (q) return '<div class="qty"><button data-dec="' + p.id + '" aria-label="Less">−</button><span>' + q + '</span><button data-inc="' + p.id + '" aria-label="More">+</button></div>';
    return '<button class="add" data-inc="' + p.id + '">+ Add to cart</button>';
  }
  function card(p) {
    var off = discount(p);
    return '<article class="card" data-card="' + p.id + '">' +
      '<button class="pic" data-open="' + p.id + '" style="background:' + soft(p) + '" aria-label="' + esc(p.name) + '">' +
        '<span class="ph">' + esc(emojiFor(p)) + '</span>' +
        (p.images[0] ? '<img loading="lazy" src="' + img(p.images[0]) + '" alt="' + esc(p.name) + '" onerror="this.remove()">' : "") +
        '<span class="badges">' + (p.tag ? '<span class="badge">' + esc(p.tag) + '</span>' : !p.in_stock ? '<span class="badge out">Sold out</span>' : "<span></span>") +
        (off ? '<span class="badge off">' + off + '% OFF</span>' : "") + '</span>' +
      '</button>' +
      '<div class="info"><h3>' + esc(p.name) + '</h3>' + priceHtml(p) + '<div class="act" data-act="' + p.id + '">' + actHtml(p) + '</div></div>' +
    '</article>';
  }
  function grid(list) { return list.length ? '<div class="grid">' + list.map(card).join("") + '</div>' : '<div class="empty">Nothing here yet — new stock arrives every season! 🎈</div>'; }
  function productsIn(c) { return S.products.filter(function (p) { return p.collections.indexOf(c.id) >= 0; }); }
  function refreshActs() {
    document.querySelectorAll("[data-act]").forEach(function (el) { var p = S.byId[+el.dataset.act]; if (p) el.innerHTML = actHtml(p); });
  }

  function sortList(list) {
    var l = list.slice();
    if (S.sort === "low") l.sort(function (a, b) { return (a.price || 1e9) - (b.price || 1e9); });
    else if (S.sort === "high") l.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    else if (S.sort === "new") l.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    else if (S.sort === "off") l.sort(function (a, b) { return discount(b) - discount(a); });
    return l;
  }
  function filtered() {
    var q = S.query.trim().toLowerCase();
    var list = S.products.filter(function (p) {
      if (S.filter !== "all" && p.collections.indexOf(+S.filter) < 0) return false;
      if (!q) return true;
      var cols = p.collections.map(function (id) { return S.colById[id] ? S.colById[id].name : ""; }).join(" ");
      return (p.name + " " + p.description + " " + p.tag + " " + cols).toLowerCase().indexOf(q) >= 0;
    });
    return sortList(list);
  }
  function toolbar(withChips) {
    return '<div class="toolbar">' +
      '<div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input id="q" type="search" placeholder="Search costumes, trees, balloons…" value="' + esc(S.query) + '" autocomplete="off"></div>' +
      (withChips ? '<div class="chips" id="chips">' + chipsHtml() + '</div>' : "") +
      '<div class="sort"><span id="count"></span><select id="sort" aria-label="Sort">' +
        [["featured", "Recommended"], ["new", "Newest"], ["low", "Price: low to high"], ["high", "Price: high to low"], ["off", "Biggest discount"]].map(function (o) {
          return '<option value="' + o[0] + '"' + (S.sort === o[0] ? " selected" : "") + '>' + o[1] + '</option>';
        }).join("") + '</select></div></div>';
  }
  function chipsHtml() {
    return '<button class="chip' + (S.filter === "all" ? " on" : "") + '" data-filter="all">All</button>' +
      S.collections.map(function (c) { return '<button class="chip' + (String(S.filter) === String(c.id) ? " on" : "") + '" data-filter="' + c.id + '">' + esc(c.emoji + " " + c.name) + '</button>'; }).join("");
  }
  function refreshGrid() {
    var g = $("grid"); if (!g) return;
    var list = S.page ? sortList(productsIn(S.page).filter(matchQuery)) : filtered();
    g.innerHTML = grid(list);
    if ($("count")) $("count").textContent = list.length + (list.length === 1 ? " product" : " products");
    if ($("chips")) $("chips").innerHTML = chipsHtml();
  }
  function matchQuery(p) { var q = S.query.trim().toLowerCase(); return !q || (p.name + " " + p.description).toLowerCase().indexOf(q) >= 0; }

  function slideLink(sl) {
    var l = String(sl.link || "");
    var m = /^occasion:(.+)$/.exec(l);
    if (m) {
      var c = S.collections.find(function (x) { return x.name.toLowerCase() === m[1].trim().toLowerCase() || String(x.id) === m[1].trim(); });
      return c ? "#/c/" + c.id + "/" + slug(c.name) : "#all";
    }
    return l || "#all";
  }

  // ---------- Pages ----------
  function renderHome() {
    S.page = null;
    var st = S.settings, slides = [];
    try { slides = JSON.parse(st.hero_slides || "[]"); } catch (e) {}
    if (!slides.length) slides = [{ title: st.tagline || st.shop_name, subtitle: "", button: "Shop now", link: "#all", theme: "magenta", emoji: "🎉" }];
    var html = '<section class="hero"><div class="wrap"><div class="slider" id="slider"><div class="slides" id="slides">' +
      slides.map(function (sl, i) {
        var has = !!sl.image_id;
        return '<div class="slide theme-' + esc(sl.theme || "magenta") + (has ? " has-img" : "") + '">' +
          (has ? '<img class="bg-img" src="' + img(sl.image_id) + '" alt="">' : '<div class="confetti"></div><i class="balloon b1"></i><i class="balloon b2"></i><i class="balloon b3"></i>' + (sl.emoji ? '<div class="art">' + esc(sl.emoji) + '</div>' : "")) +
          '<div class="inner"><span class="kicker">✨ ' + esc(st.shop_name) + '</span>' +
          (i === 0 ? "<h1>" : "<h2>") + esc(sl.title) + (i === 0 ? "</h1>" : "</h2>") +
          (sl.subtitle ? '<p>' + esc(sl.subtitle) + '</p>' : "") +
          (sl.button ? '<a class="btn gold" href="' + esc(slideLink(sl)) + '">' + esc(sl.button) + ' →</a>' : "") +
          '</div></div>';
      }).join("") + '</div>' +
      (slides.length > 1 ? '<div class="dots" id="dots">' + slides.map(function (_, i) { return '<button aria-label="Slide ' + (i + 1) + '"' + (i ? "" : ' class="on"') + '></button>'; }).join("") + '</div>' : "") +
      '</div>' +
      '<div class="bubbles">' + S.collections.map(function (c) {
        return '<a class="bubble" href="#/c/' + c.id + '/' + slug(c.name) + '"><div class="ring"><span>' + (c.image_id ? '<img src="' + img(c.image_id) + '" alt="">' : esc(c.emoji)) + '</span></div>' + esc(c.name) + '</a>';
      }).join("") + '</div></div></section>';

    if (S.collections.length) {
      html += '<section id="occasions"><div class="wrap"><div class="head"><div><span class="eyebrow">Shop by occasion</span><h2>Every celebration, covered</h2></div></div>' +
        '<div class="occasions">' + S.collections.map(function (c, i) {
          var n = productsIn(c).length;
          return '<a class="occasion" href="#/c/' + c.id + '/' + slug(c.name) + '" style="background:' + GRADS[i % GRADS.length] + '">' +
            (c.image_id ? '<img loading="lazy" src="' + img(c.image_id) + '" alt="">' : '<span class="emo">' + esc(c.emoji) + '</span>') +
            '<span class="label"><strong>' + esc(c.name) + '</strong><small>' + n + (n === 1 ? " product" : " products") + ' →</small></span></a>';
        }).join("") + '</div></div></section>';
    }

    var featured = S.products.filter(function (p) { return p.featured; });
    if (featured.length) html += rowSection("🔥 Bestsellers", "Customer favourites", featured);
    var fresh = S.products.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 12);
    if (fresh.length > 4) html += rowSection("🆕 New arrivals", "Fresh stock, just in", fresh);

    var why = [];
    try { why = JSON.parse(st.why_us || "[]"); } catch (e) {}
    if (why.length) {
      html += '<section><div class="wrap"><div class="head"><div><span class="eyebrow">Why ' + esc(st.shop_name) + '</span><h2>Loved for a reason</h2></div></div><div class="why">' +
        why.map(function (w) { return '<div><div class="e">' + esc(w.emoji) + '</div><h3>' + esc(w.title) + '</h3><p>' + esc(w.text) + '</p></div>'; }).join("") + '</div></div></section>';
    }

    html += '<section id="all"><div class="wrap"><div class="head"><div><span class="eyebrow">Our collection</span><h2>All products</h2></div></div>' +
      toolbar(true) + '<div id="grid"></div></div></section>';

    if (st.about) {
      html += '<section id="about"><div class="wrap"><div class="about"><span class="eyebrow">About us</span><h2>' + esc(st.shop_name) + '</h2><p>' + esc(st.about) + '</p>' +
        (st.tagline ? '<div class="tag">' + esc(st.tagline) + '</div>' : "") + '</div></div></section>';
    }
    html += shopsSection() + ctaSection();
    $("app").innerHTML = html;
    refreshGrid();
    startSlider(slides.length);
  }

  function rowSection(title, sub, list) {
    return '<section><div class="wrap"><div class="head"><div><h2>' + title + '</h2><p>' + sub + '</p></div><a class="more" href="#all">See all →</a></div>' +
      '<div class="row-scroll">' + list.map(card).join("") + '</div></div></section>';
  }

  function shopsSection() {
    if (!S.shops.length) return "";
    return '<section id="shops"><div class="wrap"><div class="head"><div><span class="eyebrow">Visit us</span><h2>📍 Our ' + (S.shops.length > 1 ? "stores" : "store") + '</h2><p>Come and see the full range in person.</p></div></div><div class="shops">' +
      S.shops.map(function (sh) {
        var dir = /^https?:\/\//.test(sh.map_link) ? sh.map_link : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(sh.name + " " + sh.address);
        return '<article class="shop">' +
          (sh.address ? '<iframe loading="lazy" title="Map of ' + esc(sh.name) + '" src="https://maps.google.com/maps?q=' + encodeURIComponent(sh.name + ", " + sh.address) + '&z=15&output=embed"></iframe>'
            : '<a class="map" target="_blank" rel="noopener" href="' + esc(dir) + '"><span>📍</span> Open in Google Maps</a>') +
          '<div class="body"><h3>' + esc(sh.name) + '</h3>' + (sh.about ? '<p class="about-line">' + esc(sh.about) + '</p>' : "") +
          (sh.address ? '<p>📍 ' + esc(sh.address) + '</p>' : "") + (sh.timings ? '<p>🕘 ' + esc(sh.timings) + '</p>' : "") +
          '<div class="acts"><a class="btn primary" target="_blank" rel="noopener" href="' + esc(dir) + '">Get directions</a>' +
          (sh.phone ? '<a class="btn ghost" href="tel:' + esc(String(sh.phone).replace(/[^\d+]/g, "")) + '">📞 Call</a>' : "") + '</div></div></article>';
      }).join("") + '</div></div></section>';
  }
  function ctaSection() {
    var wa = waNum(S.settings.whatsapp);
    if (!wa) return "";
    return '<section><div class="wrap"><div class="cta theme-magenta"><div class="confetti"></div><h2>Planning a celebration? 🎊</h2>' +
      '<p>Tell us your theme and date — we will help you with everything you need.</p>' +
      '<a class="btn white" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent("Hi " + S.settings.shop_name + "! I need help with decorations for my celebration.") + '">💬 Chat on WhatsApp</a></div></div></section>';
  }

  function renderOccasion(c) {
    S.page = c;
    var i = S.collections.indexOf(c);
    $("app").innerHTML = '<div class="wrap"><a class="back" href="#/">← Home</a>' +
      '<div class="page-hero' + (c.image_id ? " has-img" : "") + '" style="background:' + GRADS[i % GRADS.length] + '">' +
        (c.image_id ? '<img src="' + img(c.image_id) + '" alt="">' : '<span class="emo">' + esc(c.emoji) + '</span>') +
        '<h1>' + esc(c.name) + '</h1>' + (c.description ? '<p>' + esc(c.description) + '</p>' : "") + '</div>' +
      '<div class="bubbles">' + S.collections.map(function (x) {
        return '<a class="bubble' + (x === c ? " on" : "") + '" href="#/c/' + x.id + '/' + slug(x.name) + '"><div class="ring"><span>' + (x.image_id ? '<img src="' + img(x.image_id) + '" alt="">' : esc(x.emoji)) + '</span></div>' + esc(x.name) + '</a>';
      }).join("") + '</div></div>' +
      '<section><div class="wrap">' + toolbar(false) + '<div id="grid"></div></div></section>' + shopsSection();
    refreshGrid();
  }

  var slideTimer;
  function startSlider(n) {
    clearInterval(slideTimer);
    var track = $("slides"); if (!track || n < 2) return;
    var at = 0, dots = $("dots").children;
    function go(i) { at = (i + n) % n; track.style.transform = "translateX(" + (-100 * at) + "%)"; for (var k = 0; k < dots.length; k++) dots[k].classList.toggle("on", k === at); }
    function auto() { clearInterval(slideTimer); slideTimer = setInterval(function () { go(at + 1); }, 5500); }
    Array.prototype.forEach.call(dots, function (d, i) { d.onclick = function () { go(i); auto(); }; });
    var x0 = null;
    track.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { go(at + (dx < 0 ? 1 : -1)); auto(); }
    });
    auto();
  }

  function renderFooter() {
    var st = S.settings, wa = waNum(st.whatsapp);
    var ig = st.instagram ? (/^https?:/.test(st.instagram) ? st.instagram : "https://instagram.com/" + st.instagram.replace(/^@/, "")) : "";
    var fb = st.facebook ? (/^https?:/.test(st.facebook) ? st.facebook : "https://facebook.com/" + st.facebook) : "";
    $("footer").innerHTML = '<div class="wrap"><div class="cols">' +
      '<div><h3>' + esc(st.shop_name) + '</h3><p>' + esc(st.tagline) + '</p></div>' +
      '<div><h4>Shop</h4>' + S.collections.slice(0, 8).map(function (c) { return '<p><a href="#/c/' + c.id + '/' + slug(c.name) + '">' + esc(c.emoji + " " + c.name) + '</a></p>'; }).join("") + '</div>' +
      '<div><h4>Contact</h4>' +
        (st.phone ? '<p>📞 <a href="tel:' + esc(st.phone.replace(/[^\d+]/g, "")) + '">' + esc(st.phone) + '</a></p>' : "") +
        (wa ? '<p>💬 <a target="_blank" rel="noopener" href="https://wa.me/' + wa + '">WhatsApp us</a></p>' : "") +
        (st.order_email ? '<p>✉️ <a href="mailto:' + esc(st.order_email) + '">' + esc(st.order_email) + '</a></p>' : "") +
        (ig ? '<p>📸 <a target="_blank" rel="noopener" href="' + esc(ig) + '">Instagram</a></p>' : "") +
        (fb ? '<p>👍 <a target="_blank" rel="noopener" href="' + esc(fb) + '">Facebook</a></p>' : "") +
        (S.shops.length ? '<p>📍 <a href="#shops">Our stores</a></p>' : "") +
      '</div></div><div class="copy">© ' + new Date().getFullYear() + ' ' + esc(st.shop_name) + '. All rights reserved.</div></div>';
  }

  function route() {
    var h = location.hash || "#/", prev = S.prevHash || "";
    S.prevHash = h;
    var m = /^#\/c\/(\d+)/.exec(h), p = /^#\/p\/(\d+)/.exec(h);
    if (p && S.byId[+p[1]]) {
      if (!$("grid")) { renderHome(); S.rendered = "home"; }
      openProduct(+p[1]);
      return;
    }
    closeSheet(true);
    var anchor = /^#(all|shops|about|occasions)$/.exec(h);
    if (anchor) {
      if (!$(anchor[1])) { renderHome(); S.rendered = "home"; }
      var el = $(anchor[1]); if (el) el.scrollIntoView({ behavior: "smooth" });
      return;
    }
    var c = m && S.colById[+m[1]];
    var key = c ? "c" + c.id : "home";
    if (key === S.rendered && $("grid")) {
      if (!/^#\/p\//.test(prev)) window.scrollTo({ top: 0, behavior: "instant" }); // coming back from a product keeps the scroll position
      return;
    }
    S.rendered = key;
    if (c) renderOccasion(c); else renderHome();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // ---------- Sheets ----------
  var onClose = null;
  function openSheet(html, after) {
    $("sheet").innerHTML = html; $("sheet").scrollTop = 0;
    $("sheet").classList.remove("hidden"); $("overlay").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    if (after) after();
  }
  function closeSheet(silent) {
    if ($("sheet").classList.contains("hidden")) return;
    $("sheet").classList.add("hidden"); $("overlay").classList.add("hidden");
    document.body.style.overflow = "";
    if (/^#\/p\//.test(location.hash) && !silent) history.replaceState(null, "", S.page ? "#/c/" + S.page.id + "/" + slug(S.page.name) : "#/");
    var f = onClose; onClose = null; if (f) f();
  }
  var head = function (title) { return '<div class="sheet-head"><h2>' + title + '</h2><button class="x" data-close aria-label="Close">×</button></div>'; };

  var dq = 1;
  function openProduct(id) {
    var p = S.byId[id]; if (!p) return;
    dq = Math.max(1, cartQty(id) || 1);
    var off = discount(p);
    var share = location.origin + "/#/p/" + p.id;
    openSheet(head(esc(p.name)) +
      '<div class="gallery">' + (p.images.length ? p.images.map(function (im) { return '<img src="' + img(im) + '" alt="' + esc(p.name) + '">'; }).join("")
        : '<div class="ph-box" style="background:' + soft(p) + '"><span class="ph">' + esc(emojiFor(p)) + '</span></div>') + '</div>' +
      (p.images.length > 1 ? '<p class="small">Swipe for more photos →</p>' : "") +
      '<div class="detail-price">' + (p.price ? '<b>' + money(p.price) + '</b>' + (off ? '<s>' + money(p.mrp) + '</s><span class="save">Save ' + off + '%</span>' : "") : '<b style="font-size:22px">Price on request</b>') + '</div>' +
      (p.description ? '<p class="desc">' + esc(p.description) + '</p>' : "") +
      '<div class="pills">' + p.collections.map(function (cid) { var c = S.colById[cid]; return c ? '<a href="#/c/' + c.id + '/' + slug(c.name) + '">' + esc(c.emoji + " " + c.name) + '</a>' : ""; }).join("") +
      '<a target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(p.name + " – " + share) + '">↗ Share</a></div>' +
      (p.in_stock
        ? '<div class="detail-row"><div class="qty"><button data-dq="-1" aria-label="Less">−</button><span id="dq">' + dq + '</span><button data-dq="1" aria-label="More">+</button></div>' +
          '<button class="btn primary" data-addq="' + p.id + '">' + (cartQty(id) ? "Update cart" : "Add to cart") + '</button></div>'
        : '<button class="btn ghost block" disabled style="margin-top:14px">Out of stock</button>'));
  }

  function openCart() {
    if (!S.cart.length) {
      openSheet(head("Your cart") + '<div class="empty"><div style="font-size:54px">🛍️</div><p>Your cart is empty.</p><button class="btn primary" data-close>Start shopping</button></div>');
      return;
    }
    var t = totals();
    openSheet(head("Your cart") + S.cart.map(function (l) {
      var p = S.byId[l.id];
      return '<div class="line"><div class="thumb" style="background:' + soft(p) + '">' + (p.images[0] ? '<img src="' + img(p.images[0]) + '" alt="">' : esc(emojiFor(p))) + '</div>' +
        '<div><div class="name">' + esc(p.name) + '</div><div class="sub">' + (p.price ? money(p.price) + " × " + l.qty + " = <b>" + money(p.price * l.qty) + "</b>" : "Price on request × " + l.qty) + '</div>' +
        '<button class="rm" data-rm="' + p.id + '">Remove</button></div>' +
        '<div class="qty"><button data-dec="' + p.id + '">−</button><span>' + l.qty + '</span><button data-inc="' + p.id + '">+</button></div></div>';
    }).join("") +
      '<div class="total"><span>Total</span><span>' + money(t.total) + (t.ask ? ' <small class="muted">+ ' + t.ask + ' on request</small>' : "") + '</span></div>' +
      '<button class="btn primary block" data-checkout>Checkout →</button>' +
      '<p class="small" style="margin-top:10px">' + esc(S.settings.delivery_note || "") + '</p>');
  }

  function needLogin() { return !S.me && S.settings.login_mode !== "optional"; }

  function openLogin(opts) {
    opts = opts || {};
    var html = '<div class="login-hero"><div class="big">🎉</div><h2>' + esc(opts.title || "Welcome to " + S.settings.shop_name) + '</h2><p>' +
      esc(opts.text || "Log in with your mobile number and email to order and get festive offers first.") + '</p>' +
      '<div class="perks"><span>🎁 Exclusive offers</span><span>📦 Track orders</span><span>⚡ Faster checkout</span></div></div>' +
      '<form class="f" id="loginForm" novalidate>' +
        '<label>Your name<input name="name" autocomplete="name" required></label>' +
        '<label>Mobile number<div class="prefix"><span>+91</span><input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" required></div></label>' +
        '<label>Email<input name="email" type="email" autocomplete="email" inputmode="email" required></label>' +
        '<div class="err hidden" id="loginErr"></div>' +
        '<button class="btn primary block" type="submit">' + esc(opts.button || "Continue") + '</button>' +
        '<p class="small">We only use your details for your orders and offers from ' + esc(S.settings.shop_name) + '.</p>' +
      '</form>';
    if (opts.gate) {
      $("gate").innerHTML = '<div class="card-in">' + html + '</div>';
      $("gate").classList.remove("hidden");
    } else openSheet(head("") + html);
    loginThen = opts.then || null;
  }
  var loginThen = null;
  function submitLogin(form) {
    var err = $("loginErr");
    var body = { name: form.elements.name.value, phone: form.elements.phone.value, email: form.elements.email.value };
    var btn = form.querySelector("button[type=submit]"); btn.disabled = true;
    api("/api/login", { method: "POST", body: body }).then(function (r) {
      S.me = r.customer; updateAccount();
      $("gate").classList.add("hidden");
      toast("Welcome, " + S.me.name.split(" ")[0] + "! 🎉");
      var then = loginThen; loginThen = null;
      if (then) then(); else closeSheet();
    }).catch(function (e) { err.textContent = e.message; err.classList.remove("hidden"); btn.disabled = false; });
  }
  function updateAccount() { $("accountDot").classList.toggle("hidden", !S.me); }

  function openAccount() {
    if (!S.me) { openLogin(); return; }
    openSheet(head("Hi, " + esc(S.me.name.split(" ")[0]) + " 👋") +
      '<p class="muted" style="margin-top:-6px">' + esc(S.me.phone) + ' · ' + esc(S.me.email) + '</p><h3 style="margin:16px 0 10px">My orders</h3><div id="myOrders"><div class="spinner"></div></div>' +
      '<button class="btn ghost block" data-logout style="margin-top:12px">Log out</button>');
    api("/api/my-orders").then(function (r) {
      $("myOrders").innerHTML = r.orders.length ? r.orders.map(function (o) {
        return '<div class="order-card"><div class="top"><span>' + esc(o.code) + '</span><span class="status ' + esc(o.status) + '">' + esc(o.status) + '</span></div>' +
          '<div class="muted" style="font-size:14px">' + new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + ' · ' +
          o.items.length + (o.items.length === 1 ? " item" : " items") + ' · ' + money(o.total) + (o.on_request ? " + on request" : "") + '</div></div>';
      }).join("") : '<p class="muted">No orders yet. Time to party! 🎈</p>';
    }).catch(function () { $("myOrders").innerHTML = '<p class="muted">Could not load your orders.</p>'; });
  }

  // ---------- Checkout ----------
  function openCheckout() {
    if (!S.cart.length) return openCart();
    if (needLogin()) return openLogin({ title: "Almost there!", text: "Log in with your mobile number and email to place your order.", button: "Continue to checkout", then: openCheckout });
    var d = store(DRAFT_KEY) || {}, me = S.me || {};
    var recv = d.receive || "delivery";
    var t = totals();
    openSheet(head("Checkout") +
      '<div class="total" style="padding-top:0"><span>' + S.cart.length + (S.cart.length === 1 ? " product" : " products") + '</span><span>' + money(t.total) + (t.ask ? ' <small class="muted">+ ' + t.ask + ' on request</small>' : "") + '</span></div>' +
      '<form class="f" id="checkout" novalidate>' +
        '<div class="box"><h4>👤 Your details</h4>' +
          '<label>Name *<input name="name" autocomplete="name" value="' + esc(d.name || me.name) + '"></label>' +
          '<label>Mobile number *<div class="prefix"><span>+91</span><input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" value="' + esc(d.phone || me.phone) + '"></div></label>' +
          '<label>Email<input name="email" type="email" autocomplete="email" value="' + esc(d.email || me.email) + '"></label></div>' +
        (S.shops.length ? '<div class="box"><h4>🚚 How would you like to get it?</h4><div class="choices">' +
          [{ v: "delivery", t: "Ship to my address", s: "We deliver your order directly to you" }].concat(S.shops.map(function (sh) { return { v: "pickup:" + sh.id, t: "Pick up from " + sh.name, s: sh.about || sh.address }; })).map(function (o) {
            return '<label class="choice"><input type="radio" name="receive" value="' + o.v + '"' + (o.v === recv ? " checked" : "") + '><span>' + esc(o.t) + (o.s ? '<small>' + esc(o.s) + '</small>' : "") + '</span></label>';
          }).join("") + '</div></div>' : "") +
        '<div class="box' + (recv !== "delivery" ? " hidden" : "") + '" id="addrBox"><h4>📦 Shipping address</h4><p class="hint">We\'ll ship your order directly to this address.</p>' +
          '<label>House / flat no., building, street *<textarea name="line" rows="2" autocomplete="street-address">' + esc(d.line) + '</textarea></label>' +
          '<label>Area / landmark<input name="landmark" value="' + esc(d.landmark) + '" placeholder="e.g. near Ganesha temple"></label>' +
          '<div class="two"><label>City *<input name="city" autocomplete="address-level2" value="' + esc(d.city) + '"></label>' +
          '<label>PIN code *<input name="pincode" inputmode="numeric" maxlength="6" autocomplete="postal-code" value="' + esc(d.pincode) + '"></label></div>' +
          '<label>State<input name="state" autocomplete="address-level1" value="' + esc(d.state || "Karnataka") + '"></label></div>' +
        '<label>Needed by (date)<input name="needed_by" type="date" value="' + esc(d.needed_by) + '"></label>' +
        '<div class="box"><h4>📝 Special instructions</h4><p class="hint">Theme & colours, name / age for the banner, delivery time, gift wrapping — anything we should know.</p>' +
          '<textarea name="notes" rows="3" aria-label="Special instructions">' + esc(d.notes) + '</textarea></div>' +
        '<div class="err hidden" id="orderErr"></div>' +
        '<button class="btn primary block" type="submit" id="placeBtn">Place order 🎉</button>' +
        '<p class="small">' + esc(S.settings.delivery_note || "") + '</p>' +
      '</form>');
  }
  function formDraft(form) {
    var d = {};
    ["name", "phone", "email", "line", "landmark", "city", "pincode", "state", "needed_by", "notes"].forEach(function (k) { d[k] = form.elements[k] ? form.elements[k].value.trim() : ""; });
    var r = form.querySelector('input[name="receive"]:checked'); d.receive = r ? r.value : "delivery";
    return d;
  }
  function placeOrder(form) {
    var d = formDraft(form); store(DRAFT_KEY, d);
    var err = $("orderErr"), btn = $("placeBtn");
    btn.disabled = true; btn.textContent = "Placing your order…"; err.classList.add("hidden");
    api("/api/orders", { method: "POST", body: {
      name: d.name, phone: d.phone, email: d.email, receive: d.receive, needed_by: d.needed_by, notes: d.notes,
      address: { line: d.line, landmark: d.landmark, city: d.city, pincode: d.pincode, state: d.state },
      items: S.cart.map(function (l) { return { id: l.id, qty: l.qty }; })
    } }).then(function (r) {
      S.cart = []; saveCart(); refreshActs();
      store(DRAFT_KEY, { name: d.name, phone: d.phone, email: d.email, line: d.line, landmark: d.landmark, city: d.city, pincode: d.pincode, state: d.state, receive: d.receive });
      if (r.email) emailOwner(r);
      showSuccess(r);
    }).catch(function (e) {
      if (e.code === "login") { openLogin({ title: "Please log in", text: e.message, button: "Continue", then: openCheckout }); return; }
      err.textContent = e.message; err.classList.remove("hidden"); btn.disabled = false; btn.textContent = "Place order 🎉";
    });
  }
  // A copy of every order also goes to the owner's Gmail (free FormSubmit service).
  function emailOwner(r) {
    var b = new URLSearchParams();
    b.append("_subject", "New order " + r.order.code + " – " + r.order.totalText);
    b.append("_template", "box"); b.append("_captcha", "false");
    b.append("Order", r.text.replace(/\*/g, ""));
    fetch("https://formsubmit.co/ajax/" + encodeURIComponent(r.email), { method: "POST", headers: { Accept: "application/json" }, body: b }).catch(function () {});
  }
  function showSuccess(r) {
    var many = r.whatsapp.length > 1;
    openSheet(head("Order placed!") + '<div class="success"><div class="big">🎉</div>' +
      '<p><b>Order ' + esc(r.order.code) + '</b><br>Thank you! We have received your order' + (r.whatsapp.length ? " — " + (many ? "<b>please tap each WhatsApp button below</b> so our team can confirm it quickly." : "tap below to send it to us on WhatsApp for quick confirmation.") : ".") + '</p>' +
      '<div class="wa-list">' + r.whatsapp.map(function (t, i) {
        var n = t.num.slice(-10);
        return '<a class="btn wa block" data-wa target="_blank" rel="noopener" href="https://wa.me/' + t.num + '?text=' + encodeURIComponent(r.text) + '">' +
          (many ? (i + 1) + ". " : "") + "Send on WhatsApp · " + esc(t.label) + " (" + n.slice(0, 5) + " " + n.slice(5) + ")</a>";
      }).join("") + '</div>' +
      '<details style="margin-top:14px;text-align:left"><summary>Order details</summary><pre>' + esc(r.text.replace(/\*/g, "")) + '</pre></details>' +
      '<button class="btn ghost block" data-close style="margin-top:10px">Continue shopping</button></div>');
  }

  // ---------- Events ----------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-inc],[data-dec],[data-rm],[data-open],[data-close],[data-dq],[data-addq],[data-checkout],[data-logout],[data-filter],[data-wa]");
    if (!t) return;
    var d = t.dataset, inCart = !$("sheet").classList.contains("hidden") && $("sheet").querySelector(".line");
    if (d.inc) { var id = +d.inc, was = cartQty(id); setQty(id, was + 1); if (!was) toast("Added to cart 🛍️"); refreshActs(); if (inCart) openCart(); }
    else if (d.dec) { setQty(+d.dec, cartQty(+d.dec) - 1); refreshActs(); if (inCart) openCart(); }
    else if (d.rm) { setQty(+d.rm, 0); refreshActs(); openCart(); }
    else if (d.open) { history.pushState(null, "", "#/p/" + d.open); openProduct(+d.open); }
    else if (d.dq) { dq = Math.max(1, Math.min(999, dq + Number(d.dq))); $("dq").textContent = dq; }
    else if (d.addq) { setQty(+d.addq, dq); refreshActs(); closeSheet(); toast("Cart updated 🛍️"); }
    else if (d.checkout !== undefined) openCheckout();
    else if (d.logout !== undefined) { api("/api/logout", { method: "POST" }).then(function () { S.me = null; updateAccount(); closeSheet(); toast("Logged out"); if (S.settings.login_mode === "browse") openLogin({ gate: true }); }); }
    else if (d.filter) { S.filter = d.filter; refreshGrid(); }
    else if (d.wa !== undefined) { if (!t.classList.contains("sent")) { t.classList.add("sent"); t.textContent = "✓ " + t.textContent; } }
    else if (d.close !== undefined) closeSheet();
  });
  $("overlay").addEventListener("click", function () { closeSheet(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  $("cartBtn").addEventListener("click", openCart);
  $("accountBtn").addEventListener("click", openAccount);
  $("searchBtn").addEventListener("click", function () {
    if (S.page || !$("all")) { location.hash = "#all"; setTimeout(function () { if ($("q")) $("q").focus(); }, 350); }
    else { $("all").scrollIntoView({ behavior: "smooth" }); setTimeout(function () { $("q").focus({ preventScroll: true }); }, 400); }
  });
  document.addEventListener("input", function (e) {
    if (e.target.id === "q") { S.query = e.target.value; refreshGrid(); }
    if (e.target.form && e.target.form.id === "checkout") store(DRAFT_KEY, formDraft(e.target.form));
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "sort") { S.sort = e.target.value; refreshGrid(); }
    if (e.target.name === "receive") { $("addrBox").classList.toggle("hidden", e.target.value !== "delivery"); store(DRAFT_KEY, formDraft(e.target.form)); }
  });
  document.addEventListener("submit", function (e) {
    if (e.target.id === "loginForm") { e.preventDefault(); submitLogin(e.target); }
    if (e.target.id === "checkout") { e.preventDefault(); placeOrder(e.target); }
  });
  window.addEventListener("hashchange", route);

  // ---------- Start ----------
  Promise.all([api("/api/store"), api("/api/me").catch(function () { return { customer: null }; })]).then(function (res) {
    var data = res[0];
    S.settings = data.settings; S.collections = data.collections; S.products = data.products; S.shops = data.shops; S.me = res[1].customer;
    S.products.forEach(function (p) { S.byId[p.id] = p; });
    S.collections.forEach(function (c) { S.colById[c.id] = c; });
    S.cart = (store(CART_KEY) || []).filter(function (l) { return S.byId[l.id] && S.byId[l.id].in_stock && l.qty > 0; });

    var st = S.settings;
    document.title = st.shop_name + " – " + (st.tagline || "Party & festival decorations");
    $("shopName").textContent = st.shop_name;
    $("shopTag").textContent = st.tagline || "Party & festival decorations";
    $("logoBadge").innerHTML = st.logo_id ? '<img src="' + img(st.logo_id) + '" alt="">' :
      esc(st.shop_name.split(/\s+/).filter(function (w) { return /^[a-z]/i.test(w); }).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(""));
    if (st.announcement) { $("announceText").textContent = st.announcement + "     ✦     " + st.announcement; $("announce").classList.remove("hidden"); }
    var wa = waNum(st.whatsapp);
    if (wa) { $("fab").href = "https://wa.me/" + wa; $("fab").classList.remove("hidden"); }
    saveCart(); updateAccount(); renderFooter(); route();

    if (!S.me && st.login_mode === "browse") openLogin({ gate: true, text: "Log in with your mobile number and email to explore our full collection and offers." });
    else if (!S.me && st.welcome_popup === "on") {
      var seen = false; try { seen = sessionStorage.getItem("se-welcome"); sessionStorage.setItem("se-welcome", "1"); } catch (e) {}
      if (!seen) setTimeout(function () { if ($("sheet").classList.contains("hidden") && !S.me) openLogin(); }, 6000);
    }
  }).catch(function () {
    $("app").innerHTML = '<div class="loading"><div style="font-size:50px">😕</div><p><b>We couldn\'t load the shop right now.</b><br>Please check your internet and try again.</p><button class="btn primary" onclick="location.reload()">Try again</button></div>';
  });
})();
