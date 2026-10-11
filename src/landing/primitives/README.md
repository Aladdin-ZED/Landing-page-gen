# Landing primitives & base stylesheet (v2 · Modern)

The shared kit every section is built from: `src/landing/primitives/*` (pure React components and
helpers) + `src/landing/styles/base.css` (inlined on every landing and thank-you page, before the section
chunks). Art direction: `docs/DESIGN.md` (v2 · Modern) — light & depth, glass, generous radii, smooth
springs; no paper, ink, tape, stamps, dashed/double rules or hand-drawn strokes.

Import everything from `@/landing/primitives`.

## Rules the kit follows (and sections should too)

- **Pure**: props in → JSX out. No hooks, context, `"use client"`, browser globals, `Date` or
  `Math.random` — variation comes from `ctx.rng(key)`, time from `ctx.now`. Same props → byte-identical markup.
- **Styles through tokens only** (`--lp-*`, `--sec-*`), switched by the theme attributes on `<html>`
  (DESIGN.md §2.5). Inline `style` carries custom properties only, via `cssVars()`.
- **RTL**: logical properties everywhere; `--lp-x` is `1` (LTR) / `-1` (RTL) for physical nudges;
  directional icons mirror with `.lp-flip-rtl`. Numeric expressions inside text are isolated in
  `<bdi dir="ltr">` by `RichText` (`24–48`, `−30%`, `+212`, `10:30`, `06 12 34 56 78`).
- **Cascade**: every kit rule is wrapped in `:where()` (zero specificity) — any section class wins.
  No `@layer` (Chrome < 99 / Safari < 15.4 / Samsung 14 would drop it). Samsung Internet 14 (no
  `:where()`) gets the plain fallback block at the top of base.css.
- **Browser floor**: Chrome 90, Safari 14, Firefox 90, Samsung 14. Modern features (glass blur,
  `color-mix`, `linear()` springs, `:has()`, individual transforms) are progressive with fallbacks.
- **No orange, ever** (owner rule, 2026-10-10): no UI color may sit at OKLCH hue 25°–75° with chroma
  above 0.06 (red-orange, coral, terracotta, orange, amber, saffron, ochre). Low-chroma warm neutrals
  (sand, beige, taupe), crimson/berry (< 25°) and yellows (> 75°) are fine. The kit holds no color
  literal of its own beyond white/black light & shade inside mixes, sheens and masks.
  **Mixes count too**: two clean colors on opposite sides of the band (crimson × butter, gold × rose)
  blend through orange. So the kit never mixes a hued color into the raw section ground: tints mix
  into `--mx-ground` (the ground drained of color, same lightness — the result keeps the mixed
  color's own hue exactly), color blocks (`accent`/`pop`) mix tone on tone (their ink into
  themselves), and the rare blend of two real colors (fade divider, highlighter on a color block) is
  capped with `oklch(from <mix> l var(--mx-safe) h)` — a sand wherever its hue would fall in the band.
  Section CSS: mix toward `--mx-ground` / white / black, never `var(--sec-bg)` with an accent or pop.

## Theme attributes the kit switches on

| attribute | values | what changes |
|---|---|---|
| `data-btn` | `solid · pill · glow · soft · outline · underline` | button shape & light (pill: arrow in a disc; glow: accent glow always on; soft: clay edge; outline: accent ring that fills on hover; underline: crisp block whose label underline draws in). Every style keeps a corner floor of ¼ of the button height (never a boxy slab, even at `--lp-radius-btn: 0`), a 1px edge a shade deeper than the fill, and an ink wash on hover/press |
| `data-card` | `flat · soft · outlined · raised · glass` | `.lp-card` surface |
| `data-emphasis` | `swoosh · highlight · color · italic` | `*emphasis*` treatment (italic → color on Arabic pages, by the theme) |
| `data-mask` | `arch · circle · pill · rounded · blob` | `.lp-mask` / `<Picture mask="page">` |
| `data-glyph` | `dot · spark · diamond · none` | the archetype glyph (`Ornament`, kicker dot; hidden in kickers on `none`) |
| `data-texture` | `none · grain` | grain finish on dark / accent / pop / `.lp-aurora` sections only (≤ 3%) |
| `data-shadow` | `none · soft · deep · glow` | via the theme's `--lp-shadow-*` tokens; `none` removes button drops |
| `data-surfaces` | `flush · panels` | panels: sections in the page body become rounded panels inset from the viewport edge |
| `data-motion` | `calm · lively · off` | durations; `lively` adds idle loops (stage float, bead orbit, blob morph); `off` = no reveals |
| `data-radius`, `data-base`, `data-density`, `data-arch` | | radius scale, dark-page tuning, per-archetype voice (kicker look, title measure) |

## Shape system (base.css §2b)

Every kit shape is drawn from one set of rules, so corners, edges and nesting stay consistent:

- **Continuous corners.** Rounded rectangles (cards, buttons, fields, rounded media, stage sets, glass
  mats, countdown tiles, section panels) draw a superellipse corner (`corner-shape: squircle`) where the
  engine supports it together with `if()` (Chromium 139+), the theme's circular corner elsewhere. The
  squircle radius is the theme radius × `--lp-corner-k` (1.6): the same perceived roundness, with a
  curvature that grows out of the straight edge instead of starting abruptly. Pills (999px), circles,
  discs (50%), arch heads and blobs always stay circular. A field whose theme radius is ≥ 18px (nearly a
  capsule) keeps its circular corner too.
- **Tokens.** `--lp-sq-xs|s|m|l|xl|media|panel` = the theme radii, pre-scaled for continuous corners —
  use them **with** `corner-shape: var(--lp-corner)` (or add the `.lp-sq` utility). `--lp-corner`
  (`round` | `squircle`), `--lp-corner-k` (1 | 1.6), `--lp-corner-d` (1 | 1.84) are read-only.
- **Radius knobs stay circular.** The theme's `--lp-radius-*` tokens and `--btn-radius` (registered as
  `<length-percentage>`) are circular radii: the kit converts them where it draws a squircle, so a
  section that computes a concentric radius from them (`calc(var(--btn-radius) - var(--inset))`) stays
  right. Set `--btn-radius: 999px` / `50%` for a capsule / disc button.
- **Concentric nesting.** An inner corner set `gap` inside an outer one takes
  `outer − gap × var(--lp-corner-d)` (1 for circles; 1.84 for squircles, whose curve sits closer to the
  box corner). The kit applies it to the button's price chip, the phone field's country chip and the
  stage's glass mat; cards publish `--lp-inner-r` (card radius − padding) for their content — give a
  card's photo or inner panel the `.lp-nest` class.
- **Device hairlines.** `--lp-hairline` is one device pixel on 2× screens (0.5px) and 1px elsewhere; its
  color `--mx-edge` steps up a little on the thinner line. Used for glass edges, chip/kicker outlines,
  stage rims and halo rings (structure lines and ≥ 3:1 field boundaries stay 1px).
- **Media edge.** A masked photo (`.lp-mask*` other than the arch, not a cutout or `contain`) carries a
  one-hairline inner edge (`--mx-media-edge`, ink-tinted: a crisp silhouette on pale grounds, a rim
  light on dark ones). Photo stages carry it too.
- **Inner keyline** (opt-in): add `.lp-keyline` to a masked Picture for a hairline drawn just inside the
  shape, concentric with it (arch, rounded, circle, pill, blob). `--kl-d` sets the offset (default ≈
  3.4% of the width, 8–14px), `--kl-c` the color (a light line over the photo). The Picture becomes an
  inline-size container: its width must come from its parent (a block or a stretched grid/flex item).
  Maison and souk photo stages with an arch window draw this keyline by default.

## Helpers (`util.ts`)

- `cx(...classes)` · `editAttr(ctx, path)` (preview click-to-edit hook) · `joinPath(base, key)`
- `cssVars({ "--rot": "2deg" })` — the ONLY way to emit inline styles; names & values validated
  (no `;`, quotes, `url()`, backslashes, unbalanced parens).
- `reveal(kind, delayMs?)` → `{ "data-reveal", "data-delay" }` · `REVEAL_KINDS`:
  `rise fade wipe-up wipe-side mask-arch draw stamp count tilt-in scale-in blur-in`
- `seededRotation(ctx, key, scale?)` — degrees inside the archetype's tilt range (`ROTATION_RANGE`,
  read from `ARCHETYPE_DEFS[a].tilt`; straight archetypes return 0).
- `safeHex`, `safePosition`, `safeRatio`, `round`, `clamp`, `pad2`
- `brandName(ctx)` — the name to show as a brand (wordmark, `<title>`, og:site_name, favicon monogram):
  the store name, or the product name (≤ 32 chars, word boundary) while the store name is still the
  settings placeholder ("My store", "Ma boutique", "متجري"…). `isPlaceholderStoreName(name)`.

## Text

### `RichText({ text, ctx, as?, block?, className?, editPath?, id?, reveal?, delay?, decorate?=true, split? })`
Safe tiny markup: `*emphasis*`, `**strong**`, `***both***`, `\*`; block mode adds paragraphs, line
breaks and `- ` bullets (`ul.lp-rt__list`). Never `dangerouslySetInnerHTML`.
- `*emphasis*` → `<em class="lp-em" data-reveal="draw">` of word boxes (`.lp-em__w`). Per
  `data-emphasis`: **swoosh** — one clean stroke under the whole emphasis (an SVG slice per word,
  drawn on in sequence); **highlight** — a soft tinted wash under the lower half of the words, pill
  ends, one continuous band across the spaces, wiping in along the reading direction (`--em-hl` =
  `--mx-hl`: `--sec-highlight` mixed ~¼ toward the drained section ground — never a neon marker, and a
  pink highlighter on a cream page stays pink, never peach; long emphasis draws
  the same rounded band per line fragment); **color** — `--sec-accent` (ink + accent underline in running
  text); **italic** — `--lp-font-emphasis` / `--lp-emphasis-style`. Under tight display leading
  (kinetic 0.9) the swoosh climbs toward the baseline and slims and the highlight block is trimmed,
  so neither touches the next line: the display/heading classes pass their leading as `--em-lh`
  (a section title with its own `line-height` sets `--em-lh` to match). Color emphasis is
  underlined in running text only (never inside headings).
- Long emphasis (> 6 words / 48 chars) and `decorate={false}` use CSS-only `.lp-em--plain`.
  Inside buttons emphasis is neutralised.
- Stroke ends: `.lp-em__w--s` / `.lp-em__w--e` mark the words where the stroke starts and ends
  (overhangs, pill caps). Use them instead of `:first-child` / `:last-child`, which differ from the
  stroke order across a bidi run.
- **Bidi**: word boxes are inline-blocks, which bidi treats as neutral objects — a Latin run on an
  Arabic page (or the reverse) would read in reverse word order. RichText isolates every run written
  against the page direction: an emphasis made only of such a run gets `dir` itself
  (`<em class="lp-em" dir="ltr">`, stroke and wash drawn left to right, Latin stroke height); inside a
  mixed emphasis the run is `<bdi class="lp-em__run" dir="ltr">` and the stroke keeps flowing with
  the page (its slices are dealt in visual order); in a `split` heading the run's `.lp-word` boxes sit
  in a `<bdi dir="ltr">`. Digits right after a Latin word stay with it ("Abaya 2 en 1").
- `split` (inline mode) wraps each word in `.lp-word` (`--wi` index) and marks the element
  `.lp-split`: its reveal then cascades word by word (blur-to-sharp / rise / wipe, 55 ms apart).
- `parseInline`, `parseBlocks`, `inlineText`, `plainText(src)` (markup stripped — alt text, aria, meta).

### `SectionHeader({ ctx, kicker?, title, lead?, align?: "start"|"center"|"split", number?, editBase?, titleAs?="h2", size?: "m"|"l"|"xl", titleId?, titleReveal?, titleSplit?=true, kickerLook?, animate?=true, rule?, className?, children? })`
Meta row (tabular `number` · slim divider · kicker), big balanced title (`lp-h2`/`lp-h1`/`lp-display-3`,
`text-wrap: balance`, ~17ch measure), lead at ≤ 36rem in `--sec-ink-soft`, `children` under the lead.
Edit paths `${editBase}.kicker|title|lead`. `TITLE_REVEAL[archetype]` is the default title entrance.
**Hero / LCP heading: pass `animate={false}`** (never hidden).

### `Kicker({ ctx, text, ornament?, look?: "auto"|"pill"|"label", as?, className?, editPath?, reveal?, delay? })`
Glyph + small label. `auto`: soft tinted pill, bare label for maison / kinetic / editorial / garage.
`ornament` defaults to `ctx.ornament > 0`. · `Eyebrow({ ctx, text, number?, … })`: `01 ── Label`.

### `Ornament({ ctx, kind?, size?="0.75em", className? })`
The archetype glyph (`dot · spark · diamond`) or an explicit clean glyph (`ORNAMENT_KINDS`:
`dot spark diamond asterisk star8 bolt flower burst crosshair sprig square hex ring plus`).
Auto glyphs carry `data-auto`. `ORNAMENT_BY_ARCHETYPE`, `ORNAMENTS`.

## Media

### `Picture({ asset, sizes, priority?, className?, imgClassName?, alt?, fit?: "cover"|"contain", ratio?, position?, mask? })`
AVIF/WebP `<picture>`, intrinsic size (no CLS), lazy unless `priority` (eager + `fetchpriority=high`),
dominant-color placeholder; a missing asset renders a calm tinted block. `mask`:
`"page"` (theme mask) · `"arch" | "circle" | "pill" | "rounded" | "blob"` (= classes `.lp-mask`,
`.lp-mask-*`). The arch is a true half-circle at any aspect ratio (Roman arch) with continuous feet;
rounded media use continuous corners; blob takes `--blob` radii. Masked photos get the media edge, and
`className="lp-keyline"` adds the inner keyline (Shape system above).

**Subject-aware crops** (`frame?, frameLg?, frameMin?="64rem"`). Every image is analysed at upload
(`src/lib/media/focus.ts`: focal point, subject box, heads, hands, a product's footprint), and the
resolved asset carries it (`asset.focal / subject / keep / subjectKind / aspect / foot`).
- Default (no frame): `asset.position` — one subject-aware object-position that keeps heads, hands and
  a product's top inside every usual frame ratio and mask (merchant `fx/fy` → exactly `fx% fy%`).
- `frame="arch" | "circle" | "rounded" | "pill" | "blob" | "rect" | "square" | "portrait" | "landscape" |
  "tall" | "wide" | "thumb"` or `{ shape?, ratio?, tight?, maxZoom? }` fits that exact frame: the mask's
  safe area (an arch loses its top corners, a circle all four), heads never touch an edge, hands are
  never sliced, balanced headroom, a product rests on the optical centre and never loses its top; a
  small subject may zoom (≤ 1.18, `tight` ≤ 1.7). A `mask` prop with a `ratio` fits that mask too.
- Thumbnails (`ratio` + `sizes` ≤ 8rem) frame tightly by default: a product fills the box, a person
  becomes a head-and-shoulders bust.
- `frameLg` = art direction (e.g. `frame="portrait" frameLg="landscape"`): `--pic-pos` switches at
  `frameMin` in pure CSS (a viewport `clamp()`), no extra stylesheet.
- Zoom is written as `--pic-zoom` + `--pic-org` (scale and its origin, consumed by base.css); the
  position alone is already safe where the zoom is ignored (the plain window contains the zoomed one).
- Overlays on a fitted photo: `pictureCrop(asset, props)` (the crop Picture applies),
  `frameRegions(asset, frameRatio, crop)` (heads / hands / subject in frame fractions) and
  `quietCorner(asset, frameRatio, { crop, chip, dir })` (the logical corner where a chip covers no face).

### `ProductStage({ ctx, stage, asset?, priority?, size?: "s"|"m"|"l", sizes?, ratio?="4/5", alt?, seedKey?, animate?=true, float?=true, rings?, className?, children? })`
`STAGES`: `arch · halo · slab · blob · podium · frame · none`. Cutouts (`asset.alpha`) stand on a lit
set: ambient glow in the product hue (`--lp-stage-glow`), a top-lit backdrop with a 1px rim, a floor
pool, a contact shadow sized to the footprint (`--lp-shadow-product` + `--lp-shadow-product-filter`),
a gentle float on lively pages; products taller than their backdrop break out over its top. `halo`
adds concentric rings with an orbiting bead (`rings` adds them to any stage); `slab` tilts within
the archetype range; `blob` morphs slowly; `podium` stands on a lit cylinder (niche backdrop for soft
archetypes); `frame` is a frosted glass panel. Regular photos become large masked media with a soft
shadow (arch window, centered circle + rings, tilted slab, blob, glass mat), each fitted subject-first
to its exact window (`PHOTO_WINDOW`: mask + aspect per stage, mirrored from base.css §12). A cutout's
contact shadow follows its measured footprint (`asset.foot`: a gun on its narrow handle, a jar on its
full base).
`children` → `.lp-stage__over` (give children absolute positions). The over layer is not a
stacking context: its children layer inside the stage's own — `z-index: 1` by default (above the
product), while a child at `z-index: -1` (a giant word) slides between the set (`-2`) and the
product. `priority` = hero: eager image, product never hidden by a reveal.
`resolveProductVisual(ctx, asset?)` → `{ asset, kind: "cutout"|"photo"|"empty" }`.

## Commerce

### `Cta({ ctx, label?, variant?: "primary"|"secondary"|"ghost"|"glass", size?: "m"|"l"|"xl", bundleId?, withPrice?, hero?, icon?="arrow-right"|false, wide?, sub?, className?, editPath?, subEditPath? })`
Always `<a href="#order" data-action="order">` (+ `data-bundle`, `data-hero-cta`). Heights 48 / 56 / 64px,
corner radius ≥ 12 / 14 / 16px whatever the theme's button radius (a continuous corner on rounded
buttons; pills and discs stay circular). Latin labels are centered on their capitals (`text-box` trim);
a trailing arrow gets a slightly smaller end padding (optical); the price chip's corner is concentric.
`withPrice` adds a tabular price pill (live `data-lp-price="current"` without `bundleId`). `wide` =
full width under 40rem, laid out like a checkout bar. `glass` = frosted, for buttons over photos.
`LinkButton({ ctx, href, label, variant?, size?, icon?, … })` for non-order links (`safeHref`: `#anchor`,
`https:`, `tel:`, `mailto:` only). Knobs: `--btn-bg --btn-ink --btn-line --btn-h --btn-px --btn-fs --btn-radius`.

### `Price({ ctx, amount, compareAt?, size?: "s"|"m"|"l"|"xl", showSavings?, live?, from?, animate?=true, className? })`
Big tabular numerals in the display face, small currency, raised cents; the real reference price
struck by a crisp diagonal hairline that draws on (`data-reveal="draw"`); savings as an accent pill
(`offers.showSavings`). `live` follows the selected bundle and never shows a stale reference.
`Money({ ctx, amount })` (typographic amount, text identical to `ctx.money()`), `moneyParts`,
`savingsOf`, `savingsLabel`.

### Labels
- `Badge({ ctx, text, tone?="ink", icon? })` — small label pill (label face, tracked caps in Latin).
- `Chip({ ctx, text, tone?="chip", icon?, size?: "s"|"m" })` — crisp capsule with an accent icon.
- `Sticker({ ctx, text, tone?="pop", shape?="pill", size?, rotateKey?, tilt?=1, icon?, reveal?, delay? })` —
  a clean pill (`pill`, `label`) or disc (`circle`; legacy `burst`/`scallop` render as the disc) with a
  lifted shadow and a slight seeded tilt. `reveal="stamp"` = springy pop.
- `Tone`: `accent pop ink dark soft card paper(=card) chip sec success warn danger glass`. Solid tones swap
  on their own block (pop on pop, dark on dark); status tones keep AA (status ink + hairline).

### `Stars({ ctx, value, count?, size?, showValue?, showCount?, kind? })`
Real ratings only; archetype star shape (`STAR_BY_ARCHETYPE`); fractional fill clipped (RTL aware);
`role="img"` with a sentence label. Knobs `--star-on --star-off`.

### `TrustRow({ ctx, items?, layout?: "inline"|"grid"|"stack", size?, stagger?=70, itemReveal? })`
COD reassurances with icons in soft tinted discs; `defaultTrustItems(ctx)`.

### `Counter({ ctx, to, decimals?, prefix?, suffix?, delay? })`
Rolls up on reveal (`data-reveal="count"`); text already holds the final value. Symbolic affixes
(`+`, `%`) stay with the number in an LTR isolate; word affixes follow the page direction.

### `Countdown({ ctx, end, compact?, label?, hideExpired?=true })`
Real end date only (ISO with zone). Soft tiles with big tabular digits; LTR digits in every language;
nothing rendered once expired. `compact` = one inline line in the HOST's face and weight, each figure
pair in a fixed 2ch box and each colon in a fixed slot (no jitter without tabular figures); on RTL
pages the days group leads the reading order ("٢ أيام 14:33:05" read from the right — enforced in
base.css §17, tune the gap with `--cd-gap`), and it is hidden once less than a day is left. The day
label carries its plural forms (`data-cd-label="d"` + `data-forms`), so the runtime re-picks it as
days pass. `isoToMs(iso)` — pure ISO → epoch ms.

## Layout & motion

- `Container({ size?: "narrow"|"normal"|"wide"|"bleed", as? })`
- `SectionShell({ id, ctx, type, variant, bg, space?, anchor?, labelledBy?, label?, as?, className? })` —
  in-flow section root (`.lp-section.lp-{type}.lp-{type}--{variant}`, `data-bg`, `data-space`). Return it
  as the section's ROOT (the renderer absorbs it). Not for floating sections.
  Classes: `.lp-section--flush` (no panel even on `panels` pages), `.lp-section--bleed` (panel without
  clipping, for content crossing the panel edge), `.lp-aurora` (product-hue light field).
- `MarqueeTrack({ ctx, items, speed?, reverse?, separator?, fade?, minItems? })` — seamless loop
  (`data-marquee`, paused off-screen/hover/focus); string items go through `RichText`.
- `SkipLink({ ctx, target?="main", label? })` — "Skip to content" (ar/fr/en), out of sight until
  focused. The page body, thank-you and legal documents render it first; their `<main id="main">`
  carries `tabIndex={-1}` so focus lands there.

## Icons
`Icon({ name, size?=24, className?, label?, strokeWidth?=1.75 })` — 57 custom icons (`ICONS`, `ICON_NAMES`,
`isIconName`); decorative unless `label`. Directional icons mirror in RTL.

## Form (orderForm)
- `FieldShell({ ctx, field, label, htmlFor?, hint?, optional?, float?, className?, editPath?, children })`
  → `[data-field]` + label + hint + live error line `p[data-error]` (`lp-f-{name}-err`).
  `float`: floating label (engines with `:has()`; stacked elsewhere) — give the control a placeholder.
- `Input`, `PhoneInput({ ctx, name?="phone" })` (always LTR, country chip `MA +212`), `Select` (native,
  custom chevron), `Textarea`, `Radio`, `Checkbox` (bare control without `label`, for bundle cards),
  `Honeypot()`, `fieldIds(name)`, `describedBy(name, withHint?)`.
- Look: 56px filled fields (`--mx-field`), `--sec-line-strong` boundary, accent focus glow, errors in
  `--sec-danger` (runtime sets `aria-invalid` / `data-invalid` and the `[data-error]` text), checked
  controls in `--sec-accent` with a `--sec-accent-ink` mark. `.lp-form--line` on the form = hairline fields.
  Knobs: `--f-bg --f-ink --f-line --f-ring --f-h`.

## CSS classes for section authors
- Type: `.lp-display-1..4 .lp-h1..h4 .lp-lead .lp-body .lp-small .lp-label` (= `.lp-mono-label`)
  `.lp-hand` (an aside in the emphasis face) `.lp-num .lp-measure .lp-strong .lp-nobr`
- Surfaces: `.lp-card` (+ `--flat --soft --outlined --raised --glass` — a modifier always wins over the
  page's `data-card`; `.lp-card--lift`; `--lp-inner-r` + `.lp-nest` for concentric content), `.lp-glass`,
  `.lp-aurora`, `.lp-grain` (grain finish on any positioned box)
- Masks: `.lp-mask .lp-mask-arch -circle -pill -rounded -blob -tilt` (legacy `-rect -polaroid -ticket
  -stamp` = rounded), `.lp-keyline` (inner keyline)
- Shapes: `.lp-sq` (continuous corner at the element's own radius — give it a `--lp-sq-*` radius),
  `.lp-nest` (concentric inside a card), tokens `--lp-sq-* --lp-corner --lp-corner-k --lp-corner-d
  --lp-hairline` (Shape system)
- Utilities: `.lp-cq` (container queries) `.lp-flip-rtl .lp-spin .lp-rule .lp-visually-hidden .lp-hp`
- Derived section colors (read-only, color-mix with fallbacks): `--mx-hair --mx-line --mx-tint
  --mx-tint-2 --mx-field --mx-stage(-hi/-lo) --mx-hl` (highlighter wash) `--mx-edge` (hairline edge)
  `--mx-media-edge` (masked photo edge) — all orange-safe (see "No
  orange"); helpers `--mx-ground` (the drained ground to mix into; the block itself on color
  blocks) and `--mx-safe` (chroma cap for `oklch(from … l var(--mx-safe) h)`). Both exist only where
  relative colors are supported: write `var(--mx-ground, var(--sec-bg))`.
- Stacking scale (use instead of ad-hoc numbers): `--lp-z-under` (−1) `--lp-z-raised` (1)
  `--lp-z-overlay` (2) `--lp-z-header` (40) `--lp-z-sticky` (80) `--lp-z-float` (85) `--lp-z-toast` (90)
  `--lp-z-skip` (100)
- Interface feedback durations: `--lp-ui-s` (200ms) / `--lp-ui-m` (280ms) for hover, press, focus and
  selection states on every archetype (0 under `data-motion="off"`); reveals keep `--lp-dur-*`.
- Global text rules: running text (`p li dd figcaption blockquote`) wraps `pretty`, headings
  `balance`; live figures (`[data-lp-price] [data-lp-sum] [data-count-to] [data-cd] .lp-money time`)
  are tabular. French copy through `RichText` gets narrow no-break spaces before `! ? ; : »` and
  typographic apostrophes (Latin pages).
- Sections: optical rhythm — the bottom padding is 8% larger than the top.

## Reveal system (base.css §19)
The runtime adds `html.lp-js`, sets `data-in` when an element is visible and writes `--d` (delay).
Hidden states exist only under `html.lp-js`, with motion allowed — no JS, reduced motion or
`data-motion="off"` = everything visible. Entrances are keyframes with `backwards` fill (they never
clobber a section's own transforms/clip-paths). `draw` never hides its element (strokes `.lp-draw` +
`pathLength="1"` start undrawn; the swoosh, highlight and price strike follow it); `stamp` owns its
pre-state. **Failsafe**: if `lp-js` is set but the runtime shows no sign of life after 2.5 s
(`html[data-rv]` — set by the runtime as soon as its reveal observer is bound — any `[data-in]`, or
a selected bundle card), everything fades in by itself (engines with `:has()`). Never put a reveal
on the LCP element.

Motion tokens: `--lp-spring` (settle) and `--lp-spring-pop` (overshoot: pops, radio dots) wrap the
theme's `linear()` springs with a cubic fallback. Never use `var(--lp-pop)` as an easing — that name
is the theme's pop COLOR, and an animation shorthand holding a color is dropped whole.
