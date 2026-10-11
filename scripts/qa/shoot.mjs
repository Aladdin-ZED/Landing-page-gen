#!/usr/bin/env node
/**
 * QA screenshots of a rendered landing HTML file (Playwright Chromium).
 *
 *   node scripts/qa/shoot.mjs qa/argan.html --out qa/shots
 *   node scripts/qa/shoot.mjs qa/argan.html --out qa/shots --widths 390,820,1280 --full
 *
 * Flags: --out <dir> (default qa/shots) · --widths <px,…> (default 390,1280) · --full (whole page;
 *   default: first viewport only) · --wait <ms> extra settle time (default 250).
 *
 * Every reveal is forced to its final state (html.lp-qa + data-in set while the page parses, so the
 * runtime never animates), transitions/animations collapse to their end, lazy images are loaded,
 * and the shot waits for web fonts. Console errors, page errors and failed requests are reported.
 * Output: <out>/<file>-<width>.png. Needs `npx playwright install chromium` once.
 */
import { mkdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const QA_CSS =
  "html.lp-qa *,html.lp-qa *::before,html.lp-qa *::after{transition-duration:0s!important;transition-delay:0s!important;" +
  "animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;scroll-behavior:auto!important;caret-color:transparent!important}";

function fail(msg) {
  console.error(`shoot: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { file: "", out: "qa/shots", widths: [390, 1280], full: false, wait: 250 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--full") out.full = true;
    else if (a === "--out" || a === "--widths" || a === "--wait") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) fail(`${a} needs a value`);
      if (a === "--out") out.out = v;
      else if (a === "--wait") out.wait = Math.max(0, Number(v) || 0);
      else {
        out.widths = v.split(",").map((w) => Math.round(Number(w.trim())));
        if (out.widths.some((w) => !Number.isFinite(w) || w < 240 || w > 3840)) fail("--widths must be numbers between 240 and 3840");
      }
    } else if (a.startsWith("--")) fail(`unknown flag ${a}`);
    else if (!out.file) out.file = a;
    else fail(`unexpected argument "${a}"`);
  }
  if (!out.file) fail("usage: shoot.mjs <file.html> [--out dir] [--widths 390,1280] [--full] [--wait ms]");
  return out;
}

/** Runs in the page before any script: QA class + style, and data-in on every [data-reveal] as it is parsed. */
function qaInit(css) {
  let ready = false;
  const setup = () => {
    const root = document.documentElement;
    if (ready || !root) return;
    ready = true;
    root.classList.add("lp-qa");
    const style = document.createElement("style");
    style.textContent = css;
    root.appendChild(style);
  };
  const mark = (node) => {
    if (node.nodeType !== 1) return;
    if (node.hasAttribute("data-reveal")) node.setAttribute("data-in", "");
    for (const el of node.querySelectorAll("[data-reveal]")) el.setAttribute("data-in", "");
  };
  new MutationObserver((records) => {
    setup();
    for (const r of records) r.addedNodes.forEach(mark);
  }).observe(document, { childList: true, subtree: true });
  setup();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = resolve(args.file);
  const url = pathToFileURL(file).href;
  const outDir = resolve(args.out);
  mkdirSync(outDir, { recursive: true });
  const name = basename(file, extname(file));

  // Playwright's bundled Chromium first; on machines where its download fails, use installed Edge/Chrome.
  const launchArgs = ["--allow-file-access-from-files", "--font-render-hinting=none"];
  let browser;
  let lastErr;
  for (const opts of [{}, { channel: "msedge" }, { channel: "chrome" }]) {
    try {
      browser = await chromium.launch({ ...opts, args: launchArgs });
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!browser) {
    fail(`cannot start a browser (${lastErr instanceof Error ? lastErr.message.split("\n")[0] : lastErr}). Run: npx playwright install chromium`);
  }
  const shots = [];
  try {
    for (const width of args.widths) {
      const mobile = width < 768;
      const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : width < 1100 ? 1180 : 900 },
        deviceScaleFactor: mobile ? 2 : 1,
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();
      const problems = [];
      page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error" || m.type() === "warning") problems.push(`console ${m.type()}: ${m.text()}`);
      });
      page.on("requestfailed", (r) => problems.push(`failed: ${r.url().slice(0, 140)} (${r.failure()?.errorText ?? "?"})`));
      await page.addInitScript(qaInit, QA_CSS);
      await page.goto(url, { waitUntil: "load" });
      await page.evaluate(async () => {
        for (const img of document.images) img.loading = "eager";
        // decode() settles once the (now eager) image has loaded — also for images inside blocks the
        // runtime revealed after parsing (e.g. the thank-you upsell), where `complete` can lie early
        await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));
        await document.fonts.ready;
      });
      await page.waitForTimeout(args.wait);
      const out = join(outDir, `${name}-${width}.png`);
      await page.screenshot({ path: out, fullPage: args.full, animations: "disabled" });
      shots.push(out);
      for (const p of problems) console.warn(`  ! ${width}px ${p}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(shots.join("\n"));
}

main().catch((err) => fail(err instanceof Error ? (err.stack ?? err.message) : String(err)));
