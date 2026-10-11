/**
 * 404.html of an export — self-contained (one inline stylesheet, no script, no relative URLs), because
 * hosts serve it at ANY missing path ("/a/b/c"), where relative links would break. Fonts and the "back"
 * link are addressed from the site root (the site URL when known, else "/").
 *
 * Look: the page's own theme tokens and display type — a huge numeral over a soft aurora of the
 * product's accent and pop hues, a frosted chip, one pill button back to the product.
 *
 * react-dom/server is imported dynamically, like src/lib/render/core.ts (route handlers run in the RSC
 * layer, where a static import is refused).
 */
import { createElement as h, type ReactElement } from "react";
import type { Locale, PageDoc } from "@/lib/page/schema";
import { buildTheme, fontFaceCss } from "@/lib/theme";

interface NotFoundCopy {
  chip: string;
  title: string;
  text: string;
  back: string;
}

const COPY: Record<Locale, NotFoundCopy> = {
  ar: {
    chip: "الصفحة غير موجودة",
    title: "هذه الصفحة غير موجودة",
    text: "المنتج ما زال متوفراً — ارجع إلى الصفحة واطلبه، والدفع عند الاستلام.",
    back: "العودة إلى المنتج",
  },
  fr: {
    chip: "Erreur 404",
    title: "Cette page n’existe pas",
    text: "Le produit est toujours disponible — revenez à la page pour le commander, paiement à la livraison.",
    back: "Retour au produit",
  },
  en: {
    chip: "Error 404",
    title: "This page doesn’t exist",
    text: "The product is still here — head back to the page to order it, cash on delivery.",
    back: "Back to the product",
  },
  es: {
    chip: "Error 404",
    title: "Esta página no existe",
    text: "El producto sigue disponible — vuelve a la página para pedirlo, pago contra reembolso.",
    back: "Volver al producto",
  },
  de: {
    chip: "Fehler 404",
    title: "Diese Seite gibt es nicht",
    text: "Das Produkt ist weiterhin erhältlich — zurück zur Seite und bestellen, Zahlung bei Lieferung.",
    back: "Zurück zum Produkt",
  },
  it: {
    chip: "Errore 404",
    title: "Questa pagina non esiste",
    text: "Il prodotto è ancora disponibile — torna alla pagina per ordinarlo, pagamento alla consegna.",
    back: "Torna al prodotto",
  },
  nl: {
    chip: "Fout 404",
    title: "Deze pagina bestaat niet",
    text: "Het product is nog steeds beschikbaar — ga terug naar de pagina om te bestellen, betalen bij levering.",
    back: "Terug naar het product",
  },
  pt: {
    chip: "Erro 404",
    title: "Esta página não existe",
    text: "O produto continua disponível — volte à página para encomendar, pagamento na entrega.",
    back: "Voltar ao produto",
  },
};

const CSS = [
  "*,*::before,*::after{box-sizing:border-box}",
  "html{-webkit-text-size-adjust:100%;text-size-adjust:100%}",
  "body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;overflow-x:hidden;background:var(--lp-bg);color:var(--lp-ink);",
  "font-family:var(--lp-font-body);line-height:var(--lp-body-lh,1.6);-webkit-font-smoothing:antialiased}",
  ".nf{position:relative;isolation:isolate;inline-size:min(100% - 2 * var(--lp-gutter,20px),40rem);padding-block:clamp(3rem,10vh,6rem);text-align:center}",
  // the aurora is a fixed full-viewport layer of soft radial light (no blur filter: never clipped, cheap)
  ".nf__glow{position:fixed;inset:0;z-index:-1;pointer-events:none;",
  "background:radial-gradient(60vmax 50vmax at 30% 30%,var(--lp-accent-soft),transparent 60%),radial-gradient(55vmax 45vmax at 75% 70%,var(--lp-accent-soft),transparent 62%);",
  "animation:nf-drift 18s ease-in-out infinite alternate}",
  "@supports (background:color-mix(in srgb,red 50%,blue)){.nf__glow{background:",
  "radial-gradient(60vmax 50vmax at 30% 30%,color-mix(in srgb,var(--lp-accent) 30%,transparent),transparent 60%),",
  "radial-gradient(55vmax 45vmax at 75% 70%,color-mix(in srgb,var(--lp-pop) 24%,transparent),transparent 62%)}}",
  ".nf__chip{display:inline-flex;align-items:center;gap:.5rem;margin:0 0 1.4rem;padding:.42rem .95rem .42rem .8rem;border-radius:999px;",
  "border:1px solid var(--lp-line);background:var(--lp-surface);color:var(--lp-ink-soft);font-size:.8rem;font-weight:600;line-height:1.2;",
  "box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 10px 30px -18px rgba(0,0,0,.35)}",
  "@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){.nf__chip{background:color-mix(in srgb,var(--lp-surface) 66%,transparent);",
  "-webkit-backdrop-filter:blur(14px) saturate(1.6);backdrop-filter:blur(14px) saturate(1.6)}}",
  ".nf__dot{inline-size:.5rem;block-size:.5rem;border-radius:50%;background:var(--lp-accent);box-shadow:0 0 0 4px var(--lp-accent-soft)}",
  ".nf__code{margin:0;font-family:var(--lp-font-display);font-weight:var(--lp-display-weight,700);font-size:clamp(6.5rem,27vw,13.5rem);",
  "line-height:.84;letter-spacing:var(--lp-display-tracking,-.04em);color:var(--lp-ink);font-variant-numeric:lining-nums tabular-nums}",
  ".nf__title{margin:1.6rem 0 .65rem;font-family:var(--lp-font-display);font-weight:var(--lp-display-weight,700);",
  "font-size:clamp(1.55rem,4.6vw,2.35rem);line-height:var(--lp-display-lh,1.12);letter-spacing:var(--lp-display-tracking,-.01em);text-wrap:balance}",
  ".nf__text{margin:0 auto;max-inline-size:31rem;color:var(--lp-ink-soft);font-size:1.02rem;text-wrap:pretty}",
  ".nf__btn{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;margin-top:2rem;min-block-size:52px;padding-inline:1.6rem 1.4rem;",
  "border-radius:999px;background:var(--lp-accent);color:var(--lp-accent-ink);font-weight:650;font-size:1rem;text-decoration:none;",
  "box-shadow:0 14px 32px -16px var(--lp-accent),inset 0 1px 0 rgba(255,255,255,.25);",
  "transition:transform .45s var(--lp-ease-spring,cubic-bezier(.2,1.2,.3,1)),box-shadow .45s ease}",
  ".nf__btn:hover{transform:translateY(-2px);box-shadow:0 20px 40px -18px var(--lp-accent),inset 0 1px 0 rgba(255,255,255,.25)}",
  ".nf__btn:active{transform:scale(.97)}",
  ".nf__btn:focus-visible{outline:3px solid var(--lp-accent);outline-offset:4px}",
  ".nf__btn svg{inline-size:1.15em;block-size:1.15em;transition:transform .45s var(--lp-ease-spring,ease)}",
  ".nf__btn:hover svg{transform:translateX(3px)}",
  "[dir=rtl] .nf__btn svg{transform:scaleX(-1)}[dir=rtl] .nf__btn:hover svg{transform:scaleX(-1) translateX(3px)}",
  ".nf__store{margin:3.2rem 0 0;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:var(--lp-ink-mute)}",
  "[lang=ar] .nf__code,[lang=ar] .nf__title,[lang=ar] .nf__store{letter-spacing:0;text-transform:none}",
  "[lang=ar] .nf__title{line-height:1.5}",
  ".nf>:not(.nf__glow){animation:nf-rise .9s var(--lp-ease-out,cubic-bezier(.2,.8,.2,1)) both}",
  ".nf>:nth-child(3){animation-delay:.07s}.nf>:nth-child(4){animation-delay:.14s}.nf>:nth-child(5){animation-delay:.21s}",
  ".nf>:nth-child(6){animation-delay:.28s}.nf>:nth-child(7){animation-delay:.35s}",
  "@keyframes nf-rise{from{opacity:0;transform:translateY(18px);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}",
  "@keyframes nf-drift{to{transform:translate3d(3%,-3%,0) scale(1.06)}}",
  "@media (prefers-reduced-motion:reduce){.nf__glow,.nf>*{animation:none!important}.nf__btn,.nf__btn svg{transition:none}}",
].join("");

export interface NotFoundInput {
  doc: PageDoc;
  storeName: string;
  /** site root used for fonts and the "back" link: "https://shop.ma/promo/" or "/" */
  root: string;
  /** the landing page URL ("back" link) */
  home: string;
}

export async function renderNotFoundHtml(input: NotFoundInput): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { doc } = input;
  const theme = buildTheme(doc.theme, doc.locale);
  const copy = COPY[doc.locale] ?? COPY.en;
  const css = [fontFaceCss(theme.fontIds, doc.locale, input.root), theme.css, CSS].join("\n").replace(/<\/(style)/gi, "<\\/$1");
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.attrs)) if (/^data-[a-z][a-z0-9-]{0,40}$/.test(k)) attrs[k] = v;
  const arrow = h(
    "svg",
    { viewBox: "0 0 24 24", "aria-hidden": "true", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("path", { d: "M5 12h14M13 6l6 6-6 6" }),
  );
  const page: ReactElement = h(
    "html",
    { lang: doc.locale, dir: doc.locale === "ar" ? "rtl" : "ltr", className: "lp", "data-page": "404", ...attrs },
    h(
      "head",
      null,
      h("meta", { charSet: "utf-8" }),
      h("meta", { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" }),
      h("title", null, `${copy.title} — ${input.storeName}`),
      h("meta", { name: "robots", content: "noindex" }),
      h("meta", { name: "color-scheme", content: theme.scheme }),
      h("style", { dangerouslySetInnerHTML: { __html: css } }),
    ),
    h(
      "body",
      { className: "lp-body" },
      h(
        "main",
        { className: "nf" },
        h("div", { className: "nf__glow", "aria-hidden": "true" }),
        h("p", { className: "nf__chip" }, h("span", { className: "nf__dot", "aria-hidden": "true" }), copy.chip),
        h("p", { className: "nf__code", "aria-hidden": "true" }, "404"),
        h("h1", { className: "nf__title" }, copy.title),
        h("p", { className: "nf__text" }, copy.text),
        h("a", { className: "nf__btn", href: input.home }, h("span", null, copy.back), arrow),
        h("p", { className: "nf__store" }, input.storeName),
      ),
    ),
  );
  return `<!DOCTYPE html>${renderToStaticMarkup(page)}`;
}
