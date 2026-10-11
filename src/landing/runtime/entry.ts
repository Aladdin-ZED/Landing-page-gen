/**
 * Production entry, bundled as an IIFE (esbuild --format=iife --target=es2019) and loaded at the end
 * of <body>. Marks <html class="lp-js"> first thing (reveal hidden states apply only under it), then
 * boots the runtime from the embedded #lp-config JSON. Without a usable config the class is removed
 * again so the page stays fully visible.
 */
import { initLanding, readConfig } from "./index";

const html = document.documentElement;
html.classList.add("lp-js");

function boot(): void {
  const config = readConfig(document);
  if (!config) {
    html.classList.remove("lp-js");
    return;
  }
  try {
    initLanding({ doc: document, win: window, config });
  } catch {
    html.classList.remove("lp-js");
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
