/**
 * PHP mode files: order.php (template + the page's server-side price table) and the private
 * cod-private/config.php. The price table is the server truth of the standalone endpoint — computed
 * here with the same pricing module the app uses, so totals match the published page exactly.
 */
import { orderTotals } from "@/lib/page/pricing";
import type { PageDoc } from "@/lib/page/schema";
import { OTHER_CITY } from "@/lib/markets/cities-ma";
import { getMarket, phoneSpec } from "@/lib/markets/info";

export interface PhpSpec {
  v: 1;
  exportId: string;
  pageKey: string;
  product: string;
  /** product unit price (decoy answers) */
  price: number;
  currency: string;
  locale: string;
  phone: { prefix: string; national: string };
  form: { city: "select" | "text" | "hidden"; address: "required" | "optional" | "hidden"; note: "optional" | "hidden"; email: "required" | "optional" | "hidden" };
  /** select cities: canonical values + folded aliases (French, Arabic, English names) → canonical */
  cities: { values: string[]; keys: Record<string, string>; other: string } | null;
  bundles: { id: string; qty: number; total: number; totalWithBump: number; sheetLabel: string }[];
  bump: { title: string; price: number } | null;
  variants: { id: string; name: string; perUnit: boolean; options: { id: string; label: string; soldOut: boolean }[] }[];
}

/** Same key as findCity() in @/lib/markets/info (accents, Arabic letter variants, case, punctuation). */
function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "") // Latin diacritics + Arabic harakat
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/[\s'’`\-_.]+/g, "");
}

/** National-number patterns are embedded in a PCRE; only the simple syntax our specs use is allowed. */
const SIMPLE_PATTERN = /^[\^$()?:|[\]{}0-9,\-]{1,120}$/;

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
  return {
    v: 1,
    exportId: ids.exportId,
    pageKey: ids.pageKey,
    product: product.name,
    price: product.price,
    currency: doc.currency,
    locale: doc.locale,
    phone: { prefix, national },
    form: { city: form.city, address: form.address, note: form.note, email: form.email },
    cities,
    bundles: offers.bundles.map((b) => {
      const plain = orderTotals(product, offers, b.id, false)!;
      const withBump = orderTotals(product, offers, b.id, true)!;
      return {
        id: b.id,
        qty: b.qty,
        total: plain.total,
        totalWithBump: withBump.total,
        // = items.bundleLabel in the app (sheet "Produit" column)
        sheetLabel: b.title ? `${b.title} (x${b.qty})` : `x${b.qty}`,
      };
    }),
    bump: offers.orderBump?.enabled ? { title: offers.orderBump.title, price: offers.orderBump.price } : null,
    variants: product.variants.map((g) => ({
      id: g.id,
      name: g.name,
      perUnit: g.perUnit,
      options: g.options.map((o) => ({ id: o.id, label: o.label, soldOut: o.soldOut })),
    })),
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
