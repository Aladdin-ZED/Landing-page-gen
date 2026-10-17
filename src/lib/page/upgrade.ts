/**
 * Document upgrade (v1 → v2) and deterministic repairs (docs/OFFERS.md §I.1, §C.7).
 *
 *   PageDoc = z.preprocess(upgradeDoc, PageDocObject)        (src/lib/page/schema.ts)
 *   const { doc, from, repairs } = upgradeDocReport(raw);     (validateDoc: repairs → warnings)
 *
 * - `v1ToV2`: the v1 product becomes the story + the item "main" (price, compare-at, SKU, options);
 *   every v1 bundle becomes one line `qty × main` with the same id, prices, labels and gift; the
 *   bundle image becomes a custom offer visual; `cardStyle` becomes `display.picker`;
 *   `freeShipping` is set to false (v1 always charged the delivery fee: same totals).
 * - `repairDoc`: everything existing data can break is repaired the same way on every read, on v1
 *   AND v2 input, and repairing a repaired document changes nothing (idempotent). Ids that stored
 *   orders, leads and payloads can reference are only renamed by the documented rule (duplicates:
 *   the first keeps its id, the next ones get "-2", "-3"…, as validateDoc always did for offers).
 *
 * Pure JSON work on unknown input: never throws, never mutates the caller's object, imports no
 * schema at runtime (the schema imports this module).
 */
import type { CellState } from "./schema";

export type RepairKind = "money" | "duplicate_id" | "preselected" | "dangling" | "tracking" | "matrix_cell";

export interface DocRepair {
  kind: RepairKind;
  /** dotted path in the upgraded document, e.g. "offers.bundles.1.price" */
  path: string;
  message: string;
  from?: unknown;
  to?: unknown;
}

export interface UpgradeReport {
  /** the upgraded + repaired document (unchanged input when it is not a v1/v2 document object) */
  doc: unknown;
  /** schema version of the input: 1, 2, or null when it was not a document object with v 1 | 2 */
  from: 1 | 2 | null;
  repairs: DocRepair[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): Obj[] => arr(v).filter(isObj);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const MAIN = "main";

function clone<T>(v: T): T {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v)) as T;
  }
}

/** v1 → v2 upgrade + repairs. Anything that is not a v1/v2 document object is returned unchanged. */
export function upgradeDoc(raw: unknown): unknown {
  return upgradeDocReport(raw).doc;
}

export function upgradeDocReport(raw: unknown): UpgradeReport {
  if (!isObj(raw) || (raw.v !== 1 && raw.v !== 2)) return { doc: raw, from: null, repairs: [] };
  const d = clone(raw);
  const from = d.v as 1 | 2;
  if (d.v === 1) v1ToV2(d);
  const repairs: DocRepair[] = [];
  repairDoc(d, repairs);
  return { doc: d, from, repairs };
}

/* ------------------------------------------------------------------ */
/* v1 → v2                                                             */
/* ------------------------------------------------------------------ */

const V1_BUNDLE_KEYS = ["id", "title", "subtitle", "price", "compareAt", "badge", "badgeText", "gift", "preselected"] as const;

/** In place: the v1 document becomes a v2 document (§C.7). Unknown / malformed parts are carried as they are (the schema reports them). */
export function v1ToV2(d: Obj): void {
  const p = isObj(d.product) ? d.product : null;
  if (p) {
    const groups = Array.isArray(p.variants)
      ? p.variants.map((g) => (isObj(g) ? (g.kind === undefined ? { ...g, kind: "text" } : { ...g }) : g))
      : [];
    const item: Obj = { id: MAIN, name: "", images: [], price: p.price, groups, soldOut: false };
    if (p.compareAt !== undefined) item.compareAt = p.compareAt;
    if (p.sku !== undefined) item.sku = p.sku;
    if (!Array.isArray(d.items)) d.items = [item];
    delete p.price;
    delete p.compareAt;
    delete p.sku;
    delete p.variants;
  }
  const o = isObj(d.offers) ? d.offers : null;
  if (o) {
    if (Array.isArray(o.bundles)) {
      o.bundles = o.bundles.map((b) => {
        if (!isObj(b)) return b;
        const next: Obj = {};
        for (const k of V1_BUNDLE_KEYS) if (b[k] !== undefined) next[k] = b[k];
        next.lines = [{ id: "l1", qty: b.qty, pick: { item: MAIN } }];
        next.perks = [];
        next.visual = isObj(b.image) ? { mode: "custom", images: [b.image] } : { mode: "auto" };
        next.freeShipping = false;
        return next;
      });
    }
    if (!isObj(o.display)) o.display = { picker: o.cardStyle ?? "stack" };
    delete o.cardStyle;
    if (!Array.isArray(o.extras)) o.extras = [];
  }
  d.v = 2;
}

/* ------------------------------------------------------------------ */
/* Repairs                                                             */
/* ------------------------------------------------------------------ */

/** Half-up on cents ("1.005" → 1.01: the decimal the owner typed, not its binary approximation). */
export function roundMoney(m: number): number {
  const cents = Math.round(Number((m * 100).toPrecision(15)));
  return cents / 100;
}

/** Same rule as validateDoc's section ids: "<stem>-2", "-3"… not taken yet (keeps the Id pattern). */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  const stem = base.slice(0, 34).replace(/[^a-zA-Z0-9_-]/g, "-") || "id";
  for (let n = 2; n < 1000; n++) {
    const id = `${stem}-${n}`;
    if (!taken.has(id)) return id;
  }
  return `${stem}-${taken.size + 1000}`;
}

/**
 * In place, deterministic and idempotent: money to 2 decimals, duplicate ids renamed, one
 * preselected offer, dangling references dropped, `tracking.none` with ids dropped, matrix
 * exceptions on unknown dims/values dropped or narrowed (§I.1). Every change is logged in `log`.
 */
export function repairDoc(d: Obj, log: DocRepair[] = []): Obj {
  const items = objs(d.items);
  const offers = isObj(d.offers) ? d.offers : null;

  /* 1 · money */
  const money = (o: Obj, key: string, path: string) => {
    const v = o[key];
    if (typeof v !== "number" || !Number.isFinite(v)) return;
    const r = roundMoney(v);
    if (r !== v) {
      o[key] = r;
      log.push({ kind: "money", path, message: `Amount ${v} rounded to ${r} (2 decimals).`, from: v, to: r });
    }
  };
  const groupMoney = (g: Obj, at: string) => {
    money(g, "delta", `${at}.delta`);
    objs(g.options).forEach((c, i) => money(c, "delta", `${at}.options.${i}.delta`));
    objs(g.dims).forEach((dim, di) => objs(dim.values).forEach((c, i) => money(c, "delta", `${at}.dims.${di}.values.${i}.delta`)));
    objs(g.cells).forEach((c, i) => money(c, "delta", `${at}.cells.${i}.delta`));
  };
  items.forEach((it, i) => {
    money(it, "price", `items.${i}.price`);
    money(it, "compareAt", `items.${i}.compareAt`);
    objs(it.groups).forEach((g, gi) => groupMoney(g, `items.${i}.groups.${gi}`));
  });
  if (offers) {
    money(offers, "shippingFee", "offers.shippingFee");
    objs(offers.bundles).forEach((b, i) => {
      money(b, "price", `offers.bundles.${i}.price`);
      money(b, "compareAt", `offers.bundles.${i}.compareAt`);
    });
    if (isObj(offers.orderBump)) money(offers.orderBump, "price", "offers.orderBump.price");
    if (isObj(offers.upsell)) {
      money(offers.upsell, "price", "offers.upsell.price");
      money(offers.upsell, "compareAt", "offers.upsell.compareAt");
    }
    objs(offers.extras).forEach((x, i) => groupMoney(x, `offers.extras.${i}`));
  }

  /* 2 · duplicate ids (first keeps its id) */
  const dedupe = (list: Obj[], path: string, what: string) => {
    const taken = new Set<string>();
    list.forEach((o, i) => {
      const id = str(o.id);
      if (id === undefined) return;
      if (!taken.has(id)) {
        taken.add(id);
        return;
      }
      const next = uniqueId(id, taken);
      taken.add(next);
      o.id = next;
      log.push({ kind: "duplicate_id", path: `${path}.${i}.id`, message: `Duplicate ${what} id "${id}" renamed to "${next}".`, from: id, to: next });
    });
  };
  const dedupeGroup = (g: Obj, at: string) => {
    dedupe(objs(g.options), `${at}.options`, "option");
    dedupe(objs(g.dims), `${at}.dims`, "dimension");
    objs(g.dims).forEach((dim, di) => dedupe(objs(dim.values), `${at}.dims.${di}.values`, "value"));
  };
  items.forEach((it, i) => {
    dedupe(objs(it.groups), `items.${i}.groups`, "option group");
    objs(it.groups).forEach((g, gi) => dedupeGroup(g, `items.${i}.groups.${gi}`));
  });
  if (offers) {
    dedupe(objs(offers.bundles), "offers.bundles", "offer");
    objs(offers.bundles).forEach((b, i) => dedupe(objs(b.lines), `offers.bundles.${i}.lines`, "line"));
    dedupe(objs(offers.extras), "offers.extras", "extra");
    objs(offers.extras).forEach((x, i) => dedupeGroup(x, `offers.extras.${i}`));
  }

  /* 3 · one preselected offer */
  if (offers) {
    let seen = false;
    objs(offers.bundles).forEach((b, i) => {
      if (b.preselected !== true) return;
      if (!seen) {
        seen = true;
        return;
      }
      b.preselected = false;
      log.push({ kind: "preselected", path: `offers.bundles.${i}.preselected`, message: "Only the first offer marked “selected first” keeps it." });
    });
  }

  /* 4 · dangling references */
  const itemIds = new Set(items.map((it) => str(it.id)).filter((x): x is string => x !== undefined));
  const itemById = new Map(items.map((it) => [str(it.id) ?? "", it]));
  if (offers && Array.isArray(offers.bundles)) {
    const kept: unknown[] = [];
    offers.bundles.forEach((b, bi) => {
      if (!isObj(b) || !Array.isArray(b.lines)) {
        kept.push(b);
        return;
      }
      const at = `offers.bundles.${bi}`;
      let dropped = false;
      const lines: unknown[] = [];
      b.lines.forEach((l, li) => {
        if (!isObj(l) || !isObj(l.pick)) {
          lines.push(l);
          return;
        }
        const lat = `${at}.lines.${li}`;
        const pick = l.pick;
        if (typeof pick.item === "string") {
          if (!itemIds.has(pick.item)) {
            dropped = true;
            log.push({ kind: "dangling", path: lat, message: `Line on the missing product "${pick.item}" removed.` });
            return;
          }
        } else if (Array.isArray(pick.choice)) {
          const choice = pick.choice.filter((id) => typeof id !== "string" || itemIds.has(id));
          if (choice.length !== pick.choice.length) {
            const missing = pick.choice.filter((id) => typeof id === "string" && !itemIds.has(id));
            log.push({ kind: "dangling", path: `${lat}.pick.choice`, message: `Missing product(s) ${missing.map((m) => `"${String(m)}"`).join(", ")} removed from the choice.` });
            if (choice.length === 0) {
              dropped = true;
              return;
            }
            if (choice.length === 1) l.pick = { item: choice[0] };
            else pick.choice = choice;
          }
        }
        repairRules(l, itemById, lat, log);
        lines.push(l);
      });
      b.lines = lines;
      const paid = lines.some((l) => isObj(l) && l.free !== true);
      if (lines.length === 0 || (dropped && !paid)) {
        log.push({ kind: "dangling", path: at, message: `Offer "${String(b.id)}" lost its products and was removed.` });
        return;
      }
      kept.push(b);
    });
    offers.bundles = kept;
  }
  if (offers) {
    const offerIds = new Set(objs(offers.bundles).map((b) => str(b.id)).filter((x): x is string => x !== undefined));
    if (Array.isArray(offers.extras)) {
      offers.extras = offers.extras.filter((x, i) => {
        if (!isObj(x) || !Array.isArray(x.scope)) return true;
        const scope = x.scope.filter((id) => typeof id !== "string" || offerIds.has(id));
        if (scope.length === x.scope.length) return true;
        if (scope.length === 0) {
          log.push({ kind: "dangling", path: `offers.extras.${i}`, message: `Extra "${String(x.name ?? x.id)}" applied only to removed offers and was removed.` });
          return false;
        }
        x.scope = scope;
        log.push({ kind: "dangling", path: `offers.extras.${i}.scope`, message: "Removed offers dropped from the extra's offers." });
        return true;
      });
    }
    const bump = isObj(offers.orderBump) ? offers.orderBump : null;
    if (bump && Array.isArray(bump.offers)) {
      const list = bump.offers.filter((id) => typeof id !== "string" || offerIds.has(id));
      if (list.length !== bump.offers.length) {
        if (list.length) {
          bump.offers = list;
          log.push({ kind: "dangling", path: "offers.orderBump.offers", message: "Removed offers dropped from the order bump's offers." });
        } else {
          delete bump.offers;
          bump.enabled = false;
          log.push({ kind: "dangling", path: "offers.orderBump", message: "The order bump applied only to removed offers and was turned off." });
        }
      }
    }
    for (const key of ["orderBump", "upsell"] as const) {
      const x = offers[key];
      if (isObj(x) && typeof x.item === "string" && !itemIds.has(x.item)) {
        log.push({ kind: "dangling", path: `offers.${key}.item`, message: `The missing product "${x.item}" was unlinked.` });
        delete x.item;
      }
    }
  }

  /* 5 · "No pixel on this page" with pixels set */
  if (isObj(d.tracking) && d.tracking.none !== undefined) {
    const t = d.tracking;
    const hasIds = ["metaPixelId", "tiktokPixelId", "snapPixelId", "ga4Id"].some((k) => {
      const v = t[k];
      return (typeof v === "string" && v.length > 0) || (Array.isArray(v) && v.length > 0);
    });
    if (hasIds) {
      delete t.none;
      log.push({ kind: "tracking", path: "tracking.none", message: "“No pixel on this page” removed: the page has pixels." });
    }
  }

  /* 6 · matrix exceptions on unknown dims / values */
  items.forEach((it, i) => objs(it.groups).forEach((g, gi) => g.kind === "matrix" && repairCells(g, `items.${i}.groups.${gi}`, log)));

  return d;
}

const SEVERITY: Record<CellState, number> = { in: 0, out: 1, none: 2 };
const stateOf = (v: unknown): CellState => (v === "out" || v === "none" ? v : "in");

/** Canonical cell key (same as options.ts cellKey; duplicated to keep this module dependency-free). */
const keyOf = (v: Obj) =>
  Object.keys(v)
    .sort()
    .map((k) => `${k}=${String(v[k])}`)
    .join("|");

function repairCells(g: Obj, at: string, log: DocRepair[]): void {
  if (!Array.isArray(g.cells)) return;
  const dims = new Map<string, Set<string>>();
  for (const dim of objs(g.dims)) {
    const id = str(dim.id);
    if (id) dims.set(id, new Set(objs(dim.values).map((v) => str(v.id)).filter((x): x is string => x !== undefined)));
  }
  const out: Obj[] = [];
  const byKey = new Map<string, Obj>();
  g.cells.forEach((cell, ci) => {
    if (!isObj(cell) || !isObj(cell.v)) {
      log.push({ kind: "matrix_cell", path: `${at}.cells.${ci}`, message: "Malformed combination exception removed." });
      return;
    }
    const v = cell.v;
    const unknown = Object.keys(v).filter((k) => !dims.get(k)?.has(String(v[k])));
    if (unknown.length) {
      const state = stateOf(cell.state);
      if (state === "in" || unknown.length === Object.keys(v).length) {
        log.push({ kind: "matrix_cell", path: `${at}.cells.${ci}`, message: "Exception on an unknown option value removed." });
        return;
      }
      // keep an out / not-made exception: a sold-out combination never becomes sellable
      for (const k of unknown) delete v[k];
      log.push({ kind: "matrix_cell", path: `${at}.cells.${ci}.v`, message: `Unknown ${unknown.join(", ")} removed from a ${state === "out" ? "sold-out" : "not made"} exception (kept).` });
    }
    const key = keyOf(v);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, cell);
      out.push(cell);
      return;
    }
    // same combination twice: one exception, the most severe state, the first image / delta / sku
    if (SEVERITY[stateOf(cell.state)] > SEVERITY[stateOf(prev.state)]) prev.state = cell.state;
    for (const k of ["image", "delta", "sku"]) if (prev[k] === undefined && cell[k] !== undefined) prev[k] = cell[k];
    log.push({ kind: "matrix_cell", path: `${at}.cells.${ci}`, message: `Combination "${key}" was listed twice: merged.` });
  });
  g.cells = out;
}

/** Rules of a fixed line on options that no longer exist are dropped (§I.1 #4). */
function repairRules(l: Obj, items: ReadonlyMap<string, Obj>, at: string, log: DocRepair[]): void {
  if (!isObj(l.rules) || !isObj(l.pick) || typeof l.pick.item !== "string") return;
  const item = items.get(l.pick.item);
  if (!item) return;
  const groups = objs(item.groups);
  const rules = l.rules;
  for (const key of Object.keys(rules)) {
    const rule = rules[key];
    const [gid, dimId] = key.split(".");
    const g = groups.find((x) => x.id === gid);
    const gone = () => {
      delete rules[key];
      log.push({ kind: "dangling", path: `${at}.rules.${key}`, message: `Rule on the missing option "${key}" removed.` });
    };
    if (!g) {
      gone();
      continue;
    }
    let values: Set<string> | null = null;
    if (dimId === undefined) {
      if (g.kind !== "matrix" && g.kind !== "field") values = new Set(objs(g.options).map((o) => String(o.id)));
    } else if (g.kind === "matrix") {
      const dim = objs(g.dims).find((x) => x.id === dimId);
      if (!dim) {
        gone();
        continue;
      }
      values = new Set(objs(dim.values).map((o) => String(o.id)));
    }
    // a rule on a field, a shared group or a matrix without dim is a v2-only error the schema reports
    if (!values || !isObj(rule)) continue;
    if (typeof rule.lock === "string") {
      if (!values.has(rule.lock)) {
        delete rules[key];
        log.push({ kind: "dangling", path: `${at}.rules.${key}`, message: `Rule locking the missing option "${rule.lock}" removed.` });
      }
      continue;
    }
    if (Array.isArray(rule.allow)) {
      const allow = rule.allow.filter((id) => typeof id !== "string" || values!.has(id));
      if (allow.length !== rule.allow.length) {
        log.push({ kind: "dangling", path: `${at}.rules.${key}.allow`, message: "Missing options removed from the allowed list." });
        if (!allow.length) {
          delete rules[key];
          continue;
        }
        rule.allow = allow;
      }
    }
    // (a preset outside `allow` that exists is a v2-only error the schema reports)
    if (typeof rule.preset === "string" && !values.has(rule.preset)) {
      log.push({ kind: "dangling", path: `${at}.rules.${key}.preset`, message: `Preset on the missing option "${rule.preset}" removed.` });
      delete rule.preset;
      if (!Array.isArray(rule.allow)) delete rules[key];
    }
  }
  if (!Object.keys(rules).length) delete l.rules;
}
