// Database: tables, first-run sample data, and small query helpers.
const { Pool, Client } = require("pg");
const crypto = require("crypto");

// Neon gives two URLs: DATABASE_URL (pooled, "-pooler" host) for app traffic and
// DATABASE_URL_UNPOOLED (direct) for schema changes. Other Postgres hosts only need DATABASE_URL.
function connConfig(raw) {
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", ""].includes(url.hostname) || process.env.PGSSL === "off";
  // pg ignores the ssl option when sslmode is in the URL, so handle SSL here instead.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  const neon = /\.neon\.tech$/.test(url.hostname); // Neon has publicly trusted certificates, so verify them
  return { connectionString: url.toString(), ssl: local ? false : neon ? true : { rejectUnauthorized: false } };
}
if (!process.env.DATABASE_URL) {
  console.error("\n  DATABASE_URL is not set. Add your database connection string as an environment variable.\n");
  process.exit(1);
}

const pool = new Pool({ ...connConfig(process.env.DATABASE_URL), max: 5, idleTimeoutMillis: 30000 });
// Neon suspends idle computes and closes their connections; drop those clients instead of crashing.
pool.on("error", (err) => console.warn("Database connection closed:", err.message));
const q = (text, params) => pool.query(text, params);

async function applySchema() {
  const direct = process.env.DATABASE_URL_UNPOOLED;
  if (!direct || direct === process.env.DATABASE_URL) return q(SCHEMA);
  const client = new Client(connConfig(direct));
  await client.connect();
  try { await client.query(SCHEMA); } finally { await client.end(); }
}

const SCHEMA = `
create table if not exists settings (key text primary key, value text not null default '');
create table if not exists images (
  id serial primary key, mime text not null, data bytea not null, created_at timestamptz not null default now()
);
create table if not exists collections (
  id serial primary key, name text not null, emoji text not null default '🎉', description text not null default '',
  image_id int, visible boolean not null default true, sort int not null default 0
);
create table if not exists products (
  id serial primary key, name text not null, description text not null default '',
  price numeric(10,2), mrp numeric(10,2),
  collection_ids jsonb not null default '[]', image_ids jsonb not null default '[]',
  tag text not null default '', in_stock boolean not null default true, visible boolean not null default true,
  featured boolean not null default false, sample boolean not null default false, sort int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists shops (
  id serial primary key, name text not null, about text not null default '', address text not null default '',
  map_link text not null default '', whatsapp text not null default '', phone text not null default '',
  timings text not null default '', visible boolean not null default true, sort int not null default 0
);
create table if not exists customers (
  id serial primary key, name text not null default '', phone text unique not null, email text not null default '',
  created_at timestamptz not null default now(), last_login timestamptz not null default now(),
  login_count int not null default 1, notes text not null default ''
);
create table if not exists orders (
  id serial primary key, code text unique not null, customer_id int references customers(id) on delete set null,
  name text not null default '', phone text not null default '', email text not null default '',
  items jsonb not null default '[]', total numeric(10,2) not null default 0, on_request int not null default 0,
  receive text not null default 'delivery', shop_id int, address jsonb, needed_by text not null default '',
  notes text not null default '', status text not null default 'new', admin_note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on orders (created_at desc);
`;

// ---------- Defaults used on first run ----------
const DEFAULT_SETTINGS = {
  shop_name: "SAPTHAGIRI ENTERPRISES",
  tagline: "You bring the guests, we bring the party!",
  about:
    "SAPTHAGIRI ENTERPRISES is known and trusted for our quality and reliability in party and festival decorations. " +
    "We are the only brand offering such a huge variety of decoration products at such competitive prices, all under one roof. " +
    "Whatever the occasion, you will find everything you need with us — festive items for every festival, costumes for children, " +
    "Christmas trees, many varieties of Halloween products, birthday and party supplies, and complete event decoration services.",
  whatsapp: "+91 98808 55551",
  order_email: "rakeshbabyls@gmail.com",
  phone: "+91 98808 55551",
  instagram: "",
  facebook: "",
  announcement: "🎃 Halloween & 🎄 Christmas collections are here — huge variety at the best prices!",
  delivery_note: "We will confirm availability and delivery charges on WhatsApp.",
  logo_id: "",
  login_mode: "checkout", // optional | checkout | browse
  welcome_popup: "on",
  hero_slides: JSON.stringify([
    { title: "You bring the guests, we bring the party!", subtitle: "Decorations for birthdays, baby showers and every festival — all under one roof.", button: "Shop now", link: "#all", theme: "magenta", emoji: "🎉", image_id: "" },
    { title: "Spooktacular Halloween", subtitle: "Costumes, masks, props and party decor in many varieties.", button: "Shop Halloween", link: "occasion:Halloween", theme: "night", emoji: "🎃", image_id: "" },
    { title: "Christmas is coming!", subtitle: "Christmas trees in every size, ornaments, lights and more.", button: "Shop Christmas", link: "occasion:Christmas", theme: "forest", emoji: "🎄", image_id: "" },
  ]),
  why_us: JSON.stringify([
    { emoji: "🏆", title: "Trusted quality", text: "Known and trusted for quality and reliability." },
    { emoji: "🎁", title: "Huge variety", text: "Products for every festival and celebration, all under one roof." },
    { emoji: "💰", title: "Best prices", text: "Competitive prices that give you the best value." },
    { emoji: "🚚", title: "Delivery or pickup", text: "Order online — we ship to you, or pick up from our shop." },
  ]),
  // Admin-only settings
  tpl_welcome: "Hi {name}! 👋 Thank you for visiting {shop}. Explore our latest collections here: {link}",
  tpl_confirmed: "Hi {name}, your order {order} is confirmed ✅\nTotal: {total}\nWe will keep you updated. – {shop}",
  tpl_ready: "Hi {name}, good news! 🎉 Your order {order} is ready ({how}). – {shop}",
  tpl_delivered: "Hi {name}, your order {order} has been delivered. Thank you for shopping with {shop}! 🙏",
  tpl_offer: "Hi {name}! 🎊 New arrivals and festive offers are live at {shop}. Have a look: {link}",
  brevo_key: "",
  sender_email: "",
};
const PUBLIC_SETTINGS = [
  "shop_name", "tagline", "about", "whatsapp", "order_email", "phone", "instagram", "facebook", "announcement",
  "delivery_note", "logo_id", "login_mode", "welcome_popup", "hero_slides", "why_us",
];

const DEFAULT_COLLECTIONS = [
  ["Halloween", "🎃", "Costumes, masks, props and spooky party decor in many varieties."],
  ["Christmas", "🎄", "Christmas trees in every size, ornaments, lights and Santa specials."],
  ["Kids Costumes", "🧚", "Costumes for children — fancy dress, school events and parties."],
  ["Birthday", "🎂", "Balloons, banners, cake toppers and theme party kits."],
  ["Baby Shower", "🍼", "Balloon arches, backdrops and baby shower decor."],
  ["Diwali", "🪔", "Lights, lanterns and festive decor for the festival of lights."],
  ["Dussehra", "🏹", "Garlands and festive decor for Dussehra."],
  ["Festive Items", "✨", "Many more festive items for every festival, all year round."],
];

const DEFAULT_SHOPS = [
  ["Sapthagiri Party Shop", "Retail · Birthday · Halloween · Christmas", "https://maps.app.goo.gl/Q5BkWGuxpkbWK8W49", "+91 98861 80607"],
  ["Sapthagiri Party Shop – Main Outlet", "Our main outlet", "https://maps.app.goo.gl/3qZwUjtAYMwjRRey9", "+91 98802 02339"],
  ["Sapthagiri Regalia", "Birthday decorations – main store", "https://maps.app.goo.gl/3CZ5u6ptdbV4ymMu5", "+91 96208 19550"],
  ["Vishnu Enterprises", "Event decor", "https://maps.app.goo.gl/GiXUgLquWgZUhxhR6", "+91 96636 23051"],
];

// [name, occasion names, price, mrp, description, tag, featured]
// Marked as samples so the owner can remove them all with one tap once real products are added.
const SAMPLE_PRODUCTS = [
  ["Glowing Pumpkin Lantern", ["Halloween"], 399, 499, "Battery LED jack-o'-lantern, 20 cm. Perfect for parties and porches.", "Bestseller", true],
  ["Witch Hat & Broom Set", ["Halloween", "Kids Costumes"], 349, 449, "Fun witch hat with a mini broom for kids.", "", true],
  ["Skeleton Hanging Prop – 5 ft", ["Halloween"], 699, 899, "Poseable skeleton prop for spooky decor.", "New", false],
  ["Bat & Cobweb Decoration Kit", ["Halloween"], 249, 299, "30 paper bats plus stretchy cobweb.", "", false],
  ["Kids Pumpkin Costume", ["Halloween", "Kids Costumes"], 599, 799, "Soft pumpkin costume with hat. Sizes 2–8 years.", "", false],
  ["Christmas Tree – 5 ft", ["Christmas"], 1899, 2499, "Full pine tree with stand. Decorations sold separately.", "Bestseller", true],
  ["Christmas Tree – 3 ft", ["Christmas"], 899, 1199, "Compact tree, ideal for homes and offices.", "", false],
  ["Red & Gold Ornament Set (24)", ["Christmas"], 549, 699, "Shatterproof baubles in red and gold.", "", true],
  ["Santa Claus Costume – Kids", ["Christmas", "Kids Costumes"], 649, 849, "Santa suit with cap and belt. Sizes 2–10 years.", "", false],
  ["Warm White Fairy Lights – 10 m", ["Christmas", "Diwali"], 299, 399, "USB powered, 8 blink modes.", "", false],
  ["Fairy Princess Costume", ["Kids Costumes"], 749, 999, "Dress with wings and wand. Sizes 3–9 years.", "New", true],
  ["Superhero Cape & Mask Set", ["Kids Costumes", "Birthday"], 299, 399, "Satin cape with mask — great for theme parties.", "", false],
  ["Happy Birthday Balloon Kit", ["Birthday"], 599, 799, "Foil banner, 50 balloons, ribbons and pump.", "Bestseller", true],
  ["Custom Name Cake Topper", ["Birthday"], 249, 0, "Tell us the name in the special instructions.", "", false],
  ["Oh Baby Pastel Balloon Arch", ["Baby Shower"], 1299, 1599, "Ready-to-assemble arch kit with 100 pastel balloons.", "", true],
  ["Baby Shower Backdrop with Name Board", ["Baby Shower"], null, null, "Floral backdrop with name board. Price on request.", "", false],
  ["Paper Lantern Set (6)", ["Diwali", "Festive Items"], 299, 399, "Colourful paper lanterns for festive decor.", "", false],
  ["Marigold Garland Toran", ["Dussehra", "Diwali", "Festive Items"], 349, 449, "Artificial marigold and mango-leaf toran, 1 metre.", "", false],
];
// Items seen in the shop's own catalogue (no prices available yet).
const CATALOGUE_ITEMS = [
  "Chamki powder 10 grm pack", "Gift pull bows big 50mm", "Silk mala", "Ring tinsel single colour",
  "Marble paper", "Plastic triangle", "G.Band",
];

async function init() {
  await applySchema();
  // Settings: add any missing keys (also covers new keys added in later versions).
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await q("insert into settings (key, value) values ($1, $2) on conflict (key) do nothing", [k, v]);
  }
  const { rows } = await q("select count(*)::int as n from collections");
  if (rows[0].n === 0) await seed();
}

async function seed() {
  const ids = {};
  for (const [i, [name, emoji, description]] of DEFAULT_COLLECTIONS.entries()) {
    const r = await q("insert into collections (name, emoji, description, sort) values ($1,$2,$3,$4) returning id", [name, emoji, description, i]);
    ids[name] = r.rows[0].id;
  }
  for (const [i, [name, about, map, wa]] of DEFAULT_SHOPS.entries()) {
    await q("insert into shops (name, about, map_link, whatsapp, phone, sort) values ($1,$2,$3,$4,$4,$5)", [name, about, map, wa, i]);
  }
  let sort = 0;
  for (const [name, cols, price, mrp, description, tag, featured] of SAMPLE_PRODUCTS) {
    await q(
      "insert into products (name, collection_ids, price, mrp, description, tag, featured, sample, sort) values ($1,$2,$3,$4,$5,$6,$7,true,$8)",
      [name, JSON.stringify(cols.map((c) => ids[c])), price, mrp || null, description, tag, featured, sort++]
    );
  }
  for (const name of CATALOGUE_ITEMS) {
    await q("insert into products (name, collection_ids, description, sort) values ($1,$2,$3,$4)",
      [name, JSON.stringify([ids["Festive Items"]]), "Ask us for colours, sizes and today's price.", sort++]);
  }
}

// ---------- Settings ----------
async function getSettings() {
  const { rows } = await q("select key, value from settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
async function setSetting(key, value) {
  await q("insert into settings (key, value) values ($1,$2) on conflict (key) do update set value = excluded.value", [key, String(value)]);
}
async function publicSettings() {
  const s = await getSettings();
  return Object.fromEntries(PUBLIC_SETTINGS.map((k) => [k, s[k] ?? ""]));
}

// Secret used to sign login cookies; created once and kept in the database.
async function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const s = await getSettings();
  if (s.session_secret) return s.session_secret;
  const secret = crypto.randomBytes(32).toString("hex");
  await setSetting("session_secret", secret);
  return secret;
}

// ---------- Row shaping ----------
const num = (v) => (v === null || v === undefined ? null : Number(v));
function product(r) {
  return {
    id: r.id, name: r.name, description: r.description, price: num(r.price), mrp: num(r.mrp),
    collections: r.collection_ids, images: r.image_ids, tag: r.tag, in_stock: r.in_stock, visible: r.visible,
    featured: r.featured, sample: r.sample, sort: r.sort, created_at: r.created_at,
  };
}
function order(r) {
  return { ...r, total: num(r.total) };
}

// Delete uploaded images that nothing points to any more.
async function cleanupImages() {
  const s = await getSettings();
  const keep = new Set();
  const add = (v) => { const n = parseInt(v, 10); if (n) keep.add(n); };
  add(s.logo_id);
  try { JSON.parse(s.hero_slides || "[]").forEach((sl) => add(sl.image_id)); } catch (e) {}
  (await q("select image_id from collections")).rows.forEach((r) => add(r.image_id));
  (await q("select image_ids from products")).rows.forEach((r) => (r.image_ids || []).forEach(add));
  // Only touch images older than an hour, so a photo being added right now is never removed.
  await q("delete from images where created_at < now() - interval '1 hour' and not (id = any($1::int[]))", [[...keep]]);
}

module.exports = { pool, q, init, getSettings, setSetting, publicSettings, sessionSecret, product, order, cleanupImages, DEFAULT_SETTINGS };
