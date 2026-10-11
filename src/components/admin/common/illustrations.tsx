/**
 * Small geometric illustrations for empty states: layered rounded planes, soft brand gradients,
 * one confident accent each. Pure SVG, theme-token colors (light & dark), decorative (aria-hidden).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IllustrationName =
  | "pages"
  | "orders"
  | "media"
  | "history"
  | "exports"
  | "search"
  | "leads"
  | "shield"
  | "chart"
  | "audit"
  | "sheet"
  | "sparkles";

function Frame({ name, children, className }: { name: string; children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 200 140" fill="none" aria-hidden="true" className={cn("h-auto w-full", className)}>
      <defs>
        <linearGradient id={`ill-${name}-brand`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--brand) 92%, white)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--brand) 80%, var(--chart-3))" }} />
        </linearGradient>
        <linearGradient id={`ill-${name}-card`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--card)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--card) 88%, var(--muted))" }} />
        </linearGradient>
        <filter id={`ill-${name}-shadow`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodOpacity="0.12" />
        </filter>
      </defs>
      {children}
    </svg>
  );
}

const card = (name: string) => `url(#ill-${name}-card)`;
const brand = (name: string) => `url(#ill-${name}-brand)`;
const shadow = (name: string) => `url(#ill-${name}-shadow)`;

const bar = "fill-foreground/10";
const barStrong = "fill-foreground/20";
const ring = "stroke-foreground/10";

function Pages() {
  const n = "pages";
  return (
    <Frame name={n}>
      <rect x="44" y="30" width="78" height="96" rx="12" transform="rotate(-9 83 78)" className="fill-muted stroke-foreground/5" />
      <rect x="78" y="26" width="78" height="96" rx="12" transform="rotate(7 117 74)" className="fill-muted stroke-foreground/5" />
      <g filter={shadow(n)}>
        <rect x="60" y="18" width="80" height="104" rx="13" fill={card(n)} className={ring} />
      </g>
      <rect x="67" y="25" width="66" height="40" rx="8" fill={brand(n)} />
      <circle cx="113" cy="45" r="11" className="fill-white/35" />
      <rect x="67" y="73" width="44" height="5" rx="2.5" className={barStrong} />
      <rect x="67" y="83" width="58" height="4" rx="2" className={bar} />
      <rect x="67" y="91" width="50" height="4" rx="2" className={bar} />
      <rect x="67" y="103" width="34" height="11" rx="5.5" className="fill-foreground/80" />
      <circle cx="152" cy="28" r="4" className="fill-brand/60" />
      <circle cx="40" cy="104" r="2.5" className="fill-foreground/20" />
    </Frame>
  );
}

function Orders() {
  const n = "orders";
  const rows = [34, 62, 90];
  return (
    <Frame name={n}>
      <g filter={shadow(n)}>
        <rect x="36" y="20" width="128" height="104" rx="14" fill={card(n)} className={ring} />
      </g>
      {rows.map((y, i) => (
        <g key={y}>
          <circle cx="56" cy={y + 8} r="8" className={i === 1 ? "fill-brand/20" : "fill-muted"} />
          <rect x="70" y={y + 2} width={i === 1 ? 54 : 46} height="5" rx="2.5" className={i === 1 ? barStrong : bar} />
          <rect x="70" y={y + 11} width="32" height="4" rx="2" className={bar} />
          <rect x="128" y={y + 3} width="24" height="10" rx="5" className={i === 1 ? "fill-emerald-500/20" : "fill-muted"} />
        </g>
      ))}
      <g filter={shadow(n)}>
        <circle cx="160" cy="30" r="13" fill={brand(n)} />
      </g>
      <path d="M154.5 30.5l4 4 7-8" className="stroke-white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

function Media() {
  const n = "media";
  return (
    <Frame name={n}>
      <rect x="40" y="34" width="84" height="76" rx="14" transform="rotate(-8 82 72)" className="fill-muted stroke-foreground/5" />
      <g filter={shadow(n)}>
        <rect x="70" y="22" width="92" height="84" rx="15" fill={card(n)} className={ring} />
      </g>
      <clipPath id="ill-media-clip">
        <rect x="76" y="28" width="80" height="72" rx="10" />
      </clipPath>
      <g clipPath="url(#ill-media-clip)">
        <rect x="76" y="28" width="80" height="72" className="fill-brand/10" />
        <circle cx="134" cy="48" r="9" fill={brand(n)} />
        <path d="M76 92c14-16 26-24 40-14s24 4 40-10v32H76z" className="fill-brand/25" />
        <path d="M76 100c18-12 34-14 50-6s22 2 30-2v8H76z" className="fill-brand/40" />
      </g>
      <g filter={shadow(n)}>
        <circle cx="70" cy="108" r="14" className="fill-foreground" />
      </g>
      <path d="M70 114v-11m-5 5 5-5 5 5" className="stroke-background" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

function History() {
  const n = "history";
  return (
    <Frame name={n}>
      <circle cx="78" cy="70" r="46" className="stroke-foreground/8" strokeWidth="1.5" />
      <circle cx="78" cy="70" r="32" className="stroke-foreground/12" strokeWidth="1.5" />
      <path d="M78 24a46 46 0 0 1 44 33" className="stroke-brand" strokeWidth="3" strokeLinecap="round" />
      <circle cx="78" cy="70" r="5" fill={brand(n)} />
      <path d="M78 70V50M78 70l13 8" className="stroke-foreground/60" strokeWidth="2.4" strokeLinecap="round" />
      {[38, 64, 90].map((y, i) => (
        <g key={y} filter={shadow(n)}>
          <rect x="118" y={y} width="50" height="20" rx="7" fill={card(n)} className={ring} />
          <rect x="125" y={y + 8} width={i === 0 ? 30 : 24} height="4" rx="2" className={i === 0 ? "fill-brand/50" : bar} />
        </g>
      ))}
    </Frame>
  );
}

function Exports() {
  const n = "exports";
  return (
    <Frame name={n}>
      <g filter={shadow(n)}>
        <path d="M100 26l44 22v46l-44 22-44-22V48z" fill={card(n)} className={ring} />
      </g>
      <path d="M56 48l44 22 44-22" className="stroke-foreground/12" strokeWidth="1.5" />
      <path d="M100 70v46" className="stroke-foreground/12" strokeWidth="1.5" />
      <path d="M78 37l44 22v14" className="stroke-brand/50" strokeWidth="5" strokeLinecap="round" />
      <g filter={shadow(n)}>
        <circle cx="148" cy="100" r="15" fill={brand(n)} />
      </g>
      <path d="M148 93v13m-5.5-5.5L148 106l5.5-5.5" className="stroke-white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

function Search() {
  const n = "search";
  return (
    <Frame name={n}>
      <g filter={shadow(n)}>
        <circle cx="90" cy="64" r="32" fill={card(n)} className={ring} />
      </g>
      <circle cx="90" cy="64" r="22" className="stroke-foreground/15" strokeWidth="5" />
      <path d="M113 87l22 22" className="stroke-foreground/70" strokeWidth="9" strokeLinecap="round" />
      <path d="M78 54a16 16 0 0 1 14-6" className="stroke-brand" strokeWidth="4" strokeLinecap="round" />
      <circle cx="150" cy="40" r="3" className="fill-brand/60" />
      <circle cx="46" cy="98" r="2.5" className="fill-foreground/20" />
    </Frame>
  );
}

function Leads() {
  const n = "leads";
  return (
    <Frame name={n}>
      {[
        [40, 26, 120],
        [55, 56, 90],
        [70, 86, 60],
      ].map(([x, y, w], i) => (
        <g key={y} filter={shadow(n)}>
          <rect x={x} y={y} width={w} height="22" rx="11" fill={i === 2 ? brand(n) : card(n)} className={ring} />
          <rect x={x! + 12} y={y! + 9} width={w! * 0.4} height="4" rx="2" className={i === 2 ? "fill-white/60" : bar} />
        </g>
      ))}
      <path d="M100 118v8" className="stroke-brand/60" strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

function Shield() {
  const n = "shield";
  return (
    <Frame name={n}>
      <circle cx="100" cy="70" r="52" className="stroke-foreground/6" strokeWidth="1.5" />
      <g filter={shadow(n)}>
        <path d="M100 24l36 13v26c0 25-15 42-36 52-21-10-36-27-36-52V37z" fill={card(n)} className={ring} />
      </g>
      <path d="M100 34l26 9.5V63c0 18-10 31-26 39z" className="fill-brand/12" />
      <path d="M86 68l10 10 19-21" className="stroke-brand" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

function Chart() {
  const n = "chart";
  return (
    <Frame name={n}>
      <g filter={shadow(n)}>
        <rect x="34" y="22" width="132" height="98" rx="14" fill={card(n)} className={ring} />
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={50 + i * 18} y={98 - [14, 26, 20, 36, 30, 50][i]!} width="10" height={[14, 26, 20, 36, 30, 50][i]} rx="3" className={i === 5 ? "fill-brand/70" : "fill-muted"} />
      ))}
      <path d="M50 82c18-6 26-16 44-14s28-14 52-26" className="stroke-brand" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="146" cy="42" r="4.5" fill={brand(n)} className="stroke-card" strokeWidth="2" />
    </Frame>
  );
}

function Audit() {
  const n = "audit";
  return (
    <Frame name={n}>
      <path d="M62 30v84" className="stroke-foreground/12" strokeWidth="2" strokeLinecap="round" />
      {[30, 58, 86, 114].map((y, i) => (
        <g key={y}>
          <circle cx="62" cy={y} r="6" className={i === 0 ? "fill-brand" : "fill-muted stroke-foreground/15"} />
          <g filter={shadow(n)}>
            <rect x="78" y={y - 10} width={i === 0 ? 86 : 72} height="20" rx="8" fill={card(n)} className={ring} />
          </g>
          <rect x="86" y={y - 2} width={i === 0 ? 46 : 34} height="4" rx="2" className={i === 0 ? barStrong : bar} />
        </g>
      ))}
    </Frame>
  );
}

function Sheet() {
  const n = "sheet";
  return (
    <Frame name={n}>
      <g filter={shadow(n)}>
        <rect x="46" y="20" width="108" height="100" rx="14" fill={card(n)} className={ring} />
      </g>
      <rect x="46" y="20" width="108" height="22" rx="14" className="fill-emerald-500/15" />
      {[52, 68, 84, 100].map((y) => (
        <g key={y}>
          <rect x="56" y={y} width="22" height="8" rx="3" className={bar} />
          <rect x="84" y={y} width="34" height="8" rx="3" className={bar} />
          <rect x="124" y={y} width="20" height="8" rx="4" className={y === 52 ? "fill-emerald-500/40" : "fill-muted"} />
        </g>
      ))}
      <g filter={shadow(n)}>
        <circle cx="152" cy="112" r="14" fill={brand(n)} />
      </g>
      <path d="M146 112h12m-4-4 4 4-4 4" className="stroke-white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

function Sparkles() {
  const n = "sparkles";
  const star = (cx: number, cy: number, r: number) =>
    `M${cx} ${cy - r}C${cx + r * 0.18} ${cy - r * 0.18} ${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy}C${cx + r * 0.18} ${cy + r * 0.18} ${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r}C${cx - r * 0.18} ${cy + r * 0.18} ${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy}C${cx - r * 0.18} ${cy - r * 0.18} ${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r}z`;
  return (
    <Frame name={n}>
      <circle cx="96" cy="72" r="40" className="fill-brand/8" />
      <g filter={shadow(n)}>
        <path d={star(96, 70, 30)} fill={brand(n)} />
      </g>
      <path d={star(142, 40, 11)} className="fill-foreground/70" />
      <path d={star(56, 104, 8)} className="fill-brand/50" />
    </Frame>
  );
}

const MAP: Record<IllustrationName, () => ReactNode> = {
  pages: Pages,
  orders: Orders,
  media: Media,
  history: History,
  exports: Exports,
  search: Search,
  leads: Leads,
  shield: Shield,
  chart: Chart,
  audit: Audit,
  sheet: Sheet,
  sparkles: Sparkles,
};

export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  const Comp = MAP[name];
  return (
    <div className={cn("w-40", className)}>
      <Comp />
    </div>
  );
}
