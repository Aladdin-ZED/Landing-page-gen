/**
 * Reviews data model: schema, local microcopy and product-aware sample defaults.
 * Reviews are merchant content — defaults are realistic samples flagged `sample: true` so the admin
 * asks for real reviews before publishing.
 */
import { z } from "zod";
import { AssetRef } from "@/lib/page/schema";
import { createT } from "../../i18n";
import type { DefaultsInput, SectionProps } from "../../types";
import { garmentOf } from "../garment";
import { CITIES, FAMILY_REVIEWS, PEOPLE, UNIVERSAL_REVIEWS, WHEN, WOMEN, familyOf, garmentReviews, langOf, pickOne, shuffle, womenOnly, type L3 } from "./copy";

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const Review = z.object({
  name: z.string().min(1).max(40),
  city: z.string().max(40).default(""),
  /** shown as written ("Il y a 2 jours", "12 sept.") */
  date: z.string().max(32).default(""),
  rating: z.number().int().min(1).max(5).default(5),
  title: z.string().max(80).default(""),
  text: z.string().min(1).max(520),
  /** photo sent by the customer */
  photo: AssetRef.optional(),
  /** what they bought, e.g. "Commande : Pack Duo" */
  detail: z.string().max(60).default(""),
  verified: z.boolean().default(true),
});

const Breakdown = z.object({
  five: z.number().int().min(0).max(1_000_000).default(0),
  four: z.number().int().min(0).max(1_000_000).default(0),
  three: z.number().int().min(0).max(1_000_000).default(0),
  two: z.number().int().min(0).max(1_000_000).default(0),
  one: z.number().int().min(0).max(1_000_000).default(0),
});

export const schema = z.object({
  kicker: z.string().max(60).default(""),
  title: z.string().max(140).default(""),
  lead: z.string().max(260).default(""),
  items: z.array(Review).min(1).max(12),
  /** show the score (product rating when set, else the average of the reviews shown) */
  showSummary: z.boolean().default(true),
  /** real star counts (summary bars); all zero → bars computed from the reviews shown, when honest */
  breakdown: Breakdown.default({ five: 0, four: 0, three: 0, two: 0, one: 0 }),
  /** button under the reviews; empty hides it */
  cta: z.string().max(60).default(""),
  sample: z.boolean().default(false),
});

export type Data = z.infer<typeof schema>;
export type Item = Data["items"][number];
export type Props = SectionProps<Data>;

/* ------------------------------------------------------------------ */
/* Local microcopy (not in the shared i18n table)                      */
/* ------------------------------------------------------------------ */

export const UI = {
  average: { ar: "التقييم العام", fr: "Note moyenne", en: "Average rating" },
  shown: { ar: "معدل الآراء المعروضة", fr: "Moyenne des avis affichés", en: "Average of the reviews shown" },
  spread: { ar: "توزيع التقييمات", fr: "Répartition des notes", en: "Rating breakdown" },
  starsN: { ar: "{n} نجوم: {p}", fr: "{n} étoiles : {p}", en: "{n} stars: {p}" },
  photos: { ar: "تصاور الزبناء", fr: "Photos des clients", en: "Customer photos" },
  photoOf: { ar: "صورة من {name}", fr: "Photo envoyée par {name}", en: "Photo from {name}" },
  prev: { ar: "الرأي السابق", fr: "Avis précédent", en: "Previous review" },
  next: { ar: "الرأي التالي", fr: "Avis suivant", en: "Next review" },
  slide: { ar: "الرأي {n} من {total}", fr: "Avis {n} sur {total}", en: "Review {n} of {total}" },
  pick: { ar: "اختار رأي", fr: "Choisir un avis", en: "Choose a review" },
} satisfies Record<string, L3>;

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const TITLES: readonly L3[] = [
  { ar: "وصلهم، جربوه، و*عجبهم*", fr: "Reçu, testé, *adopté*", en: "Delivered, tried, *loved*" },
  { ar: "شنو قالو اللي *جربوه*", fr: "Ils l'ont reçu, ils en *parlent*", en: "In their own *words*" },
  { ar: "الكلمة للزبناء *ديالنا*", fr: "La parole à ceux qui l'ont *essayé*", en: "From people who *tried it*" },
];

const LEADS: readonly L3[] = [
  {
    ar: "طلبيات وصلات لجميع المدن، وهادشي اللي كتبو لينا من بعد.",
    fr: "Des colis livrés aux quatre coins du pays, et ce qu'on nous a écrit ensuite.",
    en: "Parcels delivered all over the country, and what people wrote back.",
  },
  {
    ar: "خلصو عند الاستلام، عاينو قبل ما يخلصو، وهادا رأيهم.",
    fr: "Ils ont payé à la livraison, vérifié avant de payer, puis ils nous ont écrit.",
    en: "They paid on delivery, checked before paying, then wrote to us.",
  },
  {
    ar: "رسائل حقيقية من ناس طلبو، توصلو، وعاودو طلبو.",
    fr: "Des messages de gens qui ont commandé, reçu, puis recommandé.",
    en: "Messages from people who ordered, received, and ordered again.",
  },
];

const KICKER: L3 = { ar: "آراء الزبناء", fr: "Avis clients", en: "Customer reviews" };
const CTA: readonly L3[] = [
  { ar: "بغيت نجربو", fr: "Je veux l'essayer", en: "I want to try it" },
  { ar: "اطلب دابا", fr: "Je commande", en: "Order now" },
];
const ORDERED: L3 = { ar: "الطلب: {x}", fr: "Commande : {x}", en: "Ordered: {x}" };

export function defaults({ locale, product, offers, rng }: DefaultsInput): Data {
  const L = langOf(locale);
  const t = createT(locale);
  // a garment's sample reviews talk about fabric and size, never "the box is gift-ready"
  const garment = garmentOf(product);
  const fam = shuffle(garment ? garmentReviews(garment) : FAMILY_REVIEWS[familyOf(product.category)], rng);
  const uni = shuffle(UNIVERSAL_REVIEWS, rng);
  // product voices lead, delivery / pay-on-delivery voices are woven in between
  const order = [fam[0], uni[0], fam[1], fam[2], uni[1], uni[2]].filter((x) => x !== undefined);
  // women's and girls' modest wear is reviewed by women (and mothers), never by a man
  const people = womenOnly(garment) ? shuffle(WOMEN, rng).map((k) => PEOPLE[k]!) : shuffle(PEOPLE, rng);
  const cities = shuffle(CITIES, rng);
  const items: Item[] = order.map((c, i) => {
    const b = pickOne(offers.bundles, rng);
    const label = b.title?.trim() || t("bundle.qty", { n: b.qty });
    return {
      name: people[i]![L],
      city: cities[i]![L],
      date: WHEN[i]![L],
      rating: c.rating ?? 5,
      title: c.title[L],
      text: c.text[L],
      detail: i % 2 === 0 ? ORDERED[L].replace("{x}", label) : "",
      verified: true,
    };
  });
  return {
    kicker: KICKER[L],
    title: pickOne(TITLES, rng)[L],
    lead: pickOne(LEADS, rng)[L],
    items,
    showSummary: true,
    breakdown: { five: 0, four: 0, three: 0, two: 0, one: 0 },
    cta: pickOne(CTA, rng)[L],
    sample: true,
  };
}
