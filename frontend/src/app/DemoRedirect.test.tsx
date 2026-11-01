import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeProject } from "../test/fakeApi";
import { json, stubFetch } from "../test/renderPage";
import { DemoRedirect } from "./DemoRedirect";

afterEach(() => vi.unstubAllGlobals());

function Where() {
  return <p>en {useLocation().pathname}</p>;
}

function visit(entry: string, projects: unknown[]) {
  stubFetch({
    me: { authenticated: false },
    handler: (call) => (call.path === "/projects" ? json(projects) : undefined),
  });
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/demo/*" element={<DemoRedirect />} />
        <Route path="/p/*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DemoRedirect", () => {
  const demo = makeProject({ id: "d1", is_demo: true });
  const own = makeProject({ id: "p1" });

  it("lleva a la misma pantalla del proyecto demo actual", async () => {
    visit("/demo/metricas", [own, demo]);
    expect(await screen.findByText("en /p/d1/metricas")).toBeInTheDocument();
  });

  it("sin pantalla, abre el resumen de la demo", async () => {
    visit("/demo", [demo]);
    expect(await screen.findByText("en /p/d1")).toBeInTheDocument();
  });

  it("si no hay demo, muestra no encontrado", async () => {
    visit("/demo/metricas", [own]);
    expect(
      await screen.findByRole("heading", { name: /no encontrad/i }),
    ).toBeInTheDocument();
  });
});
