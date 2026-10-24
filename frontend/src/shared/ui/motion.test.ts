import { afterEach, describe, expect, it, vi } from "vitest";
import { enter, MAX_STAGGER_STEPS } from "./motion";

function mockReduced(reduce: boolean | undefined) {
  if (reduce === undefined) {
    vi.stubGlobal("matchMedia", undefined);
    return;
  }
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
      media: query,
    })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("enter", () => {
  it("con movimiento reducido no aplica clase ni estilo", () => {
    mockReduced(true);
    expect(enter(2)).toEqual({});
  });

  it("sin movimiento reducido aplica la clase y un retardo escalonado", () => {
    mockReduced(false);
    const props = enter(2);
    expect(props.className).toBe("enter");
    expect(props.style).toEqual({ "--enter-i": 2 });
  });

  it("limita el escalón para que listas largas no tarden", () => {
    mockReduced(false);
    expect(enter(500).style).toEqual({ "--enter-i": MAX_STAGGER_STEPS });
  });

  it("sin matchMedia (entorno sin soporte) no anima", () => {
    mockReduced(undefined);
    expect(enter(0)).toEqual({});
  });
});
