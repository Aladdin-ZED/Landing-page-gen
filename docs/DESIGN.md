# Design Bible — COD Studio landing kit (v2 · Modern)

Art-direction contract for every landing-page component. **Modern first.** Each generated page must look
like a top 2026 studio designed it for *that* product: contemporary, smooth, premium, confident — never a
template, never "AI output", and **never dated** (no vintage/craft/scrapbook aesthetics).

The product owner's words: *"be modern into the maximum and smooth with every detail and styling; don't be
based on old styles and shapes; high quality, creative, based on each product vibe."*

---

## 1. Non-negotiables

### 1.1 Banned — dated or generic

| Banned | Do instead |
|---|---|
| **Craft / vintage motifs**: paper, kraft, wood, linen or ink textures; washi tape; polaroids; post-its; rubber/ink stamps; torn paper; scalloped, zigzag, stitched or perforated edges; ticket stubs; caution stripes; rivets; stencil type; dashed borders; double-rule frames; ornamental flourishes | Clean surfaces, light, depth and type. Texture only as ultra-subtle film grain on gradients (≤ 3% opacity) |
| Hand-drawn scribbles, doodles, sketchy arrows, wobbly underlines | One clean, smooth vector stroke when a mark is needed (a confident swoosh underline, a precise leader line, a highlight block) |
| Purple→blue / indigo gradients, gradient text, neon glows on everything | Product-derived color. Gradients only as soft light: radial glows and mesh/aurora fields built from the product's own hues, low contrast |
| Everything centered; 3 equal icon cards; `rounded-2xl + gray shadow` everywhere | Asymmetric grids, bento compositions with varied sizes, editorial scale contrast, layered depth |
| Emoji icons, ✨, generic stock-icon look | The custom icon set (clean, consistent stroke) |
| Uniform fade-up-20px on every element | Choreographed, smooth motion (see §6) |
| "Elevate / Unlock / Revolutionize / Game-changer / Seamless" copy | Concrete, sensory, specific copy |
| Fake ratings, fake countdowns, fake "trusted by" logos | Real numbers only, merchant-provided proof |
| Gray-500 body on white, default Inter everywhere | Tinted neutrals from the product hue, characterful modern type pairings |

### 1.2 Required — what "modern & premium" means here
- **Light & depth**: soft multi-layer shadows (large blur, low opacity, tinted by the section color), a 1px inner
  highlight on raised surfaces, product-tinted ambient glow behind the product, spotlight/stage lighting.
- **Shapes**: generous continuous corner radii (cards 20–32px, media 24–40px, pills 999px), clean arches and circles
  as image masks, big rounded section panels ("floating panels" inset from the viewport edge) when the archetype
  allows. No sharp clutter.
- **Materials**: frosted glass (backdrop-filter blur + saturation, translucent fill, inner highlight) for floating chips,
  sticky bars and overlays on imagery — always with an opaque fallback when `backdrop-filter` is unsupported.
  Matte solids elsewhere.
- **Typography**: large, tight, confident display type; fluid scale; real hierarchy jumps; tabular numerals for prices;
  modern Arabic typefaces (geometric/kufi/modern naskh), never old calligraphic display for headlines.
- **Composition**: one clear focal point per section, generous whitespace, an asymmetric grid, scale contrast,
  at least one element that crosses a boundary (product overlapping a panel edge, a card overlapping two sections).
- **Signature moment per section**: one memorable modern detail — a glass spec chip floating over the product, a
  number that ticks up, a line that draws across the grid, a card that lifts with a spring, an image that scales
  into place on scroll, a soft glow that follows selection.
- **Smoothness**: every state change is animated with springs/eases; nothing jumps; 60fps (transform, opacity, filter,
  clip-path only).

---

## 2. Token contract (CSS custom properties)

The theme engine (`src/lib/theme`) writes these on `:root`. Components use ONLY tokens for color, type, radius,
shadow and motion.

### 2.1 Global palette
```
--lp-bg --lp-surface --lp-surface-2 --lp-soft --lp-ink --lp-ink-soft --lp-ink-mute --lp-line --lp-line-strong
--lp-accent --lp-accent-ink --lp-accent-soft --lp-accent-strong --lp-pop --lp-pop-ink --lp-dark --lp-dark-ink
--lp-success --lp-danger --lp-warn   --lp-a-50 … --lp-a-950   --lp-n-50 … --lp-n-950
```
### 2.2 Section-local palette
Every section root has `data-bg="base|soft|surface|accent|dark|pop"`. Inside sections use `--sec-*` only:
```
--sec-bg --sec-ink --sec-ink-soft --sec-line --sec-line-strong --sec-accent --sec-accent-ink
--sec-card --sec-card-ink --sec-chip --sec-chip-ink --sec-success --sec-danger --sec-warn
```
Raw section background colors (dividers/overlaps): base `--lp-bg`, soft `--lp-soft`, surface `--lp-surface`,
accent `--lp-accent`, dark `--lp-dark`, pop `--lp-pop`.

### 2.3 Type
`--lp-font-display --lp-font-body --lp-font-accent --lp-display-weight --lp-display-tracking --lp-display-case
--lp-display-lh --lp-body-lh --lp-step--1 … --lp-step-6` (+ label/emphasis tokens emitted by the engine).
Arabic (enforced under `[lang="ar"]`): no letter-spacing, no uppercase, no italics, no faux bold, line-height ≥ 1.6,
size +6–10%.

### 2.4 Shape, depth, motion, space
`--lp-radius-* --lp-radius-btn --lp-radius-media --lp-border-w --lp-shadow-s/m/l --lp-shadow-product
--lp-shadow-product-filter --lp-ease --lp-ease-out --lp-ease-spring --lp-dur-s/m/l --lp-stagger
--lp-space-section --lp-container --lp-gutter --lp-grain --lp-grain-opacity`

### 2.5 Theme attributes on `<html>` (contract — exact value sets)
The engine emits these; CSS switches on them. Old values (paper, ticket, stamp, scribble, polaroid, halftone…) no longer exist.
```
data-arch      maison | apothecary | souk | playground | kinetic | circuit | hearth | bloom | field | editorial | garage
data-btn       solid | pill | glow | soft | outline | underline
data-card      flat | soft | outlined | raised | glass
data-emphasis  swoosh | highlight | color | italic        (italic → color automatically for Arabic)
data-mask      arch | circle | pill | rounded | blob
data-glyph     dot | spark | diamond | none
data-texture   none | grain                                  (grain = ultra-subtle, only on gradient/dark fields)
data-radius    none | subtle | soft | round
data-shadow    none | soft | deep | glow
data-surfaces  flush | panels                                (panels: sections are large rounded panels inset from the edge)
data-motion    calm | lively | off
data-base      light | tinted | dark      data-density  airy | balanced | dense
```

---

## 3. Archetypes — modern expressions

Each archetype is a *contemporary* design language. Motifs are modern reinterpretations only.

| id | Products | Expression | Type direction (Latin · Arabic) | Shape & depth | Motion |
|---|---|---|---|---|---|
| `maison` | perfume, watches, jewelry | **Quiet luxury.** Deep velvet dark or warm ivory, champagne/oxblood accent, spotlight on product, hairline structure, vast space | Didone/modern serif display (Bodoni Moda, Instrument Serif) + refined grotesk · El Messiri / Reem Kufi + Noto Naskh / IBM Plex Sans Arabic | radius small-to-medium on UI, large arches on media; long soft shadows; glass chips | slow, silky (700–1000ms), blur-to-sharp text, scale-in media |
| `apothecary` | skincare, health, supplements | **Clinical clean.** Soft clay/mint/sage, lab precision, ingredient chips, data | Fraunces/Instrument Sans · Readex Pro / IBM Plex Sans Arabic | radius 16–24, glass panels, crisp hairlines | gentle (450–600ms), counters, line draws |
| `souk` | argan, honey, crafts, traditional wear | **Modern Moroccan.** Warm terracotta/saffron/majorelle from the product, clean arch masks, abstract zellige *line geometry* at very low opacity, sun-warm gradients | Gloock/Figtree · Reem Kufi / Alexandria + Readex Pro | arches, radius 20–28, warm glows | warm, smooth (500–700ms), arch mask reveals |
| `playground` | kids, toys, pets, fun gadgets | **Playful modern.** Vivid color blocks, big rounded shapes, soft clay-3D shadows, crisp vector stickers | Bricolage Grotesque · Baloo Bhaijaan 2 / Marhey | radius 24–40, squishy pills, soft colored shadows | springy (overshoot), bouncy hovers |
| `kinetic` | sport, fitness, massage | **Sport-tech.** Dark, one electric accent, condensed bold uppercase, speed lines as clean gradients, velocity | Big Shoulders Display/Archivo · Changa / Noto Kufi Arabic | radius 8–16, sharp angles + pills, glow accents | fast (200–350ms), expo-out, scroll-velocity marquee |
| `circuit` | tech, gadgets, electronics | **Precision tech (Apple/Nothing).** Black/white, dot grid, mono labels, glass, spec numbers | Schibsted Grotesk + JetBrains Mono · Alexandria / IBM Plex Sans Arabic | radius 16–28, glass layers, thin lines | precise, counters, scan reveals |
| `hearth` | home, kitchen, cleaning | **Soft home.** Warm creams, butter/tomato/olive, pillowy shapes, friendly | Young Serif/DM Sans · El Messiri / Tajawal | radius 24–32, pillowy shadows | warm medium (450ms), gentle lifts |
| `bloom` | beauty, makeup, accessories | **Beauty glow.** Blush/nude/berry, glossy highlights, soft gradients, elegant serif + clean sans | Instrument Serif/Hanken Grotesk · El Messiri / Tajawal | pills & soft blobs, glow halos | soft elegant (550ms), morphs, blur-in |
| `field` | organic food, eco, plants | **Fresh organic.** Greens, natural light gradients, minimal leaf line icons | Young Serif/Figtree · Reem Kufi / Readex Pro | radius 20–28, soft shadows | organic (600ms), grow-in |
| `editorial` | fashion, minimal, general | **Swiss editorial.** Strong grid, huge type, monochrome + one accent, captions | Archivo + IBM Plex Mono · Noto Kufi Arabic / IBM Plex Sans Arabic | radius 0–12 on UI, crisp lines | refined clip/mask reveals |
| `garage` | tools, car, grooming | **Industrial modern.** Dark steel/graphite, amber accent, bold condensed type, precise lines (no tape/stencil/rivets) | Archivo/Big Shoulders Display · Noto Kufi Arabic / Tajawal | radius 8–16, metallic sheen gradients (subtle) | punchy, snappy |

---

## 4. Page rhythm
1. Never two consecutive sections with the same `data-bg` unless separated deliberately (panel inset, overlap).
2. One full-bleed color moment in the top half.
3. One boundary-crossing moment per page (product/card overlapping a panel edge).
4. Order form near the top (hero CTA scrolls to it), mid-page, final. Sticky mobile CTA (glass bar) after the hero CTA leaves the viewport.
5. Density alternates: dense (bento, comparison) → airy (statement, big image).
6. **Transitions between sections are modern**: `none` (space + color change), `curve` (one smooth large curve),
   `diagonal` (subtle clean angle), `steps` (clean offset), `arch` (one smooth arch shape), `wave` (one gentle
   wave). Prefer overlaps and rounded panels over decorative edges. Never torn/zigzag/scallop/stitch/tape/ornament.

## 5. Imagery
- `Picture` only (AVIF/WebP srcset, width/height, hero eager + `fetchpriority=high`, others lazy).
- Masks: `arch`, `circle`, `pill`, `rounded` (24–40px), `blob` (smooth, not wobbly). No polaroid/tape/ticket frames.
- Cutout products sit on a modern stage: soft radial glow + contact shadow + optional rim light; non-cutout photos in
  large rounded/arch media with a soft shadow and optional glass caption chip.

## 6. Motion language (smooth)
- Runtime toggles `data-in` on `[data-reveal]`. Kinds: `rise` (y + opacity, spring), `fade`, `blur-in`
  (blur 12px→0 + opacity), `scale-in` (0.94→1), `mask-arch`/`wipe-up`/`wipe-side` (clip-path), `draw`
  (clean SVG lines), `count`, `tilt-in` (subtle 3D tilt to flat), `stamp` (badge pop with spring).
- Text: headlines reveal by line/word with blur-to-sharp + rise, staggered 40–70ms.
- Media: scale from 1.06→1 inside its mask while the mask opens; subtle parallax on scroll (desktop).
- Interactive: buttons lift + glow on hover, press down (scale .98) with spring; selection states morph (border, ring,
  glow, check badge pop); accordions animate height smoothly (`interpolate-size`/grid-rows trick with fallback).
- Use CSS scroll-driven animations (`animation-timeline: view()`) as progressive enhancement for parallax/progress.
- `prefers-reduced-motion: reduce` → no transforms, instant states.

## 7. Decoration system (`src/landing/illustrations`) — modern
Product-tinted, seeded, crisp vector & light effects: `GlowOrb` / `Aurora` (soft blurred radial/mesh light from
product hues), `Halo` & concentric `Rings`, `Beam` (soft light beam), `GridLines` / `DotGrid` (subtle), `Spotlight`,
`GlassChip` (frosted chip), `Badge` (clean circular badge with rotating text — vector, no ink), `Sparkline`/`LeaderLine`
(precise callout lines), `ZelligeLines` (abstract Moroccan geometry as thin lines at ≤ 6% opacity), `Shape3D` (CSS
sphere/pill/torus with gradient shading), `Arch` mask, `Swoosh` (one clean underline stroke), `SpeedLines` (clean
gradient streaks), `Leaf` (minimal line icon). Never ornamental clutter; decoration supports the product.

## 8. Copy voice
Short, concrete, sensory; numbers > adjectives. Morocco: clear Arabic (MSA with light Darija in CTAs), warm French.
COD reassurance where it matters ("Paiement à la livraison", "Livraison 24–48h", "Vérifiez avant de payer").
No banned words; max one exclamation mark per page.

## 9. Precision & craft checklist (owner's standing rule)
> "Every element built at a high-quality creative level that fits a modern vibe from high-quality designer
> inspiration — not an AI-generated vibe. Every detail built with precision, creative structure and creative
> touches of design detail."

Run this on every section and every page before calling it done:
- **Spacing system** — every gap comes from one scale (tokens / clamp steps). No one-off margins, no doubled
  paddings where a card meets a section edge, consistent inner padding per card size.
- **Grid & alignment** — elements snap to a clear column grid; text baselines and image edges line up across
  columns; optical alignment for icons, quotes and numerals (hang punctuation/quote marks, nudge play icons).
- **Typography details** — balanced headline wraps (no orphans/widows; `text-wrap: balance/pretty`), max line
  length 45–75ch, tabular numerals for prices/counters, correct tracking per size (tighter for big Latin display,
  never for Arabic), consistent weight hierarchy (≤ 3 weights per section), real typographic quotes/dashes.
- **Edges & shapes** — radii nested correctly (inner radius = outer radius − padding), consistent stroke widths,
  crisp 1px hairlines (no blurry half-pixels), shadows tinted by the surface color with a consistent light source.
- **Color precision** — every color from tokens; states (hover/active/selected/focus/disabled) defined for each
  interactive element; contrast checked on every background incl. glass over images.
- **Creative structure** — each section has a deliberate composition (asymmetry, scale contrast, overlap, a focal
  point); nothing that looks like a default template block.
- **Creative touches** — at least one designed micro-detail per section (an animated number, a leader line that
  draws, a glass chip with a live price, a selection morph, a subtle parallax, a hover reveal) — purposeful, not
  decorative noise.
- **States & edge cases** — long Arabic/French text, 1 vs 5 items, missing image, RTL mirroring, 320px and 1440px+,
  reduced motion — all look intentional.
- **Motion precision** — consistent easing family per archetype, durations from tokens, staggers that read as one
  gesture, no layout shift, no jank.

## 10. Accessibility & performance
AA contrast via tokens (glass chips must keep AA over the image — add a scrim). Hit targets ≥ 44px; visible focus
rings. JS ≤ 20KB gz; CSS inlined per used section; `backdrop-filter` with opaque fallback; no layout thrash.
Logical properties only (RTL). Works from 320px. Mobile is the primary canvas.
