/**
 * PHP export parity (docs/OFFERS.md §G.6, §I.5) — the standalone order.php against the app, offline:
 *
 *   npx tsx scripts/qa/php-parity.ts [--php C:\xampp\php\php.exe] [--n 60] [--seed 7] [--keep]
 *
 * For every fixture (the four v1-shaped pages and the Offers v2 duo / tshirt / colors) and for
 * stress variants of them (extras with codes and surcharges, typed fields, shared groups, a bump
 * item, a gift, free lines, "any 2 of 3" with price differences, a delivery fee with free-delivery
 * offers, numeric options, long texts), a seeded corpus of v1 and v2 payloads (valid, partial,
 * wrong, sold out, too long, malformed) goes through
 *   app:  parseOrderPayload → validateOrder → orderText / Sheets cells (src/lib/sheets/row.ts)
 *   PHP:  cod_parse_payload → cod_validate → cod_order_text / cod_sheet_extras (order.php, CLI)
 * and must give the same field errors, totals (cents), Variante text, SKU / Articles / Livraison /
 * Prix pack cells, Qté, Produit and v1 compat `variants`. It also prints the Sheets row text of every
 * offer case (what a Moroccan delivery team reads). Exit code 1 on any mismatch.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fillOrderPhp, phpSpec } from "@/lib/export/php";
import { parseOrderPayload } from "@/lib/orders/contract";
import { validateOrder } from "@/lib/orders/validate";
import { expandUnits } from "@/lib/page/catalog";
import { availableCombos, availableOptions } from "@/lib/page/options";
import { FIXTURE_NAMES, getFixture } from "@/lib/page/fixtures";
import { fromCents } from "@/lib/page/pricing";
import { isChoiceGroup, isFieldGroup, isMatrixGroup, PageDoc, type PageDoc as Doc } from "@/lib/page/schema";
import { cleanText } from "@/lib/sheets/format";
import { extraColumnsOf, extraValues, orderTextOf, productText, skuCell, variantCell, wideRow } from "@/lib/sheets/row";
import { orderView } from "@/components/admin/orders/parts";
import { composeWaMessage, waCopy } from "@/lib/export/whatsapp";
import { leadSelectionText } from "@/lib/orders/lead-text";
import type { OrderItems } from "@/lib/db/schema";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};
const PHP = arg("php", process.env.PHP_BIN || "C:\\xampp\\php\\php.exe");
const N = Number(arg("n", "60"));
const SEED = Number(arg("seed", "7"));
const KEEP = process.argv.includes("--keep");
const ORDER_ID = "CMD-PARITY";

/* ------------------------------------------------------------------ */
/* documents                                                           */
/* ------------------------------------------------------------------ */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function docs(): { name: string; doc: Doc }[] {
  const out: { name: string; doc: Doc }[] = FIXTURE_NAMES.map((n) => ({ name: n, doc: getFixture(n).doc }));

  // duo+: any 2 of 3 (distinct, difference), a BOGO line, a gift, extras (choice with codes and a
  // surcharge, an optional typed card message), the sérum as bump item, delivery 30 DH with one free offer
  const duo = clone(getFixture("duo").doc);
  out.push({
    name: "duo+",
    doc: PageDoc.parse({
      ...duo,
      items: duo.items.map((it) =>
        it.id === "serum"
          ? { ...it, sku: "SER-50", groups: [{ id: "g-name", kind: "field", name: "Prénom", perUnit: true, required: false, maxLength: 12, charset: "letters", delta: 20 }] }
          : it.id === "main"
            ? { ...it, sku: "JOUR" }
            : it,
      ),
      offers: {
        ...duo.offers,
        shippingFee: 30,
        bundles: [
          ...duo.offers.bundles.map((b) => (b.id === "trio" ? { ...b, freeShipping: true, gift: { label: "Trousse de voyage" } } : b)),
          { id: "any2", title: "2 au choix", price: 279, lines: [{ id: "l1", qty: 2, pick: { choice: ["main", "nuit", "serum"], distinct: true, surcharge: "difference" } }] },
          { id: "bogo", price: 149, lines: [{ id: "l1", qty: 1, pick: { item: "nuit" } }, { id: "l2", qty: 1, pick: { item: "nuit" }, free: true }] },
          { id: "gift-serum", title: "Jour + sérum offert", price: 149, lines: [{ id: "l1", qty: 1, pick: { item: "main" } }, { id: "l2", qty: 1, pick: { item: "serum" }, free: true, label: "Votre cadeau" }] },
        ],
        extras: [
          { id: "g-wrap", kind: "text", name: "Emballage cadeau", scope: ["duo", "trio", "any2"], options: [{ id: "o-no", label: "Non", code: "SANS" }, { id: "o-yes", label: "Oui", code: "EMB", delta: 15 }] },
          { id: "g-card", kind: "field", name: "Mot sur la carte", scope: "all", required: false, maxLength: 40, delta: 5 },
        ],
        orderBump: { enabled: true, title: "Ajoutez le sérum", price: 99, item: "serum", offers: ["one", "duo", "bogo"] },
      },
    }),
  });

  // tshirt+: the printed name (letters, ≤ 12, +30, optional), a shared gift-box choice, a number field,
  // a sold-out size, a cell with its own delta and SKU, and the matrix shown in Arabic
  const tee = clone(getFixture("tshirt").doc);
  const main = tee.items[0]!;
  out.push({
    name: "tshirt+",
    doc: PageDoc.parse({
      ...tee,
      items: [
        {
          ...main,
          groups: [
            ...main.groups.map((g) =>
              g.kind === "matrix"
                ? { ...g, cells: [...g.cells, { v: { "d-col": "o-gris", "d-size": "o-l" }, delta: 35, sku: "TS-GR-L" }, { v: { "d-size": "o-s" }, state: "out" }] }
                : g,
            ),
            { id: "g-box", kind: "text", name: "Boîte", perUnit: false, options: [{ id: "o-kraft", label: "Kraft" }, { id: "o-noire", label: "Noire", delta: 10 }] },
            { id: "g-num", kind: "field", name: "Numéro", perUnit: true, required: false, input: "number", maxLength: 3, min: 1, max: 99 },
          ],
        },
      ],
    }),
  });

  // shoes: numeric options ("Pointure 42"), warehouse codes in Latin for Arabic labels, a shared
  // colour, a sold-out size, fee 25 with free delivery on the pair of two
  const shoes = clone(getFixture("parfum").doc);
  out.push({
    name: "shoes",
    doc: PageDoc.parse({
      ...shoes,
      items: [
        {
          id: "main",
          name: "",
          price: 249,
          sku: "SH",
          images: [],
          groups: [
            { id: "g-size", kind: "text", name: "Pointure", perUnit: true, options: ["40", "41", "42", "43", "44"].map((s) => ({ id: `o-${s}`, label: s, soldOut: s === "44" })) },
            { id: "g-col", kind: "swatch", name: "اللون", perUnit: false, options: [{ id: "o-k", label: "أسود", code: "NR", swatch: "#111111" }, { id: "o-w", label: "أبيض", code: "BL", swatch: "#f4f4f4" }] },
          ],
        },
      ],
      offers: {
        ...shoes.offers,
        shippingFee: 25,
        bundles: [
          { id: "x1", price: 249, lines: [{ id: "l1", qty: 1, pick: { item: "main" } }] },
          { id: "x2", title: "La paire de 2", price: 449, freeShipping: true, lines: [{ id: "l1", qty: 2, pick: { item: "main" } }] },
        ],
        extras: [],
      },
    }),
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* corpus                                                              */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEXTS = ["Sara", "سارة", "Jean-Pierre", "Zoé", "  Lina   B ", "١٢", "42", "7", "<b>x</b>", "x".repeat(30), "Emma2", "😀 ok", "", "O'Neil", "Ça va", "ب".repeat(13)];

function corpus(doc: Doc, seed: number): unknown[] {
  const r = rng(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
  const chance = (p: number) => r() < p;
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  const base = {
    pageKey: "pk_parity_0001",
    idem: "0f6c9f3e-8b1a-4c2d-9e7f-1a2b3c4d5e6f",
    eventId: "ev_parity_0001",
    name: "سارة بناني",
    phone: "0612345678",
    city: "Casablanca",
    address: "Rue 12, Maârif",
    t: 41200,
  };
  const delivery = () => {
    if (!chance(0.08)) return {};
    return pick([{ name: "x".repeat(90) }, { name: "A" }, { phone: "12" }, { city: "Atlantis" }, { address: "" }, { name: "Sara 2" }, { phone: "+212 6 12 34 56 78" }, { city: "الرباط" }]);
  };
  const GOOD = ["Sara", "سارة", "Zoé", "Lina", "O'Neil", "Jean-Pierre", "12", "7", "٤٢"];
  /** "honest" picks (what a real form sends) most of the time, anything otherwise */
  const optionsOf = (itemId: string | undefined, rules?: Record<string, import("@/lib/page/schema").LineRule>) => {
    const it = itemId ? byId.get(itemId) : undefined;
    const o: Record<string, string> = {};
    const f: Record<string, string> = {};
    const honest = chance(0.7);
    for (const g of it?.groups ?? []) {
      if (honest) {
        if (isChoiceGroup(g)) {
          const list = availableOptions(g, rules);
          if (list.length) o[g.id] = pick(list).id;
        } else if (isMatrixGroup(g)) {
          const list = availableCombos(g, rules, it);
          if (list.length) o[g.id] = pick(list).key;
        } else if (isFieldGroup(g) && (g.required || chance(0.6))) f[g.id] = pick(GOOD);
        continue;
      }
      if (chance(0.12)) continue;
      if (isChoiceGroup(g)) o[g.id] = chance(0.08) ? "o-bad" : pick(g.options).id;
      else if (isMatrixGroup(g)) {
        const parts = g.dims.filter(() => !chance(0.1)).map((d) => `${d.id}=${chance(0.04) ? "o-zz" : pick(d.values).id}`);
        if (chance(0.5)) parts.reverse();
        o[g.id] = chance(0.04) ? "garbage" : parts.join("|");
      } else if (isFieldGroup(g)) f[g.id] = pick(TEXTS);
    }
    return { o, f };
  };
  const out: unknown[] = [];
  for (const offer of doc.offers.bundles) {
    const slots = expandUnits(offer, doc.items);
    for (let i = 0; i < N; i++) {
      const units = slots.map((s) => {
        let item: string | undefined = s.item ?? undefined;
        if (!s.item) item = chance(0.1) ? undefined : chance(0.06) ? "nope-item" : pick(s.choices!);
        const { o, f } = optionsOf(item ?? s.choices?.[0], s.rules);
        return { ...(s.item ? (chance(0.05) ? { item: "main" } : {}) : item ? { item } : {}), o, f };
      });
      if (chance(0.06)) units.pop();
      const extras: Record<string, string> = {};
      for (const x of doc.offers.extras) {
        if (chance(0.2)) continue;
        extras[x.id] = isChoiceGroup(x) ? (chance(0.08) ? "o-maybe" : pick(x.options).id) : pick(TEXTS);
      }
      const bumpItem = doc.offers.orderBump?.item;
      const b = bumpItem && chance(0.7) ? optionsOf(bumpItem) : undefined;
      out.push({ ...base, ...delivery(), v: 2, st: 0, bundleId: chance(0.03) ? "nope" : offer.id, bump: chance(0.5), units, extras, ...(b ? { b } : {}) });
    }
    // v1 payloads (published v1 runtimes, old exports): { groupId: optionId } per unit
    const lead = doc.items[0]!;
    for (let i = 0; i < Math.ceil(N / 3); i++) {
      const n = chance(0.2) ? 1 : slots.length;
      const variants = Array.from({ length: n }, () => {
        const rec: Record<string, string> = {};
        for (const g of lead.groups) if (isChoiceGroup(g) && !chance(0.1)) rec[g.id] = chance(0.06) ? "o-bad" : pick(g.options).id;
        return rec;
      });
      out.push({ ...base, ...delivery(), bundleId: offer.id, bump: chance(0.3), variants });
    }
  }
  // malformed shapes
  const first = doc.offers.bundles[0]!.id;
  out.push(
    { ...base, v: 2, st: 0, bundleId: first, units: [{ item: "NOT AN ID" }], extras: {} },
    { ...base, v: 2, st: 0, bundleId: first, units: [{ o: { "g-fit": "x".repeat(300) }, f: { "g-name": "y".repeat(300) } }], extras: { "g-wrap": "z".repeat(300) } },
    { ...base, v: 2, st: 0, bundleId: first, units: [], extras: { a1: "x", b2: "x", c3: "x", d4: "x", e5: "x" } },
    { ...base, v: 2, bundleId: first, units: [] },
    { ...base, v: 3, bundleId: first },
    { ...base, bundleId: first, units: [] },
    { ...base, v: 2, st: 0, bundleId: first, name: "x".repeat(90), units: [] },
    { ...base, v: 2, st: 0, bundleId: first, units: [{ o: { "bad key!": "x" } }] },
    { ...base, bundleId: first, name: "x".repeat(90), variants: [] },
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* app side                                                            */
/* ------------------------------------------------------------------ */

type Result =
  | { status: "invalid"; fields: Record<string, string> }
  | {
      status: "ok";
      total: number;
      variante: string;
      sku: string | number;
      articles: string | number;
      delivery: string | number;
      packPrice: string | number;
      qty: number;
      product: string;
      variants: Record<string, string>[];
    };

const sortKeys = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

function app(doc: Doc, raw: unknown): Result {
  const parsed = parseOrderPayload(raw);
  if (!parsed.ok) return { status: "invalid", fields: sortKeys(parsed.fields as Record<string, string>) };
  const r = validateOrder(parsed.data, doc);
  if (!r.ok) return { status: "invalid", fields: sortKeys(r.fields as Record<string, string>) };
  const o = { id: ORDER_ID, items: r.value.items, productName: doc.product.name, subtotal: fromCents(r.value.totals.subtotal), shipping: fromCents(r.value.totals.shipping) };
  const x = extraValues(o);
  return {
    status: "ok",
    total: r.value.totals.total,
    variante: variantCellClean(variantCell(o)),
    sku: x.sku,
    articles: x.articles,
    delivery: x.delivery,
    packPrice: x.packPrice,
    qty: r.value.items.qty,
    product: productText(o),
    variants: r.value.items.variants,
  };
}

// the Variante cell as written (src/lib/sheets/row.ts orderToRow → cleanText(…, 1000))
const variantCellClean = (s: string) => cleanText(s, 1000);

/* ------------------------------------------------------------------ */
/* PHP side                                                            */
/* ------------------------------------------------------------------ */

const HARNESS = `<?php
define('COD_TEST', true);
require $argv[1];
$spec = json_decode(COD_SPEC_JSON, true);
$corpus = json_decode((string)file_get_contents($argv[2]), true);
$out = [];
foreach ($corpus as $raw) {
    list($p, $f) = cod_parse_payload($raw);
    if ($p === null) {
        ksort($f, SORT_STRING);
        $out[] = ['status' => 'invalid', 'fields' => (object)$f];
        continue;
    }
    list($o, $fields) = cod_validate($p, $spec);
    if ($o === null) {
        ksort($fields, SORT_STRING);
        $out[] = ['status' => 'invalid', 'fields' => (object)$fields];
        continue;
    }
    $x = cod_sheet_extras($spec, $o);
    $out[] = [
        'status' => 'ok',
        'total' => $o['total'],
        'variante' => cod_sheet_text(cod_order_text($spec, $o, '${ORDER_ID}'), COD_TEXT_MAX),
        'sku' => $x['sku'],
        'articles' => $x['articles'],
        'delivery' => $x['delivery'],
        'packPrice' => $x['packPrice'],
        'qty' => count($o['offer']['units']),
        'product' => $spec['product'] . ' — ' . $o['offer']['sheetLabel'] . ($o['bump'] ? ' + ' . $spec['bump']['title'] : ''),
        'variants' => $o['variants'],
    ];
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
`;

/* ------------------------------------------------------------------ */
/* run                                                                 */
/* ------------------------------------------------------------------ */

const dir = path.join(process.env.COD_SCRATCH || tmpdir(), `php-parity-${process.pid}`);
mkdirSync(dir, { recursive: true });
const template = readFileSync(path.join(process.cwd(), "src", "lib", "export", "templates", "order.php"), "utf8");
writeFileSync(path.join(dir, "harness.php"), HARNESS);

/** One comparable form: numbers by value, PHP's [] for an empty record = {}. */
function norm(r: Result | undefined): string {
  if (!r) return "missing";
  if (r.status === "invalid") return JSON.stringify({ status: r.status, fields: sortKeys(Array.isArray(r.fields) ? {} : r.fields) });
  return JSON.stringify({
    ...r,
    total: Number(r.total),
    sku: String(r.sku),
    articles: Number(r.articles),
    delivery: Number(r.delivery),
    packPrice: Number(r.packPrice),
    qty: Number(r.qty),
    variants: (r.variants ?? []).map((v) => (Array.isArray(v) ? {} : v)),
  });
}

let total = 0;
let failures = 0;
const examples: string[] = [];
const sheetSamples = new Map<string, string>();
const t0 = Date.now();
for (const [di, { name, doc }] of docs().entries()) {
  const spec = phpSpec(doc, { exportId: "01JPARITYEXPORT00000000000", pageKey: "pk_parity_0001" });
  const php = path.join(dir, `${name.replace(/[^a-z0-9]+/gi, "_")}.php`);
  writeFileSync(php, fillOrderPhp(template, spec));
  const payloads = corpus(doc, SEED * 1000 + di);
  const cfile = path.join(dir, `${name.replace(/[^a-z0-9]+/gi, "_")}.json`);
  writeFileSync(cfile, JSON.stringify(payloads));
  const warn = console.warn;
  console.warn = () => {};
  const mine = payloads.map((p) => app(doc, p));
  console.warn = warn;
  let theirs: Result[];
  try {
    const stdout = execFileSync(PHP, ["-d", "display_errors=stderr", "-d", "log_errors=0", "-d", "memory_limit=512M", path.join(dir, "harness.php"), php, cfile], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    theirs = JSON.parse(stdout) as Result[];
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message: string };
    console.error(`✗ ${name}: PHP failed\n${(e.stderr || e.stdout || e.message).slice(0, 2000)}`);
    failures++;
    continue;
  }
  let docFails = 0;
  mine.forEach((m, i) => {
    total++;
    const am = norm(m);
    const b = norm(theirs[i]);
    if (am !== b) {
      failures++;
      docFails++;
      if (examples.length < 25) examples.push(`${name} #${i}\n    payload: ${JSON.stringify(payloads[i]).slice(0, 600)}\n    app: ${am.slice(0, 700)}\n    php: ${b.slice(0, 700)}`);
    }
    if (m.status === "ok") {
      const raw = payloads[i] as { bundleId: string; v?: number };
      const key = `${name} · ${raw.bundleId}${raw.v === 2 ? "" : " (v1)"}`;
      if (!sheetSamples.has(key) || (m.variante.length > (sheetSamples.get(key)?.length ?? 0) && sheetSamples.size < 200)) {
        sheetSamples.set(key, `Produit: ${m.product}\n      Variante: ${m.variante || "(vide)"}\n      Qté ${m.qty} · SKU ${m.sku || "—"} · Articles ${m.articles} · Livraison ${m.delivery} · Prix pack ${m.packPrice} · Total ${fromCents(m.total)}`);
      }
    }
  });
  const oks = mine.filter((m) => m.status === "ok").length;
  console.log(`${docFails ? "✗" : "✓"} ${name}: ${mine.length} payloads (${oks} valid, ${mine.length - oks} refused)${docFails ? ` · ${docFails} mismatches` : ""}`);
}

console.log("\nSheets rows (one valid order per offer, the longest Variante seen):");
for (const [k, v] of sheetSamples) console.log(`  ${k}\n      ${v}`);

if (examples.length) console.log(`\nMismatches (first ${examples.length}):\n${examples.join("\n")}`);
console.log(`\nphp-parity: ${total - failures}/${total} identical · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
/* ------------------------------------------------------------------ */
/* order outputs (pure): Sheets cells, admin view, leads, WhatsApp     */
/* ------------------------------------------------------------------ */

let checks = 0;
const bad: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) bad.push(`${name}\n    got:  ${a}\n    want: ${b}`);
};
{
  // optional columns: found after M only, trimmed, any case, first occurrence wins
  eq("headers", extraColumnsOf(["Confirmé par", " sku ", "ARTICLES", "Livraison", "prix   pack", "SKU"]), { sku: 14, articles: 15, delivery: 16, packPrice: 17 });
  eq("headers: none", extraColumnsOf(["Agent", "Commentaire"]), {});
  eq("wide row: nulls after M, values in their columns", wideRow(["a", "b", "c", "d", "e", "f", "g", "h", "i", 1, 2, "l", "m"], { sku: 15, packPrice: 13 }, { sku: "TS×2", articles: 2, delivery: 0, packPrice: 229 }), ["a", "b", "c", "d", "e", "f", "g", "h", "i", 1, 2, "l", "m", 229, null, "TS×2"]);
  eq("wide row: no optional column", wideRow(["x"], {}, { sku: "", articles: 0, delivery: 0, packPrice: 0 }), ["x"]);

  // v1 rows (no v): text from variants, SKU from the product name, Articles = qty (+ bump)
  const v1: OrderItems = { bundleId: "b2", bundleLabel: "Pack Duo (x2)", qty: 2, unitPrice: 174.5, variants: [{ Couleur: "Noir", Taille: "M" }, { Couleur: "Noir", Taille: "M" }], bump: { title: "Mini sérum", price: 49 } };
  eq("v1 row: Variante", variantCell({ id: "CMD-1", items: v1 }), "2 × Noir/M");
  eq("v1 row: SKU", skuCell({ items: v1, productName: "Huile d'argan pure" }), "Huile-d'argan-pure×2 Mini-sérum×1");
  eq("v1 row: cells", extraValues({ items: v1, productName: "Huile", subtotal: 398, shipping: 0 }), { sku: "Huile×2 Mini-sérum×1", articles: 3, delivery: 0, packPrice: 349 });

  // the upsell's own unit (catalog item) → "[UPSELL] 1 × Sérum (options à confirmer)", in SKU and Articles
  const up: OrderItems = {
    v: 2,
    bundleId: "duo",
    bundleLabel: "Le duo jour + nuit (x2)",
    qty: 2,
    unitPrice: 124.5,
    variants: [{ Article: "Crème jour" }, { Article: "Crème nuit" }],
    units: [
      { item: "main", label: "Crème jour", short: "Jour", sku: "JOUR", options: [] },
      { item: "nuit", label: "Crème nuit", short: "Nuit", options: [] },
    ],
    price: 249,
    deltas: 0,
    upsell: { title: "Le sérum à -50 %", price: 99, item: "serum", confirmOptions: true, unit: { item: "serum", label: "Sérum éclat", short: "Sérum", sku: "SER-50", options: [] } } as NonNullable<OrderItems["upsell"]>,
  };
  eq("upsell: Variante", variantCell({ id: "CMD-2", items: up }), "1 × Jour + 1 × Nuit + [UPSELL] 1 × Sérum (options à confirmer)");
  eq("upsell: Produit", productText({ productName: "Duo Éclat", items: up }), "Duo Éclat — Le duo jour + nuit (x2) + Le sérum à -50 %");
  eq("upsell: cells", extraValues({ items: up, productName: "Duo Éclat", subtotal: 348, shipping: 0 }), { sku: "JOUR×1 Nuit×1 SER-50×1", articles: 3, delivery: 0, packPrice: 249 });
  const plainUp: OrderItems = { ...up, upsell: { title: "Mini sérum", price: 49 } };
  eq("upsell without item: title", orderTextOf(plainUp), "1 × Jour + 1 × Nuit + [UPSELL] 1 × Mini sérum");

  // the drawer: grouped parts, free apart from paid, bump and upsell with their price, gift, extras
  const duo = docs().find((d) => d.name === "duo+")!.doc;
  const base2 = { pageKey: "pk_parity_0001", idem: "0f6c9f3e-8b1a-4c2d-9e7f-1a2b3c4d5e6f", eventId: "ev_parity_0001", name: "سارة بناني", phone: "0612345678", city: "Casablanca", address: "Rue 12, Maârif", t: 41200, v: 2, st: 0 };
  const warn = console.warn;
  console.warn = () => {};
  const bogo = parseOrderPayload({ ...base2, bundleId: "bogo", bump: true, units: [{}, {}], extras: { "g-card": "Bon anniversaire" }, b: { f: { "g-name": "Sara" } } });
  const trio = parseOrderPayload({ ...base2, bundleId: "trio", bump: false, units: [{}, {}, { f: { "g-name": "سارة" } }], extras: { "g-wrap": "o-yes" } });
  const vb = bogo.ok ? validateOrder(bogo.data, duo) : null;
  const vt = trio.ok ? validateOrder(trio.data, duo) : null;
  console.warn = warn;
  if (vb?.ok) {
    const view = orderView(vb.value.items);
    eq(
      "view: bogo parts",
      view.parts.map((p) => [p.kind, p.count, p.item, p.fields.map((f) => f.value).join(","), p.price ?? null]),
      [["unit", 1, "Crème nuit", "", null], ["free", 1, "Crème nuit", "", null], ["bump", 1, "Sérum éclat", "Sara", 99]],
    );
    eq("view: pieces + extras", [view.pieces, view.extras], [3, [{ name: "Mot sur la carte", value: "Bon anniversaire", typed: true, delta: 5 }]]);
    eq("bogo: Variante", variantCell({ id: "CMD-3", items: vb.value.items }), "1 × Nuit + [OFFERT] 1 × Nuit + [AJOUT] 1 × Sérum · Prénom « Sara » || Commande : Mot sur la carte = « Bon anniversaire » (+5)");
  } else bad.push("bogo order refused: " + JSON.stringify(vb && !vb.ok ? vb.fields : bogo));
  if (vt?.ok) {
    const view = orderView(vt.value.items);
    eq("view: trio gift", view.gift, "Trousse de voyage");
    eq("trio: customer text", orderTextOf(vt.value.items, { mode: "customer" }), "1 × Jour + 1 × Nuit + 1 × Sérum · Prénom « سارة » + CADEAU : Trousse de voyage || Commande : Emballage cadeau = Oui (+15)");
    // WhatsApp (§G.5): one bullet per part, gift and order choices on their lines, the runtime's total
    const msg = composeWaMessage(
      {
        orderId: "CMD-7K3Q9X",
        product: "Duo Éclat",
        pack: "Le rituel complet (x3)",
        units: orderTextOf(vt.value.items, { mode: "customer" }),
        total: vt.value.totals.total,
        customer: { name: "سارة بناني", phone: "0612345678", city: "Casablanca" },
      },
      waCopy("fr").labels,
      { locale: "fr", money: (c) => `${fromCents(c)} DH` },
    );
    eq(
      "whatsapp: message",
      msg.text,
      "*Nouvelle commande* · Réf. CMD-7K3Q9X\nProduit : Duo Éclat\nPack : Le rituel complet (x3)\n• 1 × Jour\n• 1 × Nuit\n• 1 × Sérum · Prénom « سارة »\n• Cadeau : Trousse de voyage\nCommande : Emballage cadeau = Oui (+15 DH)\n*Total : 384 DH* (paiement à la livraison)\n\nNom : سارة بناني\nTéléphone : 0612345678\nVille : Casablanca",
    );
  } else bad.push("trio order refused: " + JSON.stringify(vt && !vt.ok ? vt.fields : trio));

  // WhatsApp URL cap: unit bullets dropped from the end, counted
  const many = Array.from({ length: 20 }, (_, i) => `1 × Article ${i} · Prénom « ${"ب".repeat(40)} »`).join(" + ") + " + [OFFERT] 2 pièces";
  const capped = composeWaMessage({ orderId: "WA-1", product: "P", pack: "x20", units: many, total: 100, customer: { name: "A", phone: "0600000000" } }, waCopy("ar").labels, { locale: "ar", money: (c) => String(fromCents(c)) });
  checks++;
  if (!(encodeURIComponent(capped.text).length <= 3800 && capped.dropped > 0 && capped.text.includes(`(+${capped.dropped} قطع أخرى)`))) bad.push(`whatsapp cap: ${capped.dropped} ${encodeURIComponent(capped.text).length}`);

  // leads.selection: what resolves, warehouse text, ≤ 400
  const tee = docs().find((d) => d.name === "tshirt")!.doc;
  eq("lead: matrix + field", leadSelectionText(tee, { bundleId: "x2", units: [{ o: { "g-fit": "d-col=o-noir|d-size=o-m" }, f: { "g-name": "Sara" } }, { o: {}, f: {} }] }), "NR/M · Prénom à imprimer « Sara »");
  eq("lead: nothing chosen yet", leadSelectionText(tee, { bundleId: "x1", units: [] }), null);
  eq("lead: unknown offer", leadSelectionText(tee, { bundleId: "nope", units: [] }), null);
  eq("lead: fixed items resolve", leadSelectionText(duo, { bundleId: "duo", units: [] }), "1 × Jour + 1 × Nuit");

  // order.php runs top to bottom: a `const` declared after the cod_main() call is undefined while an
  // order is served (the CLI harness above defines COD_TEST and never sees it)
  const lines = template.split(/\r?\n/);
  const mainAt = lines.findIndex((l) => /^\s+cod_main\(\);/.test(l));
  const late = lines.map((l, i) => (/^const COD_/.test(l) && i > mainAt ? l.slice(0, 40) : "")).filter(Boolean);
  eq("order.php: every const before cod_main()", [mainAt > 0, late], [true, []]);
}
console.log(`\norder outputs: ${checks - bad.length}/${checks} passed${bad.length ? `\n  ${bad.join("\n  ")}` : ""}`);
if (bad.length) failures += bad.length;

if (!KEEP) rmSync(dir, { recursive: true, force: true });
else console.log(`kept: ${dir}`);
process.exit(failures ? 1 : 0);
