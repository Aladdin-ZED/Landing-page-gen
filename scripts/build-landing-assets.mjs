#!/usr/bin/env node
/**
 * build-landing-assets — compiles the landing kit's static assets into TypeScript modules that the
 * renderer (publish/export) and the admin preview import as plain strings.
 *
 * Section stylesheets live in src/landing/sections/<type>/:
 *   <type>.css            rules every variant uses (may @import partials: orderForm's pv.css, packs.css)
 *   <type>.<variant>.css  optional: rules only that variant renders. <variant> is the variant id
 *                         (lowercase, digits, single dashes: "two-col", "big-numbers") the section root
 *                         renders as its modifier class .lp-<type>--<variant> — or, for a root named
 *                         after its own block (stickyCta: .lp-sticky), as data-section="<type>"
 *                         data-variant="<variant>". Every rule must only ever match markup inside that
 *                         variant's root — a page that does not render the variant never receives it.
 *                         A rule several (not all) variants need is repeated in each of their files,
 *                         identically. Variant files are inlined AFTER <type>.css: on equal specificity
 *                         a variant rule wins over a shared one. No @import in variant files.
 *
 * → src/landing/generated/assets.ts (admin preview + renderer):
 *   baseCss          src/landing/styles/base.css + src/landing/illustrations/illustrations.css
 *   sectionCss       per type: the COMPLETE stylesheet — <type>.css, then every variant file merged
 *                    into one cascade-safe sequence (below). The admin preview concatenates these; a
 *                    page that renders two or more variants of one type inlines it.
 *   thankYouCss      src/landing/thankyou/thankyou.css
 *   legalCss         src/landing/legal/legal.css (privacy / terms / shipping / contact documents)
 *   runtimeJs        src/landing/runtime/entry.ts bundled as an IIFE (es2019, minified)
 *   runtimeHash      "sha256-<base64>" of runtimeJs, for the hash-based landing CSP
 *   version          short content hash of everything here and in chunks.ts
 * → src/landing/generated/chunks.ts (renderer only — kept out of the admin's client bundle):
 *   sectionChunkCss  types with variant files: "<type>" (<type>.css) and "<type>.<variant>"
 *   sectionVariants  the variant ids of each of those types (sorted)
 *   A page rendering ONE variant of a type inlines "<type>" + "<type>.<variant>" (src/landing/document.tsx).
 *
 * Why a merge for the complete stylesheet: concatenating the variant files would repeat a rule two
 * variants share AFTER the first variant's own later rules, where it could override them (the
 * preview, or a page with two variants of one type). Every variant file keeps the source order of its
 * rules, so the files are merged as sequences of statements (longest-common-subsequence merge,
 * through @media / @supports / @container / @layer groups): each shared statement appears once, and
 * every file's own order is kept, so each variant's markup meets its rules exactly as on its own page.
 *
 * Files are rewritten only when their content changes. Runs on predev/prebuild (`npm run
 * assets:build`). Missing or empty sources yield empty strings; invalid CSS rules are dropped with a
 * warning (lightningcss error recovery) so one broken section can never take the whole site down.
 * Budget (a warning, never a failure): runtime ≤ 15 KB gzip. `--report` prints every chunk's size.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { bundle as bundleCss, transform as transformCss, Features } from "lightningcss";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LANDING = join(ROOT, "src", "landing");
const OUT_FILE = join(LANDING, "generated", "assets.ts");
const CHUNKS_FILE = join(LANDING, "generated", "chunks.ts");
const REPORT = process.argv.includes("--report");

/** Runtime budget (ARCHITECTURE.md: ~15 KB of runtime on a visitor's page), gzip -9 bytes. */
const RUNTIME_GZIP_BUDGET = 15 * 1024;

/** Browser floor of the landing pages (DESIGN.md §9): chrome 90, safari 14, firefox 90, samsung 14. */
const v = (major, minor = 0) => (major << 16) | (minor << 8);
const TARGETS = { chrome: v(90), safari: v(14), firefox: v(90), samsung: v(14) };

const t0 = performance.now();
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");
let warnings = 0;

function warn(msg) {
  warnings++;
  console.warn(`  ! ${msg}`);
}

/** `</style` inside the inlined stylesheet would close the element early. */
const guardStyle = (css) => css.replace(/<\/(style)/gi, "<\\/$1");
/** Same for the inline runtime script (esbuild already escapes it in strings; this is defense in depth). */
const guardScript = (js) => js.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

function isNonEmptyFile(file) {
  try {
    return statSync(file).isFile() && readFileSync(file, "utf8").trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Bundle (@import) + minify + lower for the targets. Nesting is lowered (Chrome 90 has no native
 * nesting); logical properties are kept as written — RTL relies on them and every target supports
 * the ones the kit uses.
 */
const CSS_OPTIONS = { minify: true, sourceMap: false, errorRecovery: true, targets: TARGETS, exclude: Features.LogicalProperties };

function compileCss(file) {
  if (!isNonEmptyFile(file)) return "";
  try {
    const res = bundleCss({ filename: file, ...CSS_OPTIONS });
    for (const w of res.warnings ?? []) {
      warn(`${rel(w.loc?.filename ?? file)}:${w.loc?.line ?? "?"}:${w.loc?.column ?? "?"} ${w.message}`);
    }
    return guardStyle(Buffer.from(res.code).toString("utf8"));
  } catch (err) {
    warn(`${rel(file)}: ${err instanceof Error ? err.message : String(err)} — chunk skipped`);
    return "";
  }
}

/** Compile a stylesheet held in memory (`label` names it in warnings). */
function compileCssText(code, label) {
  if (!code.trim()) return "";
  try {
    const res = transformCss({ filename: label, code: Buffer.from(code, "utf8"), ...CSS_OPTIONS });
    for (const w of res.warnings ?? []) warn(`${label}:${w.loc?.line ?? "?"}:${w.loc?.column ?? "?"} ${w.message}`);
    return guardStyle(Buffer.from(res.code).toString("utf8"));
  } catch (err) {
    warn(`${label}: ${err instanceof Error ? err.message : String(err)} — chunk skipped`);
    return "";
  }
}

/* ---------------------------------------------------------------------------------------------
 * Variant merge (the complete stylesheet of a type). A tiny statement scanner over the SOURCE
 * files: comments dropped, strings and parentheses respected, group rules (@media, @supports,
 * @container, @layer {…}, @scope, @starting-style, @document) descended into; everything else —
 * a style rule with its whole block (nesting included), @keyframes, @font-face, @property, a
 * statement at-rule — is one opaque statement. Whitespace outside strings collapses to one space
 * (insignificant in CSS), so the identical copies the variant files hold compare equal.
 * --------------------------------------------------------------------------------------------- */

const GROUP_AT_RULE = /^@(?:media|supports|container|layer|scope|starting-style|document|-moz-document)\b/i;

/** `src` without comments; strings kept verbatim. */
function stripComments(src) {
  let out = "";
  for (let i = 0; i < src.length; ) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
      out += " ";
    } else if (c === '"' || c === "'") {
      const j = skipString(src, i);
      out += src.slice(i, j);
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Index just past the string literal starting at `i` (escapes honored; an unclosed string ends at the line). */
function skipString(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== q && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
  return Math.min(j + 1, src.length);
}

/** Collapse whitespace runs outside strings to one space; trim. */
function squash(text) {
  let out = "";
  let space = false;
  for (let i = 0; i < text.length; ) {
    const c = text[i];
    if (c === '"' || c === "'") {
      const j = skipString(text, i);
      if (space && out) out += " ";
      space = false;
      out += text.slice(i, j);
      i = j;
    } else if (/\s/.test(c)) {
      space = true;
      i++;
    } else {
      if (space && out) out += " ";
      space = false;
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * Statements of a comment-free source, flattened through group rules: [{ ctx: [group preludes],
 * text, key }] in source order. Returns null when the text is not balanced (the caller then keeps
 * plain concatenation).
 */
function statements(src, ctx = [], out = []) {
  let i = 0;
  const n = src.length;
  while (i < n) {
    while (i < n && /\s/.test(src[i])) i++;
    if (i >= n) break;
    // prelude: up to `{` or `;` at depth 0
    let j = i;
    let paren = 0;
    while (j < n) {
      const c = src[j];
      if (c === '"' || c === "'") {
        j = skipString(src, j);
        continue;
      }
      if (c === "\\") {
        j += 2;
        continue;
      }
      if (c === "(") paren++;
      else if (c === ")") paren = Math.max(0, paren - 1);
      else if (paren === 0 && (c === "{" || c === ";" || c === "}")) break;
      j++;
    }
    if (j >= n || src[j] === "}") {
      // trailing junk or a stray brace: refuse rather than guess
      if (src.slice(i, j).trim() || j < n) return null;
      break;
    }
    const prelude = squash(src.slice(i, j));
    if (src[j] === ";") {
      if (prelude) out.push({ ctx, text: `${prelude};` });
      i = j + 1;
      continue;
    }
    // block: matching `}`
    let k = j + 1;
    let depth = 1;
    let inParen = 0;
    while (k < n && depth) {
      const c = src[k];
      if (c === '"' || c === "'") {
        k = skipString(src, k);
        continue;
      }
      if (c === "\\") {
        k += 2;
        continue;
      }
      if (c === "(") inParen++;
      else if (c === ")") inParen = Math.max(0, inParen - 1);
      else if (!inParen && c === "{") depth++;
      else if (!inParen && c === "}") depth--;
      k++;
    }
    if (depth) return null;
    const body = src.slice(j + 1, k - 1);
    if (GROUP_AT_RULE.test(prelude)) {
      if (!statements(body, [...ctx, prelude], out)) return null;
    } else {
      out.push({ ctx, text: `${prelude}{${squash(body)}}` });
    }
    i = k;
  }
  for (const s of out) s.key ??= `${s.ctx.join("\u0001")}\u0002${s.text}`;
  return out;
}

/** Longest-common-subsequence merge: a supersequence of `a` and `b`, common statements once. */
function mergeSequences(a, b) {
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i].key === b[j].key ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].key === b[j].key) {
      out.push(a[i]);
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) out.push(a[i++]);
    else out.push(b[j++]);
  }
  while (i < n) out.push(a[i++]);
  while (j < m) out.push(b[j++]);
  return out;
}

/** Statements back to CSS, re-opening group rules only where the context changes. */
function printStatements(list) {
  let css = "";
  let open = [];
  for (const s of list) {
    let k = 0;
    while (k < open.length && k < s.ctx.length && open[k] === s.ctx[k]) k++;
    css += "}".repeat(open.length - k);
    open = open.slice(0, k);
    for (const p of s.ctx.slice(k)) {
      css += `${p}{`;
      open.push(p);
    }
    css += s.text;
  }
  return css + "}".repeat(open.length);
}

/**
 * The variant files of a type merged into one cascade-safe stylesheet (compiled). Falls back to the
 * concatenation (with a warning) when a file cannot be scanned or uses @import.
 */
function mergedVariantCss(type, variantFiles) {
  const concatenated = () => variantFiles.map((v) => compileCss(v.file)).filter(Boolean).join("\n");
  const seqs = [];
  for (const { file } of variantFiles) {
    if (!isNonEmptyFile(file)) continue;
    const src = stripComments(readFileSync(file, "utf8"));
    const list = /@import\b/i.test(src) ? null : statements(src);
    if (!list) {
      warn(`${rel(file)}: cannot be merged (unbalanced, or @import in a variant file) — ${type} preview/mixed stylesheet falls back to concatenation`);
      return concatenated();
    }
    seqs.push({ file, list });
  }
  if (!seqs.length) return "";
  const merged = seqs.map((s) => s.list).reduce((acc, list) => mergeSequences(acc, list));
  // every file's own order must survive as a subsequence (the property the cascade relies on)
  const keys = merged.map((s) => s.key);
  for (const { file, list } of seqs) {
    let at = 0;
    for (const s of list) {
      while (at < keys.length && keys[at] !== s.key) at++;
      if (at++ >= keys.length) {
        warn(`${rel(file)}: order lost in the ${type} merge — preview/mixed stylesheet falls back to concatenation`);
        return concatenated();
      }
    }
  }
  return compileCssText(printStatements(merged), `src/landing/sections/${type}/${type}.*.css (merged)`);
}

function listSectionTypes() {
  const dir = join(LANDING, "sections");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[a-zA-Z][a-zA-Z0-9]{1,40}$/.test(d.name))
    .map((d) => d.name)
    .sort();
}

/** Variant id format = the root modifier the section shell renders (lp-<type>--<id>). */
const VARIANT_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Variant stylesheets of a section folder: <type>.<variant>.css, sorted by id. Other .css files in
 * the folder (e.g. orderForm's pv.css / packs.css) are partials pulled in with @import.
 */
function listVariantFiles(type) {
  const dir = join(LANDING, "sections", type);
  const prefix = `${type}.`;
  const out = [];
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(prefix) || !name.endsWith(".css") || name === `${type}.css`) continue;
    const id = name.slice(prefix.length, -".css".length);
    if (!VARIANT_ID.test(id)) {
      warn(`${rel(join(dir, name))}: "${id}" is not a variant id (lowercase, digits, single dashes) — skipped`);
      continue;
    }
    out.push({ id, file: join(dir, name) });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

async function compileRuntime() {
  const entry = join(LANDING, "runtime", "entry.ts");
  if (!isNonEmptyFile(entry)) {
    warn(`${rel(entry)} is missing — runtimeJs is empty`);
    return "";
  }
  const res = await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2019",
    minify: true,
    legalComments: "none",
    charset: "utf8",
    write: false,
    logLevel: "silent",
    tsconfig: join(ROOT, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
  });
  for (const w of res.warnings) warn(`runtime: ${w.text}`);
  return guardScript(res.outputFiles[0]?.text.trim() ?? "");
}

const sha256 = (s) => createHash("sha256").update(s, "utf8");

async function main() {
  const base = [
    compileCss(join(LANDING, "styles", "base.css")),
    compileCss(join(LANDING, "illustrations", "illustrations.css")),
  ]
    .filter(Boolean)
    .join("\n");

  // per type: the shared file, each variant file (renderer chunks), and the complete stylesheet
  const sectionCss = {}; // complete, every type (admin preview · pages mixing variants of a type)
  const sectionChunkCss = {}; // split types: "<type>" + "<type>.<variant>"
  const sectionVariants = {};
  for (const type of listSectionTypes()) {
    const shared = compileCss(join(LANDING, "sections", type, `${type}.css`));
    const files = [];
    for (const v of listVariantFiles(type)) {
      const chunk = compileCss(v.file);
      if (!chunk) continue;
      files.push(v);
      sectionChunkCss[`${type}.${v.id}`] = chunk;
    }
    if (files.length) {
      sectionVariants[type] = files.map((v) => v.id);
      if (shared) sectionChunkCss[type] = shared;
    }
    const complete = [shared, files.length ? mergedVariantCss(type, files) : ""].filter(Boolean).join("\n");
    if (complete) sectionCss[type] = complete;
  }

  const thankYouCss = compileCss(join(LANDING, "thankyou", "thankyou.css"));
  const legalCss = compileCss(join(LANDING, "legal", "legal.css"));

  let runtimeJs = "";
  try {
    runtimeJs = await compileRuntime();
  } catch (err) {
    const msg = err?.errors?.map?.((e) => `${e.location?.file ?? ""}:${e.location?.line ?? ""} ${e.text}`).join("; ") ?? String(err);
    throw new Error(`runtime bundle failed: ${msg}`);
  }
  const runtimeHash = runtimeJs ? `sha256-${sha256(runtimeJs).digest("base64")}` : "";

  const versionHash = sha256(JSON.stringify([base, sectionCss, sectionChunkCss, sectionVariants, thankYouCss, legalCss, runtimeJs])).digest("hex").slice(0, 12);

  const lit = (s) => JSON.stringify(s);
  const entries = (obj) =>
    Object.entries(obj)
      .map(([k, v]) => `  ${lit(k)}: ${lit(v)},`)
      .join("\n");
  const out = `// GENERATED by scripts/build-landing-assets.mjs — do not edit (npm run assets:build).

/** Landing base stylesheet (styles/base.css + illustrations/illustrations.css), minified. */
export const baseCss: string = ${lit(base)};

/**
 * Complete stylesheet of every section type: <type>.css, then all of its <type>.<variant>.css files
 * merged in cascade-safe order. The admin preview concatenates these; a published page inlines one
 * only when it renders two or more variants of that type (otherwise ./chunks · sectionChunkCss).
 */
export const sectionCss: Readonly<Record<string, string>> = {
${entries(sectionCss)}
};

/** Thank-you page stylesheet (src/landing/thankyou/thankyou.css). */
export const thankYouCss: string = ${lit(thankYouCss)};

/** Legal documents stylesheet (src/landing/legal/legal.css). */
export const legalCss: string = ${lit(legalCss)};

/** Landing runtime (src/landing/runtime/entry.ts), IIFE, es2019, minified. Inlined at the end of <body>. */
export const runtimeJs: string = ${lit(runtimeJs)};

/** CSP source expression for runtimeJs ("sha256-<base64>"); empty when there is no runtime. */
export const runtimeHash: string = ${lit(runtimeHash)};

/** Content version of this asset set (assets.ts + chunks.ts). */
export const version: string = ${lit(versionHash)};
`;
  const chunksOut = `// GENERATED by scripts/build-landing-assets.mjs — do not edit (npm run assets:build).
// Renderer only (src/landing/document.tsx): kept apart from ./assets so the admin's client bundle,
// which imports sectionCss for the preview, never carries these strings twice.

/**
 * Per-page chunks of the section types that have variant files: "<type>" = <type>.css (rules every
 * variant uses), "<type>.<variant>" = <type>.<variant>.css (rules only that variant renders). A page
 * rendering one variant of such a type inlines "<type>" then "<type>.<variant>".
 */
export const sectionChunkCss: Readonly<Record<string, string>> = {
${entries(sectionChunkCss)}
};

/** Variant ids per split type, sorted: sectionChunkCss["<type>.<id>"] exists for each one. */
export const sectionVariants: Readonly<Record<string, readonly string[]>> = {
${entries(sectionVariants)}
};
`;

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  const prev = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, "utf8") : null;
  if (prev !== out) writeFileSync(OUT_FILE, out, "utf8");
  const prevChunks = existsSync(CHUNKS_FILE) ? readFileSync(CHUNKS_FILE, "utf8") : null;
  if (prevChunks !== chunksOut) writeFileSync(CHUNKS_FILE, chunksOut, "utf8");
  const unchanged = prev === out && prevChunks === chunksOut;

  const bytes = (s) => Buffer.byteLength(s, "utf8");
  const gz = (s) => (s ? gzipSync(Buffer.from(s, "utf8"), { level: 9 }).length : 0);
  const kb = (n) => (n / 1024).toFixed(1);
  const runtimeGz = gz(runtimeJs);
  if (runtimeGz > RUNTIME_GZIP_BUDGET) warn(`runtime is ${kb(runtimeGz)} KB gzip — over the ${kb(RUNTIME_GZIP_BUDGET)} KB budget`);
  const sum = (obj) => Object.values(obj).reduce((n, s) => n + bytes(s), 0);
  const variantCount = Object.values(sectionVariants).reduce((n, ids) => n + ids.length, 0);
  if (REPORT) {
    const rows = [["base", base]];
    for (const [type, css] of Object.entries(sectionCss)) {
      rows.push([`section ${type}${sectionVariants[type] ? " (complete)" : ""}`, css]);
      if (!sectionVariants[type]) continue;
      rows.push([`  ${type}`, sectionChunkCss[type] ?? ""]);
      for (const id of sectionVariants[type]) rows.push([`  ${type}.${id}`, sectionChunkCss[`${type}.${id}`]]);
    }
    rows.push(["thank-you", thankYouCss], ["legal", legalCss], ["runtime", runtimeJs]);
    for (const [name, s] of rows) console.log(`  ${name.padEnd(34)} ${kb(bytes(s)).padStart(6)} KB ${kb(gz(s)).padStart(6)} KB gz`);
  }
  console.log(
    `landing assets ${versionHash}${unchanged ? " (unchanged)" : ""}: base ${kb(bytes(base))} KB · ` +
      `${Object.keys(sectionCss).length} section types ${kb(sum(sectionCss))} KB complete · ` +
      `${Object.keys(sectionVariants).length} split into ${variantCount} variant chunks (${kb(sum(sectionChunkCss))} KB) · ` +
      `thank-you ${kb(bytes(thankYouCss))} KB · legal ${kb(bytes(legalCss))} KB · ` +
      `runtime ${kb(bytes(runtimeJs))} KB (${kb(runtimeGz)} KB gz) · ${Math.round(performance.now() - t0)} ms` +
      (warnings ? ` · ${warnings} warning(s)` : ""),
  );
}

main().catch((err) => {
  console.error(`build-landing-assets: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
