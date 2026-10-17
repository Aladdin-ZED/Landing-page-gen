/**
 * Test documents (selftests only): the fixtures duo / tshirt / colors and the docs/OFFERS.md §C.5–C.6
 * cases built on them — the owner's example, BOGO, any 2 of 3 (distinct + difference), ×2 matrix with
 * XL +20, color locks, ×3 allow + preset, a name to print, extras, a bump item, a gift.
 */
import { getFixture } from "../../lib/page/fixtures";
import { PageDoc } from "../../lib/page/schema";

export type Doc = ReturnType<typeof PageDoc.parse>;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const reparse = (raw: unknown): Doc => PageDoc.parse(raw);

export function duo(locale: "fr" | "ar" = "fr"): Doc {
  return getFixture("duo", { locale, now: "2026-10-16T10:00:00.000Z" }).doc;
}
export function tshirt(locale: "fr" | "ar" = "fr"): Doc {
  return getFixture("tshirt", { locale, now: "2026-10-16T10:00:00.000Z" }).doc;
}
export function colors(locale: "fr" | "ar" = "ar"): Doc {
  return getFixture("colors", { locale, now: "2026-10-16T10:00:00.000Z" }).doc;
}

/** duo + a field on the sérum, a gift-wrap extra, the sérum as bump, BOGO, any 2 of 3, a gift. */
export function kitchen(fee = 0): Doc {
  const d = clone(duo()) as Record<string, unknown> & Doc;
  const items = d.items as Doc["items"];
  items[0]!.groups = [
    {
      id: "g-tone",
      kind: "swatch",
      name: "Teinte",
      perUnit: true,
      display: "auto",
      options: [
        { id: "o-claire", label: "Claire", swatch: "#f1ddc9", soldOut: false },
        { id: "o-doree", label: "Dorée", swatch: "#d9a86c", soldOut: false, delta: 10 },
      ],
    },
  ] as Doc["items"][number]["groups"];
  items[2]!.groups = [
    { id: "g-name", kind: "field", name: "Prénom", perUnit: true, input: "text", required: false, maxLength: 12, charset: "letters", delta: 30 },
    { id: "g-size", kind: "text", name: "Format", perUnit: false, display: "auto", options: [{ id: "o-30", label: "30 ml", soldOut: false }, { id: "o-50", label: "50 ml", soldOut: false, delta: 40 }] },
  ] as Doc["items"][number]["groups"];
  const offers = d.offers as Doc["offers"];
  offers.bundles.push(
    { id: "bogo", price: 149, badge: "custom", badgeText: "1 + 1 offert", lines: [{ id: "l1", qty: 1, pick: { item: "main" } }, { id: "l2", qty: 1, pick: { item: "main" }, free: true }] } as never,
    { id: "any2", title: "2 au choix", price: 279, lines: [{ id: "l1", qty: 2, pick: { choice: ["main", "nuit", "serum"], distinct: true, surcharge: "difference" } }] } as never,
    { id: "combo", price: 249, lines: [{ id: "l1", qty: 1, pick: { item: "main" } }, { id: "l2", qty: 1, pick: { item: "nuit" } }], gift: { label: "Trousse de voyage offerte" } } as never,
  );
  offers.extras = [{ id: "g-wrap", kind: "text", name: "Emballage cadeau", scope: ["duo", "trio"], perUnit: true, display: "auto", options: [{ id: "o-no", label: "Non", soldOut: false }, { id: "o-yes", label: "Oui", soldOut: false, delta: 15 }] }] as never;
  offers.orderBump = { enabled: true, title: "Ajoutez le sérum", description: "", price: 99, item: "serum", offers: ["one", "duo"] } as never;
  offers.shippingFee = fee;
  return reparse(d);
}

/** tshirt (×1, ×2 popular, ×3) + the name-to-print field (optional, +30) */
export function tee(fee = 0): Doc {
  const d = clone(tshirt()) as Doc;
  const it = d.items[0]!;
  if (!it.groups.some((g) => g.kind === "field"))
    it.groups.push({ id: "g-name", kind: "field", name: "Prénom à imprimer", perUnit: true, input: "text", required: false, maxLength: 12, charset: "letters", delta: 30 } as never);
  d.offers.shippingFee = fee;
  return reparse(d);
}
