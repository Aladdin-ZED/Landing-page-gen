import type { NextConfig } from "next";

/**
 * Hostinger Business (managed Node.js) notes:
 *  - must export a plain object (not a function)
 *  - Hostinger forces `output: "standalone"` itself; we don't set it here
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // landing pages are served by route handlers; admin uses plain <img> — no image optimizer surface
  images: { unoptimized: true },
  serverExternalPackages: ["mysql2"],
  experimental: {
    // Next clones every non-GET body that proxy.ts matches into memory, up to this size, and holds it
    // until the client finishes sending. Media uploads (≤ 25 MB) bypass the proxy (see its matcher);
    // every other body is ≤ 16 KB and server actions are capped at 1 MB, so keep the clone small.
    proxyClientMaxBodySize: "1mb",
  },
  // files read at runtime from disk must be traced into the standalone output.
  // @img: sharp's native binding is traced but not the libvips libraries it links against
  // (libvips-cpp .so/.dll), which made every route that loads sharp answer 500 in standalone mode.
  outputFileTracingIncludes: {
    "/**": [
      "./drizzle/**/*",
      "./public/fonts/**/*",
      "./src/lib/export/templates/**/*",
      "./php/gsheets.php",
      "./node_modules/@img/**/*",
    ],
  },
  // No Turbopack loaders on purpose: Turbopack runs loaders in spawned Node workers, which Hostinger's
  // build machines kill. The admin's Tailwind CSS is precompiled by scripts/build-admin-css.mjs.
};

export default nextConfig;
