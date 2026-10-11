/**
 * Default announcement lines. Only promises every COD store on the platform keeps: payment at the
 * door, the 24–48h delivery window, opening the parcel before paying, and free delivery — the last
 * one is added by defaults() only when the page's offers really ship free. Three phrasings per
 * pledge (neutral · warm · crisp) so two generated pages rarely read alike; the archetype picks the
 * voice: spare archetypes never get the chatty one.
 */
import type { Archetype, Locale } from "@/lib/page/schema";
import type { IconName } from "../../primitives";

export type Pledge = "cod" | "delivery" | "check" | "free";

/** [neutral, warm, crisp] */
type Phrasings = readonly [string, string, string];

const EN: Record<Pledge, Phrasings> = {
  cod: ["Cash on delivery", "Nothing to pay until it arrives", "Pay on arrival"],
  delivery: ["24–48h delivery nationwide", "At your door in 24–48h", "Delivered in 24–48h"],
  check: ["Check it before you pay", "Open your parcel before paying", "Check first, pay after"],
  free: ["Free delivery", "Delivery is on us", "No delivery fee"],
};

/** Written for the launch markets; other locales fall back to English, like the kit microcopy. */
const LINES: Readonly<Partial<Record<Locale, Record<Pledge, Phrasings>>>> = {
  ar: {
    cod: ["الدفع عند الاستلام", "ما كتخلص حتى توصلك طلبيتك", "خلّص ملي توصلك"],
    delivery: ["توصيل فـ 24–48 ساعة لجميع المدن", "كتوصلك حتى لباب الدار فـ 24–48 ساعة", "التوصيل فـ 24–48 ساعة"],
    check: ["عاين قبل ما تخلص", "حلّ الكولي، شوف، ومن بعد خلّص", "شوف قبل ما تخلص"],
    free: ["التوصيل مجاني", "توصيل مجاني لجميع المدن", "التوصيل علينا"],
  },
  fr: {
    cod: ["Paiement à la livraison", "Rien à payer avant la livraison", "Payez à la réception"],
    delivery: ["Livraison 24–48h partout au Maroc", "Livré chez vous en 24–48h", "Chez vous en 24–48h"],
    check: ["Vérifiez avant de payer", "Ouvrez le colis avant de payer", "Ouvrez, vérifiez, payez"],
    free: ["Livraison offerte", "La livraison est offerte", "Livraison gratuite"],
  },
  en: EN,
};

export const PLEDGE_ICON: Readonly<Record<Pledge, IconName>> = {
  cod: "cash-hand",
  delivery: "truck",
  check: "eye",
  free: "box",
};

/** Archetypes with a spare voice (luxury, precision, sport, editorial): neutral or crisp only. */
const SPARE: ReadonlySet<Archetype> = new Set(["maison", "circuit", "editorial", "kinetic", "garage"]);

/** One phrasing of a pledge for this locale and archetype, picked with the defaults rng. */
export function line(locale: Locale, pledge: Pledge, archetype: Archetype, rng: () => number): string {
  const [neutral, warm, crisp] = (LINES[locale] ?? EN)[pledge];
  const pool = SPARE.has(archetype) ? [neutral, crisp] : [neutral, warm, crisp];
  return pool[Math.floor(rng() * pool.length)] ?? neutral;
}
