# COD Studio

A private studio for cash-on-delivery sellers. Drop a few product photos, and COD Studio designs
three art-directed landing pages for that product (Arabic RTL, French or English). You refine the one
you like in a visual builder and publish it on your own domain. Orders land in your database and in a
Google Sheet your call-center team already knows how to use.

Built for the Moroccan market first (MAD, Moroccan cities and phone numbers, Darija/Arabic + French
copy) with EU markets ready (FR, BE, ES, DE, IT, NL, PT and an international fallback).

- **Admin**: Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 + shadcn/ui · Zod v4
- **Data**: MariaDB / MySQL via Drizzle ORM (pages, versions, media, orders, settings and sessions)
- **Landing pages**: pure React components rendered once to static HTML at publish time. The CSS
  landing kit is written by hand and inlined per page. A ~15 KB (gzip) vanilla runtime handles
  interactions. Visitors never download React.
- **Hosting**: one Node.js app on Hostinger Business (managed Node.js + MariaDB). See
  [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md).

---

## Features

**Generator + local AI**
- Wizard: photos → analysis → product details → three directions in three different design languages
  (archetypes such as *maison*, *souk*, *kinetic*, *circuit*, *hearth*…), each with its own palette taken
  from the product photos, type pairing, layout and section mix.
- The AI runs **in the admin's browser** (WebGPU). No paid API and no data leaves the device:
  - a photo reader (SigLIP) for category and visual mood,
  - a background remover (BiRefNet lite on WebGPU, ISNet on WASM) for clean product cut-outs,
  - a copywriter (Qwen3.5 0.8B or 2B) for first-draft copy in Arabic, French and English.
- Without WebGPU, the generator still works: the photo reader and background removal fall back to
  WASM, and copy comes from a built-in, hand-written copy library (Arabic, French and English).
- **Remix** a page from the builder: new design, new layout, new copy, or all three, while your product
  content stays in place.

**Builder**
- 27 section types (hero, offer, order form, reviews, social proof, before/after, comparison, FAQ,
  guarantee, sticky CTA, WhatsApp button…), most with several variants. You can add, remove,
  reorder, duplicate and restyle every section.
- Live preview on phone, tablet and desktop. Edit text directly in the preview or in the inspector.
  Undo/redo, keyboard shortcuts, autosave.
- Version history: autosaved versions, named milestones, restore, and duplicate as a new page.
- Publish checklist: it blocks example content such as sample reviews or numbers until you confirm
  it is real.

**Offers & bundles**
- Packs (×1 / ×2 / ×3…) with suggested prices, savings badges, order bump, per-unit variants
  (size, colour…) and a one-click upsell on the thank-you page.
- Prices are always recomputed on the server; the page's prices are never trusted.

**COD orders**
- Order form with Moroccan phone validation, a city list, and abandoned-lead capture. Duplicate guard,
  honeypot, rate limits, blocklist and a risk score. Cloudflare Turnstile is optional.
- Admin orders queue: search, statuses, details drawer, CSV export (Excel-ready) and abandoned leads.
- **Google Sheets**: every order is appended to a formatted *Commandes* tab. Statuses your team sets
  in the sheet sync back to the admin. Setup: paste the sheet link
  ([docs/GOOGLE-SHEETS-SETUP.md](docs/GOOGLE-SHEETS-SETUP.md)).
- Tracking: up to 3 Meta and 3 TikTok pixels, plus Snap and GA4 (ViewContent, AddToCart,
  InitiateCheckout, Lead, Purchase; TikTok's purchase event is Purchase). Server-side Purchase events go to
  the Meta Conversions API and the TikTok Events API with a token and test code per pixel ("Send test
  event"), deduplicated with the browser pixel by event id (= the order id). Contact data is SHA-256 hashed.

**Exports**
- Export any published version as a ZIP and host it anywhere (Hostinger Premium, Netlify, Vercel,
  Cloudflare Pages). Three order modes:
  - **Connected**: orders still flow into this app (allowed domains only).
  - **PHP**: a bundled `order.php` writes to Google Sheets, with optional Telegram alerts.
  - **WhatsApp**: the order opens a pre-filled WhatsApp message.
- The ZIP includes host configs (`.htaccess`, `_headers`, `vercel.json`), SEO files and a README
  with deploy steps. Connected exports can be revoked.

**Security**
- The admin is invisible. `/admin` answers 404 until the browser visits the secret `/<ADMIN_GATE>`
  path. An IP allowlist is optional.
- scrypt passwords, database sessions, TOTP two-factor with recovery codes, and DB-backed rate
  limits on login, 2FA, setup and public endpoints.
- Roles: **owner**, **editor** (pages, media, exports) and **agent** (order queue only). Audit log.
- Landing pages get a strict hash-based CSP. The admin gets a per-request nonce CSP. HSTS,
  `frame-ancestors 'none'` and the usual hardening headers apply everywhere.
- Zod validation on every input. Uploads are re-encoded with sharp. Secrets in settings (pixel
  tokens, Turnstile secret) are encrypted at rest with AES-GCM.

---

## Requirements

| | |
|---|---|
| Node.js | **20.9+** (22 LTS recommended, the version Hostinger runs) |
| Database | MariaDB 10.4+ or MySQL 8 (local: **XAMPP**) |
| Browser for the admin | Chrome or Edge 113+ (WebGPU for the full local AI; any modern browser works without it) |
| Disk | ~1.2 GB for `node_modules`, plus the AI model cache in the browser (see below) |

## Local setup (Windows + XAMPP)

1. **Start MariaDB**: open the XAMPP Control Panel → *MySQL* → **Start**.
   Create the database (phpMyAdmin → *New*, or from a terminal):
   ```powershell
   C:\xampp\mysql\bin\mysql.exe -uroot -e "CREATE DATABASE cod_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Environment**: copy `.env.example` to `.env.local` and fill it in:
   ```ini
   DATABASE_URL=mysql://root:@127.0.0.1:3306/cod_studio
   APP_SECRET=<64 random chars>      # node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ADMIN_GATE=<8–128 chars of A-Z a-z 0-9 _ ->
   SETUP_TOKEN=<one-time token>
   PUBLIC_URL=http://localhost:3400
   ```
   Every variable is explained in [`.env.example`](.env.example) and in the
   [deploy guide](docs/DEPLOY-HOSTINGER.md#3-environment-variables).
4. **Run**
   ```bash
   npm run dev          # http://localhost:3400
   ```
   `predev` compiles the landing CSS kit and runtime first. Database tables are created
   automatically on start (migrations in `drizzle/` run at boot).

## First login

1. Open `http://localhost:3400/<ADMIN_GATE>`. This sets the gate cookie for this browser and redirects to
   the admin. Without it, every `/admin` URL is a plain 404.
2. Go to **`/admin/setup`**, enter `SETUP_TOKEN`, and create the **owner** account (email + strong
   password). Setup closes once an owner exists.
3. Turn on **two-factor authentication** in *Settings → Security*: scan the QR code with an
   authenticator app and keep the 10 recovery codes somewhere safe.
4. Fill in *Settings → Store & legal* (name, logo, WhatsApp, phone, legal identity) and
   *Settings → Market defaults* (country, currency, language, delivery fee). Then **Generate** your first page.

Add teammates in *Settings → Team* (owner only). Agents only see the order queue.

---

## Project structure

```
src/
  app/
    route.ts, [slug]/, legal/   public landing pages, thank-you pages, legal pages (route handlers → stored HTML)
    api/public/                 order, lead, upsell, event endpoints (used by published and exported pages)
    api/admin/                  media upload, exports, Google Sheets (gated + authenticated)
    api/cron/tick/              hPanel cron: Sheets sync + housekeeping
    media/[key]/                images and videos served from the database
    admin/                      the admin UI (auth, panel, builder, preview)
    dev/fixture/                fixture pages for local QA (answer 404 in production)
  proxy.ts                      admin gate, IP allowlist, admin CSP (Next 16 "proxy" convention)
  instrumentation.ts            boot: config warnings, DB migrations, session cleanup
  landing/                      landing kit: sections/, primitives/, illustrations/, styles/, runtime/, thankyou/, legal/
  lib/
    page/                       PageDoc schema, pricing, validation
    theme/                      archetypes, palettes from photos, fonts, design tokens
    generator/                  photos + product info → three PageDoc directions, remix
    ai/                         browser workers (SigLIP, Qwen3.5, BiRefNet) + copy library
    render/                     publish renderer, CSP, serving
    editor/                     builder state (zustand + zundo)
    orders/, sheets/, markets/  order pipeline (+ server-side Purchase events), Google Sheets client, market data
    settings/, stats/           store settings (secrets encrypted at rest), dashboard counters
    auth/, security/            sessions, 2FA, gate, rate limits, crypto, headers
    db/, media/, export/        Drizzle schema + migrations, media store, ZIP exports
  components/                   admin, builder, generator and shadcn/ui components
drizzle/                        SQL migrations (applied automatically at boot)
php/gsheets.php                 Google Sheets client copied into PHP exports
public/fonts/                   self-hosted landing fonts (generated by npm run fonts:sync)
scripts/                        asset build, font sync, theme check, QA tools (scripts/qa/README.md)
docs/                           ARCHITECTURE, DESIGN (art direction), SECTIONS, deploy and Sheets guides
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing the renderer or runtime contract, and
[docs/DESIGN.md](docs/DESIGN.md) before touching anything visitors see.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on **http://localhost:3400** (builds landing assets first) |
| `npm run build` | Production build (landing assets + `next build`) |
| `npm run start` | Serve the production build (`PORT` env or `-- -p 3400`) |
| `npm run typecheck` | `tsc --noEmit` (builds landing assets first) |
| `npm run lint` | ESLint (Next.js + TypeScript rules) |
| `npm test` | All offline self-tests (theme, runtime, generator, renderer, money formatting) |
| `npm run check` | typecheck + lint + tests: run this before every deploy |
| `npm run test:turnstile` | Turnstile + CSP end-to-end check in a headless browser (Edge/Chrome) |
| `npm run assets:build` | Compile the landing CSS kit + runtime into `src/landing/generated` |
| `npm run fonts:sync` | Copy the curated font files from `@fontsource` into `public/fonts` |
| `npm run theme:check` | Theme engine checks (contrast, palettes, tokens) |
| `npm run db:generate` | Generate a new SQL migration after editing `src/lib/db/schema.ts` |
| `npm run db:migrate` / `db:studio` | Apply migrations manually / browse the database (Drizzle Kit) |

Landing QA without a server or database (render any fixture page, screenshot it): see
[scripts/qa/README.md](scripts/qa/README.md).

---

## Deploy

Hostinger Business (managed Node.js + MariaDB): step by step in
**[docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md)**. It covers the database, environment variables,
first login, the cron job, Cloudflare and Turnstile, and the security checklist.

## Google Sheets

There is a one-time service-account setup (5 minutes, free), after which the admin only pastes a
sheet link. See **[docs/GOOGLE-SHEETS-SETUP.md](docs/GOOGLE-SHEETS-SETUP.md)**.

## Local AI: requirements

The models run in the admin's browser through WebGPU. They download once from Hugging Face and stay
in the browser's cache (*Settings → Local AI* shows what is stored and can clear it).

| Model | Job | Download | Runs on |
|---|---|---|---|
| SigLIP base | Photo reader: category + mood | ≈ 0.2–0.4 GB | WebGPU (fp16) or WASM: any computer |
| BiRefNet lite / ISNet | Background removal | ≈ 0.2 GB | WebGPU / WASM fallback |
| Qwen3.5 0.8B (**Lite**) | Copywriter | ≈ 0.9 GB | WebGPU: most recent laptops, integrated GPUs |
| Qwen3.5 2B (**Full**) | Copywriter, richer copy | ≈ 2.2 GB | WebGPU with `shader-f16`, 8 GB+ RAM, 3.2 GB free storage |

- Use **Chrome or Edge 113+** on Windows, macOS or ChromeOS. WebGPU must be on: check
  `chrome://gpu` → *WebGPU: Hardware accelerated*. Other browsers work too; without WebGPU they take
  the no-AI path.
- The tier is picked automatically from the GPU, memory and free storage, and you can force
  Lite or turn the AI off in *Settings → Local AI*. A software-only GPU counts as "no WebGPU", because
  it would take minutes per answer.
- The first generation includes the download. Later runs start in seconds. Keep the tab open
  while models download.
- Nothing is sent to an AI service. The admin's CSP only allows outside connections to Hugging Face
  (model files) and jsDelivr (ONNX Runtime WASM files).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/admin` is a 404 | Expected without the gate. Visit `/<ADMIN_GATE>` first. If it is still 404: `ADMIN_GATE` must be 8–128 chars of `A-Z a-z 0-9 _ -` and not a route name (`admin`, `api`, `media`, `login`…), `APP_SECRET` must be 32+ chars, and your IP must be in `ADMIN_IP_ALLOWLIST` when that is set. The server logs a `[boot]` warning for each problem. |
| `/admin/setup` is a 404 | An owner already exists, or `SETUP_TOKEN` is missing or invalid. |
| Admin unlocked yesterday, 404 today | The gate cookie lasts 30 days from your last visit. Changing `ADMIN_GATE` or `APP_SECRET` invalidates it. Visit the gate path again. |
| Locked out by 2FA | Sign in with one of the 10 recovery codes, then set 2FA up again in *Settings → Security*. |
| `ECONNREFUSED 127.0.0.1:3306` | MariaDB is not running (XAMPP → MySQL → Start), or `DATABASE_URL` points to the wrong port or database. |
| `Access denied for user` | Wrong user or password in `DATABASE_URL`. URL-encode special characters (`@` → `%40`, `#` → `%23`). |
| `[boot] database migration failed` | The DB user needs CREATE/ALTER rights on the database. The app keeps serving and retries on the next start. |
| Large uploads fail locally | XAMPP ships with `max_allowed_packet=1M`. Media is stored in small chunks, so this works, but raising it to `16M` in `C:\xampp\mysql\bin\my.ini` under `[mysqld]` is safer. |
| `npm run start` on `http://localhost`: the Settings link fails with `ERR_SSL_PROTOCOL_ERROR` / "Failed to fetch RSC payload" | Expected for a production build served over plain HTTP. The production admin CSP has `upgrade-insecure-requests`, so the browser upgrades redirected requests (`/admin/settings` → `/admin/settings/store`) to `https://`. Use `npm run dev` locally. On Hostinger the site is HTTPS, so this never happens there. |
| Port 3400 already in use | Another `next dev` is running. Stop it (`netstat -ano \| findstr :3400` → `taskkill /PID <pid> /T /F`). |
| Build: `Cannot find module 'esbuild'` / `lightningcss` / `tailwindcss` | devDependencies were skipped. Do not set `NODE_ENV=production` before `npm install`. The build needs the dev tools. |
| Build warning "ignored package-lock.json in C:\Users\…" | A stray `package-lock.json` in a parent folder. Harmless; delete that file to silence it. |
| Orders do not reach Google Sheets | *Settings → Google Sheets* shows the last error. Check that the sheet is shared with the service-account email as **Editor**, that `GOOGLE_SA_JSON_B64` is set, and that the cron job runs (it retries queued orders). |
| Published page shows old content | Landing pages are rendered once, at publish time. Re-publish after changing *Settings → Store & legal*, pixels or Turnstile keys (legal pages update on their own). Shared caches may keep a page for up to 60 s. |
| Generator says "WebGPU is not available" | See [Local AI](#local-ai-requirements). Generation still works with the copy library. |
