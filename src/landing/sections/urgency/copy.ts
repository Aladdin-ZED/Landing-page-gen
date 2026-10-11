/**
 * Default copy and date wording of the urgency section (ar · fr · en). Every line stays true whatever
 * the merchant's numbers: the countdown, the stock and the end date are always real data, the copy
 * only frames them. Arabic is clear MSA with light Moroccan touches. Dates are formatted from epoch
 * milliseconds (no Date objects: renders stay pure) in the market's own time zone.
 */
import type { Locale, Market } from "@/lib/page/schema";
import { isoToMs } from "../../primitives";
import { headlineName } from "../orderForm/copy";

type L = Record<"ar" | "fr" | "en", string>;

const tr = (locale: Locale, p: L): string => (locale === "ar" || locale === "fr" ? p[locale] : p.en);
const pick = <T,>(rng: () => number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;

export interface UrgencyCopy {
  kicker: string;
  countdownTitle: string;
  stockTitle: string;
  promiseTitle: string;
  route: RouteStop[];
}

export interface RouteStop {
  when: string;
  what: string;
}

export function urgencyCopy(locale: Locale, productName: string, rng: () => number): UrgencyCopy {
  const short = headlineName(productName);
  const countdown: L[] = [
    { ar: "ثمن الإطلاق *قرب يسالي*", fr: "Le prix de lancement *s'arrête bientôt*", en: "The launch price *ends soon*" },
    { ar: "هاد الثمن *غير حتى يسالي العداد*", fr: "Ce prix tient *jusqu'au bout du compteur*", en: "This price holds *until the timer stops*" },
  ];
  if (short)
    countdown.push({
      ar: `${short} بهاد الثمن، *ماشي لمدة طويلة*`,
      fr: `${short} à ce prix, *plus pour longtemps*`,
      en: `${short} at this price, *not for long*`,
    });
  const stock: L[] = [
    { ar: "بقات *غير شوية* فالمخزون", fr: "Il en reste *très peu*", en: "Only *a few* left" },
    { ar: "كل نهار، المخزون *كينقص*", fr: "Chaque jour, le stock *fond*", en: "Every day, the stock *drops*" },
  ];
  const promise: L[] = [
    { ar: "اطلب اليوم، *توصلك فـ 24–48 ساعة*", fr: "Commandez aujourd'hui, *chez vous en 24–48 h*", en: "Order today, *at your door in 24–48h*" },
    { ar: "من اليوم *حتى لباب الدار*", fr: "D'aujourd'hui *à votre porte*", en: "From today *to your door*" },
  ];
  const kickers: L[] = [
    { ar: "ما تفوتهاش", fr: "À ne pas rater", en: "Don't miss it" },
    { ar: "معلومة مهمة", fr: "Bon à savoir", en: "Good to know" },
  ];
  return {
    kicker: tr(locale, pick(rng, kickers)),
    countdownTitle: tr(locale, pick(rng, countdown)),
    stockTitle: tr(locale, pick(rng, stock)),
    promiseTitle: tr(locale, pick(rng, promise)),
    route: routeStops(locale),
  };
}

/** The stops of the honest delivery route shown when there is no countdown or stock to report. */
export function routeStops(locale: Locale): RouteStop[] {
  const stops: { when: L; what: L }[] = [
    {
      when: { ar: "اليوم", fr: "Aujourd'hui", en: "Today" },
      what: { ar: "كتطلب فـ 30 ثانية، بلا حساب", fr: "Vous commandez en 30 secondes", en: "You order in 30 seconds" },
    },
    {
      when: { ar: "خلال 24 ساعة", fr: "Sous 24 h", en: "Within 24h" },
      what: { ar: "كنعيطو ليك باش نأكدو الطلب", fr: "Un appel pour confirmer", en: "A quick call to confirm" },
    },
    {
      when: { ar: "24–48 ساعة", fr: "24–48 h", en: "24–48h" },
      what: { ar: "توصلك، وكتخلص عند الاستلام", fr: "Livré chez vous, payé à la réception", en: "Delivered, paid on arrival" },
    },
  ];
  return stops.map((s) => ({ when: tr(locale, s.when), what: tr(locale, s.what) }));
}

/** "Jusqu'au {date}, {time}" — the real end of the offer in words. */
export const untilTemplate = (locale: Locale) =>
  tr(locale, { ar: "حتى {date} على {time}", fr: "Jusqu'au {date}, {time}", en: "Until {date}, {time}" });

/** Batch gauge reading ("{n} sur {total}"). */
export const ofTemplate = (locale: Locale) => tr(locale, { ar: "{n} من {total}", fr: "{n} sur {total}", en: "{n} of {total}" });

/** Legend of the stock dot matrix: one dot is one real piece. */
export const dotLegend = (locale: Locale) => tr(locale, { ar: "كل نقطة = قطعة وحدة", fr: "1 point = 1 pièce", en: "1 dot = 1 piece" });

/** Short status line above the stock number. */
export const stockLabel = (locale: Locale) => tr(locale, { ar: "المخزون اللي باقي", fr: "Stock restant", en: "Stock left" });

/** Unit under the big stock number, with the language's plural rules ("pièces restantes", "قطع باقية"). */
export function stockUnit(locale: Locale, n: number): string {
  if (locale === "ar") {
    const r = new Intl.PluralRules("ar").select(n);
    return r === "one" ? "قطعة واحدة باقية" : r === "two" ? "قطعتان باقيتان" : r === "few" ? "قطع باقية" : "قطعة باقية";
  }
  const one = new Intl.PluralRules(locale === "fr" ? "fr" : "en").select(n) === "one";
  if (locale === "fr") return one ? "pièce restante" : "pièces restantes";
  return one ? "piece left" : "pieces left";
}

/** The market's wall clock: a countdown end is read in the merchant's own time zone. */
const ZONES: Record<Market, string> = {
  MA: "Africa/Casablanca",
  FR: "Europe/Paris",
  BE: "Europe/Brussels",
  ES: "Europe/Madrid",
  DE: "Europe/Berlin",
  IT: "Europe/Rome",
  NL: "Europe/Amsterdam",
  PT: "Europe/Lisbon",
  INTL: "UTC",
};

export interface EndParts {
  /** "vendredi 9 octobre" */
  date: string;
  /** "19:00" */
  time: string;
  /** "9" — the day of the month on the calendar tile */
  day: string;
}

/** Localized end date (Latin digits, the market's time zone), or null when it cannot be formatted. */
export function endParts(iso: string, locale: Locale, market: Market): EndParts | null {
  const ms = isoToMs(iso);
  if (!Number.isFinite(ms)) return null;
  const tag = `${locale}${market === "INTL" ? "" : `-${market}`}-u-nu-latn`;
  const timeZone = ZONES[market];
  try {
    const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { timeZone, ...o }).format(ms);
    return {
      date: f({ weekday: "long", day: "numeric", month: "long" }),
      time: f({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      day: f({ day: "numeric" }),
    };
  } catch {
    return null;
  }
}
