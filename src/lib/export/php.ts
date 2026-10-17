/**
 * PHP mode files: order.php (template + the page's server-side data) and the private
 * cod-private/config.php.
 *
 * PhpSpec v2 (docs/OFFERS.md §G.6) is everything order.php needs to validate, price and describe an
 * order on its own, exactly like the app (src/lib/orders/validate.ts, src/lib/page/pricing.ts,
 * src/lib/orders/text.ts): items with their option groups (choice / matrix / field), every offer's
 * units (fixed items, choice lines, distinct, free, line rules), choice-price differences, order
 * extras with their scope, the bump (catalog item or not), the gift per offer — money in integer
 * cents. Labels are pre-rendered here with the app's own helpers (sanitized names, numeric prefix
 * "Pointure 42", warehouse codes), so order.php only assembles them. scripts/qa/php-parity.ts runs
 * a payload corpus through both and compares field errors, totals and the Sheets cells.
 */
import { expandUnits, itemName, itemShort, leadItem, offerAvailable, offerSheetLabel } from "@/lib/page/catalog";
import { effectiveFree, offerMath, toCents } from "@/lib/page/pricing";
import { isChoiceGroup, isChoicePick, isMatrixGroup, type ChoiceGroup, type ExtraGroup, type FieldGroup, type Item, type LineRule, type OptionGroup, type PageDoc } from "@/lib/page/schema";
import { optionText, sanitizeLabel } from "@/lib/orders/text";
import { OTHER_CITY } from "@/lib/markets/cities-ma";
import { getMarket, phoneSpec } from "@/lib/markets/info";

/** A choice option: raw label (v1 compat records), rendered texts, stock, surcharge (cents). */
export interface PhpOption {
  id: string;
  /** owner label as typed (compat `variants` records) */
  label: string;
  /** printed value: sanitized, numeric values prefixed by the group name ("Pointure 42") */
  text: string;
  /** warehouse code, rendered like `text` */
  code?: string;
  soldOut: boolean;
  delta: number;
}

export type PhpGroup =
  | { kind: "choice"; id: string; name: string; label: string; perUnit: boolean; options: PhpOption[] }
  | {
      kind: "matrix";
      id: string;
      name: string;
      label: string;
      perUnit: boolean;
      dims: { id: string; name: string; values: (PhpOption & { ctext: string })[] }[];
      cells: { v: Record<string, string>; state: "in" | "out" | "none"; delta?: number; sku?: string }[];
    }
  | {
      kind: "field";
      id: string;
      name: string;
      label: string;
      perUnit: boolean;
      input: "text" | "number";
      required: boolean;
      maxLength: number;
      min?: number;
      max?: number;
      charset: "any" | "letters" | "latin" | "digits";
      delta: number;
    };

export interface PhpItem {
  id: string;
  /** item name (compat "Article" record; the product name on single-item pages) */
  name: string;
  /** snapshot label: the name on multi-item pages, "" on single-item pages */
  label: string;
  /** snapshot short name (multi-item pages only) */
  short?: string;
  /** label printed in the order text: the sanitized short name ("" on single-item pages) */
  tl: string;
  sku?: string;
  /** cents */
  price: number;
  groups: PhpGroup[];
}

export interface PhpSlot {
  line: string;
  item: string | null;
  choices: string[] | null;
  available: string[] | null;
  distinct: boolean;
  free: boolean;
  rules: Record<string, LineRule> | null;
}

export interface PhpOffer {
  id: string;
  /** = items.bundleLabel in the app (Sheets "Produit") */
  sheetLabel: string;
  /** cents */
  price: number;
  /** cheapest payable total of the units (decoy answers), cents */
  from: number;
  /** no delivery fee for this offer (effectiveFree) */
  freeDelivery: boolean;
  /** cannot be ordered (offerAvailable false) */
  soldOut: boolean;
  gift: string | null;
  units: PhpSlot[];
  /** paid choice lines priced "difference": the declared prices, ascending (cents) */
  diff: { line: string; qty: number; distinct: boolean; declared: number[] }[];
}

export type PhpExtra = Extract<PhpGroup, { kind: "choice" | "field" }> & { scope: "all" | string[] };

export interface PhpSpec {
  v: 2;
  exportId: string;
  pageKey: string;
  product: string;
  currency: string;
  locale: string;
  /** the page sells 2+ items: counts and item names always printed */
  multi: boolean;
  /** lead item price, cents (decoy answers for an unknown offer) */
  leadPrice: number;
  /** cents */
  shippingFee: number;
  phone: { prefix: string; national: string };
  form: { city: "select" | "text" | "hidden"; address: "required" | "optional" | "hidden"; note: "optional" | "hidden"; email: "required" | "optional" | "hidden" };
  /** select cities: canonical values + folded aliases (French, Arabic, English names) → canonical */
  cities: { values: string[]; keys: Record<string, string>; other: string } | null;
  items: PhpItem[];
  offers: PhpOffer[];
  extras: PhpExtra[];
  bump: { title: string; price: number; item?: string; offers?: string[] } | null;
}

/** Same key as findCity() in @/lib/markets/info (accents, Arabic letter variants, case, punctuation). */
function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "") // Latin diacritics + Arabic harakat
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/[\s'’`\-_.]+/g, "");
}

/** National-number patterns are embedded in a PCRE; only the simple syntax our specs use is allowed. */
const SIMPLE_PATTERN = /^[\^$()?:|[\]{}0-9,\-]{1,120}$/;

const cents = (m: number | undefined) => (typeof m === "number" ? toCents(m) : 0);

function choiceOf(g: ChoiceGroup, extra: boolean): PhpOption[] {
  // order extras print sanitized labels / codes (no numeric prefix); unit options use optionText
  const render = (s: string) => (extra ? sanitizeLabel(s) : optionText(g.name, s));
  return g.options.map((o) => ({ id: o.id, label: o.label, text: render(o.label), ...(o.code ? { code: render(o.code) } : {}), soldOut: o.soldOut, delta: cents(o.delta) }));
}

function fieldOf(g: FieldGroup): Extract<PhpGroup, { kind: "field" }> {
  return {
    kind: "field",
    id: g.id,
    name: g.name,
    label: sanitizeLabel(g.name),
    perUnit: g.perUnit,
    input: g.input,
    required: g.required,
    maxLength: g.maxLength,
    ...(g.min !== undefined ? { min: g.min } : {}),
    ...(g.max !== undefined ? { max: g.max } : {}),
    charset: g.charset,
    delta: cents(g.delta),
  };
}

function groupOf(g: OptionGroup): PhpGroup {
  if (isChoiceGroup(g)) return { kind: "choice", id: g.id, name: g.name, label: sanitizeLabel(g.name), perUnit: g.perUnit, options: choiceOf(g, false) };
  if (isMatrixGroup(g)) {
    return {
      kind: "matrix",
      id: g.id,
      name: g.name,
      label: sanitizeLabel(g.name),
      perUnit: g.perUnit,
      dims: g.dims.map((d) => ({
        id: d.id,
        name: d.name,
        values: d.values.map((v) => ({
          id: v.id,
          label: v.label,
          text: optionText(d.name, v.label),
          ...(v.code ? { code: optionText(d.name, v.code) } : {}),
          ctext: optionText(d.name, v.code ?? v.label),
          soldOut: v.soldOut,
          delta: cents(v.delta),
        })),
      })),
      cells: g.cells.map((c) => ({ v: { ...c.v }, state: c.state, ...(c.delta !== undefined ? { delta: cents(c.delta) } : {}), ...(c.sku ? { sku: c.sku } : {}) })),
    };
  }
  return fieldOf(g as FieldGroup);
}

function itemOf(doc: PageDoc, it: Item, multi: boolean): PhpItem {
  const short = itemShort(doc, it);
  return {
    id: it.id,
    name: itemName(doc, it),
    label: multi ? itemName(doc, it) : "",
    ...(multi ? { short } : {}),
    tl: multi ? sanitizeLabel(short) : "",
    ...(it.sku ? { sku: it.sku } : {}),
    price: toCents(it.price),
    groups: it.groups.map(groupOf),
  };
}

function extraOf(x: ExtraGroup): PhpExtra {
  const scope = x.scope === "all" ? ("all" as const) : [...x.scope];
  if (isChoiceGroup(x)) return { kind: "choice", id: x.id, name: x.name, label: sanitizeLabel(x.name), perUnit: x.perUnit, options: choiceOf(x, true), scope };
  return { ...fieldOf(x as FieldGroup), scope };
}

export function phpSpec(doc: PageDoc, ids: { exportId: string; pageKey: string }): PhpSpec {
  const { product, offers, form } = doc;
  const market = getMarket(doc.market);
  const rule = phoneSpec(form.phoneCountry);
  const national = SIMPLE_PATTERN.test(rule.national) ? rule.national : "^[0-9]{6,15}$";
  const prefix = rule.prefix || market.phone.prefix;
  let cities: PhpSpec["cities"] = null;
  if (form.city === "select" && market.cities) {
    const keys: Record<string, string> = {};
    for (const c of market.cities) for (const n of [c.value, c.fr, c.ar, c.en]) if (n) keys[fold(n)] ??= c.value;
    cities = { values: market.cities.map((c) => c.value), keys, other: OTHER_CITY.value };
  }
  const multi = doc.items.length > 1;
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  const bump = offers.orderBump?.enabled ? offers.orderBump : null;
  return {
    v: 2,
    exportId: ids.exportId,
    pageKey: ids.pageKey,
    product: product.name,
    currency: doc.currency,
    locale: doc.locale,
    multi,
    leadPrice: toCents(leadItem(doc).price),
    shippingFee: toCents(offers.shippingFee),
    phone: { prefix, national },
    form: { city: form.city, address: form.address, note: form.note, email: form.email },
    cities,
    items: doc.items.map((it) => itemOf(doc, it, multi)),
    offers: offers.bundles.map((o) => ({
      id: o.id,
      sheetLabel: offerSheetLabel(doc, o),
      price: toCents(o.price),
      from: offerMath(doc, o).from,
      freeDelivery: effectiveFree(doc, o),
      soldOut: !offerAvailable(o, doc.items),
      gift: o.gift?.label ?? null,
      units: expandUnits(o, doc.items).map((s) => ({
        line: s.lineId,
        item: s.item,
        choices: s.choices,
        available: s.available,
        distinct: s.distinct,
        free: s.free,
        rules: s.rules ?? null,
      })),
      diff: o.lines.flatMap((l) => {
        if (l.free || !isChoicePick(l.pick) || l.pick.surcharge !== "difference") return [];
        const declared = l.pick.choice
          .map((id) => byId.get(id))
          .filter((it): it is Item => !!it)
          .map((it) => toCents(it.price))
          .sort((a, b) => a - b);
        return [{ line: l.id, qty: l.qty, distinct: l.pick.distinct, declared }];
      }),
    })),
    extras: offers.extras.map(extraOf),
    bump: bump
      ? { title: bump.title, price: toCents(bump.price), ...(bump.item && byId.has(bump.item) ? { item: bump.item } : {}), ...(bump.offers ? { offers: [...bump.offers] } : {}) }
      : null,
  };
}

const SPEC_SLOT = /(<<<'JSON'\r?\n)\{"v":0\}(\r?\nJSON;)/;

/** order.php = the template with the spec on the single line of its nowdoc (never interpolated by PHP). */
export function fillOrderPhp(template: string, spec: PhpSpec): string {
  if (!SPEC_SLOT.test(template)) throw new Error("export: order.php template has no spec slot");
  // one line of JSON (no raw newlines): the nowdoc terminator can never appear inside it
  const json = JSON.stringify(spec);
  if (/[\r\n]/.test(json)) throw new Error("export: spec JSON must be a single line");
  return template.replace(SPEC_SLOT, (_m, open: string, close: string) => `${open}${json}${close}`);
}

/** PHP single-quoted string literal. */
function phpString(value: string): string {
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error("export: control character in a PHP config value");
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export interface PhpConfigInput {
  exportId: string;
  pageName: string;
  generatedAt: Date;
  /** random hex (≥ 32 chars) — HMAC key for IP / phone hashing */
  secret: string;
  spreadsheetId?: string;
  /** base64 service-account JSON (only when the owner asked to embed it) */
  serviceAccountB64?: string;
  sheetTab?: string;
  currency: string;
  timeZone: string;
}

export function configPhp(c: PhpConfigInput): string {
  if (!/^[a-f0-9]{32,128}$/.test(c.secret)) throw new Error("export: invalid order.php secret");
  const sheet = c.spreadsheetId && /^[A-Za-z0-9_-]{20,100}$/.test(c.spreadsheetId) ? c.spreadsheetId : "";
  const sa = c.serviceAccountB64 && /^[A-Za-z0-9+/=]{100,20000}$/.test(c.serviceAccountB64) ? c.serviceAccountB64 : "";
  const name = c.pageName.replace(/[\u0000-\u001f\u007f*/]/g, " ").slice(0, 80);
  return `<?php
/**
 * Private settings of order.php — keep this folder OUTSIDE public_html (see README.md).
 * Export ${c.exportId} · ${name} · ${c.generatedAt.toISOString()}
 */
return [
    // Random key used to hash IP addresses and phone numbers (rate limits, duplicates). Keep it secret.
    'secret' => ${phpString(c.secret)},

    // Google Sheets (optional): the spreadsheet link or id, and the service-account key — the JSON itself,
    // its base64, or the path of the JSON key file inside this folder — put the file in data/ and write
    // 'data/service-account.json' (that folder is created and locked by order.php itself).
    // Share the spreadsheet with the service account's e-mail as Editor. Empty = orders are kept in
    // data/orders.jsonl only.
    'spreadsheet_id' => ${phpString(sheet)},
    'service_account' => ${phpString(sa)},
    'sheet_tab' => ${phpString(c.sheetTab && c.sheetTab.length <= 80 ? c.sheetTab : "Commandes")},
    'currency' => ${phpString(/^[A-Z]{3}$/.test(c.currency) ? c.currency : "MAD")},
    'timezone' => ${phpString(/^[A-Za-z_]+(?:\/[A-Za-z_+-]+){0,2}$/.test(c.timeZone) ? c.timeZone : "Africa/Casablanca")},

    // Telegram message for every order (optional): bot token from @BotFather and your chat id.
    'telegram_bot_token' => '',
    'telegram_chat_id' => '',

    // Behind Cloudflare or another proxy: the header holding the visitor IP, e.g. 'HTTP_CF_CONNECTING_IP',
    // and the proxies allowed to set it (IP ranges, e.g. ['203.0.113.0/24']). The header is ignored on
    // requests that do not come from one of them: anyone reaching this server directly can write any
    // value into it. For 'HTTP_CF_CONNECTING_IP' an empty list means Cloudflare's published ranges.
    // With 'HTTP_X_FORWARDED_FOR', the right-most address that is not one of your proxies is used.
    'trusted_ip_header' => '',
    'trusted_proxies' => [],
];
`;
}

/** Denies HTTP access to the private folder if it ever ends up inside a web root. */
export const PRIVATE_HTACCESS = `# Private folder of order.php — never served over HTTP
<IfModule mod_authz_core.c>
  Require all denied
</IfModule>
<IfModule !mod_authz_core.c>
  Order allow,deny
  Deny from all
</IfModule>
`;
