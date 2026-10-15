"use server";
/**
 * Generator → page. "Use this direction" creates a draft page from the chosen direction and stores
 * all three directions as "generation" versions, so the alternatives stay one click away in History.
 *
 * The documents come from the browser (the generator is pure and runs client-side): each one is
 * validated and repaired with validateDoc, size-capped, and must only reference assets that exist.
 * New pages start with the store pixels (Settings → Pixels) for every platform the doc leaves empty —
 * unless the wizard sends `pixels: "chosen"`: then its Ad tracking choices already hold the store
 * pixels the owner kept, and a platform it left empty (every pixel unticked) stays empty.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, fail, type ActionResult } from "@/lib/admin-data/action";
import { docChecksum, slugify, uniqueSlug, type StorePixels } from "@/lib/admin-data/pages";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db/client";
import { newId, newPublicKey } from "@/lib/db/ids";
import { pages, pageVersions } from "@/lib/db/schema";
import { getAssetsByIds } from "@/lib/media";
import { Archetype, type PageDoc } from "@/lib/page/schema";
import { validateDoc } from "@/lib/page/validate";
import { mergeStorePixels } from "@/lib/pixels/tracking";
import { getSetting } from "@/lib/settings";
import { collectAssetIds } from "@/landing/context";

/** A generated document is ~30–60 KB of JSON; anything far beyond that is not from the generator. */
const MAX_DOC_CHARS = 400_000;

const Input = z
  .object({
    name: z.string().trim().min(1, { error: "Give the product a name." }).max(120),
    chosen: z.number().int().min(0).max(2),
    directions: z
      .array(z.object({ archetype: Archetype, label: z.string().trim().min(1).max(40), doc: z.unknown() }))
      .min(1)
      .max(3),
    /** "chosen": the docs carry the wizard's Ad tracking choices — no store-pixel fill */
    pixels: z.literal("chosen").optional(),
  })
  .refine((i) => i.chosen < i.directions.length, { error: "Pick one of the directions." });

export type CreateFromDirectionsInput = z.input<typeof Input>;

const cleanName = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);

/** mysql2 error code, looking through drizzle's wrapping (`cause`). */
function dbErrorCode(err: unknown): string | undefined {
  for (let e: unknown = err, depth = 0; e && typeof e === "object" && depth < 4; depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Base for the page address: the product name when it has Latin letters, else the category
 * ("skincare", "organic-food") — an Arabic-only name would otherwise give "page-7".
 */
const slugBase = (name: string, category: string) => (slugify(name) !== "page" ? name : category);

export async function createFromDirectionsAction(input: CreateFromDirectionsInput): Promise<ActionResult<{ id: string; slug: string }>> {
  return adminAction("pages.write", async ({ actor }) => {
    const { name, chosen, directions, pixels } = Input.parse(input);

    // the stored setting is schema-validated (same Tracking schema as the doc); the wizard's own
    // pixel choices stand as they are (unticking every pixel of a platform must stick)
    const storePixels: StorePixels | null = pixels === "chosen" ? null : await getSetting("pixels");
    const docs: { label: string; doc: PageDoc }[] = [];
    for (const d of directions) {
      if (JSON.stringify(d.doc ?? null).length > MAX_DOC_CHARS) fail("This direction is too large to save.");
      const { doc, issues } = validateDoc(d.doc);
      if (!doc) return fail(`This direction can't be saved: ${issues.find((i) => i.level === "error")?.message ?? "invalid page"}.`);
      if (doc.theme.archetype !== d.archetype) fail("The directions changed while saving — generate again.");
      docs.push({ label: d.label, doc: storePixels ? { ...doc, tracking: mergeStorePixels(doc.tracking, storePixels, "fill") } : doc });
    }

    // photos are uploaded before generating: a missing asset means it was deleted meanwhile
    const ids = [...new Set(docs.flatMap((d) => collectAssetIds(d.doc)))];
    if (ids.length) {
      const found = await getAssetsByIds(ids);
      if (found.length < ids.length) fail("Some photos are no longer in the media library — add them again.");
    }

    const page = docs[chosen]!;
    const id = newId();
    const now = Date.now();
    // the chosen direction is saved last so it is the newest version (= the draft)
    const order = [...docs.keys()].filter((i) => i !== chosen).concat(chosen);

    const insert = (slug: string) =>
      db.transaction(async (tx) => {
        await tx.insert(pages).values({
          id,
          slug,
          name: cleanName(name) || "Untitled page",
          status: "draft",
          locale: page.doc.locale,
          publicKey: newPublicKey(),
          draft: page.doc,
          createdBy: actor.id,
          createdAt: new Date(now),
          updatedAt: new Date(now),
        });
        await tx.insert(pageVersions).values(
          order.map((i, n) => ({
            id: newId(),
            pageId: id,
            kind: "generation" as const,
            label: `Direction ${i + 1} · ${docs[i]!.label}${i === chosen ? " (chosen)" : ""}`.slice(0, 160),
            doc: docs[i]!.doc,
            checksum: docChecksum(docs[i]!.doc),
            createdBy: actor.id,
            createdAt: new Date(now - (order.length - 1 - n)),
          })),
        );
      });

    // another page may take the same free address between the check and the insert: retry
    let slug = "";
    for (let attempt = 0; ; attempt++) {
      slug = await uniqueSlug(slugBase(name, page.doc.product.category));
      try {
        await insert(slug);
        break;
      } catch (err) {
        if (dbErrorCode(err) !== "ER_DUP_ENTRY" || attempt >= 2) throw err;
      }
    }

    await audit("page.generated", {
      userId: actor.id,
      target: id,
      meta: { archetypes: docs.map((d) => d.doc.theme.archetype), chosen: page.doc.theme.archetype, locale: page.doc.locale },
      ip: actor.ip,
    });
    revalidatePath("/admin/pages");
    revalidatePath("/admin/history");
    revalidatePath("/admin");
    return { id, slug };
  });
}
