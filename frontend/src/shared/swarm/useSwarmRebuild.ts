import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SwarmHandle } from "./swarm";

const SEEN_KEY = "storylens:swarm-seen";
/** Igual que PREHIDE_ATTR en swarm.ts (sin importarlo: ese módulo se carga diferido). */
const PREHIDE = "data-sr-pre";
/** Si el módulo no confirma que arrancó en este tiempo, todo vuelve a verse. */
const PREHIDE_SAFETY_MS = 2500;

/** El efecto solo corre con movimiento permitido y matchMedia disponible (no en jsdom). */
export function swarmAllowed(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function seen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* sin almacenamiento: solo no se recuerda entre cargas */
  }
}

type Run = { id: number; handle: SwarmHandle | null };

/** Detiene cualquier ejecución en curso y deja todo visible. */
function halt(run: Run) {
  run.id++;
  document.documentElement.removeAttribute(PREHIDE);
  run.handle?.stop();
  run.handle = null;
}

/** Oculta `node` antes de pintar, carga el módulo y arranca el enjambre. */
function launch(node: HTMLElement, run: Run): () => void {
  halt(run);
  const id = run.id;
  const html = document.documentElement;
  html.setAttribute(PREHIDE, "");
  const safety = window.setTimeout(
    () => html.removeAttribute(PREHIDE),
    PREHIDE_SAFETY_MS,
  );
  import("./swarm")
    .then(({ startSwarm }) => {
      clearTimeout(safety);
      if (id !== run.id || !node.isConnected) return;
      markSeen();
      run.handle = startSwarm({ root: node });
    })
    .catch(() => {
      clearTimeout(safety);
      if (id === run.id) html.removeAttribute(PREHIDE);
    });
  return () => {
    clearTimeout(safety);
    if (id === run.id) halt(run);
  };
}

/**
 * D9 Swarm Rebuild sobre `root`: corre una vez por sesión del navegador al montar
 * (si `enabled`) y devuelve `replay` para el botón `[data-sr-replay]`.
 * Si el módulo falla o tarda, se muestra todo.
 */
export function useSwarmRebuild(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const [allowed] = useState(() => enabled && swarmAllowed());
  const [auto] = useState(() => allowed && !seen());
  const run = useRef<Run>({ id: 0, handle: null });

  // useLayoutEffect: el atributo que oculta se pone antes del primer pintado.
  useLayoutEffect(() => {
    if (auto && root.current) return launch(root.current, run.current);
  }, [auto, root]);

  useEffect(() => {
    const current = run.current;
    return () => halt(current);
  }, []);

  function replay() {
    if (!root.current || !swarmAllowed()) return;
    window.scrollTo(0, 0);
    launch(root.current, run.current);
  }

  return { replay, available: allowed && enabled };
}
