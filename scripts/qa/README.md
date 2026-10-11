# Landing QA tooling

Render any fixture page to a standalone HTML file and screenshot it — no dev server, no database.
The HTML comes from the real publish renderer (`src/lib/render/core.ts`), so what you see is what
visitors get (minus network: the runtime runs offline, like the admin preview).

## 1. Render

```bash
npx tsx scripts/qa/render.ts --fixture argan
# → qa/argan.html   (open it in Chrome: fonts and photos are file:/// URLs into public/)
```

| Flag | Meaning |
|---|---|
| `--fixture <name>` | **required** — `argan` (ar · souk), `massage` (fr · kinetic), `blender` (fr · hearth), `parfum` (ar · maison) |
| `--arch <archetype>` | regenerate the theme for another archetype (`maison`, `apothecary`, `souk`, `playground`, `kinetic`, `circuit`, `hearth`, `bloom`, `field`, `editorial`, `garage`) |
| `--locale ar\|fr\|en` | page language (product copy is written in all three) |
| `--seed <n>` | theme seed — new palette pick, fonts pairing, rotations, blobs, dividers |
| `--only <type,…>` | keep only these section types, in page order, e.g. `--only hero,benefits,orderForm` |
| `--variant <type>=<id>,…` | force variants, e.g. `--variant hero=poster,offer=tickets` (unknown ids are rejected with the list of valid ones) |
| `--out <file.html>` | output path (default `qa/<fixture>[-arch][-locale][-sSEED].html`; `qa/` is git-ignored) |
| `--page landing\|merci\|both\|legal\|all` | landing page; thank-you page (`<out>-merci.html`, pre-filled with a sample order); both; the four legal documents (`<out>-privacy.html`, `-terms`, `-shipping`, `-contact`); or everything — the files link to each other |
| `--now <ISO>` | render time (countdowns are set relative to it) — use a fixed value for pixel-stable diffs |
| `--live` | keep scroll reveals and animations (default: everything in its final state, `html.lp-qa`) |

Warnings print the repairs `validateDoc()` made (unknown variant, invalid data replaced by defaults…)
and any section whose render threw (it is left out of the page, exactly as on publish).

Every fixture contains every section type, with each section's own `defaults()` as content, the
archetype's preferred variant, and a color-blocking background layout. Photos: `public/dev-fixtures`
(see `CREDITS.md`).

## 2. Screenshot

```bash
node scripts/qa/shoot.mjs qa/argan.html --out qa/shots --full
node scripts/qa/shoot.mjs qa/argan.html --widths 390,820,1280 --full
# → qa/shots/argan-390.png, qa/shots/argan-1280.png …
```

| Flag | Meaning |
|---|---|
| `--out <dir>` | output folder (default `qa/shots`) |
| `--widths <px,…>` | viewport widths (default `390,1280`; < 768 px = mobile emulation at 2× DPR) |
| `--full` | whole page instead of the first viewport |
| `--wait <ms>` | extra settle time after fonts & images (default 250) |

The shot forces the final state of every reveal (`html.lp-qa` + `data-in` set while parsing, so the
runtime never animates), collapses transitions/animations, loads lazy images and waits for web fonts.
Console errors, page errors and failed requests are printed as `!` lines — treat them as bugs.

First run on a machine: `npx playwright install chromium`. When Playwright's Chromium is missing or
cannot start, the script falls back to the installed Microsoft Edge, then Google Chrome.

## 3. Typical loops

```bash
# one section, every archetype
for a in maison souk kinetic hearth; do
  npx tsx scripts/qa/render.ts --fixture argan --arch $a --only hero --out qa/hero-$a.html
  node scripts/qa/shoot.mjs qa/hero-$a.html --out qa/shots --full
done

# RTL vs LTR of the same page
npx tsx scripts/qa/render.ts --fixture massage --locale ar --out qa/massage-ar.html
npx tsx scripts/qa/render.ts --fixture massage --locale fr --out qa/massage-fr.html
```

## 4. Live dev routes

With `npm run dev`: `/dev/fixture/<name>`, `/dev/fixture/<name>/merci` and
`/dev/fixture/<name>/legal/<privacy|terms|shipping|contact>` serve the same fixtures through the real
route-handler path (headers, CSP). Query: `?locale=fr&arch=bloom&seed=7` (kept on the links between
the documents). They answer 404 in production.

## 5. Regression checks

```bash
npx tsx scripts/qa/render-check.ts    # all fixtures × ar/fr/en × every document: CSP hashes, scripts, dividers, v1 migration
npx tsx scripts/qa/money-parity.ts    # server-rendered vs runtime-updated prices are byte-identical
npx tsx scripts/qa/turnstile-e2e.ts   # Turnstile: lazy load, token sent as "cf", renewal, real CSP
```

All three exit with code 1 on failure (render-check writes no files). The Turnstile check serves the real rendered page with its real CSP
header from a local server and replaces Cloudflare's `api.js` with a mock (no network needed).

## 6. Fixture photos

`npx tsx scripts/qa/fixture-images.ts` re-downloads the source photos (cached in `qa/.fixture-cache`),
rebuilds the WebP renditions in `public/dev-fixtures` and prints the rows embedded in
`src/lib/page/fixtures.ts` (`FIXTURE_ASSETS`) — paste them there if the photos change.
