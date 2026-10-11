# Deploying COD Studio on Hostinger Business

Hostinger **Business** ("Unlimited") web hosting runs Node.js web apps (Next.js in full server mode) next to a
managed **MariaDB** database. This guide takes you from zero to a live, private admin and public landing pages.

> Plan check: Premium does **not** run Node.js. Business/Unlimited and every Cloud plan do.

---

## 0. What you need
- Your domain added to Hostinger (e.g. `mystore.ma`) with SSL active (free and automatic).
- A GitHub account (the recommended deploy method), or a `.zip` of the project.
- 20 minutes.

## 1. Create the database
hPanel → **Websites → (your site) → Databases → MySQL Databases**
1. Create a database, a user and a strong password. Note the three values.
2. The host for Node.js apps is **`127.0.0.1`** (not `localhost`).
3. Your `DATABASE_URL` becomes:
   `mysql://DB_USER:DB_PASSWORD@127.0.0.1:3306/DB_NAME`
   (URL-encode special characters in the password, e.g. `@` → `%40`, `#` → `%23`).

Tables are created automatically on the first start. Migrations from `drizzle/` run at boot, and a database
lock serialises them, so a restart during a deploy is safe.

## 2. Create the Node.js app
hPanel → **Websites → Add website → Node.js Apps** (or *Deploy Node.js app*)
1. Source: **GitHub** (auto-deploys on every push) or **Upload** a project zip. Leave `node_modules`, `.next`,
   `qa` and **`.env.local`** out of the zip: your local secrets must never be uploaded.
2. Framework: **Next.js** (auto-detected). Node version: **22** (recommended) or **24**.
3. Build command: `npm run build`. It first compiles the landing CSS kit and runtime and the admin's
   Tailwind CSS (`prebuild`), then runs `next build`; if Turbopack fails on the build machine it retries
   once with webpack. Turbopack gets no loaders (Hostinger kills the Node workers they need: "node
   process exited before we could connect to it"), so never add a `postcss.config` or `turbopack.rules`. Hostinger handles the start command and applies standalone output itself, so
   `next.config.ts` stays a plain object without `output`.
4. Attach it to your domain (e.g. `mystore.ma`).

> Do **not** add a `NODE_ENV` variable. The build needs the devDependencies (TypeScript, Tailwind, esbuild,
> lightningcss), and `NODE_ENV=production` during `npm install` would skip them. Next.js sets the production
> mode itself.

## 3. Environment variables
In the app's **Environment variables** panel, add the variables below. [`.env.example`](../.env.example) has the
same list with comments. Saving the variables redeploys the app.

**Required**

| Name | Value |
|---|---|
| `DATABASE_URL` | from step 1 |
| `APP_SECRET` | 64 random chars: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. At least 32 chars, or the admin stays unreachable; 48+ recommended. |
| `ADMIN_GATE` | your private door to the admin, e.g. `studio-k29fx81q4mz7w2pd`. **20+ random chars** of `A-Z a-z 0-9 _ -`. It cannot be a route name (`admin`, `api`, `media`, `fonts`, `login`, `setup`). |
| `SETUP_TOKEN` | a one-time token (8–128 chars of `A-Z a-z 0-9 _ -`) to create the first owner. Remove it after setup. |
| `PUBLIC_URL` | `https://mystore.ma`: canonical links, exports and server-side tracking. Must be `https://` for *Connected* exports. |
| `CRON_KEY` | a random string, **at least 8 chars** (32 recommended). Without it the cron endpoint stays disabled (404). |
| `TRUSTED_PROXY_HOPS` | `1`. Hostinger has one proxy in front of the app (see §6). |
| `BEHIND_CLOUDFLARE` | `0`, or `1` only when the domain is proxied by Cloudflare (see §6). |

**Optional**

| Name | Value |
|---|---|
| `GOOGLE_SA_JSON_B64` | Google service-account key, base64 on one line: see [GOOGLE-SHEETS-SETUP.md](GOOGLE-SHEETS-SETUP.md) |
| `GOOGLE_EXPORT_SA_JSON_B64` | a **second** service-account key, only for PHP exports that carry a Google key in `config.php` ([GOOGLE-SHEETS-SETUP.md, Part C](GOOGLE-SHEETS-SETUP.md#part-c--optional-a-key-for-php-exports)). It must be a different account from `GOOGLE_SA_JSON_B64`, or the export is refused. |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile keys (both or neither). These are defaults only: keys saved in *Settings → Anti-spam* take over (see §7). |
| `ADMIN_HOST` | **Recommended.** A host name of its own for the admin, e.g. `studio.mystore.ma` (see §4a). |
| `ADMIN_IP_ALLOWLIST` | comma-separated IPs allowed to reach the admin. Leave empty to allow all (see §6). |
| `APP_TIMEZONE` | the store time zone for dashboard days and Sheets dates. Default `Africa/Casablanca`. |

The server prints a `[boot]` line for every missing or weak value (never the value itself). Check the app's
logs after the first deploy.

> **`APP_SECRET` must never change after launch.** It signs sessions and the admin gate cookie, and it
> encrypts the 2FA secrets and the secret settings (Turnstile secret key, pixel API tokens). Changing it signs
> everyone out, closes the gate, breaks two-step sign-in (recovery codes still work) and makes those
> settings unreadable until they are entered again.

## 4. First login (private admin)
1. Open `https://mystore.ma/<ADMIN_GATE>` once (with `ADMIN_HOST` set: `https://studio.mystore.ma/<ADMIN_GATE>`;
   the gate does nothing on the public domain then). This unlocks the admin for this browser and redirects to
   `/admin`. Access slides with use: it expires after 30 days without a visit. Without the gate cookie, every
   `/admin` and `/api/admin` URL answers **404**, so the admin is invisible to the public.
2. Go to `/admin/setup`, enter `SETUP_TOKEN`, and create the owner account (email + strong password).
3. Enable **two-factor authentication** in *Settings → Security* (strongly recommended). Store the 10
   recovery codes somewhere safe.
4. Remove `SETUP_TOKEN` from the environment variables. Setup also closes for good once an owner exists.
5. Fill in *Settings → Store & legal* and *Settings → Market defaults*. Add teammates in *Settings → Team*
   (roles: owner, editor, agent).

## 4a. Admin on its own host (recommended)
Your live pages load the ad platforms' scripts (Meta, TikTok, Snap, Google). On a shared domain, every one of
those scripts runs on the same origin as the admin. If one were ever compromised, it could use your signed-in
browser to export orders or add users. `ADMIN_HOST` gives the admin an origin of its own:
1. Create a subdomain such as `studio.mystore.ma` and make it reach **this same Node.js app** (add it to the
   app as an extra domain or alias in hPanel), with SSL active.
2. Set `ADMIN_HOST=studio.mystore.ma` and keep `PUBLIC_URL=https://mystore.ma`. They must differ.
3. Unlock the admin at `https://studio.mystore.ma/<ADMIN_GATE>`. Setting or changing `ADMIN_HOST` closes the
   gate for every browser, and older admin cookies on the public domain stop working.

The admin host then serves only the admin. Landing pages, `/legal`, `/api/public` and `/api/cron` answer 404
there; only a browser that has unlocked the gate is sent on to the same page on `PUBLIC_URL`, so the
admin's "view live" links keep working. Keep the cron (§5) and every shared link on `https://mystore.ma`.
The public domain answers 404 for `/admin`, `/api/admin` and the gate. If your plan cannot route a second host name to the app, leave
`ADMIN_HOST` empty and open live pages only in a browser profile where you are not signed in to the admin.

## 5. Cron (Google Sheets sync + housekeeping)
hPanel → **Advanced → Cron Jobs** → custom command, **every 5 minutes** (`*/5 * * * *`):
```
curl -fsS --max-time 110 "https://mystore.ma/api/cron/tick?key=YOUR_CRON_KEY" > /dev/null
```
Each run:
- pushes orders still queued for Google Sheets (up to 100 per run; new orders are normally sent within
  seconds, so this is the retry path) and pulls the statuses your team set in the sheet;
- purges expired sessions, old rate-limit buckets, visitor markers older than 2 days, and **abandoned
  leads older than 30 days**;
- keeps the Node.js process warm. Hostinger stops idle apps, so without the cron the first visitor after a
  quiet period waits for a cold start.

A missing or wrong key answers **404**, and repeated guesses are rate-limited per IP. With a valid key you
get a small JSON report (`{"ok":true,…}`), which is handy for a first manual test in the browser.

## 6. Proxies, real visitor IPs and Cloudflare
Rate limits, the duplicate-order guard and the risk score work per visitor IP (always stored hashed).
The app reads the IP that **its own proxy** appended to `X-Forwarded-For`, never the client-supplied
entries:

| Setup | `TRUSTED_PROXY_HOPS` | `BEHIND_CLOUDFLARE` | `ADMIN_IP_ALLOWLIST` |
|---|---|---|---|
| Hostinger only (default) | `1` | `0` | works: your public IP(s) |
| Cloudflare proxy (orange cloud) → Hostinger | `1` | `1` | **leave empty**: the app sees Cloudflare's address, so an allowlist would lock everyone out |

- `BEHIND_CLOUDFLARE=1` trusts the `CF-Connecting-IP` header. Set it only if **every** request goes through
  Cloudflare. Otherwise a visitor could forge that header to dodge rate limits.
- To confirm the app sees real addresses, temporarily set `ADMIN_IP_ALLOWLIST` to your current public IP.
  If the admin still opens, the proxy hop is right. If it answers 404, remove the variable (and check the table
  above).

## 7. Anti-spam (Cloudflare Turnstile, optional)
Every order already goes through a honeypot, rate limits, a duplicate guard, a blocklist and a risk score.
If fake orders still get through, add Turnstile:
1. Cloudflare dashboard → **Turnstile → Add widget** → your domain, mode *Managed* → copy the site key and
   the secret key.
2. Admin → *Settings → Anti-spam* → paste both keys → **Save**. (Or set `TURNSTILE_SITE_KEY` /
   `TURNSTILE_SECRET_KEY`. Keys saved in the admin override the variables.)
3. **Re-publish** your pages. The widget is part of the published HTML. It stays invisible until a visitor
   starts filling in the form, and it loads nothing before that.

Pages published before the keys existed (and exported pages) keep taking orders, which are flagged
*captcha missing*, until they are re-published. A Cloudflare outage never blocks a sale.

## 8. Pixels and server-side tracking
*Settings → Pixels*: enter the pixel IDs (Meta, TikTok, Snap, Google tag/GA4) once, then use **Apply to
pages**. New pages start with them. Live pages pick them up when you re-publish them.

Purchases are also sent **server to server**, deduplicated with the browser pixel by event id:
- **Meta Conversions API**: Events Manager → your pixel → Settings → *Generate access token*.
- **TikTok Events API**: Events Manager → your pixel → Settings → *Generate access token*.
- Optional *test event codes* route events to the platforms' "Test events" screens. Remove them after testing.
- Snap and GA4 Measurement Protocol secrets can be stored, but purchases on those platforms are tracked by
  the browser tag only.

These tokens are stored encrypted with `APP_SECRET`. They are not environment variables.

## 9. Publish your first page
Admin → **Generate** → drop product photos → pick a direction → edit → **Publish**.
Set it as **home page** in *Pages* so `https://mystore.ma/` shows it. Without a chosen home page, `/` shows
the most recently published page. Every page is also reachable at `https://mystore.ma/<slug>`, and its
thank-you page at `/<slug>/merci`.

The local AI in the generator runs in **your** browser (Chrome/Edge with WebGPU), not on Hostinger. See the
README's *Local AI* section.

## 10. Smoke test after each deploy
Open these in a private window (or use `curl -I`):

| URL | Expected |
|---|---|
| `https://mystore.ma/` | your home page (or a plain 404 page before the first publish) |
| `https://mystore.ma/admin` | **404** (the gate is closed in a fresh browser) |
| `https://mystore.ma/<ADMIN_GATE>` | **303** to `/admin`, which sends you to `/admin/login` |
| `https://mystore.ma/admin/setup` (after the owner exists) | **404** |
| `https://mystore.ma/api/cron/tick?key=YOUR_CRON_KEY` | `{"ok":true,…}` (a wrong or missing key: **404**) |
| `https://mystore.ma/api/public/order` (GET) | **405** (the endpoint only accepts POST) |
| `curl -X POST -H "Content-Type: application/json" -d "{}" https://mystore.ma/api/public/order` | **422** `{"ok":false,"error":"invalid","fields":{…}}` (a body that is not JSON: **400**) |
| `https://mystore.ma/legal/privacy` | your privacy page, once a page is published (**404** before) |

With `ADMIN_HOST` set, the gate row becomes `https://studio.mystore.ma/<ADMIN_GATE>` → `/admin/login`.
Also check `https://mystore.ma/<ADMIN_GATE>` → **404** and `https://studio.mystore.ma/<slug>` → **404**.

Then place one real test order on a published page and check that it shows up in *Orders* and in the sheet.

## 11. Security checklist
- [ ] 2FA enabled for every admin user
- [ ] `ADMIN_GATE` is 20+ random characters and not shared publicly
- [ ] `ADMIN_HOST` set to a subdomain of its own (§4a), or live pages opened only in a browser profile without an admin session
- [ ] `APP_SECRET` is 48+ random characters, saved in your password manager
- [ ] `SETUP_TOKEN` removed
- [ ] Optional: `ADMIN_IP_ALLOWLIST` with your office/home IPs (not behind Cloudflare, see §6)
- [ ] `BEHIND_CLOUDFLARE=1` only if all traffic is proxied by Cloudflare
- [ ] Google service-account JSON key stored only in the env var (never in Git or a zip)
- [ ] Cron job runs every 5 minutes (*Settings → Google Sheets* shows no orders left pending for long)
- [ ] Turnstile keys set in *Settings → Anti-spam* if you get fake orders

## 12. Updating and backups
Push to GitHub (auto deploy) or upload a new zip. Uploaded images and videos, pages, versions, orders and
settings all live in the database, so redeploys never lose data (Hostinger replaces the app folder on every
deploy). New migrations apply automatically at boot. Hostinger keeps database backups, and you can also
export from phpMyAdmin.

## Static exports (optional)
Any published version can be exported as a ZIP (Admin → page → **Export**) and uploaded to any host,
including Hostinger Premium (File Manager → `public_html`). Orders from exported pages either flow into
this app (*Connected*: needs an `https://` `PUBLIC_URL`; only the domains you allow can post), go through the
bundled `order.php` to Google Sheets (*PHP*), or open a WhatsApp message (*WhatsApp*). Connected exports can
be revoked from *Exports*. See the README inside the ZIP.
