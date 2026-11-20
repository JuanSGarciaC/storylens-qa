/** Geometría pura del enjambre: sin DOM, para poder probarla. */

export type Point = { x: number; y: number };

/** Tope absoluto de velocidad de cualquier agente (px/s). */
export const MAX_SPEED = 1800;
/** Separación del anillo por agente: radio = agentes × 4,4 px. */
export const RING_SPACING = 4.4;
/** La punta del cursor dibujado apunta arriba a la izquierda (−135°). */
const TIP_ANGLE = -135;

/** 14 agentes; 8 en pantallas de menos de 600 px. */
export function agentCount(viewportWidth: number): number {
  return viewportWidth < 600 ? 8 : 14;
}

export function ringRadius(agents: number): number {
  return agents * RING_SPACING;
}

/** Puesto de cada agente en el anillo alrededor de `center`. */
export function ringSlot(
  center: Point,
  index: number,
  agents: number,
  phase = 0,
): Point {
  const angle = phase + (index / agents) * Math.PI * 2;
  const r = ringRadius(agents);
  return {
    x: center.x + Math.cos(angle) * r,
    y: center.y + Math.sin(angle) * r,
  };
}

/** Giro (grados) para que la punta del cursor apunte de `from` hacia `to`. */
export function aimAt(from: Point, to: Point): number {
  const deg = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return deg - TIP_ANGLE;
}

/**
 * Avanza de `from` hacia `to` como mucho `speed` px/s durante `dt` segundos,
 * sin pasar nunca de MAX_SPEED. Devuelve la nueva posición y si llegó.
 */
export function stepToward(
  from: Point,
  to: Point,
  speed: number,
  dt: number,
): { point: Point; arrived: boolean } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const max = Math.min(speed, MAX_SPEED) * dt;
  if (dist <= max || dist < 0.5) return { point: { ...to }, arrived: true };
  const k = max / dist;
  return { point: { x: from.x + dx * k, y: from.y + dy * k }, arrived: false };
}

/**
 * Seguimiento suave (cola tras el ratón): acerca `from` a `to` con un factor
 * exponencial independiente de los fps, respetando el tope de velocidad.
 */
export function follow(
  from: Point,
  to: Point,
  rate: number,
  dt: number,
): Point {
  const t = 1 - Math.exp(-rate * dt);
  const want = {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
  return stepToward(from, want, MAX_SPEED, dt).point;
}

/** Interpola un ángulo en grados por el camino corto. */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

/** Punto fuera de la pantalla por el borde más cercano a `p`. */
export function exitPoint(
  p: Point,
  width: number,
  height: number,
  margin = 60,
): Point {
  const edges = [
    { d: p.x, point: { x: -margin, y: p.y } },
    { d: width - p.x, point: { x: width + margin, y: p.y } },
    { d: p.y, point: { x: p.x, y: -margin } },
    { d: height - p.y, point: { x: p.x, y: height + margin } },
  ];
  edges.sort((a, b) => a.d - b.d);
  return edges[0].point;
}

/**
 * Scroll guiado: hacia dónde avanzar para que la primera capa sin construir
 * quede al 60 % de la pantalla, sin retroceder y a 900 px/s como mucho.
 */
export function guidedScroll(
  current: number,
  firstPendingTop: number | null,
  viewportHeight: number,
  maxScroll: number,
  dt: number,
  speed = 900,
): number {
  if (firstPendingTop === null) return current;
  const target = Math.min(maxScroll, firstPendingTop - viewportHeight * 0.6);
  if (target <= current) return current;
  return Math.min(target, current + speed * dt);
}
