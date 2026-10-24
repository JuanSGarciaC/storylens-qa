import { describe, expect, it } from "vitest";
import { parseCriteria } from "./parseCriteria";

describe("parseCriteria", () => {
  it("separa por líneas y descarta vacías", () => {
    expect(parseCriteria("uno\n\n  dos  \r\ntres")).toEqual([
      "uno",
      "dos",
      "tres",
    ]);
  });

  it("quita viñetas y numeración", () => {
    expect(parseCriteria("- uno\n* dos\n1. tres\n2) cuatro")).toEqual([
      "uno",
      "dos",
      "tres",
      "cuatro",
    ]);
  });

  it("no altera guiones dentro del texto", () => {
    expect(parseCriteria("Un correo-electrónico válido")).toEqual([
      "Un correo-electrónico válido",
    ]);
  });

  it("devuelve lista vacía con texto en blanco", () => {
    expect(parseCriteria("  \n \n")).toEqual([]);
  });
});
