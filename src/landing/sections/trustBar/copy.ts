/**
 * Trust bar default copy — the four COD promises a Moroccan shopper looks for before ordering
 * (pay on delivery, fast delivery, check before paying, easy exchange), written per language and
 * tuned to the product: what "checking" means for a perfume is not what it means for a blender.
 * Claims stay true by construction: "free" delivery only when no fee is charged and every pack
 * ships free; no country is named, so the copy holds in any market.
 */
import type { IconName } from "@/landing/primitives";
import type { Locale, Offers, Product, ProductCategory } from "@/lib/page/schema";
import { garmentOf } from "../garment";

type Lang = "ar" | "fr" | "en";
type Family = "care" | "scent" | "style" | "tech" | "home" | "kids" | "natural" | "general";

const FAMILY: Partial<Record<ProductCategory, Family>> = {
  beauty: "care",
  skincare: "care",
  haircare: "care",
  grooming: "care",
  fragrance: "scent",
  jewelry: "style",
  watches: "style",
  fashion: "style",
  bags: "style",
  fitness: "tech",
  sport: "tech",
  tech: "tech",
  gadgets: "tech",
  car: "tech",
  tools: "tech",
  kitchen: "home",
  home: "home",
  cleaning: "home",
  decor: "home",
  garden: "home",
  kids: "kids",
  toys: "kids",
  pets: "kids",
  health: "natural",
  supplements: "natural",
  "organic-food": "natural",
  traditional: "natural",
};

const langOf = (l: Locale): Lang => (l === "ar" || l === "fr" ? l : "en");
const familyOf = (c: ProductCategory | undefined): Family => (c && FAMILY[c]) || "general";

/** Deterministic pick from the defaults rng. */
function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;
}

interface Lines {
  titles: readonly string[];
  cod: { title: string; ring: string; details: readonly string[] };
  delivery: { title: string; freeTitle: string; ring: string; freeRing: string; details: readonly string[] };
  check: { title: string; ring: string; details: Readonly<Record<Family, string>> };
  exchange: { title: string; ring: string; picked: string; plain: string };
}

const COPY: Readonly<Record<Lang, Lines>> = {
  fr: {
    titles: ["Commandez *l'esprit tranquille*", "Vous payez *à la réception*", "Zéro avance, *zéro risque*"],
    cod: {
      title: "Paiement à la livraison",
      ring: "Paiement à la livraison",
      details: [
        "Vous payez en espèces, au livreur.",
        "Rien à payer avant d'avoir le colis en main.",
        "Pas de carte bancaire\u00a0: vous réglez à la porte.",
      ],
    },
    delivery: {
      title: "Livré en 24–48h",
      freeTitle: "Livraison offerte, 24–48h",
      ring: "Livraison 24–48h",
      freeRing: "Livraison offerte",
      details: ["Chez vous, dans toutes les villes.", "À votre porte, où que vous soyez."],
    },
    check: {
      title: "Vérifiez avant de payer",
      ring: "Vérifiez avant de payer",
      details: {
        care: "Ouvrez le colis, regardez le flacon, puis payez.",
        scent: "Le flacon scellé, sous vos yeux, à la porte.",
        style: "Regardez-le de près, puis payez.",
        tech: "Ouvrez le colis et allumez-le devant le livreur.",
        home: "Ouvrez le colis et vérifiez chaque pièce.",
        kids: "Ouvrez le colis et vérifiez tout, sur place.",
        natural: "Vérifiez le produit et sa date, sur place.",
        general: "Ouvrez le colis devant le livreur.",
      },
    },
    exchange: {
      title: "Échange facile sous 7 jours",
      ring: "Échange 7 jours",
      picked: "Pas le bon choix\u00a0? On vous l'échange.",
      plain: "Un souci à la réception\u00a0? On l'échange.",
    },
  },
  ar: {
    titles: ["اطلب و*بالك مرتاح*", "ما كتخلص *حتى توصلك*", "بلا تسبيق، *بلا مخاطرة*"],
    cod: {
      title: "الدفع عند الاستلام",
      ring: "الدفع عند الاستلام",
      details: ["تدفع نقداً للموزّع عند باب منزلك.", "ما كتخلص والو حتى يوصلك الطلب.", "بلا بطاقة بنكية: تخلص عند الباب."],
    },
    delivery: {
      title: "توصيل خلال 24–48 ساعة",
      freeTitle: "توصيل مجاني خلال 24–48 ساعة",
      ring: "توصيل سريع",
      freeRing: "توصيل مجاني",
      details: ["إلى باب منزلك، في جميع المدن.", "حتى لباب الدار، فين ما كنتي."],
    },
    check: {
      title: "عاين قبل ما تخلص",
      ring: "عاين قبل الدفع",
      details: {
        care: "افتح الطرد وتأكد من العبوة، ثم ادفع.",
        scent: "القنينة مختومة، تشوفها بعينيك عند الباب.",
        style: "تفحّصه جيداً، ثم ادفع.",
        tech: "افتح الطرد وشغّله أمام الموزّع.",
        home: "افتح الطرد وتأكد من كل قطعة.",
        kids: "افتح الطرد وتأكد من كل شيء في عين المكان.",
        natural: "تأكد من المنتج وتاريخ صلاحيته عند الباب.",
        general: "افتح الطرد أمام الموزّع وتأكد منه.",
      },
    },
    exchange: {
      title: "تبديل سهل خلال 7 أيام",
      ring: "تبديل سهل",
      picked: "ما عجبكش الاختيار؟ نبدلوه ليك.",
      plain: "شي مشكل عند الاستلام؟ نبدلوه ليك.",
    },
  },
  en: {
    titles: ["Order with *peace of mind*", "You pay *on arrival*", "Nothing upfront, *no risk*"],
    cod: {
      title: "Cash on delivery",
      ring: "Cash on delivery",
      details: ["Pay the courier in cash, at your door.", "Nothing to pay until it's in your hands.", "No card needed: you pay at the door."],
    },
    delivery: {
      title: "Delivered in 24–48h",
      freeTitle: "Free delivery in 24–48h",
      ring: "Fast delivery",
      freeRing: "Free delivery",
      details: ["Right to your door, in every city.", "To your door, wherever you are."],
    },
    check: {
      title: "Check before you pay",
      ring: "Check before paying",
      details: {
        care: "Open the parcel, look at the bottle, then pay.",
        scent: "Inspect the sealed bottle at your door.",
        style: "Look it over closely, then pay.",
        tech: "Open it and switch it on in front of the courier.",
        home: "Open the parcel and check every piece.",
        kids: "Open the parcel and check everything first.",
        natural: "Check the product and its date at the door.",
        general: "Open the parcel in front of the courier.",
      },
    },
    exchange: {
      title: "Easy 7-day exchange",
      ring: "7-day exchange",
      picked: "Wrong pick? We'll swap it.",
      plain: "Any issue on arrival? We swap it.",
    },
  },
};

export interface ClaimCopy {
  icon: IconName;
  title: string;
  detail: string;
  badge: string;
}

/** Free delivery is claimed only when no fee is added and every pack ships free. */
export function freeDelivery(offers: Offers): boolean {
  return (offers.shippingFee ?? 0) === 0 && offers.bundles.every((b) => b.freeShipping);
}

/** Default heading + the four promises, in the page language and tuned to the product. */
export function defaultCopy(locale: Locale, product: Product, offers: Offers, rng: () => number): { title: string; items: ClaimCopy[] } {
  const c = COPY[langOf(locale)];
  const free = freeDelivery(offers);
  const choice = product.variants.some((g) => g.options.length > 1);
  return {
    title: pick(rng, c.titles),
    items: [
      { icon: "cash-hand", title: c.cod.title, detail: pick(rng, c.cod.details), badge: c.cod.ring },
      {
        icon: "truck",
        title: free ? c.delivery.freeTitle : c.delivery.title,
        detail: pick(rng, c.delivery.details),
        badge: free ? c.delivery.freeRing : c.delivery.ring,
      },
      { icon: "eye", title: c.check.title, detail: c.check.details[garmentOf(product) ? "style" : familyOf(product.category)], badge: c.check.ring },
      { icon: "return", title: c.exchange.title, detail: choice ? c.exchange.picked : c.exchange.plain, badge: c.exchange.ring },
    ],
  };
}
