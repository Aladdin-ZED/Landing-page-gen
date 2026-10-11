/**
 * Pre-publish checklist: blocking errors (the page would be broken or misleading) and warnings
 * (quality and honesty), each with a "fix" target in the builder. Pure and isomorphic.
 */
import { getSection } from "@/landing/registry";
import { bundleMath, bundleWarnings } from "@/lib/page/pricing";
import type { PageDoc } from "@/lib/page/schema";
import { validateDoc } from "@/lib/page/validate";
import { assetRefsIn, fieldLabel, sectionIssues, valuesOfKind } from "./fields";
import type { LeftTab } from "./store";
import type { StoreHealth } from "./types";

export interface CheckFix {
  tab?: LeftTab;
  sectionId?: string;
  /** an admin screen outside the builder (opened in a new tab so the editor stays as it is) */
  href?: string;
}

const STORE_SETTINGS = "/admin/settings/store";

export interface CheckItem {
  id: string;
  level: "error" | "warning";
  title: string;
  detail?: string;
  fix?: CheckFix;
}

export interface Checklist {
  errors: CheckItem[];
  warnings: CheckItem[];
  /** visible sections still flagged as sample content (needs the merchant's confirmation) */
  sampleSectionIds: string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function buildChecklist(doc: PageDoc, store: StoreHealth, now = Date.now()): Checklist {
  const errors: CheckItem[] = [];
  const warnings: CheckItem[] = [];
  const add = (item: CheckItem) => (item.level === "error" ? errors : warnings).push(item);
  const visible = doc.sections.filter((s) => !s.hidden);
  const label = (type: string) => getSection(type)?.label ?? type;

  /* ---- page-level validity (what publish will refuse) ---- */
  const { doc: valid, issues } = validateDoc(doc);
  if (!valid) {
    for (const i of issues.filter((x) => x.level === "error").slice(0, 4)) {
      add({ id: `doc:${i.path}`, level: "error", title: "Page settings are invalid", detail: `${i.path || "page"} — ${i.message}` });
    }
  }

  /* ---- product & offer ---- */
  if (!doc.product.name.trim()) add({ id: "product:name", level: "error", title: "Name your product", fix: { tab: "product" } });
  if (!(doc.product.price > 0)) add({ id: "product:price", level: "error", title: "Set the product price", fix: { tab: "product" } });
  doc.offers.bundles.forEach((b, i) => {
    if (!(b.price > 0)) add({ id: `bundle:${b.id}:price`, level: "error", title: `Pack ${i + 1} (x${b.qty}) has no price`, fix: { tab: "offers" } });
  });

  /* ---- order form ---- */
  const form = doc.sections.find((s) => getSection(s.type)?.required);
  if (!form) add({ id: "form:missing", level: "error", title: "The order form is missing", detail: "Add the Order form section so visitors can order.", fix: { tab: "sections" } });
  else if (form.hidden) add({ id: "form:hidden", level: "error", title: "The order form is hidden", detail: "Visitors could not order from this page.", fix: { sectionId: form.id } });

  /* ---- section data ---- */
  for (const s of visible) {
    const def = getSection(s.type);
    if (!def) continue;
    const list = sectionIssues(def, s.data);
    if (list.length) {
      const first = list[0]!;
      add({
        id: `section:${s.id}`,
        level: "error",
        title: `${label(s.type)}: ${first.path ? fieldLabel(def.fields, first.path) : "content"} — ${first.message}`,
        detail: list.length > 1 ? `${plural(list.length - 1, "more problem")} in this section.` : undefined,
        fix: { sectionId: s.id },
      });
    }
    if (!def.variants.some((v) => v.id === s.variant)) {
      add({ id: `variant:${s.id}`, level: "warning", title: `${label(s.type)}: unknown style "${s.variant}"`, detail: "The first style will be used.", fix: { sectionId: s.id } });
    }
  }

  /* ---- honesty: sample content ---- */
  const sampleSectionIds = visible.filter((s) => (s.data as Record<string, unknown>)?.sample === true).map((s) => s.id);
  for (const id of sampleSectionIds) {
    const s = doc.sections.find((x) => x.id === id)!;
    add({
      id: `sample:${id}`,
      level: "warning",
      title: `The ${label(s.type)} section still shows example content`,
      detail: "Replace the examples with real customer reviews, chats or numbers.",
      fix: { sectionId: id },
    });
  }

  /* ---- prices ---- */
  if (doc.product.compareAt !== undefined && doc.product.compareAt <= doc.product.price) {
    add({ id: "product:compare", level: "warning", title: "“Compare at” is not higher than the price", detail: "No saving is shown; remove it or enter the real previous price.", fix: { tab: "product" } });
  }
  doc.offers.bundles.forEach((b) => {
    const m = bundleMath(b, doc.product.price);
    if (b.compareAt !== undefined && !m.showReference) {
      add({ id: `bundle:${b.id}:compare`, level: "warning", title: `Pack x${b.qty}: “compare at” shows no real saving`, fix: { tab: "offers" } });
    }
  });
  bundleWarnings(doc.offers, doc.product.price).forEach((w, i) => add({ id: `bundles:${i}`, level: "warning", title: w, fix: { tab: "offers" } }));

  /* ---- extras: an offer shoppers can accept must say what it is ---- */
  const bump = doc.offers.orderBump;
  if (bump?.enabled) {
    if (!bump.title.trim()) add({ id: "bump:title", level: "error", title: "The order bump has no title", detail: "Shoppers would tick an extra without knowing what it is.", fix: { tab: "offers" } });
    if (!(bump.price > 0)) add({ id: "bump:price", level: "warning", title: "The order bump is free", detail: "Set its price, or keep it free on purpose.", fix: { tab: "offers" } });
  }
  const upsell = doc.offers.upsell;
  if (upsell?.enabled) {
    if (!upsell.title.trim()) add({ id: "upsell:title", level: "error", title: "The thank-you upsell has no title", detail: "Shoppers would add an item without knowing what it is.", fix: { tab: "offers" } });
    if (!(upsell.price > 0)) add({ id: "upsell:price", level: "warning", title: "The thank-you upsell is free", detail: "Set its price, or keep it free on purpose.", fix: { tab: "offers" } });
    if (upsell.compareAt !== undefined && upsell.compareAt <= upsell.price) {
      add({ id: "upsell:compare", level: "warning", title: "Upsell “compare at” is not higher than its price", detail: "No saving is shown; remove it or enter the real previous price.", fix: { tab: "offers" } });
    }
  }

  /* ---- time ---- */
  const end = doc.offers.urgency.countdownEnd;
  if (end && Date.parse(end) <= now) {
    add({ id: "urgency:past", level: "warning", title: "The countdown has already ended", detail: "It hides itself — set a new real end date or remove it.", fix: { tab: "offers" } });
  }
  for (const s of visible) {
    const def = getSection(s.type);
    if (!def) continue;
    for (const v of valuesOfKind(def.fields, s.data, ["datetime"])) {
      if (typeof v.value === "string" && v.value && Date.parse(v.value) <= now) {
        add({ id: `time:${s.id}:${v.path}`, level: "warning", title: `${label(s.type)}: “${v.label}” is in the past`, fix: { sectionId: s.id } });
      }
    }
  }
  if (doc.offers.urgency.stockLeft === 0) add({ id: "urgency:stock", level: "warning", title: "Stock left is set to 0", fix: { tab: "offers" } });

  /* ---- store identity (legal & contact pages) ---- */
  if (!store.hasPhone && !store.hasEmail) {
    add({ id: "store:contact", level: "warning", title: "No contact phone or email", detail: "Add them in Settings → Store: shoppers and the legal pages need a way to reach you.", fix: { href: STORE_SETTINGS } });
  }
  if (!store.hasLegalName || !store.hasAddress) {
    add({ id: "store:legal", level: "warning", title: "Legal pages are incomplete", detail: "Add your legal name and address in Settings → Store.", fix: { href: STORE_SETTINGS } });
  }

  /* ---- media & SEO ---- */
  if (!doc.product.images.length && !doc.product.cutout) add({ id: "product:images", level: "warning", title: "No product photos yet", fix: { tab: "product" } });
  const productRefs = [...doc.product.images, ...(doc.product.cutout ? [doc.product.cutout] : [])];
  const sectionRefs = visible.map((s) => ({ id: s.id, refs: assetRefsIn(s.data) }));
  const missing = (r: { alt?: string }) => !r.alt?.trim();
  const noAlt = new Set([...productRefs, ...sectionRefs.flatMap((s) => s.refs)].filter(missing).map((r) => r.id)).size;
  if (noAlt) {
    // fix where the first one is: the product photos, else the first section holding one
    const where = productRefs.some(missing) ? undefined : sectionRefs.find((s) => s.refs.some(missing))?.id;
    add({
      id: "media:alt",
      level: "warning",
      title: `${plural(noAlt, "image")} without alt text`,
      detail: "Describe each photo in a few words (accessibility and search).",
      fix: where ? { sectionId: where } : { tab: "product" },
    });
  }
  if (!doc.seo.title?.trim()) add({ id: "seo:title", level: "warning", title: "No SEO title", detail: "The product name is used in search results.", fix: { tab: "seo" } });
  if (!doc.seo.description?.trim()) add({ id: "seo:description", level: "warning", title: "No meta description", fix: { tab: "seo" } });

  return { errors, warnings, sampleSectionIds };
}
