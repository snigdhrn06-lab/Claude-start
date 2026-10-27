# SAPTHAGIRI ENTERPRISES — Website + Owner Portal

**You bring the guests, we bring the party!**

- **Website for customers:** browse occasions, product photos, prices and discounts, cart, login with mobile number and email, checkout with shipping address or store pickup, special instructions, WhatsApp order confirmation, and "My orders".
- **Owner portal at `/admin`**, made for the phone:
  - See every customer who logs in (name, phone, email, visits, orders) and message them on **WhatsApp or email with one tap**.
  - Manage orders: status (New → Confirmed → Ready → Delivered), customer address, special instructions, and a ready-made update message to the customer.
  - **Full control without coding:** add, edit or delete products, photos, prices, discounts, stock, bestsellers, occasion pages (Halloween, Christmas, Diwali…), home page banners, stores and map links, shop details, announcement bar, "Why choose us", message templates and password.

---

## Part 1 — Put the website online (one time, about 15 minutes)

You need two free accounts:
- **Neon**, which stores your products, customers and orders. Its free plan doesn't expire.
- **Render**, which runs the website.

### Step 1: Create the database on Neon
1. Go to **https://neon.tech** and tap **Sign up**, then choose **Continue with Google**.
2. Create a project:
   - Name: `sapthagiri`
   - Region: **AWS Asia Pacific (Singapore)**, the closest to India
   - Tap **Create project**.
3. On the project dashboard, tap **Connect**. Copy the **connection string**. It looks like this:
   `postgresql://neondb_owner:xxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   Keep it safe, because it is the key to your data.

### Step 2: Create the website on Render
1. Go to **https://render.com** and tap **Get Started**, then choose **Continue with GitHub**. Allow Render to see the repository **Claude-start**.
2. Tap **+ New**, then **Web Service**, then pick **snigdhrn06-lab / Claude-start**.
3. Fill in the settings exactly like this:

   | Setting | Value |
   |---|---|
   | Name | `sapthagiri-enterprises` (this becomes your link) |
   | Region | **Singapore** |
   | Branch | `claude/exciting-knuth-72ejsn` |
   | **Root Directory** | `sapthagiri-app` |
   | Runtime / Language | **Node** |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

4. Under **Environment Variables**, tap **Add Environment Variable** three times and add:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from Step 1 |
   | `ADMIN_PASSWORD` | a password of your choice for the owner portal |
   | `NODE_VERSION` | `22` |

5. Tap **Deploy Web Service**. Wait 2–4 minutes until it says **Live**.
6. Your website is now online at **https://sapthagiri-enterprises.onrender.com**.
   The owner portal is at **https://sapthagiri-enterprises.onrender.com/admin**. Log in with your `ADMIN_PASSWORD`.

> On first start, the site fills itself with your shop details, 4 stores, 8 occasion pages and sample products.
> In the portal, tap **Remove sample products** once you've added your own.

### Good to know about the free plan
- Render's free plan **sleeps after 15 minutes without visitors**. The next visitor waits about 1 minute while it wakes up. To avoid that, either:
  - Upgrade the service to Render **Starter** (about $7 a month), so it never sleeps, **or**
  - Use a free pinger: at **https://cron-job.org**, create a job that opens `https://sapthagiri-enterprises.onrender.com/healthz` **every 10 minutes**.
- Your data lives in Neon, not on Render. Restarts and updates never lose products, customers or orders.
- **Your own address** (like `sapthagiri.in`): when you buy it, open Render, go to **Settings → Custom Domains**, and follow the steps.

---

## Part 2 — Using the owner portal (all from your phone)

Open **/admin** and log in. Tip: in Chrome, tap ⋮, then **Add to Home screen**, so it opens like an app.

| I want to… | Where |
|---|---|
| See new orders | **Orders** tab (the red badge shows how many are new) |
| Confirm an order and tell the customer | Open the order → **Confirmed** → the WhatsApp message is ready → **Send** |
| Message a customer | **Customers** → 💬 **WhatsApp** or ✉️ **Email**, then pick a ready-made message |
| Email many customers at once | **Customers** → **Select customers** → **Email** |
| Download all customers to Excel | **Customers** → **Download list (Excel)** |
| Add a product with photos | **Products** → **+ Add product** → **📷 Add photos** (camera or gallery) |
| Change a price quickly | **Products** → tap the price ✏️ |
| Mark something sold out | **Products** → turn off the switch |
| Show a discount | Edit product → fill **Original price / MRP**. A "% OFF" badge appears |
| Put a product in Bestsellers | Edit product → **Show in Bestsellers** |
| Add a festival page (Holi, Navratri…) | **More → Occasions & pages → + Add occasion** |
| Change the big home page banners | **More → Home page banners** |
| Change the scrolling offer at the top | **More → Shop details → Scrolling announcement** |
| Change WhatsApp number, email, logo, tagline | **More → Shop details** |
| Make login compulsory to view the site | **More → Shop details → Customer login** |
| Update store addresses, map links, store order numbers | **More → Our stores** |
| Edit the ready-made messages | **More → Message templates** |
| Send emails straight from the portal (optional) | **More → Email sending** (free Brevo account) |
| Change the portal password | **More → Change password** |

### How orders reach you
1. Every order is saved in the portal under **Orders**.
2. A copy is emailed to your **order email**. The very first time, FormSubmit sends you an **"Activate"** email; tap it once.
3. After ordering, the customer taps a button that sends the full order to your **main WhatsApp (98808 55551)**. For store pickups, it also goes to that store's own number.

### About customer login
Customers log in with **name + mobile number + email**. There is no OTP, because SMS OTP costs money per message. Their details still appear in your portal straight away, and you can message them with one tap.

---

## For developers

- Node.js 18+ (Express) and PostgreSQL (`pg`). No build step.
- `DATABASE_URL` (required), `ADMIN_PASSWORD` (required until a password is set in the portal), `SESSION_SECRET` (optional; one is generated and stored in the database), `PGSSL=off` for a local database without SSL.
- Tables are created and sample data added automatically on first start (`db.js`).
- Run locally: `npm install && DATABASE_URL=postgres://… ADMIN_PASSWORD=… npm start`, then open http://localhost:3000.
