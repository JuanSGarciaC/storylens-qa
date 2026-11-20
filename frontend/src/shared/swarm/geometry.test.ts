import { describe, expect, it } from "vitest";
import {
  MAX_SPEED,
  agentCount,
  aimAt,
  exitPoint,
  guidedScroll,
  ringRadius,
  ringSlot,
  stepToward,
} from "./geometry";

describe("geometría del enjambre", () => {
  it("usa 14 agentes, 8 en pantallas de menos de 600 px", () => {
    expect(agentCount(1440)).toBe(14);
    expect(agentCount(599)).toBe(8);
  });

  it("el anillo mide agentes × 4,4 px", () => {
    expect(ringRadius(14)).toBeCloseTo(61.6);
    const p = ringSlot({ x: 100, y: 100 }, 0, 14);
    expect(p.x).toBeCloseTo(161.6);
    expect(p.y).toBeCloseTo(100);
  });

  it("la punta apunta hacia el objetivo", () => {
    // El cursor sin girar apunta arriba a la izquierda.
    expect(aimAt({ x: 10, y: 10 }, { x: 0, y: 0 }) % 360).toBeCloseTo(0);
    expect(aimAt({ x: 0, y: 0 }, { x: 10, y: 10 })).toBeCloseTo(180);
  });

  it("nunca supera el tope de velocidad", () => {
    const res = stepToward({ x: 0, y: 0 }, { x: 10000, y: 0 }, 99999, 1);
    expect(res.point.x).toBe(MAX_SPEED);
    expect(res.arrived).toBe(false);
    expect(stepToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 100, 1).arrived).toBe(
      true,
    );
  });

  it("sale por el borde más cercano", () => {
    expect(exitPoint({ x: 10, y: 300 }, 800, 600)).toEqual({ x: -60, y: 300 });
    expect(exitPoint({ x: 400, y: 590 }, 800, 600)).toEqual({ x: 400, y: 660 });
  });

  it("el scroll guiado avanza a 900 px/s y no pasa de la primera capa pendiente", () => {
    // Capa pendiente en y=2000, pantalla de 1000: objetivo 2000 − 600 = 1400.
    expect(guidedScroll(0, 2000, 1000, 5000, 0.1)).toBe(90);
    expect(guidedScroll(1390, 2000, 1000, 5000, 0.1)).toBe(1400);
    expect(guidedScroll(1500, 2000, 1000, 5000, 0.1)).toBe(1500); // nunca retrocede
    expect(guidedScroll(0, null, 1000, 5000, 0.1)).toBe(0);
    expect(guidedScroll(0, 2000, 1000, 40, 1)).toBe(40); // límite del documento
  });
});
