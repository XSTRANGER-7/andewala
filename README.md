# AndeWala

Single-product storefront for a same-day egg delivery business: customers order 30-egg trays at today's farm price and pay on delivery; the owner runs price, stock, delivery windows and the day's orders from a back office.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma and Postgres on Supabase.

## Quick start

```bash
cp .env.example .env       # fill in the Supabase values (see "Supabase" below), ADMIN_PASSWORD and AUTH_SECRET
npm install
npm run setup              # creates the tables in Supabase, locks them off from the public API, seeds settings
npm run check:supabase     # confirms the connection, tables, row-level security and login setup
npm run dev                # http://localhost:3000
```

Open `/admin/login` with the password from `.env` to set today's price, add stock and configure delivery windows.

Customers log in at `/login`. In development, with no email or SMS provider configured, the 6-digit code is shown on the login screen so you can test.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (also regenerates the Prisma client) |
| `npm start` | Serve the production build |
| `npm run setup` | Apply migrations to the database and seed default settings |
| `npm run db:deploy` | Apply new migrations only |
| `npm run check:supabase` | Check database connection, tables, row-level security, public API lockdown and login settings |
| `npm run race` | Fire 8 simultaneous orders at 3 trays of stock and confirm exactly 3 succeed |
| `npm run smoke` | Exercise the order lifecycle against the database and clean up |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks |
| `npm run db:studio` | Browse the database in Prisma Studio |

## Project layout

```
prisma/           schema.prisma (data model) and seed.ts
src/app/          routes
  page.tsx          landing page
  cart/             the cart, which is also checkout
  login/            customer login (mobile or email + one-time code) and profile setup
  account/          profile, saved addresses, latest order, log out
  order/[id]        order tracking (/order redirects to /cart)
  orders/           the customer's orders + lookup by ID and phone
  admin/            back office (login outside the (dashboard) group, which is session-gated)
  api/              /api/availability (live stock and windows), /api/health
src/components/
  ui/               primitives: Button, Field, Choice, Pill, Note, Stepper, Modal, Toast, Icons
  layout/           Header, LocationChip, CartButton, MobileTabBar, Footer, SiteShell
  account/          LoginForm, ProfileCard, AddressBook, AddressForm
  cart/             AddToCart, CartCheckout
  sections/         landing page sections
  order/            OrderForm, OrderTimeline, OrderActions, FindOrderForm, OrderCard
  admin/            back-office forms and tables
  art/              SVG product art
src/lib/          pure domain logic, no I/O: time (IST), pricing, availability, validation (zod), types
src/server/       data access and server actions
  settings.ts       the single settings row
  orders.ts         order creation (transactional stock + slot checks) and status changes
  auth.ts           HMAC-signed admin session cookie (Web Crypto, shared with proxy.ts)
  customer-auth.ts  customer login: one-time codes, rate limits, sessions
  otp-delivery.ts   sends codes by email (Resend) or SMS (MSG91 or Twilio)
  accounts.ts       profiles and saved addresses
  session.ts        admin session helpers; getCustomerId() = the logged-in customer
  actions/          "use server" entry points called from client components
src/proxy.ts      redirects unauthenticated /admin requests to the login page
src/content/      marketing copy (features, steps, testimonials, FAQ)
```

## Cart and order flow

The cart is the checkout. There is one place to buy: `/cart`.

1. Every "Order now", tray pick, "Buy now" and "Order again" button calls `addToCart()` (`src/lib/cart.ts`) and opens `/cart`. A button with a count ("2 trays", "Order again") sets the cart to exactly that many trays; a plain "Order now" keeps an existing cart or starts one with a single tray.
2. The cart lives in the browser (`eggspress:cart`). Every change at checkout (trays, day, window, payment, rider note) is saved, so a customer who leaves halfway finds the same order when they tap the cart icon.
3. Anyone can fill a cart, but placing the order needs a logged-in customer with a complete profile (name and mobile) and one of their saved addresses. Logged-out visitors see their cart line and a "Log in to place your order" step instead of checkout.
4. The server re-checks login, the address's owner, stock, window capacity, delivery area, cutoff and payment method in one transaction. On success the cart is cleared and the customer lands on `/order/[id]`.
5. The cart icon's badge counts the cart (if any) plus orders still on their way. `/cart` lists those orders under "On the way".
6. Old `/order` and `/order?trays=N` links redirect to `/cart`.

## Customer login and accounts

- **Sign up and log in**: the login screen asks for a mobile number, with a "Log in with email" link for existing customers. New accounts are created with a mobile number only. Existing customers log in with their mobile number or their email. An email that belongs to no account is refused before any code is sent, with a prompt to sign up by mobile. Then a 6-digit code; no passwords.
- **Codes**: valid 10 minutes, single use, 5 wrong tries, only an HMAC of the code is stored. At most one code per 30 s and 5 per hour for a contact, and 20 per hour from one IP address.
- **Sessions**: a `Session` row per login, 30 days; the `egg_session` cookie holds its id plus a signature, is httpOnly, and is cleared on log out. A tampered cookie is ignored.
- **Sign-up details**: right after the first mobile login, customers give their full name, email and first delivery address in one step. A profile is complete once it has a name, mobile and email. The contact used to log in is marked verified and can't be edited.
- **My account** (`/account`): a menu with My profile, My orders (active and past), Saved addresses, Help and support, and Log out.
- **Addresses**: up to 10 per account, with labels (Home, Work, Other) and one default. Managed on `/account` or inline at checkout; the header's "Deliver to" picker switches the default.
- **Delivering codes**: set `RESEND_API_KEY` and `EMAIL_FROM` for email, and `MSG91_AUTH_KEY` + `MSG91_TEMPLATE_ID` (or the Twilio keys) for SMS. In production a channel with no provider shows a clear message instead of sending, and codes are never displayed.

## Mobile layout

Phones get a fixed bottom tab bar (Home, My orders, My account) from `src/components/layout/MobileTabBar.tsx`; it hides on `/cart` while a cart is open, where the sticky order-summary bar takes its place. Sections drop their longer copy below the `sm` breakpoint, so the landing page stays short on a phone. The promo strip under the header (`PromoBar.tsx`) is generated from the live settings: free-delivery threshold, cutoff time and payment options.

## How the store logic works

- **Price**: one tray price, changed from the admin. A scheduled price can be set for a future date and takes effect automatically. Each order stores the price it was placed at.
- **Stock**: `stock` is trays physically on hand. Trays available to sell = stock − trays in open orders. Delivering an order reduces stock on hand.
- **Windows**: each delivery window has a capacity in orders. Same-day orders close at the cutoff and 30 minutes before a window starts.
- **Order creation** runs inside a database transaction that re-checks stock, window capacity, delivery area and payment method, so two customers cannot oversell the last tray.
- **Customers** must log in to order; orders are filed under their account. Anyone can still look up an order with its ID and the phone number used.
- **Admin** is a single owner password (`ADMIN_PASSWORD`) and a signed cookie (`AUTH_SECRET`). All admin writes go through server actions that verify the session, and every change is written to the activity log.
- All times are in IST regardless of where the server runs.

## Supabase

The app uses Supabase in two ways. Prisma stays as the code layer either way.

**1. The database (required).** All data lives in your Supabase Postgres database.
- `DATABASE_URL` is the pooled connection (port 6543, `?pgbouncer=true&connection_limit=1`), used by the app.
- On Vercel, use the pooler host (`aws-0-<region>.pooler.supabase.com`) for both. The direct host `db.<ref>.supabase.co` is IPv6-only, and Vercel cannot reach it, so every page fails with "Can't reach database server".
- `DIRECT_URL` is the session or direct connection (port 5432), used only by `npm run db:deploy` to create and change tables.
- Copy both from the Supabase dashboard: **Connect > ORMs > Prisma**, and put in your database password.

**2. Login codes (optional).** Set `SUPABASE_AUTH_OTP="phone"` (or `"phone,email"`) with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, and Supabase Auth sends and checks the codes for those channels. Phone needs an SMS provider configured in **Authentication > Providers > Phone**. Email needs the Magic Link template to include `{{ .Token }}` and a custom SMTP server. Accounts, profiles, addresses and sessions stay in the app's own tables.

**Security.** Supabase publishes every table in the `public` schema through its REST and GraphQL APIs, and the publishable key is public. Migration `0002_lock_public_api` turns on row-level security with no policies and revokes the API roles' access on every table, so the API returns nothing. The app connects as the database owner, which is unaffected. Any table added later needs the same lines in its migration; `npm run check:supabase` flags one that's missing them. Never put the `service_role` (secret) key in this app.

**Concurrency.** Placing, cancelling and delivering an order take a Postgres advisory lock (`lockStore` in `src/server/db.ts`), so two customers can't buy the last tray at the same moment.

## Delivery areas

Admin > **Delivery areas** is a map where you set where you deliver:
- **Circle around a hub**: click the hub on the map and set the radius (200 m to 50 km). Drag the dot to move it.
- **Custom area**: click around a neighbourhood to outline it (3+ corners). Drag corners to adjust, double-click a corner to remove it.
- Areas can overlap (two hubs sharing a zone is fine). Switch an area off to pause it, or remove it. **Check a location** tells you whether a spot is covered and by which area.

Just outside: a spot within 200 m of an area's edge (`NEAR_EDGE_M` in `src/lib/zones.ts`) can still be delivered to. The header shows "Just outside" with an "Order here" button, and saving such an address asks the customer to tick "Yes, deliver to this spot". Further out, the header says "Not deliverable" and a strip under it explains how far the nearest area is, with "Change location". Tests: `npm run test:zones`.

Rules: when at least one area is active, a customer can only save an address, and order, with a map pin inside an active area (checked in the browser for instant feedback and again on the server). Each order records the area it falls in (the nearest hub when areas overlap). With no areas, the PIN-code list in Delivery settings applies as before.

How it works: areas are stored in the `DeliveryZone` table; the check is plain code in `src/lib/zones.ts` (distance for circles, ray casting for polygons), which takes microseconds for a handful of areas, so no PostGIS or paid map API is needed. The maps use OpenStreetMap.

## Payments (Razorpay)

Checkout offers **Cash on delivery** and **Pay online** (UPI, cards, netbanking, wallets through Razorpay).

How an online order is placed:
1. The server re-checks the order (store open, stock, area, map pin) and prices it, then creates a Razorpay order for exactly that amount. The browser never sets the price.
2. The customer pays in Razorpay Checkout.
3. The server verifies Razorpay's signature, fetches the payment to confirm the order id, amount and status (capturing it if it is only authorized), and only then places the order, marked paid.
4. Closed window or declined payment: no order, and the customer sees "Order failed: payment didn't go through" with Try again / Pay cash on delivery.
5. Paid, but the order can no longer be placed (for example stock ran out that second): the payment is refunded automatically and the customer is told.
6. Customer paid and closed the app before returning: the webhook places the order. The browser and webhook can both finish the same payment safely; only one order is created.
7. Cancelling a paid order refunds it.

Setup:
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: Razorpay Dashboard > Account & Settings > API keys (test keys first).
- Webhook: Dashboard > Webhooks > Add new: URL `https://<your-site>/api/razorpay/webhook`, events `payment.authorized` and `payment.captured`, and a secret you also put in `RAZORPAY_WEBHOOK_SECRET`.
- Add all three on Vercel (Production and Preview) and redeploy. "Pay online" shows only when the keys are set and the admin switch "Accept online payment" is on.

## Deploying

1. Set `DATABASE_URL`, `ADMIN_PASSWORD`, `AUTH_SECRET` (32+ random characters) and `NEXT_PUBLIC_SITE_URL`.
2. Set `DATABASE_URL` and `DIRECT_URL` to your Supabase connection strings (see Supabase above).
3. Set up code delivery for the login channels you want (see Customer login above).
4. `npm run db:deploy`, then `npm run build` and `npm start` (on Vercel, add `npm run db:deploy` before the build command).
5. `/api/health` returns `{ ok: true }` when the app and database are reachable.
