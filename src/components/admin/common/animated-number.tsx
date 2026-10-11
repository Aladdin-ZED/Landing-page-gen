"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Number that rolls up to its value once visible, then glides between later values.
 * The markup carries the final value (correct without JS); the roll-up starts from zero before
 * the first paint on the client.
 */
export function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();

  useIsoLayoutEffect(() => {
    if (!reduce && shown.current === null && ref.current) ref.current.textContent = format(0);
    // first paint only
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    const from = shown.current ?? 0;
    if (reduce || from === value) {
      el.textContent = format(value);
      shown.current = value;
      return;
    }
    const controls = animate(from, value, {
      duration: shown.current === null ? 1.1 : 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
        shown.current = v;
      },
    });
    return () => controls.stop();
  }, [value, inView, reduce, format]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
