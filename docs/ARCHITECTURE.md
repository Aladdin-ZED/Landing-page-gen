# Architecture — COD Studio

One Next.js 16 app (App Router, React 19, TypeScript) deployed on **Hostinger Business (managed Node.js)**.
MariaDB (Hostinger) via Drizzle. Everything heavy (local AI, background removal) runs in the **admin's browser**.

```
                 ┌──────────── Admin (private, /admin, gated + auth + 2FA) ─────────────┐
 product photos →│ upload → sharp (server) → assets in DB │ local AI worker (browser):   │
                 │ generator → PageDoc (3 directions)     │ SigLIP + Qwen3.5 + BiRefNet  │
                 │ builder (zustand+zundo) → live preview (React portal into iframe)     │
                 │ publish → renderLandingHtml() → page_versions (html, csp, etag)       │
                 │ export  → zip (html + assets + fonts + order.php + host configs)      │
                 └───────────────────────────────────────────────────────────────────────┘
 visitor → GET /{slug} → route handler serves stored HTML (zero React on client, ~15KB runtime)
        → POST /api/public/order → validate, anti-fraud, recompute price → DB → Google Sheets (after())
```

## Key decisions
- **Landing pages are not App Router pages.** They are pure React components rendered to a static HTML
  string with `await import("react-dom/server")` at publish time, stored as an immutable version and
  served by a route handler. Same renderer powers admin preview (client), live, and export.
- **Landing components are pure** (no hooks/context/"use client"). Interactivity = vanilla runtime
  (`src/landing/runtime`) driven by `data-*` attributes (contract below).
- **Landing CSS is hand-authored**, per-section files (`src/landing/sections/<type>/<type>.css`) + `src/landing/styles/base.css`,
  compiled with lightningcss into a generated module; the renderer inlines only the chunks used by the page.
  Tailwind is used ONLY for the admin UI.
- **Theme = tokens.** `src/lib/theme` turns `ThemeSpec` (+ product photo palette) into CSS custom properties
  (see docs/DESIGN.md §2). Sections use `--sec-*` vars so they work on any section background.
- **Media in DB** (MariaDB LONGBLOB) — Hostinger wipes the app dir on every deploy. Served from `/media/<key>`
  with immutable caching + in-memory LRU.
- **Orders → DB first → Google Sheets** via a service account (env `GOOGLE_SA_JSON_B64`). Admin only pastes the sheet link.
- **Security**: secret admin gate path, scrypt passwords, DB sessions, TOTP 2FA, DB-backed rate limits,
  hash-based strict CSP on landing pages, nonce CSP on admin, zod validation everywhere, re-encoded uploads.

## Directory ownership
| Path | Owner | Notes |
|---|---|---|
| `src/lib/page/*` | core | PageDoc schema, pricing, validation |
| `src/lib/orders/contract.ts` | core | public API contract |
| `src/landing/types.ts`, `i18n.ts`, `registry.ts` | core | section contract, microcopy, registry |
| `src/lib/theme/*` | theme | archetypes, color, palette, tokens, fonts, vibe rules, extraction |
| `src/landing/primitives/*`, `src/landing/styles/base.css` | primitives | Picture, Cta, Price, Stars, Badge, Icon, RichText, SectionShell… |
| `src/landing/illustrations/*` | illustration | procedural SVG + dividers |
| `src/landing/runtime/*` | runtime | vanilla TS, built with esbuild |
| `src/landing/sections/<type>/*` | sections | one folder per section type |
| `src/landing/document.tsx`, `src/landing/context.ts`, `src/landing/thankyou/*`, `scripts/build-landing-assets.mjs`, `src/lib/render/*` | renderer | |
| `src/lib/db`, `src/lib/auth`, `src/lib/security`, `src/lib/media`, `src/lib/orders/*` (not contract), `src/lib/sheets`, `src/lib/markets`, `src/app/api/**`, `src/app/media/**`, `src/proxy.ts` | backend | |
| `src/lib/export/*` | export | |
| `src/lib/ai/*` | ai | browser workers + fallback copy library |
| `src/lib/generator/*` | generator | images+info → PageDoc directions, remix |
| `src/lib/editor/*`, `src/components/builder/*`, `src/app/admin/(panel)/pages/[id]/**` | builder | |
| `src/app/admin/**` (other), `src/components/admin/*`, `src/components/ui/*` | admin | shadcn-based |

## Runtime data-attribute contract
Sections/primitives emit these; the runtime implements them. Everything must work (visible, submittable) with JS disabled except the async order POST.

| Attribute | Element | Behavior |
|---|---|---|
| `data-reveal="rise\|fade\|wipe-up\|wipe-side\|mask-arch\|draw\|stamp\|count\|tilt-in\|scale-in\|blur-in"` | any | runtime sets `data-in` once visible. CSS animates. Hidden initial state only under `html.lp-js` |
| `data-delay="ms"` | with data-reveal | transition delay |
| `data-stagger="ms"` | container | children `[data-reveal]` get incremental delays |
| `data-count-to="1234"` `data-count-decimals="0"` | with `data-reveal="count"` | number roll-up; text content holds final value for no-JS |
| `data-parallax="0.08"` | any | subtle translateY on scroll (desktop, motion allowed) |
| `data-action="order"` (+ `data-bundle="<id>"`) | a/button | smooth-scroll to `#order`, preselect bundle, focus first field |
| `data-lp-form` | form#order-form | order form (see below) |
| `data-bundle-card="<id>"` | card | runtime toggles `data-selected` on all cards for the current bundle (form + offer sections) |
| `data-lp-price="current"` | span | text = current bundle total (formatted) — e.g. sticky CTA, hero price |
| `data-countdown="<ISO>"` + children `[data-cd="d\|h\|m\|s"]` | any | live countdown; on expiry sets `data-expired` (hidden if `data-hide-expired`) |
| `data-gallery` / `data-gallery-track` / `data-slide` / `data-thumb="i"` / `data-gallery-prev` / `data-gallery-next` / `data-dot="i"` | gallery | scroll-snap carousel sync |
| `data-compare` + `input[type=range][data-compare-range]` | before/after | sets `--pos` (0–100%) |
| `data-sticky-cta` | fixed bar | `data-visible` when `[data-hero-cta]` is off-screen and form not on screen |
| `data-hero-cta` | hero CTA | reference for sticky |
| `data-marquee` | marquee | pauses (`data-paused`) when off-screen |
| `data-tabs` with `[role=tab][aria-controls]` | tabs | keyboard + click tab switching |
| `data-accordion="single"` | wrapper of `<details>` | only one open |
| `data-autoplay` | video | play when visible, pause when not (muted, playsinline) |

### Order form markup (rendered by `orderForm` section)
```
<form id="order-form" data-lp-form novalidate data-state="idle|sending|error|done">
  [data-lp-bundles]  input[type=radio][name=bundle][value=<id>] inside [data-bundle-card=<id>]
  [data-lp-variants] + <template data-lp-variant-tpl> (runtime clones per unit; {n} → unit number,
                      inputs named v.{i}.{groupId})
  [data-field=name|phone|city|address|note|email]  > input/select[name=…] + [data-error]
  input[name=website].lp-hp (honeypot, visually hidden, tabindex=-1, autocomplete=off)
  input[type=checkbox][name=bump]  (optional order bump)
  [data-lp-sum=subtotal|bump|shipping|total]   (runtime updates text)
  button[type=submit][data-lp-submit]
  [data-lp-status] (aria-live=polite)
</form>
```
On success the runtime stores `{orderId, name, total, bundleLabel, upsellToken, eventId}` in sessionStorage
(`lp-order`) and navigates to `config.thankYouUrl?o=<orderId>`.

### Thank-you page hooks
`[data-ty="name|orderId|total|items"]` filled from sessionStorage; `[data-ty-upsell]` block with
`[data-ty-upsell-accept]`, `[data-ty-upsell-decline]`, `[data-countdown]` window.

### Editor hooks (preview mode only)
`data-sid="<section id>"` on section roots (always), `data-edit="<data path>"` on editable text (preview only, via `editAttr(ctx, path)`).

## Conventions
- TypeScript strict. No `any` in public APIs. Zod for all external input.
- Never run `next build` / `next dev` from sub-tasks — use `npx tsc --noEmit -p .` to typecheck.
- Landing CSS class prefix: `lp-` (BEM-ish: `.lp-hero`, `.lp-hero__title`, `.lp-hero--stage`).
- All public routes must set security headers via `src/lib/security/headers.ts`.
