/**
 * Unit labels of the order form (docs/OFFERS.md §F.2, §J.2, §J.3): unit heads, their accessible
 * names, and the localized messages every group carries in its markup (`data-msg*`) so the runtime
 * shows client and server errors without any i18n of its own.
 *
 *   unitHeads(ctx, offer)   the visible head of every unit of an offer ("Pièce 2", "Rose · 2", "Au choix · 1")
 *   groupMessages(...)      data-msg / -gone / -long / -dup / -bad / -switched / -conflict of a group
 *
 * Pure; copy from src/landing/sections/orderForm/copy.ts (all 8 locales).
 */
import { expandUnits, itemShort, type UnitSlot } from "@/lib/page/catalog";
import { fromCents } from "@/lib/page/pricing";
import { isFieldGroup, isMatrixGroup, type FieldGroup, type Item, type Locale, type Offer, type OptionGroup } from "@/lib/page/schema";
import { optionLabels, unitWord } from "../sections/orderForm/copy";
import type { RenderContext } from "../types";

export interface UnitHead {
  slot: UnitSlot;
  /** visible head */
  head: string;
  /** accessible name: head + ", pièce 2 sur 3" */
  aria: string;
}

/**
 * Heads of an offer's units (§F.2): single-item pages "Pièce {n}"; multi-item pages "{item short} · {j}"
 * (j = ordinal among the offer's units of that item, omitted when there is only one); choice units
 * "{line label} · {j}" or "Au choix · {j}" (j among the line's units, omitted for one). A line label
 * ("Votre cadeau") replaces the automatic head.
 */
export function unitHeads(ctx: RenderContext, offer: Pick<Offer, "lines">): UnitHead[] {
  const slots = expandUnits(offer, ctx.items);
  const total = slots.length;
  const multi = ctx.items.length > 1;
  const byId = new Map(ctx.items.map((it) => [it.id, it]));
  const count = new Map<string, number>();
  for (const s of slots) {
    const key = s.item ? `i:${s.item}` : `l:${s.lineId}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return slots.map((slot) => {
    const key = slot.item ? `i:${slot.item}` : `l:${slot.lineId}`;
    const j = (seen.get(key) ?? 0) + 1;
    seen.set(key, j);
    const many = (count.get(key) ?? 1) > 1;
    let head: string;
    if (!slot.item) {
      const base = slot.label?.trim() || choiceWord(ctx.locale);
      head = many ? `${base} · ${ctx.num(j)}` : base;
    } else if (slot.label?.trim()) {
      head = many ? `${slot.label.trim()} · ${ctx.num(j)}` : slot.label.trim();
    } else if (multi) {
      const it = byId.get(slot.item);
      const name = it ? itemShort(ctx.doc, it) : slot.item;
      head = many ? `${name} · ${ctx.num(j)}` : name;
    } else {
      head = unitWord(ctx.locale, "head", { n: ctx.num(slot.k + 1) });
    }
    return { slot, head, aria: head + unitWord(ctx.locale, "of", { n: ctx.num(slot.k + 1), u: ctx.num(total) }) };
  });
}

const CHOICE: Record<Locale, string> = { ar: "على اختيارك", fr: "Au choix", en: "Your choice", es: "A elegir", de: "Nach Wahl", it: "A scelta", nl: "Naar keuze", pt: "À escolha" };
const choiceWord = (locale: Locale) => CHOICE[locale] ?? CHOICE.en;

/** Head patterns the runtime fills for offers it builds (tokens {n} {item} {j} {u}). */
export function headPatterns(locale: Locale) {
  return {
    unit: unitWord(locale, "head", {}),
    of: unitWord(locale, "of", {}),
    choice: choiceWord(locale),
  };
}

export type GroupMessages = Record<string, string>;

/** "Lettres uniquement" / "Chiffres uniquement" / "Entre 1 et 99" for a field's invalid value. */
function fieldBad(locale: Locale, g: FieldGroup): string {
  if (g.input === "number") return unitWord(locale, "range", { min: g.min ?? 0, max: g.max ?? 1_000_000 });
  if (g.charset === "digits") return unitWord(locale, "digits");
  if (g.charset === "latin") return unitWord(locale, "latin");
  return unitWord(locale, "letters");
}

/** The `data-msg*` attributes of a group (choice, matrix or field) — §J.2. */
export function groupMessages(ctx: Pick<RenderContext, "locale">, g: OptionGroup): GroupMessages {
  const O = optionLabels(ctx.locale);
  const msgs: GroupMessages = { "data-msg-gone": unitWord(ctx.locale, "unavailable") };
  if (isFieldGroup(g)) {
    const name = g.name.trim();
    msgs["data-msg"] = unitWord(ctx.locale, "write", { name: ctx.locale === "ar" || ctx.locale === "de" ? name : name.charAt(0).toLocaleLowerCase(ctx.locale) + name.slice(1) });
    msgs["data-msg-long"] = unitWord(ctx.locale, "tooLong", { max: g.maxLength });
    msgs["data-msg-bad"] = fieldBad(ctx.locale, g);
    return msgs;
  }
  msgs["data-msg"] = O.choose(g.name);
  if (isMatrixGroup(g)) {
    msgs["data-msg-switched"] = unitWord(ctx.locale, "switched");
    msgs["data-msg-conflict"] = unitWord(ctx.locale, "conflict");
    msgs["data-msg-none"] = unitWord(ctx.locale, "matrixNone");
  }
  return msgs;
}

/** The item chooser's messages (§J.2 `u.<k>.@item`). */
export function pickMessages(locale: Locale): GroupMessages {
  return {
    "data-msg": unitWord(locale, "chooseItem"),
    "data-msg-gone": unitWord(locale, "unavailable"),
    "data-msg-dup": unitWord(locale, "duplicate"),
  };
}

/** "+20 DH" (a positive surcharge in cents), else undefined. */
export function plusMoney(ctx: Pick<RenderContext, "money">, cents: number | undefined): string | undefined {
  return cents && cents > 0 ? `+${ctx.money(fromCents(cents))}` : undefined;
}

/** Items of the page that have something a unit fills (a per-unit group). */
export const hasUnitGroups = (item: Item): boolean => item.groups.some((g) => g.perUnit);
