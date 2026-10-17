/**
 * WhatsApp order mode for static exports — no server at all.
 *
 * The landing runtime is reused as is (validation, packs, variants, totals, thank-you hand-off): its
 * order endpoint is a sentinel URL that a tiny export-only bridge intercepts in window.fetch. The
 * bridge composes the order message from the validated payload, opens wa.me (new tab / the app) and
 * answers the runtime like a successful order, so the shopper lands on the thank-you page — where a
 * floating glass card keeps a one-tap "open WhatsApp again" until the message is sent.
 *
 * Everything the bridge needs is public page data (#lp-config) plus #lp-wa (number + localized
 * labels). Text is inserted with textContent only.
 */
import { runtimeChunks } from "@/landing/generated/assets";
import type { Locale } from "@/lib/page/schema";

/** Order endpoint of WhatsApp exports (never fetched: the bridge answers it). */
export const WA_ENDPOINT = "whatsapp:order";

export interface WaLabels {
  /** v2 bullets: a free piece ("Offert · 1 × Rose"), the offer's gift, the order-level choices line, "+n articles" */
  free: string;
  gift: string;
  choices: string;
  more: string;
  order: string;
  ref: string;
  product: string;
  pack: string;
  options: string;
  extra: string;
  total: string;
  cod: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  note: string;
  email: string;
  /** thank-you card: after WhatsApp opened / when it could not open by itself */
  cardTitle: string;
  cardTitleNow: string;
  cardText: string;
  cardButton: string;
}

export interface WaCopy {
  labels: WaLabels;
  /** order button of the form */
  submit: string;
  /** thank-you page heading & lead in WhatsApp mode */
  thanksTitle: string;
  thanksMessage: string;
}

const COPY: Record<Locale, WaCopy> = {
  ar: {
    labels: {
      free: "هدية",
      gift: "هدية مع العرض",
      choices: "الطلب",
      more: "+{n} قطع أخرى",
      order: "طلب جديد",
      ref: "المرجع",
      product: "المنتج",
      pack: "العرض",
      options: "الاختيارات",
      extra: "إضافة",
      total: "المجموع",
      cod: "الدفع عند الاستلام",
      name: "الاسم",
      phone: "الهاتف",
      city: "المدينة",
      address: "العنوان",
      note: "ملاحظة",
      email: "البريد الإلكتروني",
      cardTitle: "لم ترسل الرسالة بعد؟",
      cardTitleNow: "أرسل طلبك عبر واتساب",
      cardText: "طلبك يصلنا فقط بعد إرسال رسالة واتساب.",
      cardButton: "افتح واتساب",
    },
    submit: "اطلب عبر واتساب",
    thanksTitle: "خطوة أخيرة: أرسل لنا الرسالة",
    thanksMessage: "رسالة طلبك جاهزة في واتساب — اضغط على «إرسال» لنؤكد طلبك ونشحنه إليك. الدفع عند الاستلام.",
  },
  fr: {
    labels: {
      free: "Offert",
      gift: "Cadeau",
      choices: "Commande",
      more: "+{n} articles",
      order: "Nouvelle commande",
      ref: "Réf.",
      product: "Produit",
      pack: "Pack",
      options: "Options",
      extra: "En plus",
      total: "Total",
      cod: "paiement à la livraison",
      name: "Nom",
      phone: "Téléphone",
      city: "Ville",
      address: "Adresse",
      note: "Note",
      email: "E-mail",
      cardTitle: "Message pas encore envoyé ?",
      cardTitleNow: "Envoyez votre commande sur WhatsApp",
      cardText: "Votre commande nous parvient uniquement une fois le message WhatsApp envoyé.",
      cardButton: "Ouvrir WhatsApp",
    },
    submit: "Commander via WhatsApp",
    thanksTitle: "Plus qu’une étape : envoyez le message",
    thanksMessage: "Votre message de commande est prêt dans WhatsApp — appuyez sur « Envoyer » pour que nous puissions la confirmer et l’expédier. Paiement à la livraison.",
  },
  en: {
    labels: {
      free: "Free",
      gift: "Gift",
      choices: "Order",
      more: "+{n} more items",
      order: "New order",
      ref: "Ref.",
      product: "Product",
      pack: "Pack",
      options: "Options",
      extra: "Add-on",
      total: "Total",
      cod: "cash on delivery",
      name: "Name",
      phone: "Phone",
      city: "City",
      address: "Address",
      note: "Note",
      email: "Email",
      cardTitle: "Haven’t sent it yet?",
      cardTitleNow: "Send your order on WhatsApp",
      cardText: "Your order reaches us only once the WhatsApp message is sent.",
      cardButton: "Open WhatsApp",
    },
    submit: "Order via WhatsApp",
    thanksTitle: "One last step: send the message",
    thanksMessage: "Your order message is ready in WhatsApp — tap send so we can confirm and ship it. You pay on delivery.",
  },
  es: {
    labels: {
      free: "Gratis",
      gift: "Regalo",
      choices: "Pedido",
      more: "+{n} artículos más",
      order: "Nuevo pedido",
      ref: "Ref.",
      product: "Producto",
      pack: "Pack",
      options: "Opciones",
      extra: "Extra",
      total: "Total",
      cod: "pago contra reembolso",
      name: "Nombre",
      phone: "Teléfono",
      city: "Ciudad",
      address: "Dirección",
      note: "Nota",
      email: "Email",
      cardTitle: "¿Aún no lo enviaste?",
      cardTitleNow: "Envía tu pedido por WhatsApp",
      cardText: "Tu pedido nos llega solo cuando envías el mensaje de WhatsApp.",
      cardButton: "Abrir WhatsApp",
    },
    submit: "Pedir por WhatsApp",
    thanksTitle: "Último paso: envía el mensaje",
    thanksMessage: "Tu mensaje de pedido está listo en WhatsApp — pulsa enviar para que podamos confirmarlo y enviarlo. Pagas a la entrega.",
  },
  de: {
    labels: {
      free: "Gratis",
      gift: "Geschenk",
      choices: "Bestellung",
      more: "+{n} weitere Artikel",
      order: "Neue Bestellung",
      ref: "Ref.",
      product: "Produkt",
      pack: "Paket",
      options: "Optionen",
      extra: "Extra",
      total: "Gesamt",
      cod: "Zahlung bei Lieferung",
      name: "Name",
      phone: "Telefon",
      city: "Stadt",
      address: "Adresse",
      note: "Notiz",
      email: "E-Mail",
      cardTitle: "Noch nicht gesendet?",
      cardTitleNow: "Sende deine Bestellung per WhatsApp",
      cardText: "Deine Bestellung erreicht uns erst, wenn die WhatsApp-Nachricht gesendet ist.",
      cardButton: "WhatsApp öffnen",
    },
    submit: "Per WhatsApp bestellen",
    thanksTitle: "Letzter Schritt: Nachricht senden",
    thanksMessage: "Deine Bestellnachricht ist in WhatsApp bereit — tippe auf Senden, damit wir bestätigen und verschicken können. Du zahlst bei Lieferung.",
  },
  it: {
    labels: {
      free: "In omaggio",
      gift: "Regalo",
      choices: "Ordine",
      more: "+{n} altri articoli",
      order: "Nuovo ordine",
      ref: "Rif.",
      product: "Prodotto",
      pack: "Pacchetto",
      options: "Opzioni",
      extra: "Extra",
      total: "Totale",
      cod: "pagamento alla consegna",
      name: "Nome",
      phone: "Telefono",
      city: "Città",
      address: "Indirizzo",
      note: "Nota",
      email: "Email",
      cardTitle: "Non l’hai ancora inviato?",
      cardTitleNow: "Invia il tuo ordine su WhatsApp",
      cardText: "Il tuo ordine ci arriva solo quando invii il messaggio WhatsApp.",
      cardButton: "Apri WhatsApp",
    },
    submit: "Ordina su WhatsApp",
    thanksTitle: "Ultimo passo: invia il messaggio",
    thanksMessage: "Il messaggio del tuo ordine è pronto su WhatsApp — tocca invia così possiamo confermarlo e spedirlo. Paghi alla consegna.",
  },
  nl: {
    labels: {
      free: "Gratis",
      gift: "Cadeau",
      choices: "Bestelling",
      more: "+{n} andere artikelen",
      order: "Nieuwe bestelling",
      ref: "Ref.",
      product: "Product",
      pack: "Pakket",
      options: "Opties",
      extra: "Extra",
      total: "Totaal",
      cod: "betalen bij levering",
      name: "Naam",
      phone: "Telefoon",
      city: "Plaats",
      address: "Adres",
      note: "Notitie",
      email: "E-mail",
      cardTitle: "Nog niet verstuurd?",
      cardTitleNow: "Verstuur je bestelling via WhatsApp",
      cardText: "Je bestelling komt pas bij ons aan als het WhatsApp-bericht is verstuurd.",
      cardButton: "WhatsApp openen",
    },
    submit: "Bestel via WhatsApp",
    thanksTitle: "Laatste stap: verstuur het bericht",
    thanksMessage: "Je bestelbericht staat klaar in WhatsApp — tik op verzenden zodat we kunnen bevestigen en versturen. Je betaalt bij levering.",
  },
  pt: {
    labels: {
      free: "Grátis",
      gift: "Oferta",
      choices: "Encomenda",
      more: "+{n} artigos",
      order: "Nova encomenda",
      ref: "Ref.",
      product: "Produto",
      pack: "Pack",
      options: "Opções",
      extra: "Extra",
      total: "Total",
      cod: "pagamento na entrega",
      name: "Nome",
      phone: "Telefone",
      city: "Cidade",
      address: "Morada",
      note: "Nota",
      email: "Email",
      cardTitle: "Ainda não enviou?",
      cardTitleNow: "Envie a sua encomenda pelo WhatsApp",
      cardText: "O seu pedido só nos chega depois de enviar a mensagem do WhatsApp.",
      cardButton: "Abrir WhatsApp",
    },
    submit: "Encomendar pelo WhatsApp",
    thanksTitle: "Último passo: envie a mensagem",
    thanksMessage: "A mensagem da sua encomenda está pronta no WhatsApp — toque em enviar para podermos confirmar e enviar. Paga na entrega.",
  },
};

export function waCopy(locale: Locale): WaCopy {
  return COPY[locale] ?? COPY.en;
}

/** #lp-wa data (public): the number orders go to, the intercepted endpoint and the labels. */
export function waData(number: string, locale: Locale): { v: 1; endpoint: string; number: string; labels: WaLabels } {
  if (!/^[1-9][0-9]{7,14}$/.test(number)) throw new Error("export: invalid WhatsApp number");
  return { v: 1, endpoint: WA_ENDPOINT, number, labels: waCopy(locale).labels };
}

/* ------------------------------------------------------------------ */
/* v2 message (docs/OFFERS.md §G.5)                                    */
/* ------------------------------------------------------------------ */

/** encodeURIComponent(message) stays under this (wa.me links longer than ~4 KB fail on some phones). */
export const WA_URL_MAX = 3800;

export interface WaOrderInput {
  orderId: string;
  /** product name (the page's story name) */
  product: string;
  /** the offer label the shopper saw ("Le rituel complet (x3)") */
  pack: string;
  /**
   * The runtime's own `unitsText(cfg, selection, "customer")`: parts joined by " + ", then
   * " || Commande : " and the order choices (the grammar guarantees neither appears inside a label).
   */
  units: string;
  /** the runtime's total, cents (the bridge never prices) */
  total: number;
  customer: { name: string; phone: string; city?: string; address?: string; note?: string; email?: string };
}

const SEGMENT = " || Commande : ";
const clip = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** Pieces a part stands for: its "n × " count (after a marker), else 1. */
function partCount(part: string): number {
  const m = /^(?:\[[A-Z]+\] )?(\d{1,3}) (?:× |pièces?$)/.exec(part);
  return m ? Number(m[1]) : 1;
}

/**
 * The WhatsApp order message (§G.5), formatted from what the runtime computed (no pricing here; it is
 * in the parity corpus): one bullet per part of the order text, the gift and the order choices on
 * their own lines, the total, then the customer. French puts a space before the colon. When the link
 * would be too long, unit bullets are dropped from the end and replaced by "… (+n articles)".
 * The export bridge (WA_BRIDGE_JS) implements the same steps.
 */
export function composeWaMessage(input: WaOrderInput, labels: WaLabels, opts: { locale: Locale; money: (cents: number) => string }): { text: string; dropped: number } {
  const sep = opts.locale === "fr" ? " : " : ": ";
  const line = (label: string, value: string) => (value ? `${label}${sep}${value}` : "");
  const at = input.units.indexOf(SEGMENT);
  const head = (at >= 0 ? input.units.slice(0, at) : input.units).trim();
  const seg = at >= 0 ? input.units.slice(at + SEGMENT.length).trim() : "";

  const units: { bullet: string; n: number }[] = [];
  const fixed: string[] = [];
  for (const part of head ? head.split(" + ") : []) {
    if (part.startsWith("CADEAU : ")) fixed.push(`• ${labels.gift}${sep}${part.slice(9)}`);
    else if (part.startsWith("[AJOUT] ") || part.startsWith("[UPSELL] ")) fixed.push(`• ${labels.extra} · ${part.slice(part.indexOf(" ") + 1)}`);
    else if (part.startsWith("[OFFERT] ")) units.push({ bullet: `• ${labels.free} · ${part.slice(9)}`, n: partCount(part) });
    else units.push({ bullet: `• ${part}`, n: partCount(part) });
  }
  // "(+15)" after an order choice becomes "(+15 DH)"
  const choices = seg
    .split("; ")
    .map((x) => x.replace(/ \(\+(\d+(?:\.\d{1,2})?)\)$/, (_m, n: string) => ` (+${opts.money(Math.round(Number(n) * 100))})`))
    .join("; ");

  const build = (kept: readonly { bullet: string }[], more: number) => {
    const top = [
      `*${labels.order}* · ${labels.ref} ${input.orderId}`,
      line(labels.product, clip(input.product, 120)),
      line(labels.pack, clip(input.pack, 120)),
      ...kept.map((u) => u.bullet),
      ...(more > 0 ? [`• … (${labels.more.replace("{n}", String(more))})`] : []),
      ...fixed,
      choices ? line(labels.choices, choices) : "",
      `*${labels.total}${sep}${opts.money(input.total)}* (${labels.cod})`,
    ];
    const c = input.customer;
    const who = [
      line(labels.name, clip(c.name, 80)),
      line(labels.phone, clip(c.phone, 24)),
      line(labels.city, clip(c.city, 80)),
      line(labels.address, clip(c.address, 240)),
      line(labels.note, clip(c.note, 300)),
      line(labels.email, clip(c.email, 120)),
    ];
    return `${top.filter(Boolean).join("\n")}\n\n${who.filter(Boolean).join("\n")}`;
  };

  let kept = units.length;
  let more = 0;
  let text = build(units, 0);
  while (encodeURIComponent(text).length > WA_URL_MAX && kept > 0) {
    kept--;
    more = units.slice(kept).reduce((n, u) => n + u.n, 0);
    text = build(units.slice(0, kept), more);
  }
  return { text, dropped: more };
}

/**
 * The bridge: the "whatsapp" runtime chunk, built from src/landing/runtime/entry-whatsapp.ts (es2019,
 * minified) by scripts/build-landing-assets.mjs. Landing page: intercepts the order POST, formats the
 * runtime's own total and units text with composeWaMessage (above), opens WhatsApp and answers
 * { ok, orderId, total, currency }. Thank-you page: shows the floating "open WhatsApp again" card for
 * the order that was just placed.
 */
export const WA_BRIDGE_JS: string = runtimeChunks.whatsapp;

/** Floating glass card of the thank-you page (theme tokens, logical properties, reduced motion). */
export const WA_CARD_CSS = [
  ".lp-wa-cta{position:fixed;z-index:60;inset-inline:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));",
  "display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;max-inline-size:36rem;margin-inline:auto;padding:14px;padding-inline-start:20px;",
  "border-radius:calc(var(--lp-radius-l,20px) + 6px);border:1px solid var(--lp-line,rgba(0,0,0,.08));background:var(--lp-surface,#fff);color:var(--lp-ink,#111);",
  "box-shadow:0 1px 0 rgba(255,255,255,.55) inset,0 24px 60px -24px rgba(0,0,0,.38),0 8px 18px -10px rgba(0,0,0,.2);",
  "animation:lp-wa-in .8s var(--lp-ease-spring,cubic-bezier(.2,1.2,.3,1)) .35s both}",
  "@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){.lp-wa-cta{background:color-mix(in srgb,var(--lp-surface,#fff) 78%,transparent);",
  "-webkit-backdrop-filter:blur(20px) saturate(1.7);backdrop-filter:blur(20px) saturate(1.7)}}",
  ".lp-wa-cta__body{flex:1 1 14rem;min-inline-size:0}",
  ".lp-wa-cta__title{margin:0;font-family:var(--lp-font-body,system-ui);font-weight:650;font-size:.98rem;line-height:1.3}",
  ".lp-wa-cta__text{margin:.2rem 0 0;font-family:var(--lp-font-body,system-ui);font-size:.84rem;line-height:1.45;color:var(--lp-ink-soft,#555)}",
  ".lp-wa-cta__btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:.55rem;min-block-size:48px;padding-inline:1.15rem 1.35rem;",
  "border-radius:999px;background:var(--lp-accent,#1f8f4e);color:var(--lp-accent-ink,#fff);font-family:var(--lp-font-body,system-ui);font-weight:650;font-size:.95rem;",
  "text-decoration:none;box-shadow:0 10px 24px -12px var(--lp-accent,#1f8f4e);transition:transform .35s var(--lp-ease-spring,ease),box-shadow .35s ease}",
  ".lp-wa-cta__btn:hover{transform:translateY(-2px);box-shadow:0 16px 30px -14px var(--lp-accent,#1f8f4e)}",
  ".lp-wa-cta__btn:active{transform:scale(.97)}",
  ".lp-wa-cta__btn:focus-visible{outline:3px solid var(--lp-accent,#1f8f4e);outline-offset:3px}",
  ".lp-wa-cta__icon{inline-size:1.25em;block-size:1.25em;fill:currentColor}",
  ".lp-wa-cta[data-attention] .lp-wa-cta__btn{animation:lp-wa-pulse 2.2s ease-out 1.2s infinite}",
  "@keyframes lp-wa-in{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:none}}",
  "@keyframes lp-wa-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--lp-accent,#1f8f4e) 45%,transparent)}70%,100%{box-shadow:0 0 0 14px transparent}}",
  "@media (max-width:30rem){.lp-wa-cta__btn{flex:1 1 100%}}",
  "@media (prefers-reduced-motion:reduce){.lp-wa-cta,.lp-wa-cta[data-attention] .lp-wa-cta__btn{animation:none}.lp-wa-cta__btn{transition:none}}",
  "body.lp-body{padding-block-end:7.5rem}",
].join("");
