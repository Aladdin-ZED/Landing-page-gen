"use server";
/**
 * Settings → Pixels mutations, the "Send test event" button and the store pixel summary that the
 * builder (and the generate wizard) read. Tokens never leave the server unmasked.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { adminAction, fail, type ActionResult } from "@/lib/admin-data/action";
import { can } from "@/lib/auth";
import { siteOrigin } from "@/lib/orders/conversions";
import { sendTestEvent, type TestEventResult } from "@/lib/orders/conversions-core";
import type { PixelFormValues } from "@/lib/pixels/form";
import { PIXEL_ID_RE, PIXEL_LIMIT, normalizePixelId } from "@/lib/pixels/ids";
import { PixelSettingsError, applyStorePixelsToDrafts, rowToken, savePixelSettings, storePixelSummary } from "@/lib/pixels/store.server";
import type { StorePixelSummary } from "@/lib/pixels/summary";
import { getSetting } from "@/lib/settings";
import { TestEventCode } from "@/lib/settings/schemas";

const Row = z.object({
  origin: z.string().max(64),
  id: z.string().max(80),
  token: z.string().max(600),
  testCode: z.string().max(40),
});
const rows = (max: number) => z.array(Row).max(max + 2);
const FormInput = z.object({
  meta: rows(PIXEL_LIMIT.meta),
  tiktok: rows(PIXEL_LIMIT.tiktok),
  snap: rows(PIXEL_LIMIT.snap),
  ga4: rows(PIXEL_LIMIT.ga4),
});

export async function savePixelSettingsAction(values: PixelFormValues): Promise<ActionResult<{ values: PixelFormValues }>> {
  return adminAction("settings.write", async ({ actor }) => {
    const input = FormInput.parse(values);
    try {
      const saved = await savePixelSettings(input, actor);
      revalidatePath("/admin/settings", "layout");
      revalidatePath("/admin");
      return { values: saved };
    } catch (err) {
      if (err instanceof PixelSettingsError) fail(err.message);
      throw err;
    }
  });
}

/** Copy the saved store pixels into every page draft (live pages then show unpublished changes). */
export async function applyStorePixelsAction(): Promise<ActionResult<{ updated: number; live: number; skipped: number }>> {
  return adminAction("settings.write", async ({ user, actor }) => {
    if (!can(user.role, "pages.write")) fail("Your role can't edit pages.");
    const res = await applyStorePixelsToDrafts(actor);
    if (!res.platforms.length) fail("Save at least one pixel ID first.");
    revalidatePath("/admin/pages");
    revalidatePath("/admin");
    return { updated: res.updated, live: res.live, skipped: res.skipped };
  });
}

const TestInput = z.object({
  platform: z.enum(["meta", "tiktok"]),
  id: z.string().max(80),
  origin: z.string().max(64),
  token: z.string().max(600),
  testCode: z.string().max(40),
});

/**
 * Send a synthetic Purchase with the platform's test event code (it shows in Events Manager → Test
 * events and never counts in reports). Uses the typed token, or the stored one behind a mask.
 */
export async function sendPixelTestAction(input: z.input<typeof TestInput>): Promise<ActionResult<TestEventResult>> {
  return adminAction("settings.write", async () => {
    const v = TestInput.parse(input);
    const pixelId = normalizePixelId(v.platform, v.id);
    if (!PIXEL_ID_RE[v.platform].test(pixelId)) fail("Enter a valid pixel ID first.");
    const code = TestEventCode.safeParse(v.testCode.replace(/\s+/g, "").toUpperCase());
    if (!code.success) fail("Add the test event code from Events Manager → Test events first.");
    const token = await rowToken(v.platform, v.origin, v.token);
    if (!token) fail(v.platform === "meta" ? "Add the Conversions API token first." : "Add the Events API access token first.");
    if (!/^[A-Za-z0-9_\-.:|=+/]{8,512}$/.test(token)) fail("This doesn't look like a valid token — paste it again.");
    const defaults = await getSetting("defaults");
    // Meta requires a page URL for website events: the site (PUBLIC_URL), else the host serving the admin
    let siteUrl = siteOrigin();
    if (!siteUrl) {
      const host = (await headers()).get("host") ?? "";
      siteUrl = /^[a-z0-9.-]+(:[0-9]{1,5})?$/i.test(host) ? `https://${host}` : null;
    }
    return sendTestEvent({
      platform: v.platform,
      pixelId,
      token,
      testCode: code.data!,
      siteUrl: siteUrl ? `${siteUrl}/` : null,
      currency: defaults.currency,
      country: defaults.phoneCountry,
    });
  });
}

/** Store pixels (ids + server/test flags, never a token) for the builder and the generate wizard. */
export async function storePixelSummaryAction(): Promise<ActionResult<StorePixelSummary>> {
  return adminAction("pages.read", () => storePixelSummary());
}
