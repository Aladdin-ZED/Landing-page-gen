/**
 * [data-autoplay] videos: muted inline playback while ≥ 25% visible, paused otherwise.
 * Reduced motion / Data Saver / blocked autoplay → native controls instead, never a stuck frame.
 */
import type { Ctx } from "./core";
import { $$ } from "./core";

export function video(c: Ctx): void {
  const vids = $$(c.doc, "[data-autoplay]")
    .map((el) => (el.tagName === "VIDEO" ? el : el.querySelector("video")) as HTMLVideoElement | null)
    .filter((v): v is HTMLVideoElement => !!v);
  if (!vids.length) return;
  const nav = c.win.navigator as Navigator & { connection?: { saveData?: boolean } };
  const IO = c.win.IntersectionObserver;
  if (c.reduced || (nav.connection && nav.connection.saveData) || typeof IO !== "function") {
    for (const v of vids) v.controls = true;
    return;
  }
  for (const v of vids) {
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
  }
  const io = new IO(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.intersectionRatio >= 0.25) {
          const p = v.play();
          if (p && typeof p.catch === "function")
            p.catch(() => {
              v.controls = true;
            });
        } else if (!v.paused) v.pause();
      }
    },
    { threshold: [0, 0.25] },
  );
  for (const v of vids) io.observe(v);
  c.add(() => io.disconnect());
}
