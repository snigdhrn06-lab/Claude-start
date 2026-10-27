(function () {
  "use strict";

  var A = { settings: {}, collections: [], shops: [], products: [], orders: [], counts: {}, customers: [], selected: {} };
  var STATUSES = [["new", "New"], ["confirmed", "Confirmed"], ["ready", "Ready"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]];
  var THEMES = [["magenta", "Pink party"], ["night", "Halloween night"], ["forest", "Christmas green"], ["gold", "Festive gold"], ["sky", "Purple sky"], ["candy", "Baby pastel"]];
  var EMOJIS = "🎉 🎂 🎈 🎃 👻 🦇 🎄 🎅 ⛄ 🪔 🏹 🌸 🍼 🧸 🧚 👑 🦸 🎁 ✨ 🎊 🪅 🌙 ⭐ 💐 🕯️ 🎀 🏆 💰 🚚 💖".split(" ");
  var TAGS = ["Bestseller", "New", "Sale", "Limited stock", "Trending"];

  // ---------- Helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function img(id) { return "/img/" + id; }
  function waNum(v) { var d = String(v || "").replace(/\D/g, ""); if (d.length === 10) d = "91" + d; if (d.length === 11 && d[0] === "0") d = "91" + d.slice(1); return d; }
  function when(d) {
    d = new Date(d); var diff = (Date.now() - d) / 60000;
    if (diff < 1) return "just now";
    if (diff < 60) return Math.round(diff) + " min ago";
    if (diff < 1440 && d.getDate() === new Date().getDate()) return "today " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.add("hidden"); }, 2200); }
  function api(path, opts) {
    opts = opts || {};
    return fetch(path, { method: opts.method || "GET", credentials: "same-origin", headers: opts.body ? { "content-type": "application/json" } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401 && path.indexOf("/api/admin/login") < 0) { showLogin(); throw new Error("Please log in again."); }
          if (!r.ok) { var e = new Error(j.error || "Something went wrong"); e.code = j.error; throw e; }
          return j;
        });
      });
  }
  function fail(e) { toast("⚠️ " + e.message); }
  function siteLink() { return location.origin + "/"; }
  function fill(tpl, v) {
    return String(tpl || "").replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; });
  }

  // ---------- Photo upload (resized on the phone before upload) ----------
  function resize(file, max) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.84));
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Could not read that photo. Try a JPG or PNG.")); };
      im.src = url;
    });
  }
  function pickPhotos(multiple, max) {
    return new Promise(function (res) {
      var inp = $("filePick"); inp.value = ""; inp.multiple = !!multiple;
      inp.onchange = function () {
        var files = Array.prototype.slice.call(inp.files || []);
        if (!files.length) return res([]);
        toast("Uploading " + files.length + (files.length > 1 ? " photos…" : " photo…"));
        var ids = [];
        files.reduce(function (p, f) {
          return p.then(function () { return resize(f, max || 1400); }).then(function (data) { return api("/api/admin/images", { method: "POST", body: { data: data } }); })
            .then(function (r) { ids.push(r.id); }).catch(fail);
        }, Promise.resolve()).then(function () { if (ids.length) toast("✅ Photo added"); res(ids); });
      };
      inp.click();
    });
  }

  // ---------- Sheet ----------
  function openSheet(title, html) {
    $("sheet").innerHTML = '<div class="sheet-head"><h2>' + title + '</h2><button class="x" data-close aria-label="Close">×</button></div>' + html;
    $("sheet").classList.remove("hidden"); $("overlay").classList.remove("hidden"); $("sheet").scrollTop = 0;
    document.body.style.overflow = "hidden";
  }
  function closeSheet() { $("sheet").classList.add("hidden"); $("overlay").classList.add("hidden"); document.body.style.overflow = ""; }
  $("overlay").addEventListener("click", closeSheet);
  document.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closeSheet(); });

  // ---------- Form builder ----------
  // field: { k, label, type: text|textarea|number|select|toggle|image|images|occasions|emoji|tags|password, hint, options, placeholder }
  function fieldHtml(f, v) {
    var val = v == null ? "" : v, hint = f.hint ? '<span class="hint">' + f.hint + '</span>' : "";
    var id = "f_" + f.k;
    switch (f.type) {
      case "textarea": return '<label>' + f.label + '<textarea id="' + id + '" rows="' + (f.rows || 3) + '" placeholder="' + esc(f.placeholder || "") + '">' + esc(val) + '</textarea>' + hint + '</label>';
      case "select": return '<label>' + f.label + '<select id="' + id + '">' + f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") + '</select>' + hint + '</label>';
      case "toggle": return '<label class="toggle"><span>' + f.label + (f.hint ? '<small>' + f.hint + '</small>' : "") + '</span><span class="switch"><input type="checkbox" id="' + id + '"' + (val ? " checked" : "") + '><i></i></span></label>';
      case "image": return '<div class="lbl">' + f.label + '<div class="one-photo" id="' + id + '" data-val="' + esc(val) + '">' + onePhoto(val) + '</div>' + hint + '</div>';
      case "images": return '<div class="lbl">' + f.label + '<div class="photos" id="' + id + '" data-val="' + esc(JSON.stringify(val || [])) + '">' + photosHtml(val || []) + '</div>' + hint + '</div>';
      case "occasions": return '<div class="lbl">' + f.label + '<div class="pick" id="' + id + '">' + A.collections.map(function (c) {
          return '<button type="button" data-pick="' + c.id + '" class="' + ((val || []).indexOf(c.id) >= 0 ? "on" : "") + '">' + esc(c.emoji + " " + c.name) + '</button>'; }).join("") +
          (A.collections.length ? "" : '<span class="hint">Add occasions first (More → Occasions).</span>') + '</div>' + hint + '</div>';
      case "emoji": return '<label>' + f.label + '<input id="' + id + '" value="' + esc(val) + '" maxlength="8"></label><div class="emojis">' + EMOJIS.map(function (e) { return '<button type="button" data-emoji="' + id + '">' + e + '</button>'; }).join("") + '</div>';
      case "tags": return '<label>' + f.label + '<input id="' + id + '" value="' + esc(val) + '" maxlength="30" placeholder="e.g. Bestseller"></label><div class="pick">' + TAGS.map(function (t) { return '<button type="button" data-tag="' + id + '">' + t + '</button>'; }).join("") + '<button type="button" data-tag="' + id + '" data-clear>✕ No label</button></div>';
      default: return '<label>' + f.label + '<input id="' + id + '" type="' + (f.type || "text") + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || "") + '"' + (f.type === "number" ? ' inputmode="decimal" step="any" min="0"' : "") + '>' + hint + '</label>';
    }
  }
  function onePhoto(id) {
    return (id ? '<div class="photo"><img src="' + img(id) + '" alt=""></div>' : "") +
      '<div class="btn-row" style="flex:1"><button type="button" class="btn ghost sm" data-one-photo>' + (id ? "Change photo" : "📷 Add photo") + '</button>' +
      (id ? '<button type="button" class="btn danger sm" data-one-remove>Remove</button>' : "") + '</div>';
  }
  function photosHtml(ids) {
    return ids.map(function (id, i) {
      return '<div class="photo"><img src="' + img(id) + '" alt="">' + (i === 0 ? '<span class="main-tag">Main</span>' : "") +
        '<div class="ctl">' + (i > 0 ? '<button type="button" data-ph-left="' + i + '" aria-label="Make earlier">◀</button>' : "") + '<button type="button" data-ph-del="' + i + '" aria-label="Remove">✕</button></div></div>';
    }).join("") + (ids.length < 10 ? '<button type="button" class="add-photo" data-ph-add><div><span>📷</span>Add photos</div></button>' : "");
  }
  function formHtml(fields, values) { return fields.map(function (f) { return fieldHtml(f, values[f.k]); }).join(""); }
  function readForm(fields) {
    var out = {};
    fields.forEach(function (f) {
      var el = $("f_" + f.k); if (!el) return;
      if (f.type === "toggle") out[f.k] = el.checked;
      else if (f.type === "image") out[f.k] = el.dataset.val || "";
      else if (f.type === "images") out[f.k] = JSON.parse(el.dataset.val || "[]");
      else if (f.type === "occasions") out[f.k] = Array.prototype.map.call(el.querySelectorAll("button.on"), function (b) { return +b.dataset.pick; });
      else out[f.k] = el.value.trim();
    });
    return out;
  }
  // Interactive bits inside forms
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-pick],[data-emoji],[data-tag],[data-one-photo],[data-one-remove],[data-ph-add],[data-ph-del],[data-ph-left]");
    if (!t) return;
    var d = t.dataset;
    if (d.pick) t.classList.toggle("on");
    else if (d.emoji) $(d.emoji).value = t.textContent;
    else if (d.tag) $(d.tag).value = d.clear !== undefined ? "" : t.textContent;
    else if (d.onePhoto !== undefined || d.oneRemove !== undefined) {
      var box = t.closest(".one-photo");
      if (d.oneRemove !== undefined) { box.dataset.val = ""; box.innerHTML = onePhoto(""); return; }
      pickPhotos(false, 1600).then(function (ids) { if (ids[0]) { box.dataset.val = ids[0]; box.innerHTML = onePhoto(ids[0]); } });
    } else {
      var grid = t.closest(".photos"), ids = JSON.parse(grid.dataset.val || "[]");
      var redraw = function () { grid.dataset.val = JSON.stringify(ids); grid.innerHTML = photosHtml(ids); };
      if (d.phDel) { ids.splice(+d.phDel, 1); redraw(); }
      else if (d.phLeft) { var i = +d.phLeft; ids.splice(i - 1, 0, ids.splice(i, 1)[0]); redraw(); }
      else pickPhotos(true, 1400).then(function (n) { ids = ids.concat(n).slice(0, 10); redraw(); });
    }
  });

  // ---------- Routing ----------
  var VIEWS = {
    home: ["Dashboard", viewHome], orders: ["Orders", viewOrders], products: ["Products", viewProducts], customers: ["Customers", viewCustomers],
    more: ["More", viewMore], occasions: ["Occasions & pages", viewOccasions], shops: ["Our stores", viewShops], banners: ["Home page banners", viewBanners],
    settings: ["Shop details", viewSettings], why: ["Why choose us", viewWhy], templates: ["Message templates", viewTemplates],
    email: ["Email sending", viewEmailSetup], password: ["Change password", viewPassword]
  };
  var TAB_OF = { occasions: "more", shops: "more", banners: "more", settings: "more", why: "more", templates: "more", email: "more", password: "more" };
  function route() {
    var key = (location.hash || "#home").slice(1).split("/")[0];
    if (!VIEWS[key]) key = "home";
    var tab = TAB_OF[key] || key;
    $("title").textContent = VIEWS[key][0];
    $("backBtn").classList.toggle("hidden", !TAB_OF[key]);
    document.querySelectorAll(".tabs a").forEach(function (a) { a.classList.toggle("on", a.dataset.tab === tab); });
    closeSheet();
    $("view").innerHTML = '<div class="spinner"></div>';
    window.scrollTo(0, 0);
    VIEWS[key][1]();
  }
  $("backBtn").addEventListener("click", function () { location.hash = "#more"; });
  window.addEventListener("hashchange", route);

  function loadBase() {
    return Promise.all([api("/api/admin/settings"), api("/api/admin/collections"), api("/api/admin/shops")]).then(function (r) {
      A.settings = r[0].settings; A.collections = r[1].items; A.shops = r[2].items;
    });
  }

  // ---------- Dashboard ----------
  function viewHome() {
    api("/api/admin/dashboard").then(function (d) {
      setBadge(d.orders.new_orders);
      var link = siteLink();
      $("view").innerHTML =
        '<div class="hello"><h2>Namaste! 🙏</h2><p>Here is how ' + esc(A.settings.shop_name) + ' is doing.</p><div class="acts">' +
          '<a class="btn white sm" href="#products/new">+ Add product</a>' +
          '<a class="btn glass sm" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent("🎉 Shop party & festival decorations at " + A.settings.shop_name + ": " + link) + '">📤 Share website</a></div></div>' +
        (d.products.samples ? '<div class="notice">🧪 You have <b>' + d.products.samples + ' sample products</b> on your website. Remove them once you add your own.<br><button class="btn dark sm" id="rmSamples">Remove sample products</button></div>' : "") +
        '<div class="stats">' +
          '<a class="stat hot" href="#orders/new"><div class="n">' + d.orders.new_orders + '</div><div class="l">New orders</div><div class="s">' + d.orders.today + ' today</div></a>' +
          '<a class="stat" href="#orders"><div class="n">' + money(d.orders.month_sales) + '</div><div class="l">Sales this month</div><div class="s">' + d.orders.all_orders + (d.orders.all_orders === 1 ? ' order' : ' orders') + ' in total</div></a>' +
          '<a class="stat" href="#customers"><div class="n">' + d.customers.total + '</div><div class="l">Customers</div><div class="s">+' + d.customers.week + ' this week</div></a>' +
          '<a class="stat" href="#customers"><div class="n">' + d.customers.today + '</div><div class="l">Visited today</div><div class="s">logged-in visitors</div></a>' +
          '<a class="stat" href="#products"><div class="n">' + d.products.total + '</div><div class="l">Products</div><div class="s" style="color:' + (d.products.out_of_stock ? "var(--danger)" : "var(--ok)") + '">' + d.products.out_of_stock + ' out of stock</div></a>' +
        '</div>' +
        '<div class="sec-title"><h2>Latest orders</h2><a href="#orders">See all →</a></div>' +
        (d.recentOrders.length ? d.recentOrders.map(orderRow).join("") : '<div class="empty">No orders yet. Share your website to get started! 🚀</div>') +
        '<div class="sec-title"><h2>Recent visitors</h2><a href="#customers">See all →</a></div>' +
        (d.recentCustomers.length ? d.recentCustomers.map(function (c) {
          return '<div class="item"><div class="avatar">' + esc((c.name || "?")[0].toUpperCase()) + '</div><div class="main"><div class="t">' + esc(c.name) + '</div><div class="s">' + esc(c.phone) + ' · ' + when(c.last_login) + '</div></div>' +
            '<a class="icon" style="background:#dcfce7" target="_blank" rel="noopener" href="' + waLink(c.phone, fill(A.settings.tpl_welcome, vars(c))) + '" aria-label="WhatsApp">💬</a></div>';
        }).join("") : '<div class="empty">Customers appear here when they log in on your website.</div>');
      A.recentOrders = d.recentOrders;
      if ($("rmSamples")) $("rmSamples").onclick = function () {
        if (!confirm("Remove all sample products? Your own products stay.")) return;
        api("/api/admin/products/delete-samples", { method: "POST" }).then(function (r) { toast("Removed " + r.deleted + " sample products"); viewHome(); }).catch(fail);
      };
    }).catch(fail);
  }
  function setBadge(n) { $("newBadge").textContent = n; $("newBadge").classList.toggle("hidden", !n); }

  // ---------- Orders ----------
  var orderFilter = "", orderQuery = "";
  function orderRow(o) {
    return '<div class="order' + (o.status === "new" ? " is-new" : "") + '" data-order="' + o.id + '"><div class="r1"><span>' + esc(o.code) + ' · ' + esc(o.name) + '</span><span class="status ' + o.status + '">' + o.status + '</span></div>' +
      '<div class="r2">' + money(o.total) + (o.on_request ? " + on request" : "") + ' · ' + (o.receive === "pickup" ? "🏬 Pickup" : "📦 Delivery") + ' · ' + when(o.created_at) + '</div></div>';
  }
  function viewOrders() {
    var sub = (location.hash.split("/")[1] || "");
    if (sub && STATUSES.some(function (s) { return s[0] === sub; })) orderFilter = sub;
    loadOrders();
  }
  function loadOrders() {
    api("/api/admin/orders?status=" + encodeURIComponent(orderFilter) + "&q=" + encodeURIComponent(orderQuery)).then(function (r) {
      A.orders = r.orders; A.counts = r.counts; setBadge(r.counts.new || 0);
      var total = Object.keys(r.counts).reduce(function (a, k) { return a + r.counts[k]; }, 0);
      $("view").innerHTML = '<div class="toolbar"><input class="search" id="orderSearch" type="search" placeholder="Search by order no., name or phone" value="' + esc(orderQuery) + '">' +
        '<div class="chips"><button class="chip' + (!orderFilter ? " on" : "") + '" data-ofilter="">All <b>' + total + '</b></button>' +
        STATUSES.map(function (s) { return '<button class="chip' + (orderFilter === s[0] ? " on" : "") + '" data-ofilter="' + s[0] + '">' + s[1] + ' <b>' + (r.counts[s[0]] || 0) + '</b></button>'; }).join("") + '</div></div>' +
        (r.orders.length ? r.orders.map(orderRow).join("") : '<div class="empty">No orders here.</div>');
    }).catch(fail);
  }
  function findOrder(id) { return (A.orders || []).concat(A.recentOrders || []).find(function (o) { return o.id === id; }); }
  function orderVars(o) {
    var shop = A.shops.find(function (s) { return s.id === o.shop_id; });
    return vars({ name: o.name, phone: o.phone }, {
      order: o.code, total: money(o.total) + (o.on_request ? " + items on request" : ""), status: o.status,
      how: o.receive === "pickup" ? "pickup from " + (shop ? shop.name : "our store") : "delivery to your address"
    });
  }
  function openOrder(id) {
    var o = findOrder(id);
    if (!o || !o.items) { api("/api/admin/orders").then(function (r) { A.orders = r.orders; var x = findOrder(id); if (x) openOrder(id); }).catch(fail); return; }
    var shop = A.shops.find(function (s) { return s.id === o.shop_id; });
    var a = o.address, addr = a ? [a.line, a.landmark && "Landmark: " + a.landmark, a.city + " - " + a.pincode, a.state].filter(Boolean).join(", ") : "";
    openSheet(esc(o.code),
      '<div class="card"><div class="lbl" style="margin-bottom:8px">Order status</div><div class="status-row">' +
        STATUSES.map(function (s) { return '<button data-ostatus="' + s[0] + '" class="' + (o.status === s[0] ? "on" : "") + '">' + s[1] + '</button>'; }).join("") + '</div>' +
        '<p class="hint" style="color:var(--muted);font-size:13px;margin:8px 0 0">Placed ' + when(o.created_at) + '</p></div>' +
      '<div class="card"><h3>👤 ' + esc(o.name) + '</h3><p style="margin:0 0 10px;color:var(--muted)">' + esc(o.phone) + (o.email ? " · " + esc(o.email) : "") + '</p>' +
        '<div class="btn-row"><a class="btn wa sm" href="#" data-msg-order="' + o.id + '">💬 WhatsApp</a>' + (o.email ? '<a class="btn ghost sm" href="#" data-mail-order="' + o.id + '">✉️ Email</a>' : "") +
        '<a class="btn ghost sm" href="tel:+91' + esc(o.phone) + '">📞 Call</a></div></div>' +
      '<div class="card"><h3>' + (o.receive === "pickup" ? "🏬 Pickup" : "📦 Ship to") + '</h3>' +
        (o.receive === "pickup" ? '<p style="margin:0">' + esc(shop ? shop.name : o.shop_name || "Store") + '</p>' :
          '<p style="margin:0 0 10px">' + esc(addr) + '</p><div class="btn-row"><button class="btn ghost sm" data-copy="' + esc(o.name + "\n" + o.phone + "\n" + addr) + '">📋 Copy address</button>' +
          '<a class="btn ghost sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr) + '">🗺️ Open map</a></div>') +
        (o.needed_by ? '<p style="margin:10px 0 0"><b>Needed by:</b> ' + esc(new Date(o.needed_by).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })) + '</p>' : "") + '</div>' +
      '<div class="card"><h3>🛍️ Items</h3><table class="lines">' + o.items.map(function (i) {
        return '<tr><td>' + esc(i.name) + ' × ' + i.qty + '</td><td>' + (i.price ? money(i.price * i.qty) : "on request") + '</td></tr>'; }).join("") +
        '<tr class="tot"><td>Total</td><td>' + money(o.total) + (o.on_request ? " + " + o.on_request + " on request" : "") + '</td></tr></table></div>' +
      (o.notes ? '<div class="card"><h3>📝 Special instructions</h3><p style="margin:0;white-space:pre-line">' + esc(o.notes) + '</p></div>' : "") +
      '<div class="card f"><label>Private note (only you see this)<textarea id="adminNote" rows="2">' + esc(o.admin_note) + '</textarea></label><button class="btn ghost sm" data-save-note="' + o.id + '">Save note</button></div>' +
      '<button class="btn danger block" data-del-order="' + o.id + '">Delete order</button>');
    A.openOrder = o;
  }
  function setOrderStatus(o, status) {
    api("/api/admin/orders/" + o.id, { method: "PATCH", body: { status: status } }).then(function (r) {
      Object.assign(o, r.order);
      toast("Marked as " + status);
      var tpl = { confirmed: "tpl_confirmed", ready: "tpl_ready", delivered: "tpl_delivered" }[status];
      if (tpl) messageSheet({ name: o.name, phone: o.phone, email: o.email }, orderVars(o), tpl, "Let " + esc(o.name.split(" ")[0]) + " know");
      else openOrder(o.id);
      if (location.hash.indexOf("#orders") === 0) loadOrders();
    }).catch(fail);
  }

  // ---------- Messages to customers ----------
  function vars(c, extra) { return Object.assign({ name: (c.name || "").split(" ")[0] || "there", shop: A.settings.shop_name, link: siteLink() }, extra || {}); }
  function waLink(phone, text) { return "https://wa.me/" + waNum(phone) + "?text=" + encodeURIComponent(text); }
  var TPL_NAMES = [["tpl_welcome", "👋 Welcome / thank you"], ["tpl_offer", "🎊 Offers & new arrivals"], ["tpl_confirmed", "✅ Order confirmed"], ["tpl_ready", "🎉 Order ready"], ["tpl_delivered", "🙏 Order delivered"], ["custom", "✏️ Write my own"]];
  function messageSheet(c, v, tplKey, title) {
    tplKey = tplKey || "tpl_welcome";
    var text = tplKey === "custom" ? "" : fill(A.settings[tplKey], v);
    openSheet(title || "Message " + esc(c.name.split(" ")[0]),
      '<div class="tpls">' + TPL_NAMES.map(function (t) { return '<button data-tpl="' + t[0] + '" class="' + (t[0] === tplKey ? "on" : "") + '">' + t[1] + '</button>'; }).join("") + '</div>' +
      '<div class="f"><label>Message<textarea id="msgText" rows="6">' + esc(text) + '</textarea></label>' +
      '<a class="btn wa block" id="msgWa" target="_blank" rel="noopener" href="' + waLink(c.phone, text) + '">💬 Send on WhatsApp to ' + esc(c.phone) + '</a>' +
      (c.email ? '<button class="btn ghost block" id="msgMail">✉️ Send by email to ' + esc(c.email) + '</button>' : "") +
      '<p class="hint" style="text-align:center;color:var(--muted);font-size:13px;margin:0">WhatsApp opens with the message ready — just tap send.</p></div>');
    A.msg = { c: c, v: v };
  }
  function sendEmail(list, subject, body) {
    // Sends directly when email sending is set up; otherwise opens your email app.
    return api("/api/admin/email", { method: "POST", body: { to: list, subject: subject, body: body } }).then(function (r) {
      toast(r.failed ? "Sent " + r.sent + ", failed " + r.failed : "✅ Email sent to " + r.sent);
    }).catch(function (e) {
      if (e.code !== "not_configured") return fail(e);
      var addrs = list.map(function (t) { return t.email; });
      var body1 = list.length === 1 ? body.replace(/\{name\}/g, list[0].name || "there") : body.replace(/\{name\}/g, "there");
      location.href = "mailto:" + (list.length === 1 ? encodeURIComponent(addrs[0]) : "") + "?" + (list.length > 1 ? "bcc=" + encodeURIComponent(addrs.join(",")) + "&" : "") +
        "subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body1);
    });
  }

  // ---------- Products ----------
  var prodQuery = "", prodCol = "";
  function viewProducts() {
    Promise.all([api("/api/admin/products"), loadBase()]).then(function (r) {
      A.products = r[0].products;
      renderProducts();
      if (location.hash === "#products/new") { history.replaceState(null, "", "#products"); editProduct(null); }
    }).catch(fail);
  }
  function renderProducts() {
    var q = prodQuery.toLowerCase();
    var list = A.products.filter(function (p) {
      return (!prodCol || p.collections.indexOf(+prodCol) >= 0) && (!q || p.name.toLowerCase().indexOf(q) >= 0);
    });
    var samples = A.products.filter(function (p) { return p.sample; }).length;
    $("view").innerHTML =
      (samples ? '<div class="notice">🧪 ' + samples + ' sample products are showing on your website.<br><button class="btn dark sm" id="rmSamples2">Remove sample products</button></div>' : "") +
      '<div class="toolbar"><input class="search" id="prodSearch" type="search" placeholder="Search ' + A.products.length + ' products" value="' + esc(prodQuery) + '">' +
      '<div class="chips"><button class="chip' + (!prodCol ? " on" : "") + '" data-pcol="">All</button>' + A.collections.map(function (c) {
        return '<button class="chip' + (String(prodCol) === String(c.id) ? " on" : "") + '" data-pcol="' + c.id + '">' + esc(c.emoji + " " + c.name) + '</button>'; }).join("") + '</div></div>' +
      '<div id="prodList">' + (list.length ? list.map(productRow).join("") : '<div class="empty">No products yet. Tap “+ Add product”.</div>') + '</div>' +
      '<button class="fab-add" data-new-product>+ Add product</button>';
    if ($("rmSamples2")) $("rmSamples2").onclick = function () {
      if (!confirm("Remove all " + samples + " sample products?")) return;
      api("/api/admin/products/delete-samples", { method: "POST" }).then(function () { toast("Sample products removed"); viewProducts(); }).catch(fail);
    };
  }
  function productRow(p) {
    var col = A.collections.find(function (c) { return c.id === p.collections[0]; });
    return '<div class="item' + (p.visible ? "" : " off") + '"><div class="thumb">' + (p.images[0] ? '<img src="' + img(p.images[0]) + '" alt="">' : esc(col ? col.emoji : "🎉")) + '</div>' +
      '<div class="main"><div class="t">' + esc(p.name) + '</div>' +
        '<div>' + (p.sample ? '<span class="tag grey">Sample</span>' : "") + (p.featured ? '<span class="tag">🔥 Bestseller</span>' : "") + (!p.visible ? '<span class="tag grey">Hidden</span>' : "") + (!p.in_stock ? '<span class="tag red">Out of stock</span>' : "") + '</div>' +
        '<button class="price-btn" data-qprice="' + p.id + '">' + (p.price ? money(p.price) : "Set price") + ' ✏️</button></div>' +
      '<div class="side"><label class="switch" title="In stock"><input type="checkbox" data-qstock="' + p.id + '"' + (p.in_stock ? " checked" : "") + '><i></i></label>' +
      '<button class="icon" data-edit-product="' + p.id + '" aria-label="Edit">✏️</button></div></div>';
  }
  var PRODUCT_FIELDS = [
    { k: "images", label: "Photos", type: "images", hint: "The first photo is the main one. Tap ◀ to move a photo earlier." },
    { k: "name", label: "Product name *", placeholder: "e.g. Kids Pumpkin Costume" },
    { k: "price", label: "Selling price (₹)", type: "number", hint: "Leave empty to show “Price on request”." },
    { k: "mrp", label: "Original price / MRP (₹) – optional", type: "number", hint: "If higher than the selling price, a “% OFF” badge appears." },
    { k: "collections", label: "Show on these occasion pages", type: "occasions" },
    { k: "description", label: "Description", type: "textarea", placeholder: "Size, colours, material, what's in the pack…" },
    { k: "tag", label: "Label on photo (optional)", type: "tags" },
    { k: "in_stock", label: "In stock", type: "toggle", hint: "Turn off to show “Out of stock”." },
    { k: "featured", label: "🔥 Show in Bestsellers", type: "toggle", hint: "Appears on the home page." },
    { k: "visible", label: "Show on website", type: "toggle", hint: "Turn off to hide without deleting." }
  ];
  function editProduct(p) {
    var v = p || { images: [], collections: prodCol ? [+prodCol] : [], in_stock: true, visible: true, featured: false };
    openSheet(p ? "Edit product" : "New product", '<form class="f" id="productForm" data-id="' + (p ? p.id : "") + '">' + formHtml(PRODUCT_FIELDS, v) +
      '<div class="err hidden" id="formErr"></div><button class="btn primary block" type="submit">💾 Save product</button>' +
      (p ? '<div class="btn-row"><button type="button" class="btn ghost" data-dup-product="' + p.id + '">Duplicate</button><button type="button" class="btn danger" data-del-product="' + p.id + '">Delete</button></div>' : "") + '</form>');
  }
  function saveProduct(form) {
    var v = readForm(PRODUCT_FIELDS), id = form.dataset.id;
    if (!v.name) { $("formErr").textContent = "Please enter the product name."; $("formErr").classList.remove("hidden"); return; }
    var btn = form.querySelector("button[type=submit]"); btn.disabled = true;
    api(id ? "/api/admin/products/" + id : "/api/admin/products", { method: id ? "PUT" : "POST", body: v }).then(function () {
      toast(id ? "✅ Product updated" : "✅ Product added"); closeSheet(); viewProducts();
    }).catch(function (e) { btn.disabled = false; fail(e); });
  }

  // ---------- Customers ----------
  var custQuery = "", selecting = false;
  function viewCustomers() { A.selected = {}; selecting = false; loadCustomers(); }
  function loadCustomers() {
    api("/api/admin/customers?q=" + encodeURIComponent(custQuery)).then(function (r) { A.customers = r.customers; renderCustomers(); }).catch(fail);
  }
  function renderCustomers() {
    var n = Object.keys(A.selected).length;
    $("view").innerHTML = '<div class="toolbar"><input class="search" id="custSearch" type="search" placeholder="Search name, phone or email" value="' + esc(custQuery) + '">' +
      '<div class="btn-row"><button class="btn ghost sm" id="selToggle">' + (selecting ? "Cancel selection" : "☑️ Select customers") + '</button><a class="btn ghost sm" href="/api/admin/customers.csv">⬇️ Download list (Excel)</a></div></div>' +
      '<p style="color:var(--muted);font-size:13.5px;margin:0 2px 10px">' + A.customers.length + (A.customers.length === 1 ? ' customer' : ' customers') + ' · tap 💬 to send a WhatsApp message in one tap</p>' +
      (A.customers.length ? A.customers.map(function (c) {
        return '<div class="cust"><div class="r1">' + (selecting ? '<input type="checkbox" data-sel="' + c.id + '"' + (A.selected[c.id] ? " checked" : "") + '>' : '<div class="avatar">' + esc((c.name || "?")[0].toUpperCase()) + '</div>') +
          '<div class="who"><b>' + esc(c.name || "—") + '</b><span>' + esc(c.phone) + (c.email ? " · " + esc(c.email) : "") + '</span></div></div>' +
          '<div class="meta">Joined ' + new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + ' · last visit ' + when(c.last_login) + ' · ' + c.login_count + (c.login_count === 1 ? ' visit · ' : ' visits · ') + c.orders + (c.orders === 1 ? ' order' : ' orders') + (c.spent ? " · " + money(c.spent) : "") + (c.notes ? '<br>📝 ' + esc(c.notes) : "") + '</div>' +
          '<div class="acts"><button class="btn wa" data-msg-cust="' + c.id + '">💬 WhatsApp</button>' + (c.email ? '<button class="btn ghost" data-mail-cust="' + c.id + '">✉️ Email</button>' : "") +
          '<a class="btn ghost" href="tel:+91' + esc(c.phone) + '">📞</a><button class="btn ghost" data-cust-more="' + c.id + '">⋯</button></div></div>';
      }).join("") : '<div class="empty">No customers yet. When people log in on your website, their name, phone and email appear here.</div>') +
      (selecting ? '<div class="selbar"><span>' + n + ' selected</span><button class="btn white sm" id="selAll">All</button><button class="btn white sm" id="selMail"' + (n ? "" : " disabled") + '>✉️ Email</button><button class="btn white sm" id="selCopy"' + (n ? "" : " disabled") + '>📋 Numbers</button></div>' : "");
  }
  function custById(id) { return A.customers.find(function (c) { return c.id === id; }); }
  function bulkEmailSheet(list) {
    openSheet("Email " + list.length + " customers", '<div class="f"><label>Subject<input id="bulkSubj" value="' + esc("Festive offers from " + A.settings.shop_name + " 🎉") + '"></label>' +
      '<label>Message<textarea id="bulkBody" rows="7">' + esc(fill(A.settings.tpl_offer, { name: "{name}", shop: A.settings.shop_name, link: siteLink() })) + '</textarea><span class="hint">{name} becomes each customer\'s name.</span></label>' +
      '<button class="btn primary block" id="bulkSend">✉️ Send email</button></div>');
    $("bulkSend").onclick = function () { sendEmail(list.map(function (c) { return { email: c.email, name: (c.name || "").split(" ")[0] }; }), $("bulkSubj").value, $("bulkBody").value); };
  }

  // ---------- More menu ----------
  function viewMore() {
    loadBase().then(function () {
      $("view").innerHTML = '<div class="menu">' + [
        ["occasions", "🎊", "Occasions & pages", "Halloween, Christmas, Birthday… add or remove pages"],
        ["banners", "🖼️", "Home page banners", "The big sliding pictures at the top"],
        ["settings", "🏪", "Shop details", "Name, tagline, logo, WhatsApp, announcement, login"],
        ["shops", "📍", "Our stores", "Addresses, map links and order numbers"],
        ["why", "🏆", "Why choose us", "The 4 reasons shown on the home page"],
        ["templates", "💬", "Message templates", "Ready-made WhatsApp & email messages"],
        ["email", "✉️", "Email sending (optional)", "Send emails directly from this portal"],
        ["password", "🔒", "Change password", "Your owner portal password"]
      ].map(function (m) { return '<a href="#' + m[0] + '"><span>' + m[1] + '</span><span>' + m[2] + '<small>' + m[3] + '</small></span></a>'; }).join("") +
      '<a href="/" target="_blank" rel="noopener"><span>🌐</span><span>Open my website<small>' + esc(siteLink()) + '</small></span></a>' +
      '<a href="#" id="logoutLink"><span>🚪</span><span>Log out<small>Log out of the owner portal</small></span></a></div>';
      $("logoutLink").onclick = function (e) { e.preventDefault(); api("/api/admin/logout", { method: "POST" }).then(showLogin); };
    }).catch(fail);
  }

  // ---------- Reusable list editor ----------
  function listEditor(cfg) {
    // cfg: { items, row(item) -> html, fields, title(item), addLabel, save(values, item|null) -> Promise, remove(item) -> Promise, reorder(items) -> Promise, help }
    $("view").innerHTML = (cfg.help ? '<div class="notice" style="background:#fff;border-style:solid;border-color:var(--line)">' + cfg.help + '</div>' : "") +
      (cfg.items.length ? cfg.items.map(function (it, i) {
        return '<div class="item' + (it.visible === false ? " off" : "") + '">' + cfg.row(it) +
          '<div class="side" style="grid-auto-flow:column"><button class="icon" data-le-up="' + i + '"' + (i ? "" : " disabled") + ' aria-label="Move up">↑</button><button class="icon" data-le-edit="' + i + '" aria-label="Edit">✏️</button></div></div>';
      }).join("") : '<div class="empty">Nothing here yet.</div>') +
      '<button class="fab-add" data-le-add>+ ' + cfg.addLabel + '</button>';
    A.le = cfg;
  }
  function leOpen(i) {
    var cfg = A.le, it = i == null ? null : cfg.items[i];
    openSheet(it ? "Edit" : cfg.addLabel, '<form class="f" id="leForm" data-i="' + (i == null ? "" : i) + '">' + formHtml(cfg.fields, it || cfg.defaults || {}) +
      '<button class="btn primary block" type="submit">💾 Save</button>' + (it ? '<button type="button" class="btn danger block" data-le-del="' + i + '">Delete</button>' : "") + '</form>');
  }

  // Occasions
  var OCC_FIELDS = [
    { k: "name", label: "Name *", placeholder: "e.g. Holi, Ganesh Chaturthi, Navratri" },
    { k: "emoji", label: "Icon", type: "emoji" },
    { k: "description", label: "Short description", type: "textarea", rows: 2 },
    { k: "image_id", label: "Cover photo (optional)", type: "image", hint: "Without a photo, a colourful card with the icon is shown." },
    { k: "visible", label: "Show on website", type: "toggle", hint: "Hide a festival page when the season is over." }
  ];
  function viewOccasions() {
    Promise.all([api("/api/admin/collections"), api("/api/admin/products")]).then(function (r) {
      A.collections = r[0].items; A.products = r[1].products;
      listEditor({
        items: A.collections, fields: OCC_FIELDS, addLabel: "Add occasion", defaults: { emoji: "🎉", visible: true },
        help: "Each occasion becomes its own page on your website. Use ↑ to change the order.",
        row: function (c) {
          var n = A.products.filter(function (p) { return p.collections.indexOf(c.id) >= 0; }).length;
          return '<div class="thumb">' + (c.image_id ? '<img src="' + img(c.image_id) + '" alt="">' : esc(c.emoji)) + '</div><div class="main"><div class="t">' + esc(c.name) + '</div><div class="s">' + n + ' products' + (c.visible ? "" : " · hidden") + '</div></div>';
        },
        save: function (v, it) { return api("/api/admin/collections" + (it ? "/" + it.id : ""), { method: it ? "PUT" : "POST", body: v }); },
        remove: function (it) { return api("/api/admin/collections/" + it.id, { method: "DELETE" }); },
        reorder: function (items) { return api("/api/admin/collections/reorder", { method: "POST", body: { ids: items.map(function (x) { return x.id; }) } }); },
        reload: viewOccasions
      });
    }).catch(fail);
  }
  // Stores
  var SHOP_FIELDS = [
    { k: "name", label: "Store name *" },
    { k: "about", label: "What this store is for", placeholder: "e.g. Birthday decorations – main store" },
    { k: "address", label: "Address (optional)", type: "textarea", rows: 2, hint: "With an address, a small map appears on the store card." },
    { k: "map_link", label: "Google Maps link", placeholder: "https://maps.app.goo.gl/…", hint: "Google Maps → your shop → Share → Copy link." },
    { k: "whatsapp", label: "WhatsApp number(s) for this store's orders", placeholder: "+91 98861 80607", hint: "Pickup orders for this store go here as well as your main number. Separate several with a comma." },
    { k: "phone", label: "Phone number (for the Call button)", type: "tel" },
    { k: "timings", label: "Opening hours", placeholder: "10 AM – 9 PM, all days" },
    { k: "visible", label: "Show on website", type: "toggle" }
  ];
  function viewShops() {
    api("/api/admin/shops").then(function (r) {
      A.shops = r.items;
      listEditor({
        items: A.shops, fields: SHOP_FIELDS, addLabel: "Add store", defaults: { visible: true },
        help: "Customers can pick up orders from these stores, and get directions with one tap.",
        row: function (s) { return '<div class="thumb">📍</div><div class="main"><div class="t">' + esc(s.name) + '</div><div class="s">' + esc(s.about || s.address || "") + (s.whatsapp ? " · 💬 " + esc(s.whatsapp) : "") + '</div></div>'; },
        save: function (v, it) { return api("/api/admin/shops" + (it ? "/" + it.id : ""), { method: it ? "PUT" : "POST", body: v }); },
        remove: function (it) { return api("/api/admin/shops/" + it.id, { method: "DELETE" }); },
        reorder: function (items) { return api("/api/admin/shops/reorder", { method: "POST", body: { ids: items.map(function (x) { return x.id; }) } }); },
        reload: viewShops
      });
    }).catch(fail);
  }
  // Settings arrays (banners, why us)
  function jsonListEditor(key, cfg) {
    loadBase().then(function () {
      var items = []; try { items = JSON.parse(A.settings[key] || "[]"); } catch (e) {}
      var persist = function (list) { return api("/api/admin/settings", { method: "PUT", body: (function () { var o = {}; o[key] = JSON.stringify(list); return o; })() }); };
      listEditor(Object.assign({
        items: items,
        save: function (v, it) { var list = items.slice(); if (it) list[items.indexOf(it)] = v; else list.push(v); return persist(list); },
        remove: function (it) { return persist(items.filter(function (x) { return x !== it; })); },
        reorder: persist
      }, cfg));
    }).catch(fail);
  }
  function linkOptions() {
    return [["#all", "All products"]].concat(A.collections.map(function (c) { return ["occasion:" + c.name, c.emoji + " " + c.name + " page"]; }), [["#shops", "Our stores"], ["#about", "About us"]]);
  }
  function viewBanners() {
    loadBase().then(function () {
      jsonListEditor("hero_slides", {
        addLabel: "Add banner", reload: viewBanners, defaults: { theme: "magenta", emoji: "🎉", button: "Shop now", link: "#all" },
        help: "These big banners slide automatically at the top of your home page. Add a photo, or leave it empty for a colourful design.",
        fields: [
          { k: "title", label: "Big heading *", placeholder: "e.g. Diwali Mega Sale!" },
          { k: "subtitle", label: "Small text", type: "textarea", rows: 2 },
          { k: "button", label: "Button text", placeholder: "Shop now" },
          { k: "link", label: "Button opens", type: "select", options: linkOptions() },
          { k: "image_id", label: "Background photo (optional)", type: "image" },
          { k: "theme", label: "Colours (when there is no photo)", type: "select", options: THEMES },
          { k: "emoji", label: "Big icon (when there is no photo)", type: "emoji" }
        ],
        row: function (s) { return '<div class="thumb">' + (s.image_id ? '<img src="' + img(s.image_id) + '" alt="">' : esc(s.emoji || "🎉")) + '</div><div class="main"><div class="t">' + esc(s.title) + '</div><div class="s">' + esc(s.subtitle || "") + '</div></div>'; }
      });
    });
  }
  function viewWhy() {
    jsonListEditor("why_us", {
      addLabel: "Add reason", reload: viewWhy, defaults: { emoji: "⭐" },
      help: "Shown in the “Loved for a reason” section of your home page. 4 reasons look best.",
      fields: [{ k: "emoji", label: "Icon", type: "emoji" }, { k: "title", label: "Title *" }, { k: "text", label: "Text", type: "textarea", rows: 2 }],
      row: function (w) { return '<div class="thumb">' + esc(w.emoji) + '</div><div class="main"><div class="t">' + esc(w.title) + '</div><div class="s">' + esc(w.text) + '</div></div>'; }
    });
  }

  // ---------- Settings pages ----------
  var SETTINGS_FIELDS = [
    { k: "shop_name", label: "Shop name" },
    { k: "tagline", label: "Tagline" },
    { k: "logo_id", label: "Logo", type: "image", hint: "Square logos look best." },
    { k: "announcement", label: "Scrolling announcement (top of the site)", placeholder: "e.g. 🪔 Diwali sale – up to 30% off!", hint: "Leave empty to hide it." },
    { k: "whatsapp", label: "Main WhatsApp number (gets every order)", type: "tel" },
    { k: "order_email", label: "Email for order copies", type: "email" },
    { k: "phone", label: "Phone number", type: "tel" },
    { k: "instagram", label: "Instagram (optional)", placeholder: "@yourshop" },
    { k: "facebook", label: "Facebook page (optional)", placeholder: "facebook.com/yourshop" },
    { k: "about", label: "About us", type: "textarea", rows: 6 },
    { k: "delivery_note", label: "Note shown at checkout", type: "textarea", rows: 2 },
    { k: "login_mode", label: "Customer login", type: "select", options: [["checkout", "Ask customers to log in before ordering (recommended)"], ["browse", "Customers must log in to see the website"], ["optional", "Login is optional"]] },
    { k: "welcome_popup", label: "Show a “log in for offers” pop-up to new visitors", type: "toggle" }
  ];
  function settingsPage(fields, intro) {
    loadBase().then(function () {
      var v = Object.assign({}, A.settings); v.welcome_popup = A.settings.welcome_popup === "on";
      $("view").innerHTML = (intro ? '<div class="card help">' + intro + '</div>' : "") + '<form class="card f" id="settingsForm">' + formHtml(fields, v) + '<button class="btn primary block" type="submit">💾 Save changes</button></form>';
      A.settingsFields = fields;
    }).catch(fail);
  }
  function viewSettings() { settingsPage(SETTINGS_FIELDS); }
  function viewTemplates() {
    settingsPage([
      { k: "tpl_welcome", label: "👋 Welcome / thank you", type: "textarea" },
      { k: "tpl_offer", label: "🎊 Offers & new arrivals", type: "textarea" },
      { k: "tpl_confirmed", label: "✅ Order confirmed", type: "textarea" },
      { k: "tpl_ready", label: "🎉 Order ready", type: "textarea" },
      { k: "tpl_delivered", label: "🙏 Order delivered", type: "textarea" }
    ], "These messages are filled in automatically when you tap 💬 for a customer. You can use: <code>{name}</code> customer's name, <code>{shop}</code> your shop name, <code>{link}</code> your website, and for orders <code>{order}</code>, <code>{total}</code>, <code>{how}</code>.");
  }
  function viewEmailSetup() {
    settingsPage([
      { k: "brevo_key", label: "Brevo API key", type: "password", placeholder: "xkeysib-…" },
      { k: "sender_email", label: "Sender email (verified in Brevo)", type: "email" }
    ], "<b>Optional.</b> Without this, tapping ✉️ opens your own email app with the message ready. To send emails straight from this portal (free, up to 300 a day):<ol><li>Create a free account at <b>brevo.com</b>.</li><li>Add and verify your Gmail as a sender (Senders & IP → Senders).</li><li>Go to SMTP & API → API Keys → Generate a new API key.</li><li>Paste the key and your Gmail below and save.</li></ol>");
  }
  function viewPassword() {
    $("view").innerHTML = '<form class="card f" id="pwForm"><label>New password<input type="password" id="pw1" autocomplete="new-password"></label><label>Type it again<input type="password" id="pw2" autocomplete="new-password"></label>' +
      '<div class="err hidden" id="pwErr"></div><button class="btn primary block" type="submit">Change password</button><p class="hint" style="color:var(--muted);font-size:13px;margin:0">Use at least 6 characters. Keep it safe — anyone with it can change your website.</p></form>';
  }

  // ---------- Events ----------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-order],[data-ostatus],[data-msg-order],[data-mail-order],[data-copy],[data-save-note],[data-del-order],[data-ofilter],[data-tpl],[data-new-product],[data-edit-product],[data-del-product],[data-dup-product],[data-qprice],[data-pcol],[data-msg-cust],[data-mail-cust],[data-cust-more],[data-del-cust],[data-save-cust],[data-le-add],[data-le-edit],[data-le-up],[data-le-del],#msgMail,#selToggle,#selAll,#selMail,#selCopy");
    if (!t) return;
    var d = t.dataset;
    if (t.matches("a[href='#']")) e.preventDefault();
    if (d.order) openOrder(+d.order);
    else if (d.ostatus) setOrderStatus(A.openOrder, d.ostatus);
    else if (d.msgOrder) { var o = findOrder(+d.msgOrder); messageSheet({ name: o.name, phone: o.phone, email: o.email }, orderVars(o), o.status === "new" ? "tpl_confirmed" : ({ confirmed: "tpl_confirmed", ready: "tpl_ready", delivered: "tpl_delivered" }[o.status] || "tpl_welcome")); }
    else if (d.mailOrder) { var o2 = findOrder(+d.mailOrder); messageSheet({ name: o2.name, phone: o2.phone, email: o2.email }, orderVars(o2), "tpl_confirmed"); }
    else if (d.copy) { (navigator.clipboard ? navigator.clipboard.writeText(d.copy) : Promise.reject()).then(function () { toast("📋 Copied"); }).catch(function () { prompt("Copy this:", d.copy); }); }
    else if (d.saveNote) api("/api/admin/orders/" + d.saveNote, { method: "PATCH", body: { admin_note: $("adminNote").value } }).then(function (r) { Object.assign(A.openOrder, r.order); toast("Note saved"); }).catch(fail);
    else if (d.delOrder) { if (confirm("Delete this order permanently?")) api("/api/admin/orders/" + d.delOrder, { method: "DELETE" }).then(function () { toast("Order deleted"); closeSheet(); route(); }).catch(fail); }
    else if (d.ofilter !== undefined) { orderFilter = d.ofilter; loadOrders(); }
    else if (d.tpl) {
      var m = A.msg, text = d.tpl === "custom" ? "" : fill(A.settings[d.tpl], m.v);
      document.querySelectorAll(".tpls button").forEach(function (b) { b.classList.toggle("on", b === t); });
      $("msgText").value = text; $("msgWa").href = waLink(m.c.phone, text); $("msgText").focus();
    }
    else if (t.id === "msgMail") { var mm = A.msg; sendEmail([{ email: mm.c.email, name: mm.v.name }], A.settings.shop_name, $("msgText").value); }
    else if (d.newProduct !== undefined) editProduct(null);
    else if (d.editProduct) editProduct(A.products.find(function (p) { return p.id === +d.editProduct; }));
    else if (d.delProduct) { if (confirm("Delete this product?")) api("/api/admin/products/" + d.delProduct, { method: "DELETE" }).then(function () { toast("Product deleted"); closeSheet(); viewProducts(); }).catch(fail); }
    else if (d.dupProduct) {
      var src = A.products.find(function (p) { return p.id === +d.dupProduct; });
      var copy = Object.assign({}, src, { name: src.name + " (copy)" });
      api("/api/admin/products", { method: "POST", body: copy }).then(function (r) { toast("Copy created"); A.products.unshift(r.product); editProduct(r.product); renderProducts(); }).catch(fail);
    }
    else if (d.qprice) {
      var p = A.products.find(function (x) { return x.id === +d.qprice; });
      var nv = prompt("New price for “" + p.name + "” (₹). Leave empty for “Price on request”.", p.price || "");
      if (nv === null) return;
      api("/api/admin/products/" + p.id, { method: "PATCH", body: { price: nv } }).then(function (r) { Object.assign(p, r.product); renderProducts(); toast("Price updated"); }).catch(fail);
    }
    else if (d.pcol !== undefined) { prodCol = d.pcol; renderProducts(); }
    else if (d.msgCust) { var c = custById(+d.msgCust); messageSheet(c, vars(c), "tpl_welcome"); }
    else if (d.mailCust) { var c2 = custById(+d.mailCust); messageSheet(c2, vars(c2), "tpl_offer"); }
    else if (d.custMore) {
      var c3 = custById(+d.custMore);
      openSheet(esc(c3.name || c3.phone), '<div class="f"><label>Private note<textarea id="custNote" rows="3" placeholder="e.g. Regular customer, likes pastel themes">' + esc(c3.notes) + '</textarea></label>' +
        '<button class="btn primary block" data-save-cust="' + c3.id + '">Save note</button><button class="btn danger block" data-del-cust="' + c3.id + '">Delete customer</button></div>');
    }
    else if (d.saveCust) api("/api/admin/customers/" + d.saveCust, { method: "PATCH", body: { notes: $("custNote").value } }).then(function () { toast("Saved"); closeSheet(); loadCustomers(); }).catch(fail);
    else if (d.delCust) { if (confirm("Delete this customer? Their orders stay.")) api("/api/admin/customers/" + d.delCust, { method: "DELETE" }).then(function () { toast("Deleted"); closeSheet(); loadCustomers(); }).catch(fail); }
    else if (t.id === "selToggle") { selecting = !selecting; A.selected = {}; renderCustomers(); }
    else if (t.id === "selAll") { A.customers.forEach(function (c) { A.selected[c.id] = true; }); renderCustomers(); }
    else if (t.id === "selMail") {
      var list = A.customers.filter(function (c) { return A.selected[c.id] && c.email; });
      if (!list.length) return toast("None of them have an email");
      bulkEmailSheet(list);
    }
    else if (t.id === "selCopy") {
      var nums = A.customers.filter(function (c) { return A.selected[c.id]; }).map(function (c) { return "+91" + c.phone; }).join("\n");
      (navigator.clipboard ? navigator.clipboard.writeText(nums) : Promise.reject()).then(function () { toast("📋 Numbers copied"); }).catch(function () { prompt("Copy these numbers:", nums); });
    }
    else if (d.leAdd !== undefined) leOpen(null);
    else if (d.leEdit) leOpen(+d.leEdit);
    else if (d.leUp) {
      var i = +d.leUp, items = A.le.items.slice(); items.splice(i - 1, 0, items.splice(i, 1)[0]);
      A.le.reorder(items).then(function () { A.le.reload(); }).catch(fail);
    }
    else if (d.leDel) { if (confirm("Delete this?")) A.le.remove(A.le.items[+d.leDel]).then(function () { toast("Deleted"); closeSheet(); A.le.reload(); }).catch(fail); }
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset.qstock) {
      var p = A.products.find(function (x) { return x.id === +t.dataset.qstock; });
      api("/api/admin/products/" + p.id, { method: "PATCH", body: { in_stock: t.checked } }).then(function (r) { Object.assign(p, r.product); renderProducts(); toast(t.checked ? "In stock" : "Marked out of stock"); }).catch(fail);
    }
    if (t.dataset.sel) { if (t.checked) A.selected[t.dataset.sel] = true; else delete A.selected[t.dataset.sel]; renderCustomers(); }
  });
  var timers = {};
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "msgText" && A.msg) $("msgWa").href = waLink(A.msg.c.phone, t.value);
    if (t.id === "prodSearch") { prodQuery = t.value; clearTimeout(timers.p); timers.p = setTimeout(function () { renderProducts(); var s = $("prodSearch"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 250); }
    if (t.id === "custSearch") { custQuery = t.value; clearTimeout(timers.c); timers.c = setTimeout(function () { loadCustomers(); }, 350); }
    if (t.id === "orderSearch") { orderQuery = t.value; clearTimeout(timers.o); timers.o = setTimeout(function () { loadOrders(); }, 350); }
  });
  // Keep focus in search boxes after their lists re-render.
  var refocus = function (id) { var s = $(id); if (s && $("sheet").classList.contains("hidden") && document.activeElement !== s && s.value) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } };
  new MutationObserver(function () { if (custQuery) refocus("custSearch"); if (orderQuery) refocus("orderSearch"); }).observe($("view"), { childList: true });

  document.addEventListener("submit", function (e) {
    var f = e.target; e.preventDefault();
    if (f.id === "loginForm") {
      api("/api/admin/login", { method: "POST", body: { password: f.elements.password.value } }).then(start)
        .catch(function (err) { $("loginErr").textContent = err.message; $("loginErr").classList.remove("hidden"); });
    } else if (f.id === "productForm") saveProduct(f);
    else if (f.id === "leForm") {
      var cfg = A.le, i = f.dataset.i === "" ? null : +f.dataset.i, v = readForm(cfg.fields);
      if (!(v.name || v.title)) return toast("Please fill in the name / heading");
      cfg.save(v, i == null ? null : cfg.items[i]).then(function () { toast("✅ Saved"); closeSheet(); cfg.reload(); }).catch(fail);
    } else if (f.id === "settingsForm") {
      var vals = readForm(A.settingsFields);
      if ("welcome_popup" in vals) vals.welcome_popup = vals.welcome_popup ? "on" : "off";
      api("/api/admin/settings", { method: "PUT", body: vals }).then(function () { Object.assign(A.settings, vals); toast("✅ Saved — your website is updated"); }).catch(fail);
    } else if (f.id === "pwForm") {
      if ($("pw1").value !== $("pw2").value) { $("pwErr").textContent = "The two passwords don't match."; $("pwErr").classList.remove("hidden"); return; }
      api("/api/admin/password", { method: "POST", body: { password: $("pw1").value } }).then(function () { toast("🔒 Password changed"); f.reset(); })
        .catch(function (err) { $("pwErr").textContent = err.message; $("pwErr").classList.remove("hidden"); });
    }
  });

  // ---------- Start ----------
  function showLogin() { $("shell").classList.add("hidden"); $("login").classList.remove("hidden"); closeSheet(); }
  function start() {
    $("login").classList.add("hidden"); $("shell").classList.remove("hidden");
    loadBase().then(route).catch(fail);
  }
  api("/api/admin/me").then(start).catch(showLogin);
})();
