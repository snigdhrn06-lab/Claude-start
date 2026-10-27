// SAPTHAGIRI ENTERPRISES – web server: shop API, customer logins, owner admin API.
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const db = require("./db");

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "15mb" }));

let SECRET = "";

// ---------- Small helpers ----------
const ORDER_STATUSES = ["new", "confirmed", "ready", "delivered", "cancelled"];
const clean = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const bool = (v) => v === true || v === "true" || v === "on" || v === 1;
const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
function normPhone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}
function waNumber(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  if (d.length === 11 && d[0] === "0") d = "91" + d.slice(1);
  return d;
}
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const priceOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const asyncRoute = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

// ---------- Signed cookies ----------
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return body + "." + mac;
}
function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const good = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp && p.exp < Date.now() ? null : p;
  } catch (e) { return null; }
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((c) => {
    const i = c.indexOf("=");
    return i < 0 ? [c.trim(), ""] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }));
}
function setCookie(req, res, name, value, days) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.round(days * 86400)}`];
  if (req.secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}
const clearCookie = (req, res, name) => setCookie(req, res, name, "", 0);

// ---------- Admin password ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(pw, salt, 64).toString("hex");
}
function checkHash(pw, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const want = Buffer.from(hash, "hex");
  return want.length === test.length && crypto.timingSafeEqual(test, want);
}
function samePassword(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
const loginAttempts = new Map(); // ip -> { n, until }
function tooManyAttempts(ip) {
  const a = loginAttempts.get(ip);
  return a && a.n >= 8 && a.until > Date.now();
}
function noteFailedAttempt(ip) {
  const a = loginAttempts.get(ip);
  if (!a || a.until < Date.now()) loginAttempts.set(ip, { n: 1, until: Date.now() + 15 * 60 * 1000 });
  else a.n++;
}

// Simple per-visitor limit for public forms (stops spam and fake orders).
const hits = new Map();
function limit(max, minutes) {
  return (req, res, next) => {
    const key = req.path + "|" + req.ip, now = Date.now();
    const h = hits.get(key);
    if (!h || h.until < now) hits.set(key, { n: 1, until: now + minutes * 60000 });
    else if (++h.n > max) return res.status(429).json({ error: "Too many tries. Please wait a few minutes and try again." });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.until < now) hits.delete(k); }, 10 * 60000).unref();

// ---------- Middleware ----------
function customer(req) {
  const p = verify(cookies(req).sid);
  return p && p.t === "c" ? p.id : null;
}
function requireAdmin(req, res, next) {
  const p = verify(cookies(req).aid);
  if (!p || p.t !== "a") return res.status(401).json({ error: "Please log in again." });
  next();
}

// ---------- Public: store data ----------
app.get("/api/store", asyncRoute(async (req, res) => {
  const [settings, cols, prods, shops] = await Promise.all([
    db.publicSettings(),
    db.q("select id, name, emoji, description, image_id from collections where visible order by sort, id"),
    db.q("select * from products where visible order by sort, id"),
    db.q("select id, name, about, address, map_link, phone, timings from shops where visible order by sort, id"),
  ]);
  res.set("Cache-Control", "no-store");
  res.json({
    settings,
    collections: cols.rows,
    products: prods.rows.map(db.product).map(({ visible, sample, sort, ...p }) => p),
    shops: shops.rows,
  });
}));

app.get("/img/:id", asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(404).end();
  const { rows } = await db.q("select mime, data from images where id = $1", [id]);
  if (!rows[0]) return res.status(404).end();
  res.set("Content-Type", rows[0].mime);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(rows[0].data);
}));

// ---------- Customers: log in with name, phone and email ----------
async function upsertCustomer({ name, phone, email }, countLogin) {
  const { rows } = await db.q(
    `insert into customers (name, phone, email) values ($1, $2, $3)
     on conflict (phone) do update set
       name = coalesce(nullif(excluded.name, ''), customers.name),
       email = coalesce(nullif(excluded.email, ''), customers.email),
       last_login = now(),
       login_count = customers.login_count + $4
     returning id, name, phone, email`,
    [name, phone, email, countLogin ? 1 : 0]
  );
  return rows[0];
}

app.post("/api/login", limit(20, 15), asyncRoute(async (req, res) => {
  const name = clean(req.body.name, 80);
  const phone = normPhone(req.body.phone);
  const email = clean(req.body.email, 120).toLowerCase();
  if (!name) return res.status(400).json({ error: "Please enter your name." });
  if (phone.length !== 10) return res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
  if (!validEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  const c = await upsertCustomer({ name, phone, email }, true);
  setCookie(req, res, "sid", sign({ t: "c", id: c.id, exp: Date.now() + 180 * 86400e3 }), 180);
  res.json({ customer: c });
}));

app.get("/api/me", asyncRoute(async (req, res) => {
  const id = customer(req);
  if (!id) return res.json({ customer: null });
  const { rows } = await db.q("select id, name, phone, email from customers where id = $1", [id]);
  res.json({ customer: rows[0] || null });
}));

app.post("/api/logout", (req, res) => { clearCookie(req, res, "sid"); res.json({ ok: true }); });

app.get("/api/my-orders", asyncRoute(async (req, res) => {
  const id = customer(req);
  if (!id) return res.json({ orders: [] });
  const { rows } = await db.q(
    "select code, items, total, on_request, status, receive, created_at from orders where customer_id = $1 order by created_at desc limit 30", [id]);
  res.json({ orders: rows.map(db.order) });
}));

// ---------- Orders ----------
function orderCode() {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  return "SE" + ymd + "-" + crypto.randomInt(1000, 10000);
}

app.post("/api/orders", limit(15, 60), asyncRoute(async (req, res) => {
  const settings = await db.getSettings();
  let customerId = customer(req);
  if (!customerId && settings.login_mode !== "optional") return res.status(401).json({ error: "login", message: "Please log in to place your order." });

  const name = clean(req.body.name, 80);
  const phone = normPhone(req.body.phone);
  const email = clean(req.body.email, 120).toLowerCase();
  const errors = [];
  if (!name) errors.push("your name");
  if (phone.length !== 10) errors.push("a valid 10-digit mobile number");
  if (email && !validEmail(email)) errors.push("a valid email");

  // Prices always come from the database, never from the browser.
  const wanted = (Array.isArray(req.body.items) ? req.body.items : []).slice(0, 100)
    .map((i) => ({ id: parseInt(i.id, 10), qty: Math.max(1, Math.min(999, parseInt(i.qty, 10) || 1)) }))
    .filter((i) => i.id);
  const ids = wanted.map((i) => i.id);
  const found = ids.length ? (await db.q("select * from products where id = any($1::int[]) and visible and in_stock", [ids])).rows.map(db.product) : [];
  const byId = Object.fromEntries(found.map((p) => [p.id, p]));
  const items = wanted.filter((i) => byId[i.id]).map((i) => {
    const p = byId[i.id];
    return { id: p.id, name: p.name, price: p.price, qty: i.qty, line: p.price ? p.price * i.qty : null };
  });
  if (!items.length) errors.push("at least one available product");

  let receive = "delivery", shop = null, address = null;
  const m = /^pickup:(\d+)$/.exec(String(req.body.receive || ""));
  if (m) {
    shop = (await db.q("select * from shops where id = $1 and visible", [parseInt(m[1], 10)])).rows[0] || null;
    if (shop) receive = "pickup";
  }
  if (receive === "delivery") {
    const a = req.body.address || {};
    address = {
      line: clean(a.line, 300), landmark: clean(a.landmark, 150), city: clean(a.city, 80),
      pincode: String(a.pincode || "").replace(/\D/g, "").slice(0, 6), state: clean(a.state, 60),
    };
    if (!address.line) errors.push("your house / street address");
    if (!address.city) errors.push("your city");
    if (address.pincode.length !== 6) errors.push("a 6-digit PIN code");
  }
  if (errors.length) return res.status(400).json({ error: "Please add " + errors.join(", ") + "." });

  // Also remember the customer if they ordered without logging in.
  const c = await upsertCustomer({ name, phone, email }, false);
  customerId = customerId || c.id;

  const total = items.reduce((a, i) => a + (i.line || 0), 0);
  const onRequest = items.filter((i) => !i.price).length;
  const neededBy = clean(req.body.needed_by, 20);
  const notes = clean(req.body.notes, 1500);

  let saved;
  for (let attempt = 0; attempt < 5 && !saved; attempt++) {
    try {
      saved = (await db.q(
        `insert into orders (code, customer_id, name, phone, email, items, total, on_request, receive, shop_id, address, needed_by, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
        [orderCode(), customerId, name, phone, email, JSON.stringify(items), total, onRequest, receive, shop && shop.id,
          address && JSON.stringify(address), neededBy, notes]
      )).rows[0];
    } catch (e) { if (e.code !== "23505") throw e; } // code clash: try another
  }

  const how = shop ? "Pickup from " + shop.name : "Ship to customer's address";
  const addr = address ? [address.line, address.landmark && "Landmark: " + address.landmark, address.city + " - " + address.pincode, address.state].filter(Boolean).join(", ") : "";
  const totalText = money(total) + (onRequest ? ` + ${onRequest} item(s) price on request` : "");
  const text =
    `🎉 *New order ${saved.code}*\n\n` +
    items.map((i, n) => `${n + 1}. ${i.name} × ${i.qty}` + (i.price ? ` = ${money(i.line)}` : " (price on request)")).join("\n") +
    `\n\n*Total: ${totalText}*\n\nName: ${name}\nPhone: ${phone}` + (email ? `\nEmail: ${email}` : "") +
    (shop ? `\n🏬 ${how}` : "") + (addr ? `\n📦 Ship to: ${addr}` : "") +
    (neededBy ? `\nNeeded by: ${neededBy}` : "") + (notes ? `\n📝 Special instructions: ${notes}` : "");

  // WhatsApp: the main number always, plus the chosen shop's own numbers.
  const targets = [], seen = new Set();
  const addTarget = (n, label) => { const w = waNumber(n); if (w.length >= 12 && !seen.has(w)) { seen.add(w); targets.push({ label, num: w }); } };
  addTarget(settings.whatsapp, settings.shop_name);
  if (shop) String(shop.whatsapp).split(/[,/;&]+/).forEach((n) => addTarget(n, shop.name));

  res.json({ order: { code: saved.code, total, totalText, how, address: addr }, text, whatsapp: targets, email: settings.order_email });
}));

// ---------- Admin: auth ----------
app.post("/api/admin/login", asyncRoute(async (req, res) => {
  if (tooManyAttempts(req.ip)) return res.status(429).json({ error: "Too many tries. Please wait 15 minutes." });
  const pw = String(req.body.password || "");
  const s = await db.getSettings();
  let ok = false;
  if (s.admin_hash) ok = checkHash(pw, s.admin_hash);
  else if (process.env.ADMIN_PASSWORD) ok = samePassword(pw, process.env.ADMIN_PASSWORD);
  else return res.status(503).json({ error: "Admin password is not set up yet. Add ADMIN_PASSWORD in Render → Environment." });
  if (!ok) { noteFailedAttempt(req.ip); return res.status(401).json({ error: "Wrong password." }); }
  loginAttempts.delete(req.ip);
  setCookie(req, res, "aid", sign({ t: "a", exp: Date.now() + 30 * 86400e3 }), 30);
  res.json({ ok: true });
}));
app.post("/api/admin/logout", (req, res) => { clearCookie(req, res, "aid"); res.json({ ok: true }); });
app.get("/api/admin/me", requireAdmin, (req, res) => res.json({ ok: true }));

app.post("/api/admin/password", requireAdmin, asyncRoute(async (req, res) => {
  const pw = String(req.body.password || "");
  if (pw.length < 6) return res.status(400).json({ error: "Use at least 6 characters." });
  await db.setSetting("admin_hash", hashPassword(pw));
  res.json({ ok: true });
}));

// ---------- Admin: dashboard ----------
app.get("/api/admin/dashboard", requireAdmin, asyncRoute(async (req, res) => {
  const one = async (sql) => (await db.q(sql)).rows[0];
  const [orders, customers, products, recentOrders, recentCustomers] = await Promise.all([
    one(`select count(*) filter (where status = 'new')::int as new_orders,
                count(*) filter (where created_at > date_trunc('day', now()))::int as today,
                coalesce(sum(total) filter (where status <> 'cancelled' and created_at > date_trunc('month', now())), 0) as month_sales,
                count(*)::int as all_orders from orders`),
    one(`select count(*)::int as total, count(*) filter (where created_at > now() - interval '7 days')::int as week,
                count(*) filter (where last_login > date_trunc('day', now()))::int as today from customers`),
    one(`select count(*)::int as total, count(*) filter (where not in_stock)::int as out_of_stock,
                count(*) filter (where sample)::int as samples from products`),
    db.q("select id, code, name, total, on_request, status, receive, created_at from orders order by created_at desc limit 5"),
    db.q("select id, name, phone, email, created_at, last_login from customers order by last_login desc limit 5"),
  ]);
  res.json({
    orders: { ...orders, month_sales: Number(orders.month_sales) }, customers, products,
    recentOrders: recentOrders.rows.map(db.order), recentCustomers: recentCustomers.rows,
  });
}));

// ---------- Admin: orders ----------
app.get("/api/admin/orders", requireAdmin, asyncRoute(async (req, res) => {
  const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : null;
  const search = clean(req.query.q, 80);
  const params = [];
  let where = "true";
  if (status) { params.push(status); where += ` and o.status = $${params.length}`; }
  if (search) { params.push("%" + search + "%"); where += ` and (o.code ilike $${params.length} or o.name ilike $${params.length} or o.phone ilike $${params.length})`; }
  const { rows } = await db.q(
    `select o.*, s.name as shop_name from orders o left join shops s on s.id = o.shop_id where ${where} order by o.created_at desc limit 300`, params);
  const counts = (await db.q("select status, count(*)::int as n from orders group by status")).rows;
  res.json({ orders: rows.map(db.order), counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) });
}));
app.patch("/api/admin/orders/:id", requireAdmin, asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (req.body.status !== undefined && !ORDER_STATUSES.includes(req.body.status)) return res.status(400).json({ error: "Unknown status." });
  const { rows } = await db.q(
    `update orders set status = coalesce($2, status), admin_note = coalesce($3, admin_note), updated_at = now() where id = $1 returning *`,
    [id, req.body.status ?? null, req.body.admin_note === undefined ? null : clean(req.body.admin_note, 1000)]);
  if (!rows[0]) return res.status(404).json({ error: "Order not found." });
  res.json({ order: db.order(rows[0]) });
}));
app.delete("/api/admin/orders/:id", requireAdmin, asyncRoute(async (req, res) => {
  await db.q("delete from orders where id = $1", [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
}));

// ---------- Admin: customers ----------
const CUSTOMER_SQL = `select c.*, (select count(*)::int from orders o where o.customer_id = c.id) as orders,
  (select coalesce(sum(total),0) from orders o where o.customer_id = c.id and o.status <> 'cancelled') as spent from customers c`;
app.get("/api/admin/customers", requireAdmin, asyncRoute(async (req, res) => {
  const search = clean(req.query.q, 80);
  const { rows } = search
    ? await db.q(CUSTOMER_SQL + " where c.name ilike $1 or c.phone ilike $1 or c.email ilike $1 order by c.last_login desc limit 1000", ["%" + search + "%"])
    : await db.q(CUSTOMER_SQL + " order by c.last_login desc limit 1000");
  res.json({ customers: rows.map((r) => ({ ...r, spent: Number(r.spent) })) });
}));
app.get("/api/admin/customers.csv", requireAdmin, asyncRoute(async (req, res) => {
  const { rows } = await db.q(CUSTOMER_SQL + " order by c.created_at");
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheets treating text as a formula
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [["Name", "Phone", "Email", "Joined", "Last visit", "Visits", "Orders", "Spent"].join(",")];
  rows.forEach((r) => lines.push([r.name, r.phone, r.email, r.created_at.toISOString().slice(0, 10), r.last_login.toISOString().slice(0, 10), r.login_count, r.orders, Number(r.spent)].map(cell).join(",")));
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="customers.csv"');
  res.send("﻿" + lines.join("\n"));
}));
app.patch("/api/admin/customers/:id", requireAdmin, asyncRoute(async (req, res) => {
  await db.q("update customers set notes = $2 where id = $1", [parseInt(req.params.id, 10), clean(req.body.notes, 1000)]);
  res.json({ ok: true });
}));
app.delete("/api/admin/customers/:id", requireAdmin, asyncRoute(async (req, res) => {
  await db.q("delete from customers where id = $1", [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
}));

// ---------- Admin: images (already resized in the browser) ----------
app.post("/api/admin/images", requireAdmin, asyncRoute(async (req, res) => {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(String(req.body.data || ""));
  if (!m) return res.status(400).json({ error: "Please choose a photo (JPG or PNG)." });
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 6 * 1024 * 1024) return res.status(400).json({ error: "That photo is too large." });
  const { rows } = await db.q("insert into images (mime, data) values ($1, $2) returning id", [m[1], buf]);
  res.json({ id: rows[0].id });
}));

// ---------- Admin: products ----------
function productFields(b) {
  return {
    name: clean(b.name, 150), description: clean(b.description, 3000), price: priceOrNull(b.price), mrp: priceOrNull(b.mrp),
    collection_ids: JSON.stringify((Array.isArray(b.collections) ? b.collections : []).map((x) => parseInt(x, 10)).filter(Boolean)),
    image_ids: JSON.stringify((Array.isArray(b.images) ? b.images : []).map((x) => parseInt(x, 10)).filter(Boolean).slice(0, 10)),
    tag: clean(b.tag, 30), in_stock: b.in_stock === undefined ? true : bool(b.in_stock),
    visible: b.visible === undefined ? true : bool(b.visible), featured: bool(b.featured),
  };
}
app.get("/api/admin/products", requireAdmin, asyncRoute(async (req, res) => {
  const { rows } = await db.q("select * from products order by sort, id");
  res.json({ products: rows.map(db.product) });
}));
app.post("/api/admin/products", requireAdmin, asyncRoute(async (req, res) => {
  const f = productFields(req.body);
  if (!f.name) return res.status(400).json({ error: "Please enter the product name." });
  const { rows } = await db.q(
    `insert into products (name, description, price, mrp, collection_ids, image_ids, tag, in_stock, visible, featured, sort)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, (select coalesce(min(sort),0) - 1 from products)) returning *`,
    [f.name, f.description, f.price, f.mrp, f.collection_ids, f.image_ids, f.tag, f.in_stock, f.visible, f.featured]);
  res.json({ product: db.product(rows[0]) });
}));
app.put("/api/admin/products/:id", requireAdmin, asyncRoute(async (req, res) => {
  const f = productFields(req.body);
  if (!f.name) return res.status(400).json({ error: "Please enter the product name." });
  const { rows } = await db.q(
    `update products set name=$2, description=$3, price=$4, mrp=$5, collection_ids=$6, image_ids=$7, tag=$8, in_stock=$9,
       visible=$10, featured=$11, sample=false, updated_at=now() where id=$1 returning *`,
    [parseInt(req.params.id, 10), f.name, f.description, f.price, f.mrp, f.collection_ids, f.image_ids, f.tag, f.in_stock, f.visible, f.featured]);
  if (!rows[0]) return res.status(404).json({ error: "Product not found." });
  db.cleanupImages().catch(console.error);
  res.json({ product: db.product(rows[0]) });
}));
// Quick changes from the product list: price, stock, featured, visible.
app.patch("/api/admin/products/:id", requireAdmin, asyncRoute(async (req, res) => {
  const b = req.body, sets = [], params = [parseInt(req.params.id, 10)];
  const add = (col, v) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if ("price" in b) add("price", priceOrNull(b.price));
  if ("mrp" in b) add("mrp", priceOrNull(b.mrp));
  ["in_stock", "featured", "visible"].forEach((k) => { if (k in b) add(k, bool(b[k])); });
  if (!sets.length) return res.status(400).json({ error: "Nothing to change." });
  const { rows } = await db.q(`update products set ${sets.join(", ")}, updated_at = now() where id = $1 returning *`, params);
  if (!rows[0]) return res.status(404).json({ error: "Product not found." });
  res.json({ product: db.product(rows[0]) });
}));
app.delete("/api/admin/products/:id", requireAdmin, asyncRoute(async (req, res) => {
  await db.q("delete from products where id = $1", [parseInt(req.params.id, 10)]);
  db.cleanupImages().catch(console.error);
  res.json({ ok: true });
}));
app.post("/api/admin/products/delete-samples", requireAdmin, asyncRoute(async (req, res) => {
  const r = await db.q("delete from products where sample");
  res.json({ deleted: r.rowCount });
}));
app.post("/api/admin/products/reorder", requireAdmin, asyncRoute(async (req, res) => {
  const ids = (req.body.ids || []).map((x) => parseInt(x, 10)).filter(Boolean);
  for (const [i, id] of ids.entries()) await db.q("update products set sort = $2 where id = $1", [id, i]);
  res.json({ ok: true });
}));

// ---------- Admin: occasions (collections) and shops ----------
function listRoutes(table, fieldsFn) {
  const base = `/api/admin/${table}`;
  app.get(base, requireAdmin, asyncRoute(async (req, res) => {
    res.json({ items: (await db.q(`select * from ${table} order by sort, id`)).rows });
  }));
  app.post(base, requireAdmin, asyncRoute(async (req, res) => {
    const f = fieldsFn(req.body);
    if (!f.name) return res.status(400).json({ error: "Please enter a name." });
    const cols = Object.keys(f);
    const { rows } = await db.q(
      `insert into ${table} (${cols.join(",")}, sort) values (${cols.map((_, i) => "$" + (i + 1)).join(",")}, (select coalesce(max(sort),0)+1 from ${table})) returning *`,
      Object.values(f));
    res.json({ item: rows[0] });
  }));
  app.put(`${base}/:id`, requireAdmin, asyncRoute(async (req, res) => {
    const f = fieldsFn(req.body);
    if (!f.name) return res.status(400).json({ error: "Please enter a name." });
    const cols = Object.keys(f);
    const { rows } = await db.q(
      `update ${table} set ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")} where id = $1 returning *`,
      [parseInt(req.params.id, 10), ...Object.values(f)]);
    if (!rows[0]) return res.status(404).json({ error: "Not found." });
    db.cleanupImages().catch(console.error);
    res.json({ item: rows[0] });
  }));
  app.delete(`${base}/:id`, requireAdmin, asyncRoute(async (req, res) => {
    await db.q(`delete from ${table} where id = $1`, [parseInt(req.params.id, 10)]);
    db.cleanupImages().catch(console.error);
    res.json({ ok: true });
  }));
  app.post(`${base}/reorder`, requireAdmin, asyncRoute(async (req, res) => {
    const ids = (req.body.ids || []).map((x) => parseInt(x, 10)).filter(Boolean);
    for (const [i, id] of ids.entries()) await db.q(`update ${table} set sort = $2 where id = $1`, [id, i]);
    res.json({ ok: true });
  }));
}
listRoutes("collections", (b) => ({
  name: clean(b.name, 60), emoji: clean(b.emoji, 8) || "🎉", description: clean(b.description, 500),
  image_id: parseInt(b.image_id, 10) || null, visible: b.visible === undefined ? true : bool(b.visible),
}));
listRoutes("shops", (b) => ({
  name: clean(b.name, 100), about: clean(b.about, 200), address: clean(b.address, 300), map_link: clean(b.map_link, 500),
  whatsapp: clean(b.whatsapp, 120), phone: clean(b.phone, 40), timings: clean(b.timings, 120),
  visible: b.visible === undefined ? true : bool(b.visible),
}));

// ---------- Admin: settings ----------
const EDITABLE_SETTINGS = Object.keys(db.DEFAULT_SETTINGS);
app.get("/api/admin/settings", requireAdmin, asyncRoute(async (req, res) => {
  const s = await db.getSettings();
  res.json({ settings: Object.fromEntries(EDITABLE_SETTINGS.map((k) => [k, s[k] ?? ""])) });
}));
app.put("/api/admin/settings", requireAdmin, asyncRoute(async (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) {
    if (!EDITABLE_SETTINGS.includes(k)) continue;
    let value = typeof v === "string" ? v : JSON.stringify(v);
    if (k === "login_mode" && !["optional", "checkout", "browse"].includes(value)) continue;
    await db.setSetting(k, value.slice(0, 20000));
  }
  db.cleanupImages().catch(console.error);
  res.json({ ok: true });
}));

// ---------- Admin: send email directly (optional, uses a free Brevo account) ----------
app.post("/api/admin/email", requireAdmin, asyncRoute(async (req, res) => {
  const s = await db.getSettings();
  if (!s.brevo_key || !s.sender_email) return res.status(400).json({ error: "not_configured" });
  const subject = clean(req.body.subject, 200) || s.shop_name;
  const body = clean(req.body.body, 5000);
  const to = (Array.isArray(req.body.to) ? req.body.to : []).slice(0, 100)
    .map((t) => ({ email: clean(t.email, 120), name: clean(t.name, 80) })).filter((t) => validEmail(t.email));
  if (!to.length || !body) return res.status(400).json({ error: "Add at least one email address and a message." });
  let sent = 0, failed = 0;
  for (const t of to) {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": s.brevo_key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: s.sender_email, name: s.shop_name }, to: [t], subject,
        textContent: body.replace(/\{name\}/g, t.name || "there"),
      }),
    }).catch(() => null);
    if (r && r.ok) sent++; else failed++;
  }
  res.json({ sent, failed });
}));

// ---------- Pages ----------
const pub = path.join(__dirname, "public");
app.use(express.static(pub, { index: false, maxAge: "10m" }));
app.get("/admin", (req, res) => res.sendFile(path.join(pub, "admin.html")));
app.get("/healthz", (req, res) => res.send("ok"));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(pub, "index.html"));
});

const PORT = process.env.PORT || 3000;
db.init()
  .then(db.sessionSecret)
  .then((secret) => {
    SECRET = secret;
    app.listen(PORT, () => console.log(`SAPTHAGIRI ENTERPRISES is running on port ${PORT}`));
    setInterval(() => db.cleanupImages().catch(console.error), 6 * 3600e3);
  })
  .catch((err) => { console.error("Could not start:", err); process.exit(1); });
