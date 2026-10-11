/**
 * QA render — a fixture PageDoc → standalone HTML file that opens without a server
 * (fonts and photos point to absolute file:/// URLs inside public/). Same renderer as publish.
 *
 *   npx tsx scripts/qa/render.ts --fixture argan
 *   npx tsx scripts/qa/render.ts --fixture massage --arch playground --locale ar --seed 7
 *   npx tsx scripts/qa/render.ts --fixture blender --only hero,benefits,orderForm --variant hero=poster,benefits=bento
 *   npx tsx scripts/qa/render.ts --fixture parfum --page both --out qa/parfum.html
 *   npx tsx scripts/qa/render.ts --fixture argan --page legal      # privacy / terms / shipping / contact
 *
 * Flags: --fixture <argan|massage|blender|parfum> (required) · --arch <archetype> · --locale ar|fr|en ·
 *   --seed <n> · --only <type,…> · --variant <type>=<variantId>,… · --out <file.html> ·
 *   --page landing|merci|both|legal|all (default landing) · --now <ISO> (default: now) ·
 *   --live (keep scroll reveals & animations instead of the QA end state).
 * Files: <out>.html, <out>-merci.html, <out>-<privacy|terms|shipping|contact>.html — linked together.
 * See scripts/qa/README.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { LEGAL_KINDS, type LegalKind } from "@/landing/context";
import { getSection, SECTION_TYPES } from "@/landing/registry";
import type { PageLinks } from "@/landing/types";
import { FIXTURE_LOCALES, FIXTURE_NAMES, fixtureAssets, getFixture, isFixtureName, type FixtureLocale } from "@/lib/page/fixtures";
import { defaultBundleId, orderTotals } from "@/lib/page/pricing";
import { ARCHETYPES, type Archetype, type PageDoc } from "@/lib/page/schema";
import { validateDoc } from "@/lib/page/validate";
import { bundleLabel } from "@/lib/render/config";
import { renderLandingHtml, renderLegalHtml, renderThankYouHtml, type RenderHtmlOptions } from "@/lib/render/core";
import { createT } from "@/landing/i18n";

const ROOT = resolve(__dirname, "..", "..");
const PUBLIC_URL = pathToFileURL(join(ROOT, "public")).href + "/";

interface Args {
  fixture: string;
  arch?: string;
  locale?: string;
  seed?: string;
  only?: string;
  variant?: string;
  out?: string;
  page: string;
  now?: string;
  live: boolean;
}

function fail(msg: string): never {
  console.error(`render: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) fail(`unexpected argument "${a}"`);
    const key = a.slice(2);
    if (key === "live") {
      args.live = true;
      continue;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) fail(`--${key} needs a value`);
    args[key] = v;
    i++;
  }
  const known = new Set(["fixture", "arch", "locale", "seed", "only", "variant", "out", "page", "now", "live"]);
  for (const k of Object.keys(args)) if (!known.has(k)) fail(`unknown flag --${k}`);
  if (typeof args.fixture !== "string") fail(`--fixture is required (${FIXTURE_NAMES.join(", ")})`);
  return {
    fixture: args.fixture,
    arch: args.arch as string | undefined,
    locale: args.locale as string | undefined,
    seed: args.seed as string | undefined,
    only: args.only as string | undefined,
    variant: args.variant as string | undefined,
    out: args.out as string | undefined,
    page: (args.page as string | undefined) ?? "landing",
    now: args.now as string | undefined,
    live: args.live === true,
  };
}

const list = (s: string | undefined) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

/** --only / --variant applied on the fixture doc (validated against the registry). */
function tailor(doc: PageDoc, only: string[], variants: string[]): PageDoc {
  for (const t of only) if (!SECTION_TYPES.includes(t)) fail(`--only: unknown section type "${t}" (${SECTION_TYPES.join(", ")})`);
  const overrides = new Map<string, string>();
  for (const pair of variants) {
    const [type, variant] = pair.split("=").map((x) => x?.trim());
    const def = type ? getSection(type) : undefined;
    if (!def || !variant) fail(`--variant: expected <type>=<variantId>, got "${pair}"`);
    if (!def.variants.some((v) => v.id === variant)) {
      fail(`--variant: "${type}" has no variant "${variant}" (${def.variants.map((v) => v.id).join(", ")})`);
    }
    overrides.set(type!, variant);
  }
  const sections = doc.sections
    .filter((s) => !only.length || only.includes(s.type))
    .map((s) => (overrides.has(s.type) ? { ...s, variant: overrides.get(s.type)! } : s));
  return { ...doc, sections };
}

/**
 * Point root-relative font URLs at public/ on disk. Font preloads are dropped: file:// documents have
 * an opaque origin, so a CORS preload can never be matched by the font request (console noise only).
 */
function localizeFonts(html: string): string {
  return html.replace(/url\("\/fonts\//g, `url("${PUBLIC_URL}fonts/`).replace(/<link rel="preload" as="font"[^>]*\/>/g, "");
}

/** Final reveal state baked in: every [data-reveal] element starts with data-in (runtime skips it). */
function revealAll(html: string): string {
  return html.replace(/(<[a-zA-Z][a-zA-Z0-9-]*\b[^<>]*?\sdata-reveal="[^"]*")/g, '$1 data-in=""');
}

/** A sample order in sessionStorage so the thank-you page renders its "filled" state. */
function seedOrder(html: string, doc: PageDoc, pageKey: string): string {
  const t = createT(doc.locale);
  const bundle = doc.offers.bundles.find((b) => b.id === defaultBundleId(doc.offers)) ?? doc.offers.bundles[0]!;
  const totals = orderTotals(doc.product, doc.offers, bundle.id, false);
  const label = bundleLabel({ t }, bundle);
  const order = {
    orderId: "CMD-7K3Q9X",
    name: doc.locale === "ar" ? "سلمى" : "Salma",
    total: totals?.total ?? bundle.price,
    currency: doc.currency,
    bundleLabel: label,
    items: label,
    qty: bundle.qty,
    upsellToken: "qa-upsell-token-0001",
    eventId: "qa-event-0001",
    ts: 0,
    pageKey,
  };
  const json = JSON.stringify(order).replace(/</g, "\\u003c");
  const script = `<script>try{var o=${json};o.ts=Date.now();sessionStorage.setItem("lp-order",JSON.stringify(o))}catch(e){}</script>`;
  // before the runtime (the last script of the body)
  const at = html.lastIndexOf("<script>");
  return at < 0 ? html : html.slice(0, at) + script + html.slice(at);
}

async function main() {
  const t0 = performance.now();
  const a = parseArgs(process.argv.slice(2));
  if (!isFixtureName(a.fixture)) fail(`unknown fixture "${a.fixture}" (${FIXTURE_NAMES.join(", ")})`);
  if (a.arch && !(ARCHETYPES as readonly string[]).includes(a.arch)) fail(`unknown archetype "${a.arch}" (${ARCHETYPES.join(", ")})`);
  if (a.locale && !(FIXTURE_LOCALES as readonly string[]).includes(a.locale)) fail(`--locale must be one of ${FIXTURE_LOCALES.join(", ")}`);
  if (!["landing", "merci", "both", "legal", "all"].includes(a.page)) fail("--page must be landing, merci, both, legal or all");
  const seed = a.seed !== undefined ? Number(a.seed) : undefined;
  if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 2_147_483_647)) fail("--seed must be an integer ≥ 0");
  const now = a.now ? new Date(a.now) : new Date();
  if (Number.isNaN(now.getTime())) fail("--now must be an ISO date");

  const fx = getFixture(a.fixture, {
    archetype: a.arch as Archetype | undefined,
    locale: a.locale as FixtureLocale | undefined,
    seed,
    now: now.toISOString(),
  });
  const doc = tailor(fx.doc, list(a.only), list(a.variant));
  const { issues } = validateDoc(doc);
  for (const i of issues) console.warn(`  ${i.level === "error" ? "✗" : "!"} ${i.path}: ${i.message}`);

  const suffix = [a.arch, a.locale, seed !== undefined ? `s${seed}` : ""].filter(Boolean).join("-");
  const outFile = resolve(ROOT, a.out ?? join("qa", `${fx.name}${suffix ? `-${suffix}` : ""}.html`));
  const sibling = (suffix: string) => join(dirname(outFile), `${basename(outFile, extname(outFile))}-${suffix}${extname(outFile) || ".html"}`);
  const mercFile = sibling("merci");
  const legalFile = (k: LegalKind) => sibling(k);
  mkdirSync(dirname(outFile), { recursive: true });
  // every document links to its local siblings (footer legal links, "back to the page")
  const links: PageLinks = {
    home: `./${basename(outFile)}`,
    privacy: `./${basename(legalFile("privacy"))}`,
    terms: `./${basename(legalFile("terms"))}`,
    shipping: `./${basename(legalFile("shipping"))}`,
    contact: `./${basename(legalFile("contact"))}`,
  };
  const want = {
    landing: ["landing", "both", "all"].includes(a.page),
    merci: ["merci", "both", "all"].includes(a.page),
    legal: ["legal", "all"].includes(a.page),
  };

  const opts: RenderHtmlOptions = {
    mode: "live",
    assets: fixtureAssets(PUBLIC_URL),
    pageKey: fx.pageKey,
    store: fx.store,
    links,
    urls: {
      landing: `./${basename(outFile)}`,
      thankYou: `./${basename(mercFile)}`,
      endpoints: { order: "/api/public/order" },
    },
    base: "/",
    now: now.toISOString(),
    runtimeMode: "preview",
    qa: !a.live,
    upgradeInsecureRequests: false,
  };
  const post = (html: string) => (a.live ? localizeFonts(html) : revealAll(localizeFonts(html)));

  const written: string[] = [];
  if (want.landing) {
    const r = await renderLandingHtml(doc, opts);
    for (const i of r.issues) console.warn(`  ✗ section ${i.sectionId} (${i.type}) failed to render: ${i.message}`);
    writeFileSync(outFile, post(r.html), "utf8");
    written.push(outFile);
  }
  if (want.merci) {
    const r = await renderThankYouHtml(doc, opts);
    writeFileSync(mercFile, seedOrder(post(r.html), doc, fx.pageKey), "utf8");
    written.push(mercFile);
  }
  if (want.legal) {
    for (const kind of LEGAL_KINDS) {
      const r = await renderLegalHtml(doc, kind, {
        mode: "live",
        assets: opts.assets,
        store: fx.store,
        links,
        base: "/",
        now: now.toISOString(),
        updatedAt: now.toISOString(),
        qa: !a.live,
        upgradeInsecureRequests: false,
      });
      writeFileSync(legalFile(kind), localizeFonts(r.html), "utf8");
      written.push(legalFile(kind));
    }
  }
  const ms = Math.round(performance.now() - t0);
  console.log(`${written.map((f) => pathToFileURL(f).href).join("\n")}\n(${doc.theme.archetype} · ${doc.locale} · seed ${doc.theme.seed} · ${doc.sections.length} sections · ${ms} ms)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
