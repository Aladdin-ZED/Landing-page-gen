/**
 * Renderer regression check — every fixture × ar/fr/en × landing, thank-you and the four legal
 * documents, rendered in memory (no files written) with the live renderer:
 *  - no section fails to render; every inline <script>/<style> hash is in the CSP; the live CSP has
 *    frame-ancestors + upgrade-insecure-requests; one runtime script on landing/thank-you, none on
 *    legal documents; style attributes only carry custom properties; lp-config parses;
 *  - every BuiltTheme attribute the CSS switches on is on <html>;
 *  - dividers are v2 kinds only, never the same shape twice in a row, none on "panels" pages;
 *  - a v1 document (paper texture, hard shadow, torn/scallop dividers…) is migrated, not rejected.
 *
 *   npx tsx scripts/qa/render-check.ts        (exit code 1 on any failure)
 */
import { LEGAL_KINDS, liveLinks } from "@/landing/context";
import { FIXTURE_NAMES, fixtureAssets, getFixture } from "@/lib/page/fixtures";
import { DIVIDERS } from "@/lib/page/schema";
import { validateDoc } from "@/lib/page/validate";
import { inlineHashes, renderLandingHtml, renderLegalHtml, renderThankYouHtml, styleAttrViolations } from "@/lib/render/core";
/** Same values as PUBLIC_ENDPOINTS in src/lib/render/publish.server.ts (server-only, not importable here). */
const PUBLIC_ENDPOINTS = { order: "/api/public/order", lead: "/api/public/lead", event: "/api/public/event", upsell: "/api/public/upsell" };

const now = "2026-10-07T12:00:00.000Z";
let failures = 0;
const fail = (m: string) => {
  failures++;
  console.log("  FAIL " + m);
};

async function main() {
  for (const name of FIXTURE_NAMES) {
    for (const locale of ["ar", "fr", "en"] as const) {
      const fx = getFixture(name, { now, locale });
      const { doc, issues } = validateDoc(fx.doc);
      if (!doc) {
        fail(`${name}/${locale}: invalid doc ${JSON.stringify(issues.slice(0, 3))}`);
        continue;
      }
      const opts = {
        mode: "live" as const,
        assets: fixtureAssets("/"),
        pageKey: fx.pageKey,
        store: fx.store,
        urls: { landing: `/${name}`, thankYou: `/${name}/merci`, endpoints: PUBLIC_ENDPOINTS },
        links: liveLinks(name),
        origin: "https://shop.example",
        now,
        upgradeInsecureRequests: true,
      };
      const pages = [
        ["landing", await renderLandingHtml(doc, opts)],
        ["merci", await renderThankYouHtml(doc, opts)],
        ...(await Promise.all(LEGAL_KINDS.map(async (k) => [k, await renderLegalHtml(doc, k, { mode: "live", assets: opts.assets, store: fx.store, links: opts.links, now, upgradeInsecureRequests: true })] as const))),
      ] as const;
      const warns = issues.filter((i) => i.level === "warning").length;
      console.log(`${name}/${locale} ${doc.theme.archetype} warnings=${warns}`);
      for (const [kind, r] of pages) {
        const { scripts, styles } = inlineHashes(r.html);
        const tag = `${name}/${locale}/${kind}`;
        if (r.issues.length) fail(`${tag}: failed sections ${r.issues.map((i) => i.sectionId + ":" + i.message).join("; ")}`);
        for (const h of [...scripts, ...styles]) if (!r.csp.includes(`'${h}'`)) fail(`${tag}: hash missing from CSP ${h}`);
        const styleCount = (r.html.match(/<style\b/g) ?? []).length;
        const expectScripts = kind === "landing" || kind === "merci" ? 1 : 0;
        if (scripts.length !== expectScripts) fail(`${tag}: ${scripts.length} executable scripts (expected ${expectScripts})`);
        if (styleCount < 1) fail(`${tag}: no <style>`);
        const v = styleAttrViolations(r.html);
        if (v.length) fail(`${tag}: style attr violations ${v.slice(0, 3).join(" | ")}`);
        const html = /<html[^>]*>/.exec(r.html)?.[0] ?? "";
        for (const a of ["data-surfaces", "data-arch", "data-btn", "data-shadow", "data-texture"]) if (!html.includes(a + "=")) fail(`${tag}: <html> lacks ${a}`);
        if (/data-kind="(marquee-tape|scallop|zigzag|torn|stitch|zellige-band)"/.test(r.html.replace(/<style[\s\S]*?<\/style>/g, ""))) fail(`${tag}: retired divider/edge name in markup`);
        if (!/frame-ancestors 'none'/.test(r.csp) || !/upgrade-insecure-requests/.test(r.csp)) fail(`${tag}: live CSP lacks frame-ancestors/upgrade`);
        if (kind === "landing") {
          const kinds = [...r.html.matchAll(/class="lp-divider[^"]*" data-kind="([a-z]+)"/g)].map((m) => m[1]!);
          const surfaces = /data-surfaces="(\w+)"/.exec(html)?.[1];
          if (kinds.some((k) => !(DIVIDERS as readonly string[]).includes(k))) fail(`${tag}: unknown divider ${kinds.join(",")}`);
          if (surfaces === "panels" && kinds.length) fail(`${tag}: auto dividers on a panels page (${kinds.join(",")})`);
          for (let i = 1; i < kinds.length; i++) if (kinds[i] === kinds[i - 1]) fail(`${tag}: same divider twice in a row (${kinds[i]})`);
          console.log(`   ${surfaces} dividers: ${kinds.join(" ") || "-"} · ${Math.round(r.html.length / 1024)} KB`);
          const cfg = /<script type="application\/json" id="lp-config">([\s\S]*?)<\/script>/.exec(r.html)?.[1];
          if (!cfg || JSON.parse(cfg).v !== 1) fail(`${tag}: lp-config missing`);
        }
      }
    }
  }

  /* legacy (v1) theme values are migrated, not fatal */
  const fx = getFixture("argan", { now });
  const legacy = JSON.parse(JSON.stringify(fx.doc));
  legacy.theme.texture = "paper";
  legacy.theme.shadow = "hard";
  legacy.theme.surfaces = "boxed";
  legacy.theme.dividers = ["torn", "arch", "scallop", "arch"];
  legacy.sections[3].divider = "marquee-tape";
  legacy.sections[4].bg = "kraft";
  const v = validateDoc(legacy);
  if (!v.doc) fail(`legacy doc rejected: ${JSON.stringify(v.issues.slice(0, 4))}`);
  else {
    const t = v.doc.theme;
    if (t.texture !== "archetype" || t.shadow !== "archetype" || t.surfaces !== "archetype" || t.dividers.join() !== "arch") fail(`legacy theme not migrated ${JSON.stringify(t)}`);
    if (v.doc.sections[3]!.divider !== "auto" || v.doc.sections[4]!.bg !== "base") fail("legacy section values not migrated");
    console.log(`legacy migration: ${v.issues.filter((i) => i.message.startsWith("Retired")).length} retired values repaired`);
  }
  console.log(failures ? `${failures} FAILURE(S)` : "ALL OK");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
