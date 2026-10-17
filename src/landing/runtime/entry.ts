/**
 * Production entry of product pages ("landing" chunk, docs/OFFERS.md §F.9), bundled as an IIFE
 * (es2019) and inlined at the end of <body>, after the optional chunks the page needs. Marks
 * <html class="lp-js"> first thing (reveal hidden states apply only under it), then boots from the
 * embedded #lp-config JSON (v2). Without a usable config the class is removed again so the page stays
 * fully visible.
 */
import { accordion } from "./accordion";
import { analytics } from "./analytics";
import { bundles } from "./bundles";
import { compare } from "./compare";
import { countdown } from "./countdown";
import { form } from "./form";
import { gallery } from "./gallery";
import { boot } from "./init";
import { lead } from "./lead";
import { marquee } from "./marquee";
import { orderScroll } from "./order-scroll";
import { parallax } from "./parallax";
import { reveal } from "./reveal";
import { sticky } from "./sticky";
import { tabs } from "./tabs";
import { units } from "./units";
import { video } from "./video";

// Order matters: bundles → units → form → lead.
boot({
  once: [analytics],
  bind: [reveal, parallax, marquee, video, gallery, compare, tabs, accordion, bundles, units, form, lead, orderScroll, sticky, countdown],
  reveal,
});
