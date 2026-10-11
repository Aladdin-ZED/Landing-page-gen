"use client";
/**
 * Admin-side identity of section types: a lucide icon per type, and readable names for the
 * background / spacing / divider choices.
 */
import {
  BadgeCheck,
  BookOpen,
  ChartNoAxesColumn,
  CircleAlert,
  CircleHelp,
  Clapperboard,
  Columns2,
  Image as ImageIcon,
  Images,
  LayoutTemplate,
  ListChecks,
  ListOrdered,
  Megaphone,
  MessageCircle,
  MessageSquareQuote,
  MessagesSquare,
  MousePointerClick,
  MoveHorizontal,
  Package,
  PanelBottom,
  PanelTop,
  Ruler,
  Scale,
  ScanSearch,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";
import type { Divider, SectionBg } from "@/lib/page/schema";

const ICONS: Record<string, LucideIcon> = {
  announcement: Megaphone,
  header: PanelTop,
  hero: ImageIcon,
  trustBar: ShieldCheck,
  marquee: MoveHorizontal,
  problem: CircleAlert,
  benefits: ListChecks,
  showcase: ScanSearch,
  steps: ListOrdered,
  story: BookOpen,
  gallery: Images,
  video: Clapperboard,
  beforeAfter: Columns2,
  comparison: Scale,
  specs: Ruler,
  reviews: MessageSquareQuote,
  socialProof: MessagesSquare,
  stats: ChartNoAxesColumn,
  offer: Package,
  urgency: Timer,
  guarantee: BadgeCheck,
  orderForm: ShoppingBag,
  cta: MousePointerClick,
  faq: CircleHelp,
  footer: PanelBottom,
  stickyCta: Smartphone,
  whatsappFloat: MessageCircle,
};

export function SectionIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? LayoutTemplate;
  return <Icon className={className} aria-hidden="true" />;
}

export const BG_LABELS: Record<SectionBg, string> = {
  base: "Page",
  soft: "Soft",
  surface: "Surface",
  accent: "Accent",
  dark: "Dark",
  pop: "Pop",
};

export const DIVIDER_LABELS: Record<Divider | "auto", string> = {
  auto: "Auto",
  none: "None",
  curve: "Curve",
  diagonal: "Diagonal",
  steps: "Steps",
  arch: "Arch",
  wave: "Wave",
  fade: "Fade",
};

/** Tiny glyph of each section transition (two blocks meeting at the edge). */
export function DividerGlyph({ kind, className }: { kind: Divider | "auto"; className?: string }) {
  const gradient = `bld-fade-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const edge: Record<Divider | "auto", string> = {
    auto: "M0 14 H40",
    none: "M0 14 H40",
    curve: "M0 18 C 12 6, 28 6, 40 18",
    diagonal: "M0 20 L40 8",
    steps: "M0 18 H14 V12 H26 V8 H40",
    arch: "M0 20 H8 C 8 6, 32 6, 32 20 H40",
    wave: "M0 14 C 7 8, 13 8, 20 14 S 33 20, 40 14",
    fade: "M0 14 H40",
  };
  if (kind === "auto") {
    return (
      <svg viewBox="0 0 40 28" className={className} aria-hidden="true">
        <path d="M14 9 l6 -4 6 4 M14 19 l6 4 6 -4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
        <circle cx="20" cy="14" r="2" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 28" className={className} aria-hidden="true">
      {kind === "fade" ? (
        <>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.12" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <rect x="0" y="4" width="40" height="24" fill={`url(#${gradient})`} />
        </>
      ) : (
        <path d={`${edge[kind]} V28 H0 Z`} fill="currentColor" opacity="0.5" />
      )}
      {kind !== "fade" ? <path d={edge[kind]} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /> : null}
    </svg>
  );
}
