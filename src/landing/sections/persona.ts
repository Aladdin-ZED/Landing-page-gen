/**
 * Does the page speak for a NAMED store? When Settings → Store has no real name, the renderer
 * stands the product's short name in for it (context.ts: "Abaya de prière" as the wordmark). That
 * is fine for a wordmark, but wrong for anything that reads as people: a team byline ("L'équipe
 * Abaya de prière"), a monogram avatar, a chat header showing the product as an online person.
 * Those views ask hasStoreName() and use neutral wording instead.
 *
 * Reads `ctx.store.named` when the renderer provides it (contract request), else compares the store
 * name with the product-name stand-in. Pure.
 */
import { isRealStoreName, shortProductName } from "@/landing/context";
import { brandName } from "@/landing/primitives";
import type { RenderContext } from "../types";

const norm = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase();

export function hasStoreName(ctx: Pick<RenderContext, "store" | "product">): boolean {
  const named = (ctx.store as { named?: unknown }).named;
  if (typeof named === "boolean") return named;
  const store = ctx.store.name;
  if (!isRealStoreName(store)) return false;
  const n = norm(store);
  const product = ctx.product.name;
  // every stand-in the kit uses: the short name (context.ts), the full name, the 32-char brand cut (util.ts)
  const standIns = [shortProductName(product), product, brandName({ store: { name: "" }, product: { name: product } })];
  return !standIns.some((x) => norm(x) === n);
}
