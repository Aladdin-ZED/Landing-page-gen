/**
 * Production entry of thank-you pages ("thanks" chunk, docs/OFFERS.md §F.9): reveals, the order
 * hand-off (name, number, total, the order's groups, Purchase once per order), the one-click upsell
 * and its countdown. The "pixels" chunk, when embedded, sits before it.
 */
import { countdown } from "./countdown";
import { boot } from "./init";
import { reveal } from "./reveal";
import { thankyou } from "./thankyou";

boot({ once: [], bind: [reveal, thankyou, countdown], reveal });
