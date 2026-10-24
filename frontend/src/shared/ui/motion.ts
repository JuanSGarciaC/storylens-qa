import type { CSSProperties } from "react";

/** Máximo de escalones: una lista larga no debe retrasar sus últimas filas. */
export const MAX_STAGGER_STEPS = 8;

const REDUCED = "(prefers-reduced-motion: reduce)";

function reducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return true;
  return window.matchMedia(REDUCED).matches;
}

type EnterProps = { className?: string; style?: CSSProperties };

/**
 * Entrada escalonada de un elemento de lista con CSS (`.enter` en base.css).
 * Uso: `<li {...enter(index)}>`. Con `prefers-reduced-motion: reduce`, o sin
 * soporte de matchMedia, no devuelve nada y el elemento aparece sin animar.
 */
export function enter(index: number): EnterProps {
  if (reducedMotion()) return {};
  const step = Math.min(Math.max(index, 0), MAX_STAGGER_STEPS);
  return { className: "enter", style: { "--enter-i": step } as CSSProperties };
}
