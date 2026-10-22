# SAPTHAGIRI PARTY SHOP Website — Setup Guide (all from your phone)

Your website reads everything (products, prices, photos, festival pages and shop details) from **one Google Sheet**.
When you change the sheet in the **Google Sheets app**, the website updates on its own. You never touch code.

When a customer picks items, chooses how many, and taps **Place order**:
- 📧 the order is **emailed to your Gmail**, and
- 💬 the customer gets a button that sends the full order to **your WhatsApp**.

---

## Step 1 — Create your Google Sheet (one time, ~10 minutes)

1. Open the **Google Sheets** app → tap **+** → **New spreadsheet**. Name it e.g. *My Shop*.
2. Make **4 tabs** at the bottom, named exactly: **`Settings`**, **`Collections`**, **`Products`**, **`Shops`**
   (tap **+** at the bottom to add a tab, long-press a tab → *Rename*).
3. Type the headings in **row 1** of each tab, as shown below.

> Easier on a computer: upload `sheet-template/Decor-Shop-Sheet.xlsx` to Google Drive,
> open it, and choose **File → Save as Google Sheets**. All 4 tabs are ready with examples.

### Tab `Settings`

| Setting       | Value |
|---------------|-------|
| Shop Name     | SAPTHAGIRI PARTY SHOP |
| Tagline       | One line about your shop |
| WhatsApp      | **+91 98765 43210** (keep the +91 and the space) |
| Order Email   | yourshop@gmail.com |
| Phone         | +91 98765 43210 |
| Address       | Your shop address / city |
| Instagram     | @yourshop |
| Announcement  | Top banner text, e.g. *🪔 Diwali orders open!* (leave blank to hide) |
| Delivery Note | Shown under the order button |
| Logo          | Link to your logo photo (optional) |
| Hero Image    | Link to a big cover photo for the home page (optional) |

### Tab `Collections` — your festival / occasion pages

| Name      | Emoji | Image | Description | Show |
|-----------|-------|-------|-------------|------|
| Diwali    | 🪔 |  | Diyas, torans and lanterns | Yes |
| Halloween | 🎃 |  | Spooky decor | Yes |
| Christmas | 🎄 |  | Trees and ornaments | Yes |
| Dussehra  | 🏹 |  | Garlands and puja decor | Yes |
| Birthday  | 🎂 |  | Balloons and banners | Yes |

- **Add a new page** (e.g. *Holi*, *Ganesh Chaturthi*, *Navratri*, *Eid*): just add a new row.
- Pages appear in the **same order as the rows**. Move rows to reorder.
- Put **No** in *Show* to hide a page after the festival is over.

### Tab `Products`

| Name | Collection | Price | Image | Description | Available | Tag |
|------|------------|-------|-------|-------------|-----------|-----|
| Clay Diyas (Set of 12) | Diwali | 240 | *photo link* | Handpainted, reusable | Yes | Bestseller |
| Marigold Toran | Diwali, Dussehra | 349 | *photo link* | 1 metre | Yes | |
| Baby Shower Arch | Baby Shower | 1299 | *photo link* | 100 balloons | No | |

- **Collection**: which page(s) it shows on. Use a comma for more than one: `Diwali, Dussehra`.
  If you type a collection name that isn't in the Collections tab, a new page is **created automatically**.
- **Price**: numbers only. Leave it **blank** to show *"Price on request"*.
- **Available**: `No` shows *Out of stock* (customers can't order it). Blank = available.
- **Tag** (optional): a small label on the photo, like `New`, `Bestseller`, `20% off`.
- To remove a product, delete its row.

### Tab `Shops` — your shop locations

| Name | About | Address | Map Link | WhatsApp | Phone | Timings | Show |
|------|-------|---------|----------|----------|-------|---------|------|
| Sapthagiri Party Shop | Retail · Birthday · Halloween · Christmas | *(optional)* | https://maps.app.goo.gl/Q5BkWGuxpkbWK8W49 | +91 98861 80607 | +91 98861 80607 | | Yes |
| Sapthagiri Party Shop – Main Outlet | Our main outlet | | https://maps.app.goo.gl/3qZwUjtAYMwjRRey9 | +91 98802 02339 | +91 98802 02339 | | Yes |
| Sapthagiri Regalia | Birthday decorations – main store | | https://maps.app.goo.gl/3CZ5u6ptdbV4ymMu5 | +91 96208 19550 | +91 96208 19550 | | Yes |
| Vishnu Enterprises | Event decor | | https://maps.app.goo.gl/GiXUgLquWgZUhxhR6 | +91 96636 23051 | +91 96636 23051 | | Yes |

- **Who gets which order on WhatsApp:** the **main WhatsApp number** (Settings tab) gets **every** order.
  When a customer chooses **Pick up from** a shop, that shop's **WhatsApp** number(s) get the order too.
  The customer sees one button per number ("1. Send to …", "2. Send to …"), because WhatsApp only allows one number per tap.
  For more than one number at a shop, separate them with a comma: `+91 98861 80607, +91 90000 00000`.
- Every row appears in a **📍 Visit our shops** section with a **Get directions** button (opens Google Maps) and a **Call** button.
- Type the shop's **Address** too and a small map of the shop appears on its card.
- **About** is a short line saying what that shop is best for.
- **Map Link** (best): open Google Maps on your phone → find your shop (or drop a pin on it) → **Share** → **Copy link** → paste it here.
  If you leave it blank, directions use the address instead.
- Customers can choose **Home delivery** or **Pick up from** any of your shops when they order, and you'll see their choice in the order.
- Add a row for a new branch; type **No** in *Show* to hide one.

## Step 2 — Adding product photos from your phone

1. Open the **Google Drive** app → **+** → **Upload** → pick the photo.
2. Tap **⋮** on the uploaded photo → **Share** → **Manage access** →
   change *General access* to **Anyone with the link** (Viewer).
3. Tap **⋮** → **Copy link**, then paste it in the **Image** cell of that product.

Tip: make one Drive folder (e.g. *Shop Photos*), set **that folder** to *Anyone with the link* once, and every photo you upload into it works automatically.
Several photos for one product? Paste several links in the same cell, separated by a space; customers can swipe through them.

## Step 3 — Share your sheet & connect it

1. In the Sheets app tap **Share** (person icon) → **Manage access** → set *General access* to
   **Anyone with the link → Viewer**. (Customers can't edit it; they only see what's on the website anyway.)
2. Copy the sheet's link.
3. Send that link to Claude and it will connect it for you, **or** do it yourself: open
   `decor-shop/config.js` on GitHub, tap ✏️ edit, paste the link between the quotes, and tap **Commit changes**.

## Step 4 — Turn on order emails (one time)

Order emails are sent through the free service **FormSubmit**. The very **first** time an order is placed,
FormSubmit emails *you* an **"Activate Form"** link. Open your Gmail and tap it. That's it.
👉 Place a small **test order yourself** right after going live, so you activate it before real customers order.

(Until it's activated, orders still reach you on WhatsApp.)

## Step 5 — Put the website online (one time, free)

The website is hosted free on **GitHub Pages**:

1. On github.com, open this repository → **Settings** → **Pages**.
2. Under *Build and deployment → Source*, choose **GitHub Actions**.
3. Open the **Actions** tab → **Publish decorations shop website** → **Run workflow**.
4. After a minute your site is live at an address like
   `https://<your-github-name>.github.io/Claude-start/`. Share it on WhatsApp, Instagram and Google Maps!

(GitHub Pages is free for **public** repositories. If this repository is private, make it public or ask Claude to host it elsewhere.)

---

## Everyday use — cheat sheet

| I want to… | Do this in the Google Sheet |
|---|---|
| Add a new product | Add a row in **Products** |
| Change a price | Edit the **Price** cell |
| Mark something sold out | Type **No** in **Available** |
| Start a new festival season (e.g. Holi) | Add a row in **Collections**, then add products with Collection = *Holi* |
| Hide a festival after it's over | Type **No** in **Show** in Collections |
| Put an offer at the top of the site | Edit **Announcement** in Settings |
| Change WhatsApp / email | Edit it in **Settings** |
| Add or change a shop location | Edit the **Shops** tab |

Changes show up on the website within about a minute (refresh the page).
