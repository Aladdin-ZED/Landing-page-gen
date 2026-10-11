import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { UNKNOWN_PAGE_COPY as copy, UNKNOWN_PAGE_STYLE as tone } from "@/lib/auth/unknown-page";

/*
 * Public 404 for every unknown URL. Kept neutral (no product or admin branding) and visually
 * identical to the proxy's answer for un-gated admin URLs (src/lib/auth/unknown-page.ts), light and
 * dark (it follows the visitor's system scheme, like the static copy).
 */
export const metadata: Metadata = {
  title: copy.titleFr,
  robots: { index: false, follow: false },
};

const vars = {
  "--nf-bg": tone.bg,
  "--nf-ink": tone.ink,
  "--nf-soft": tone.soft,
  "--nf-line": tone.line,
  "--nf-bg-d": tone.darkBg,
  "--nf-ink-d": tone.darkInk,
  "--nf-soft-d": tone.darkSoft,
  "--nf-line-d": tone.darkLine,
  fontFamily: tone.font,
} as CSSProperties;

export default function NotFound() {
  return (
    <div
      lang="fr"
      style={vars}
      className="grid min-h-dvh flex-1 place-items-center bg-(--nf-bg) p-6 leading-normal text-(--nf-ink) antialiased [@media(prefers-color-scheme:dark)]:bg-(--nf-bg-d) [@media(prefers-color-scheme:dark)]:text-(--nf-ink-d)"
    >
      <main className="w-full max-w-md text-center">
        <p aria-hidden="true" className="mb-6 text-7xl leading-none font-light tracking-[-0.04em] tabular-nums">
          {copy.code}
        </p>
        <h1 className="text-xl font-semibold text-balance">{copy.titleFr}</h1>
        <p className="mt-2 text-[0.95rem] text-pretty text-(--nf-soft) [@media(prefers-color-scheme:dark)]:text-(--nf-soft-d)">{copy.bodyFr}</p>
        <hr className="mx-auto my-6 w-16 border-0 border-t border-(--nf-line) [@media(prefers-color-scheme:dark)]:border-(--nf-line-d)" />
        <div lang="ar" dir="rtl">
          <h2 className="text-xl font-semibold text-balance">{copy.titleAr}</h2>
          <p className="mt-2 text-[0.95rem] text-pretty text-(--nf-soft) [@media(prefers-color-scheme:dark)]:text-(--nf-soft-d)">{copy.bodyAr}</p>
        </div>
        {/* "/" may be served by a route handler (home landing page): a full document load is intended. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-6 inline-flex min-h-11 items-center text-sm underline decoration-(--nf-soft) underline-offset-4 outline-current transition-[text-decoration-color] duration-200 hover:decoration-current focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 [@media(prefers-color-scheme:dark)]:decoration-(--nf-soft-d)"
        >
          {copy.homeFr}
        </a>
      </main>
    </div>
  );
}
