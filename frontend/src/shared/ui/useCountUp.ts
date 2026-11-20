import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./motion";

/**
 * A7 count-up: cuenta de 0 a `target` en `ms` con rAF (solo cambia el texto).
 * Con `prefers-reduced-motion`, sin matchMedia o con `enabled` en false,
 * devuelve el valor final desde el primer render.
 */
export function useCountUp(target: number, enabled = true, ms = 650): number {
  const animate = enabled && !prefersReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate, ms]);
  return animate ? value : target;
}
