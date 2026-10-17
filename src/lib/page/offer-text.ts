/**
 * Offer sentences for the editors (docs/OFFERS.md §C.4, §H.2, §H.4) — pure, in the page language
 * (ar / fr / en; other locales read English):
 *
 *   offerContents(doc, offer)   "2 × Crème jour + 1 au choix (Nuit ou Sérum) + 1 Trousse en cadeau · 4 pièces"
 *   offerSentence(doc, offer)   "Le client reçoit 1 Crème jour + 1 Crème nuit + 1 Sérum éclat, paie 349 DH
 *                                au lieu de 497 (−148), livraison offerte"
 *
 * Admin only: never rendered on the landing page (the landing has its own microcopy, J.3). Numbers
 * come from pricing.ts `offerMath` (the card numbers) and `effectiveFree`.
 */
import { itemName, itemShort, offerUnits } from "./catalog";
import { formatMoney, numberLocale } from "@/lib/markets/money";
import { fromCents } from "./money";
import { effectiveFree, offerMath } from "./pricing";
import { isChoiceGroup, isFixedPick, isMatrixGroup, type Item, type LineRule, type Locale, type Offer, type OfferLine, type PageDoc } from "./schema";

type SentenceDoc = Pick<PageDoc, "items" | "product" | "locale" | "currency" | "offers">;

interface Words {
  /** "{n} pièces" (n ≥ 2) / "1 pièce" */
  pieces: (n: number) => string;
  or: string;
  /** a catalog item given for free: "{item} en cadeau" */
  gift: (what: string) => string;
  /** a free choice line: "1 cadeau au choix (…)" */
  giftChoice: (n: number, list: string) => string;
  /** "1 au choix (Nuit ou Sérum)" · "2 au choix (…)" · "2 différents au choix (…)" */
  choice: (n: number, list: string, distinct: boolean) => string;
  receives: (contents: string) => string;
  pays: (price: string, from: boolean) => string;
  instead: (ref: string, save: string) => string;
  freeDelivery: string;
  delivery: (fee: string) => string;
}

const WORDS: Partial<Record<Locale, Words>> & { en: Words } = {
  fr: {
    pieces: (n) => (n > 1 ? `${n} pièces` : "1 pièce"),
    or: "ou",
    gift: (what) => `${what} en cadeau`,
    giftChoice: (n, list) => `${n} cadeau${n > 1 ? "x" : ""} au choix (${list})`,
    choice: (n, list, distinct) => `${n}${distinct && n > 1 ? " différents" : ""} au choix (${list})`,
    receives: (c) => `Le client reçoit ${c}`,
    pays: (p, from) => `paie ${from ? "dès " : ""}${p}`,
    instead: (r, s) => `au lieu de ${r} (−${s})`,
    freeDelivery: "livraison offerte",
    delivery: (f) => `+ ${f} de livraison`,
  },
  ar: {
    pieces: (n) => (n === 1 ? "قطعة وحدة" : n === 2 ? "جوج قطع" : n <= 10 ? `${n} قطع` : `${n} قطعة`),
    or: "أو",
    gift: (what) => `${what} هدية`,
    giftChoice: (n, list) => `${n} هدية على اختيارو (${list})`,
    choice: (n, list, distinct) => `${n}${distinct && n > 1 ? " مختلفين" : ""} على اختيارو (${list})`,
    receives: (c) => `الزبون كيتوصل بـ ${c}`,
    pays: (p, from) => `وكيخلص ${from ? "من " : ""}${p}`,
    instead: (r, s) => `بلاصة ${r} (−${s})`,
    freeDelivery: "والتوصيل مجاني",
    delivery: (f) => `+ ${f} ديال التوصيل`,
  },
  en: {
    pieces: (n) => (n > 1 ? `${n} pieces` : "1 piece"),
    or: "or",
    gift: (what) => `${what} free`,
    giftChoice: (n, list) => `${n} free gift${n > 1 ? "s" : ""} of their choice (${list})`,
    choice: (n, list, distinct) => `${n}${distinct && n > 1 ? " different" : ""} of their choice (${list})`,
    receives: (c) => `The customer gets ${c}`,
    pays: (p, from) => `pays ${from ? "from " : ""}${p}`,
    instead: (r, s) => `instead of ${r} (−${s})`,
    freeDelivery: "free delivery",
    delivery: (f) => `+ ${f} delivery`,
  },
};

const wordsOf = (locale: Locale): Words => WORDS[locale] ?? WORDS.en;

/** "Nuit ou Sérum" · "Jour, Nuit ou Sérum". */
function orList(names: readonly string[], w: Words): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${w.or} ${names[names.length - 1]}`;
}

/** The option label a rule fixes or allows on a line: "(Noir)" · "(Noir ou Gris)". */
function ruleNote(item: Item, rules: OfferLine["rules"], w: Words): string {
  if (!rules) return "";
  const labelOf = (key: string, id: string): string => {
    const [gid, did] = key.split(".");
    const g = item.groups.find((x) => x.id === gid);
    if (g && isChoiceGroup(g)) return g.options.find((o) => o.id === id)?.label ?? id;
    if (g && isMatrixGroup(g)) return g.dims.find((d) => d.id === did)?.values.find((v) => v.id === id)?.label ?? id;
    return id;
  };
  const parts: string[] = [];
  for (const [key, r] of Object.entries(rules) as [string, LineRule][]) {
    if ("lock" in r) parts.push(labelOf(key, r.lock));
    else if ("allow" in r) parts.push(orList(r.allow.map((id) => labelOf(key, id)), w));
  }
  return parts.length ? ` (${parts.join(", ")})` : "";
}

/** One line of contents: "1 Crème jour" · "2 × Crème jour" · "1 au choix (Nuit ou Sérum)" · "1 Trousse en cadeau". */
function lineText(doc: SentenceDoc, l: OfferLine, w: Words): string {
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  if (isFixedPick(l.pick)) {
    const it = byId.get(l.pick.item);
    const name = it ? `${itemName(doc, it)}${ruleNote(it, l.rules, w)}` : l.pick.item;
    const piece = l.qty > 1 ? `${l.qty} × ${name}` : `1 ${name}`;
    return l.free ? w.gift(piece) : piece;
  }
  const names = l.pick.choice.map((id) => {
    const it = byId.get(id);
    return it ? itemShort(doc, it) : id;
  });
  return l.free ? w.giftChoice(l.qty, orList(names, w)) : w.choice(l.qty, orList(names, w), l.pick.distinct);
}

/** What the customer receives: the lines in order, then the offer's non-catalog gift. */
function contentsOf(doc: SentenceDoc, offer: Pick<Offer, "lines" | "gift">, w: Words): string {
  const parts = offer.lines.map((l) => lineText(doc, l, w));
  if (offer.gift?.label.trim()) parts.push(offer.gift.label.trim());
  return parts.join(" + ");
}

/** "2 × Crème jour + 1 au choix (Nuit ou Sérum) + 1 Trousse en cadeau · 4 pièces" (the composer's read-only line). */
export function offerContents(doc: SentenceDoc, offer: Pick<Offer, "lines" | "gift">): string {
  const w = wordsOf(doc.locale);
  return `${contentsOf(doc, offer, w)} · ${w.pieces(offerUnits(offer))}`;
}

/**
 * "Le client reçoit 1 Crème jour + 1 Crème nuit + 1 Sérum éclat, paie 349 DH au lieu de 497 (−148),
 * livraison offerte" — the card numbers: `from` ("dès" when options can cost more), the struck
 * reference and the saving when the card shows them, and the delivery the order really pays.
 */
export function offerSentence(doc: SentenceDoc, offer: Offer): string {
  const w = wordsOf(doc.locale);
  const m = offerMath(doc, offer);
  const money = (cents: number) => formatMoney(fromCents(cents), doc.currency, doc.locale);
  const num = (cents: number) => new Intl.NumberFormat(numberLocale(doc.locale, doc.currency), { maximumFractionDigits: 2, numberingSystem: "latn" }).format(fromCents(cents));
  const parts = [w.receives(contentsOf(doc, offer, w)), w.pays(money(m.from), m.variable)];
  if (m.showReference) parts[1] += ` ${w.instead(num(m.displayReference), num(m.savings))}`;
  const delivery = effectiveFree(doc, offer) ? w.freeDelivery : w.delivery(formatMoney(doc.offers.shippingFee, doc.currency, doc.locale));
  return doc.locale === "ar" ? `${parts.join(" ")}، ${delivery}` : `${parts.join(", ")}, ${delivery}`;
}
