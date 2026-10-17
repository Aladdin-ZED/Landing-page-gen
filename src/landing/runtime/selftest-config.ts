/**
 * Test helper (selftests only, never bundled): the runtime config v2 of a document, built from the
 * server's own functions (pricing, catalog, options, display) exactly as docs/OFFERS.md §F.7 describes.
 * The renderer's builder (src/lib/render/config.ts, LR) must produce the same numbers; this one is the
 * reference the runtime parity tests run against.
 */
import { moneyFormat, phoneSpec } from "../../lib/markets/info";
import { contentIdOf, defaultOfferId, expandUnits, itemName, itemShort, offerAvailable, offerName, offerShort } from "../../lib/page/catalog";
import { resolveDisplay } from "../../lib/page/display";
import { allCombos, cellKey, resolveCombo } from "../../lib/page/options";
import { effectiveFree, offersMath, toCents } from "../../lib/page/pricing";
import type { Item, OptionGroup, PageDoc } from "../../lib/page/schema";
import type { LandingRuntimeConfig, RuntimeGroup, RuntimeOfferLine } from "./config";

const c = (m: number | undefined) => (m === undefined ? undefined : toCents(m));

export function runtimeGroup(g: OptionGroup, item?: Item): RuntimeGroup {
  if (g.kind === "field")
    return {
      id: g.id,
      name: g.name,
      kind: "field",
      perUnit: g.perUnit,
      input: g.input,
      required: g.required,
      maxLength: g.maxLength,
      ...(g.min !== undefined ? { min: g.min } : {}),
      ...(g.max !== undefined ? { max: g.max } : {}),
      charset: g.charset,
      ...(g.delta ? { delta: toCents(g.delta) } : {}),
    };
  const opt = (o: { id: string; label: string; soldOut: boolean; delta?: number }) => ({ id: o.id, label: o.label, soldOut: o.soldOut, ...(o.delta ? { delta: c(o.delta) } : {}) });
  if (g.kind === "matrix") {
    const valid = allCombos(g).filter((x) => resolveCombo(g, x, item)?.state !== "none").length;
    return {
      id: g.id,
      name: g.name,
      kind: "matrix",
      perUnit: g.perUnit,
      display: g.display === "auto" ? (valid <= 8 ? "combined" : "linked") : g.display,
      dims: g.dims.map((d) => ({ id: d.id, name: d.name, values: d.values.map(opt) })),
      cells: g.cells.map((x) => ({
        v: cellKey(x.v),
        ...(x.state === "out" ? { s: "o" as const } : x.state === "none" ? { s: "n" as const } : {}),
        ...(x.delta !== undefined ? { d: toCents(x.delta) } : {}),
      })),
    };
  }
  return { id: g.id, name: g.name, kind: g.kind, perUnit: g.perUnit, options: g.options.map(opt) };
}

export function testConfig(doc: PageDoc, opts: { pageKey?: string; mode?: "live" | "preview"; ver?: string; page?: "landing" | "thanks" } = {}): LandingRuntimeConfig {
  const pageKey = opts.pageKey ?? "pk_test_0001";
  const math = offersMath(doc);
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  const display = resolveDisplay(doc, { archetype: doc.theme.archetype, formVariant: "card" });
  const used = new Set<string>();
  const bundles = doc.offers.bundles.map((o, i) => {
    const m = math[i]!;
    const units: (RuntimeOfferLine & { label?: string })[] = expandUnits(o, doc.items).map((s) => {
      if (s.item) used.add(s.item);
      for (const id of s.choices ?? []) used.add(id);
      const base = s.choices && s.surcharge === "difference" ? s.choices.map((id) => toCents(byId.get(id)!.price)).sort((a, b) => a - b) : undefined;
      return {
        line: s.line,
        ...(s.item ? { item: s.item } : {}),
        ...(s.choices ? { choices: s.choices, available: s.available ?? [] } : {}),
        ...(s.distinct ? { distinct: true as const } : {}),
        ...(s.surcharge === "difference" ? { surcharge: true as const, base } : {}),
        ...(s.free ? { free: true as const } : {}),
        ...(s.rules ? { rules: s.rules as RuntimeOfferLine["rules"] } : {}),
        ...(s.label ? { label: s.label } : {}),
      };
    });
    return {
      id: o.id,
      label: offerName({ doc }, o),
      short: offerShort({ doc }, o),
      price: m.price,
      from: m.from,
      ...(m.variable ? { variable: true as const } : {}),
      reference: m.displayReference,
      ...(m.perUnit !== null ? { perUnit: m.perUnit } : {}),
      savings: m.savings,
      savingsPct: m.savingsPct,
      free: effectiveFree(doc, o),
      ...(offerAvailable(o, doc.items) ? {} : { soldOut: true as const }),
      units,
      ...(o.gift ? { gift: o.gift.label } : {}),
    };
  });
  const bump = doc.offers.orderBump?.enabled ? doc.offers.orderBump : undefined;
  if (bump?.item) used.add(bump.item);
  const groupsUsed = doc.items.filter((it) => used.has(it.id)).flatMap((it) => it.groups);
  const features: LandingRuntimeConfig["features"] = [];
  if (groupsUsed.some((g) => g.kind === "matrix")) features.push("matrix");
  if (groupsUsed.some((g) => g.kind === "field") || doc.offers.extras.some((x) => x.kind === "field")) features.push("fields");
  if (display.fill === "steps" || display.fill === "box") features.push("steps-box");
  const phone = phoneSpec(doc.form.phoneCountry);
  return {
    v: 2,
    ver: opts.ver ?? "",
    page: opts.page ?? "landing",
    pageKey,
    mode: opts.mode ?? "live",
    locale: doc.locale,
    dir: doc.locale === "ar" ? "rtl" : "ltr",
    currency: doc.currency,
    endpoints: { order: "/api/public/order", lead: "/api/public/lead" },
    thankYouUrl: "/merci",
    landingUrl: "/",
    phone: { country: phone.country || doc.form.phoneCountry, prefix: phone.prefix, national: phone.national },
    fields: { city: doc.form.city, address: doc.form.address, email: doc.form.email },
    money: { ...moneyFormat(doc.currency, doc.locale), minor: 100 },
    pixels: {},
    strings: {},
    shippingFee: toCents(doc.offers.shippingFee),
    product: { name: doc.product.name, contentId: pageKey },
    items: doc.items.map((it) => ({ id: it.id, name: itemName(doc, it), short: itemShort(doc, it), price: toCents(it.price), contentId: contentIdOf(doc, it, pageKey), groups: it.groups.map((g) => runtimeGroup(g, it)) })),
    bundles,
    extras: doc.offers.extras.map((x) => ({ ...runtimeGroup(x as OptionGroup), scope: x.scope })) as LandingRuntimeConfig["extras"],
    ...(bump ? { bump: { price: toCents(bump.price), ...(bump.item ? { item: bump.item } : {}), ...(bump.offers ? { offers: bump.offers } : {}), title: bump.title } as LandingRuntimeConfig["bump"] } : {}),
    defaultBundleId: defaultOfferId(doc.offers, doc.items),
    fill: display.fill,
    features,
  };
}
