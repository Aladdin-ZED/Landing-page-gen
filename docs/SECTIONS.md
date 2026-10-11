# Section catalog & art direction (v2 · Modern)

Variant ids are a contract (generator, archetype preferences, saved pages) — they keep their names even where the
look was modernized (e.g. `scrapbook` is now a modern layered collage, `tickets` are wallet-style passes).
Every variant is a distinct **modern** composition with one signature moment (DESIGN.md §1.2). Copy fields
support `*emphasis*` (clean modern treatment: accent color, highlight block, clean swoosh underline, or italic
serif for Latin) and `**strong**`.

Honesty rule: reviews, chats, stats, before/after are merchant-provided → defaults carry `sample: true`.

## top
### `announcement` (singleton)
- `ticker` — smooth infinite marquee of 3–5 short items separated by small accent dots/shapes; pauses on hover.
- `static` — one crisp line: icon + text + optional live countdown pill (real end date only).
- `split` — two items pinned start/end (COD | delivery) on a subtle glass bar.

### `header` (singleton)
- `minimal` — wordmark start, compact pill CTA end; becomes a floating glass bar after scroll.
- `centered` — centered wordmark, slim, airy; glass on scroll.
- `none`

## hero
- `stage` — cutout product on a lit stage (radial glow + contact shadow + rim light) with a huge low-contrast display word behind, 2–3 frosted glass chips floating around the product with precise leader lines; subtle float/parallax.
- `editorial` — modern magazine: oversized headline with one emphasized word, clean grid, large arch/rounded media, minimal caption, generous whitespace.
- `poster` — full-bleed color field, gigantic tight type as graphic, product overlapping the type, a clean rotating circular badge (vector), bold price block.
- `scrapbook` → **modern collage** — 2–3 layered rounded media cards at slight rotations (≤ 3°) with real depth, glass chips and crisp vector stickers; NO tape, polaroids or doodles.
- `spec` — precision tech hero: dark, thin grid, product centered with glass callouts + leader lines, numbers ticking up.
- `split` — premium PDP: rounded media gallery (main + thumbs) | title, rating, price, pill bundle chips (data-action="order" data-bundle), CTA, trust list.

## proof
### `trustBar`
- `chips` — glass/soft chips with custom icons; horizontal snap on mobile.
- `stamps` → **badges** — clean circular badges with rotating text (vector), gentle spin.
- `ledger` — hairline-divided columns, big icons, small labels (Latin small-caps feel).
- `ribbon` — a solid accent band (slight tilt allowed) with items, clean type.

### `marquee`
- `tape` → **bold strip** — solid color band, large bold type, dot/shape separators, smooth speed.
- `outline` — giant outlined display text scrolling slowly.
- `double` — two rows opposite directions, filled + outlined.

### `reviews`
- `wall` — bento/masonry of clean review cards (rounded, soft shadow), photo thumbnails in rounded frames, stars, verified pill.
- `carousel` — one large quote at a time, big quote mark, avatar initials, snap.
- `summary` — rating number + distribution bars + top reviews.
- `notes` → **stack** — swipeable stacked cards with depth (top card slightly rotated), smooth.

### `socialProof`
- `whatsapp` — recreated WhatsApp chats in modern phone frames (bubbles, ticks, time, photo messages), staggered.
- `ugc` — 9:16 story frames grid with progress bars, name · city, rounded.
- `counter` — big real order counter + city chips marquee.

### `stats`
- `big-numbers` — huge numerals counting up, captions, source footnote.
- `rings` — circular progress rings drawing on reveal.
- `ticker` — numbers in a smooth scrolling strip.

### `beforeAfter`
- `slider` — draggable compare with a glass handle.
- `cards` — two rounded cards with "Avant/Après" pills.
- `timeline` — Day 1 / 7 / 30 media on a progress line.

## story / product
### `problem`
- `crossed` — pain list with a clean animated strike-through line, then the solution line in accent.
- `chat` — pains as customer chat bubbles, brand reply bubble.
- `split` — "Sans" desaturated panel vs "Avec" vivid panel with a smooth divider.
- `quote` — one huge statement with a highlight block on the key words.

### `benefits`
- `numbered` — editorial numbered list (big numerals, hairlines), alternating media.
- `bento` — asymmetric bento of tiles with mixed media (image, big number, icon, quote), soft depth.
- `zigzag` — alternating media/text rows, large rounded media, floating glass chip on each image.
- `icons` — compact 2×2 custom-icon list.
- `stack` — sticky stacking cards on scroll with scale-down of the cards behind.

### `showcase`
- `hotspots` — product image with pulsing dots + precise leader lines to glass callouts; mobile: dots + list.
- `exploded` — product center, 4 callouts in corners linked by smooth curved lines.
- `ingredients` — ingredient/material cards with minimal line icons, origin & % labels.
- `dimensions` — clean measurement lines around the product.

### `steps`
- `timeline` — vertical line drawing on scroll, numbered nodes.
- `cards` — 3 cards with giant numerals overlapping the card edge.
- `illustrated` — rounded/arch media per step, smooth curved connector lines.
- `strip` — horizontal snap strip on mobile, grid on desktop.

### `story`
- `letter` → **founder note** — modern quote card with portrait/brand mark and signature line.
- `image-text` — large media with an overlapping text card.
- `manifesto` — big statement; words highlight progressively on scroll.

### `gallery`
- `carousel` — snap carousel + thumbs + "02 / 06" counter.
- `masonry` → **bento** — asymmetric rounded grid.
- `filmstrip` — horizontal scroller where the centered item scales up.
- `lookbook` — 1 large + 2 small, captions.

### `video`
- `framed` — video in a large rounded/arch frame, glass play button.
- `phone` — vertical UGC video in a modern phone frame with overlays.
- `fullbleed` — wide video with overlay headline.

### `comparison`
- `table` — us vs them with clean check/cross icons, our column raised with glow.
- `versus` — two cards split by a "VS" disc.
- `checklist` — ours checked vs alternatives struck.

### `specs`
- `sheet` — clean spec rows with leader dots or hairlines.
- `tabs` — pill tabs: Description / Utilisation / Composition / Livraison.
- `accordion` — smooth expanding groups.
- `label` → **spec card** — product-label inspired card, modern (no vintage label styling).

## offer / conversion
### `offer`
- `stacked` — bundle cards with the product image visually stacked ×qty; choose → scroll to form with bundle preselected.
- `tickets` → **passes** — Apple-Wallet-style passes (rounded, header band, big quantity, price block).
- `shelf` — packs standing on a lit podium, sized by quantity.

### `urgency`
- `countdown` — big digits in glass tiles (real end date; hides after).
- `stock` — progress bar of real stock.
- `banner` — slim band: countdown pill + CTA.

### `guarantee`
- `seal` → **badge** — big clean rotating badge (vector) + explanation card.
- `split` — 3 promises with custom icons.
- `letter` → **promise card** — short promise + signature line.

### `orderForm` (singleton, required) — `id="order"`
- `card` — elevated rounded card: title, bundle picker (offers.cardStyle), fields, summary, submit, reassurance.
- `split` — desktop: sticky product summary panel | form.
- `minimal` — no card, hairline fields, airy.
- `bold` — accent panel, big inputs, soft colored shadows.

Bundle card styles (offers.cardStyle): `stack` (stacked selectable cards), `tiers` (columns, middle raised with
glow), `ticket` → **pass** (wallet-pass style, no perforations), `pills` (compact segmented), `visual` (product
image ×qty). Each card: quantity, title, total, real struck reference, per-unit, savings pill, badges (popular/best
as a floating pill on the top edge), free shipping, gift with thumbnail. Selected state: accent ring + soft glow +
check badge pop, animated smoothly; fully accessible radio semantics.

### `cta`
- `banner` — color panel, product overflowing the panel edge, headline + CTA.
- `stamp` → **badge CTA** — centered CTA with a clean rotating text badge around it.
- `poster` — giant type + CTA on a soft aurora field from product hues.

## info / bottom / floating
### `faq`
- `accordion` — smooth expanding items, +/− morph.
- `two-col` — sticky heading column + answers.
- `chat` — Q as customer bubble, A as brand bubble.

### `footer` (singleton)
- `simple` — wordmark, contact, legal links, COD line.
- `big` — giant wordmark across the bottom edge, links grid.

### `stickyCta` (singleton, floating, mobile)
- `bar` — floating glass bar: thumb + live price + CTA, safe-area aware.
- `pill` — floating pill button with price.

### `whatsappFloat` (singleton, floating)
- `bubble` — round glass/solid button with WhatsApp glyph + label on hover.
- `tab` — side tab "Une question ?".
