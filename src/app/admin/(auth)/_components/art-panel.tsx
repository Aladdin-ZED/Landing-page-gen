import { BrandMark, Wordmark } from "@/components/admin/shell/brand-mark";
import { cn } from "@/lib/utils";

/*
 * Art for the auth screens: "the stage". The brand mark's arch, drawn as a set of concentric
 * hairline arches rising out of the panel's lower edge, lit from inside by one soft jade light, with
 * the order dot resting in it. A faint dot grid and film grain sit behind. Seeded by the UTC day,
 * so the composition shifts slightly from one day to the next but is stable within a day.
 * Pure SVG, no client JS.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Changes once per UTC day; the auth pages render per request, so this is read at request time. */
export function daySeed(now: number = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

interface Stage {
  cx: number;
  springY: number;
  baseY: number;
  arches: { d: string; opacity: number }[];
  innerR: number;
  dotY: number;
}

function buildStage(seed: number, full: boolean, width: number, height: number): Stage {
  const rand = mulberry32(seed);
  const cx = full ? width * (0.7 + rand() * 0.06) : width * (0.8 + rand() * 0.06);
  const baseY = height + 4;
  const innerR = full ? 112 + rand() * 16 : 46;
  const step = full ? 24 + rand() * 6 : 15;
  const count = full ? 8 : 7;
  const springY = full ? height * (0.6 + rand() * 0.05) : height * 0.62;
  const arches = Array.from({ length: count }, (_, i) => {
    const r = innerR + i * step;
    const top = springY;
    return {
      d: `M${r1(cx - r)},${baseY} V${r1(top)} A${r1(r)},${r1(r)} 0 0 1 ${r1(cx + r)},${r1(top)} V${baseY}`,
      // the innermost lines carry the light; the outer ones fade into the field
      opacity: r1(1 - (i / count) * 0.85),
    };
  });
  const dotY = full ? springY + (baseY - springY) * 0.42 : springY + (baseY - springY) * 0.46;
  return { cx, springY, baseY, arches, innerR, dotY };
}

export function ArtPanel({
  variant,
  idPrefix,
  seed,
  className,
}: {
  variant: "full" | "band";
  idPrefix: string;
  /** composition seed (see daySeed) */
  seed: number;
  className?: string;
}) {
  const full = variant === "full";
  const width = 720;
  const height = full ? 960 : 240;
  const stage = buildStage(seed * 2654435761, full, width, height);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <aside
      aria-label="COD Studio"
      className={cn(
        "relative isolate overflow-hidden bg-(--auth-ink) text-(--auth-paper)",
        // a hairline keeps the clipped arches' edge deliberate where the form column is dark too
        full ? "flex-col justify-between border-e border-white/[0.07] p-10 xl:p-14" : "flex h-28 items-end px-6 pb-5 sm:px-10",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 -z-10 size-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio={full ? "xMidYMax slice" : "xMaxYMid slice"}
      >
        <defs>
          {/* the stage light, centred in the arch */}
          <radialGradient id={id("light")} cx={stage.cx} cy={stage.dotY} r={stage.innerR * (full ? 3.2 : 3.6)} gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: "var(--auth-glow)", stopOpacity: 0.55 }} />
            <stop offset="0.35" style={{ stopColor: "var(--auth-glow)", stopOpacity: 0.16 }} />
            <stop offset="1" style={{ stopColor: "var(--auth-glow)", stopOpacity: 0 }} />
          </radialGradient>
          {/* arch strokes are lit near the light and fall off toward the field */}
          <radialGradient id={id("stroke")} cx={stage.cx} cy={stage.dotY} r={stage.innerR * 4} gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: "var(--auth-accent)", stopOpacity: 0.95 }} />
            <stop offset="0.45" style={{ stopColor: "var(--auth-paper)", stopOpacity: 0.28 }} />
            <stop offset="1" style={{ stopColor: "var(--auth-paper)", stopOpacity: 0.06 }} />
          </radialGradient>
          <linearGradient id={id("tone")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--auth-ink-2)", stopOpacity: 0.9 }} />
            <stop offset="0.6" style={{ stopColor: "var(--auth-ink-2)", stopOpacity: 0 }} />
          </linearGradient>
          <radialGradient id={id("grid-fade")} cx={stage.cx} cy={stage.springY} r={full ? 620 : 420} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={id("grid-mask")}>
            <rect width={width} height={height} fill={`url(#${id("grid-fade")})`} />
          </mask>
          <pattern id={id("dots")} width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="0.9" className="fill-(--auth-paper)" fillOpacity="0.16" />
          </pattern>
          <filter id={id("dot-glow")} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation={full ? 10 : 6} />
          </filter>
          <filter id={id("grain")} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0" />
          </filter>
        </defs>

        <rect width={width} height={height} className="fill-(--auth-ink)" />
        {/* a quiet second tone falling from the top so the field has depth */}
        <rect width={width} height={height} fill={`url(#${id("tone")})`} />
        <rect width={width} height={height} fill={`url(#${id("dots")})`} mask={`url(#${id("grid-mask")})`} />
        <rect width={width} height={height} fill={`url(#${id("light")})`} />

        <g fill="none" stroke={`url(#${id("stroke")})`} strokeLinecap="round">
          {stage.arches.map((arch, i) => (
            <path key={i} d={arch.d} strokeWidth={i === 0 ? 1.6 : 1} strokeOpacity={arch.opacity} vectorEffect="non-scaling-stroke" />
          ))}
        </g>

        {/* the order dot, resting in the arch */}
        <circle cx={stage.cx} cy={stage.dotY} r={full ? 22 : 12} className="fill-(--auth-glow)" opacity="0.7" filter={`url(#${id("dot-glow")})`} />
        <circle cx={stage.cx} cy={stage.dotY} r={full ? 9 : 5} className="fill-(--auth-accent)" />
        <circle cx={stage.cx} cy={stage.dotY - (full ? 3 : 1.6)} r={full ? 3 : 1.6} className="fill-(--auth-paper)" opacity="0.55" />

        <rect width={width} height={height} filter={`url(#${id("grain")})`} opacity="0.03" />
      </svg>

      <div className="flex items-center gap-2.5">
        <BrandMark tone="ink" />
        <Wordmark className="text-(--auth-paper)" />
      </div>

      {full && (
        <>
          <p className="max-w-[28rem] font-display text-[2.6rem] leading-[1.06] font-semibold tracking-[-0.04em] text-balance xl:text-[3rem]">
            Landing pages, <span className="whitespace-nowrap text-(--auth-accent)">art-directed</span> from your product photos.
          </p>
          <p className="flex items-center justify-between gap-6 text-xs text-(--auth-paper)/55">
            <span>Private workspace</span>
            <span>Cash on delivery · Arabic and French</span>
          </p>
        </>
      )}
    </aside>
  );
}
