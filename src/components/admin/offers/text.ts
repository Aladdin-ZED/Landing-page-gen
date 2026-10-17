/**
 * Offer sentences for the editors (docs/OFFERS.md §C.4 `offerSentence`, admin only, page language):
 * "Le client reçoit 1 Crème jour + 1 Crème nuit + 1 Sérum, paie 349 DH au lieu de 497 (−148),
 * livraison offerte", and the composer's contents line "2 × Crème jour + 1 au choix (Nuit ou
 * Sérum) + Trousse offerte · 4 pièces". GN's src/lib/page/offer-text.ts takes over when it lands.
 */
import { itemShort, offerUnits } from "@/lib/page/catalog";
import { ruleTarget } from "@/lib/page/options";
import { formatMoney } from "@/lib/markets/money";
import { effectiveFree, fromCents, offerMath } from "@/lib/page/pricing";
import { isFixedPick, type Locale, type Offer, type PageDoc } from "@/lib/page/schema";

type SentenceDoc = Pick<PageDoc, "items" | "offers" | "product" | "locale" | "currency">;

interface Words {
  gets: string;
  pays: (price: string) => string;
  from: (price: string) => string;
  instead: (ref: string, saved: string) => string;
  freeDelivery: string;
  delivery: (fee: string) => string;
  choice: (n: number, list: string) => string;
  or: string;
  free: string;
  pieces: (n: number) => string;
  /** clause separator ("، " in Arabic) */
  comma: string;
}

const W: Partial<Record<Locale, Words>> & { en: Words } = {
  fr: {
    gets: "Le client reçoit",
    pays: (p) => `paie ${p}`,
    from: (p) => `paie dès ${p}`,
    instead: (r, s) => ` au lieu de ${r} (−${s})`,
    freeDelivery: "livraison offerte",
    delivery: (f) => `+ ${f} de livraison`,
    choice: (n, l) => `${n} au choix (${l})`,
    or: " ou ",
    free: "offert",
    pieces: (n) => `${n} pièce${n > 1 ? "s" : ""}`,
    comma: ", ",
  },
  ar: {
    gets: "الزبون كياخد",
    pays: (p) => `وكيخلص ${p}`,
    from: (p) => `وكيخلص من ${p}`,
    instead: (r, s) => ` عوض ${r} (−${s})`,
    freeDelivery: "التوصيل بلاش",
    delivery: (f) => `+ ${f} ديال التوصيل`,
    choice: (n, l) => `${n} على اختيارو (${l})`,
    or: " أو ",
    free: "هدية",
    pieces: (n) => `${n} ${n > 1 ? "قطع" : "قطعة"}`,
    comma: "، ",
  },
  en: {
    gets: "The customer gets",
    pays: (p) => `pays ${p}`,
    from: (p) => `pays from ${p}`,
    instead: (r, s) => ` instead of ${r} (−${s})`,
    freeDelivery: "free delivery",
    delivery: (f) => `+ ${f} delivery`,
    choice: (n, l) => `${n} of their choice (${l})`,
    or: " or ",
    free: "free",
    pieces: (n) => `${n} piece${n > 1 ? "s" : ""}`,
    comma: ", ",
  },
};

const words = (l: Locale): Words => W[l] ?? W.en;

/** "2 × Crème jour + 1 au choix (Nuit ou Sérum) + Trousse offerte" */
export function contentsText(doc: Pick<PageDoc, "items" | "product" | "locale">, offer: Pick<Offer, "lines" | "gift">): string {
  const w = words(doc.locale);
  const name = (id: string) => {
    const it = doc.items.find((x) => x.id === id);
    return it ? itemShort(doc, it) : id;
  };
  /** "Noir" for a line whose color is fixed (locks only; limits and presets don't change the contents) */
  const locks = (itemId: string, rules: Offer["lines"][number]["rules"]) => {
    const it = doc.items.find((x) => x.id === itemId);
    if (!it || !rules) return "";
    const labels: string[] = [];
    for (const [key, r] of Object.entries(rules)) {
      if (!("lock" in r)) continue;
      const t = ruleTarget(it, key);
      const values = t ? (t.kind === "choice" ? t.group.options : t.dim.values) : [];
      const v = values.find((x) => x.id === r.lock);
      if (v) labels.push(v.label);
    }
    return labels.length ? ` · ${labels.join(" · ")}` : "";
  };
  const parts = offer.lines.map((l) => {
    const what = isFixedPick(l.pick) ? `${l.qty} × ${name(l.pick.item)}${locks(l.pick.item, l.rules)}` : w.choice(l.qty, l.pick.choice.map(name).join(w.or));
    return l.free ? `${what} ${w.free}` : what;
  });
  if (offer.gift?.label) parts.push(`${offer.gift.label}`);
  return parts.join(" + ");
}

/** contents · "4 pièces" */
export function contentsLine(doc: Pick<PageDoc, "items" | "product" | "locale">, offer: Pick<Offer, "lines" | "gift">): string {
  return `${contentsText(doc, offer)} · ${words(doc.locale).pieces(offerUnits(offer))}`;
}

/** The whole deal in one sentence (page language). */
export function offerSentence(doc: SentenceDoc, offer: Offer): string {
  const w = words(doc.locale);
  const m = offerMath(doc, offer);
  const money = (c: number) => formatMoney(fromCents(c), doc.currency, doc.locale);
  const plain = (c: number) => formatMoney(fromCents(c), doc.currency, doc.locale).replace(/[^\d\s.,٫٬  ]/g, "").trim();
  const pay = m.variable ? w.from(money(m.from)) : w.pays(money(m.from));
  const was = m.showReference ? w.instead(plain(m.displayReference), plain(m.savings)) : "";
  const fee = effectiveFree(doc, offer) ? w.freeDelivery : w.delivery(formatMoney(doc.offers.shippingFee, doc.currency, doc.locale));
  return `${w.gets} ${contentsText(doc, offer)}${w.comma}${pay}${was}${w.comma}${fee}`;
}
