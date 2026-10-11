/**
 * Default copy of the sticky order CTA: a short action verb for the button and two reassurance lines
 * that take turns above the price. Only promises every COD store on the platform keeps: payment at
 * the door, the 24–48h delivery window, and free delivery — the latter only when the page's offers
 * really charge no delivery fee. The archetype picks the voice (spare luxury/precision pages never
 * get the chatty verbs). Locales without a hand-written set return "" so the kit microcopy
 * (ctx.t "sticky.cta" / "trust.cod") applies.
 */
import type { Archetype, Locale } from "@/lib/page/schema";

type Voice = "spare" | "bold" | "warm" | "playful";

const VOICE: Readonly<Record<Archetype, Voice>> = {
  maison: "spare",
  editorial: "spare",
  circuit: "spare",
  kinetic: "bold",
  garage: "bold",
  souk: "warm",
  hearth: "warm",
  field: "warm",
  apothecary: "warm",
  playground: "playful",
  // beauty glow is also a calm language (modest wear, soft beauty): a warm verb, never "Je craque"
  bloom: "warm",
};

interface CopySet {
  label: Readonly<Record<Voice, readonly string[]>>;
  cod: readonly string[];
  free: readonly string[];
  fast: readonly string[];
}

/** Written for the launch markets (ar · fr · en). Lines stay ≈ 25 characters: they share a phone bar with the price. */
const COPY: Readonly<Partial<Record<Locale, CopySet>>> = {
  fr: {
    label: {
      spare: ["Commander"],
      bold: ["Je commande", "Commander"],
      warm: ["Commander", "Je commande"],
      playful: ["Je craque", "Je commande"],
    },
    cod: ["Paiement à la livraison", "Payez à la réception", "Rien à payer d’avance"],
    free: ["Livraison offerte", "Livraison gratuite"],
    fast: ["Livraison 24–48h", "Chez vous en 24–48h"],
  },
  ar: {
    label: {
      spare: ["اطلب الآن"],
      bold: ["اطلب دابا", "اطلب الآن"],
      warm: ["اطلب الآن", "اطلب دابا"],
      playful: ["اطلب ديالك", "اطلب دابا"],
    },
    cod: ["الدفع عند الاستلام", "خلّص ملي توصلك", "ما كتخلص حتى توصلك"],
    free: ["التوصيل مجاني", "التوصيل علينا"],
    fast: ["توصيل فـ 24–48 ساعة", "كتوصلك فـ 24–48 ساعة"],
  },
  en: {
    label: {
      spare: ["Order now"],
      bold: ["Order now", "Get yours"],
      warm: ["Order now", "Get yours"],
      playful: ["Get yours", "I want one"],
    },
    cod: ["Pay on delivery", "Cash on delivery", "Nothing to pay upfront"],
    free: ["Free delivery", "Delivery is on us"],
    fast: ["Delivered in 24–48h", "At your door in 24–48h"],
  },
};

const pick = (pool: readonly string[], rng: () => number): string => pool[Math.floor(rng() * pool.length)] ?? pool[0] ?? "";

export interface StickyCopy {
  label: string;
  note: string;
  note2: string;
}

/** Button verb + the two alternating reassurance lines for a new page. */
export function stickyCopy(locale: Locale, archetype: Archetype, freeDelivery: boolean, rng: () => number): StickyCopy {
  const set = COPY[locale];
  if (!set) return { label: "", note: "", note2: "" };
  return {
    label: pick(set.label[VOICE[archetype] ?? "warm"], rng),
    note: pick(set.cod, rng),
    note2: pick(freeDelivery ? set.free : set.fast, rng),
  };
}
