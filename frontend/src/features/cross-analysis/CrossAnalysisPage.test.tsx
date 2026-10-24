import { screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CrossAnalysis } from "../../api/client";
import { makeMe, makeProject } from "../../test/fakeApi";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import { CrossAnalysisPage } from "./CrossAnalysisPage";

function report(overrides: Partial<CrossAnalysis> = {}): CrossAnalysis {
  return {
    total_stories: 3,
    stories: [
      { id: "a", title: "Recuperar contraseña" },
      { id: "b", title: "Restablecer clave" },
      { id: "c", title: "Exportar informe" },
    ],
    duplicates: [{ a_id: "a", b_id: "b", similarity: 0.72 }],
    dependencies: [
      { from_id: "c", to_id: "a", evidence: "menciona la clave K-1" },
    ],
    contradictions: [
      {
        a_id: "a",
        b_id: "b",
        reason: "Hipótesis, revisar a mano: cifras distintas para «minutos»",
        is_hypothesis: true,
      },
    ],
    epic_risks: [
      {
        epic_id: null,
        epic_name: "Sin épica",
        stories: 3,
        analyzed: 2,
        not_ready: 1,
        without_cases: 3,
        average_score: 71.5,
        level: "medium",
        reason: "1 no listas y 3 sin casos aceptados de 3",
      },
    ],
    without_cases: ["a", "b", "c"],
    ...overrides,
  };
}

function setup(body: CrossAnalysis | Response) {
  const project = makeProject();
  stubFetch({
    me: makeMe(),
    handler: ({ path }) => {
      if (path === "/projects/p1") return json(project);
      if (path === "/projects") return json([project]);
      if (path === "/projects/p1/cross-analysis") {
        return body instanceof Response ? body : json(body);
      }
      return undefined;
    },
  });
  return renderPage(<CrossAnalysisPage />, { entry: "/p/p1/transversal" });
}

afterEach(() => vi.unstubAllGlobals());

describe("CrossAnalysisPage", () => {
  it("muestra cada hallazgo con enlaces a las historias y marca las sospechas como hipótesis", async () => {
    setup(report());
    expect(
      await screen.findByRole("heading", { name: /Posibles duplicados/ }),
    ).toBeInTheDocument();
    const duplicates = screen
      .getByRole("heading", { name: /Posibles duplicados/ })
      .closest("section")!;
    expect(
      within(duplicates).getByRole("link", { name: "Recuperar contraseña" }),
    ).toHaveAttribute("href", "/p/p1/stories/a/analysis");
    expect(within(duplicates).getByText("72 %")).toBeInTheDocument();
    expect(screen.getByText(/menciona la clave K-1/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /contradicciones \(hipótesis\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/revisar a mano: cifras distintas/)).toBeVisible();
  });

  it("explica el riesgo por épica con los conteos reales", async () => {
    setup(report());
    const table = await screen.findByRole("table", {
      name: "Riesgo por épica",
    });
    const row = within(table).getByText("Sin épica").closest("tr")!;
    expect(within(row).getByText("Riesgo medio")).toBeInTheDocument();
    expect(within(row).getByText("71.5")).toBeInTheDocument();
    expect(within(row).getByText(/3 sin casos aceptados de 3/)).toBeVisible();
  });

  it("un grupo sin analizar dice «Sin datos» y no inventa un puntaje", async () => {
    setup(
      report({
        epic_risks: [
          {
            epic_id: null,
            epic_name: "Sin épica",
            stories: 3,
            analyzed: 0,
            not_ready: 0,
            without_cases: 3,
            average_score: null,
            level: "unknown",
            reason: "Ninguna historia de este grupo está analizada.",
          },
        ],
      }),
    );
    const table = await screen.findByRole("table", {
      name: "Riesgo por épica",
    });
    expect(within(table).getByText("Sin datos")).toBeInTheDocument();
    expect(within(table).getAllByText("—")).not.toHaveLength(0);
  });

  it("secciones sin hallazgos dicen «Nada que señalar»", async () => {
    setup(report({ duplicates: [], dependencies: [], contradictions: [] }));
    await screen.findByRole("heading", { name: /Posibles duplicados/ });
    expect(screen.getAllByText("Nada que señalar.")).toHaveLength(3);
  });

  it("un proyecto sin historias muestra un estado vacío con salida", async () => {
    setup(
      report({
        total_stories: 0,
        stories: [],
        duplicates: [],
        dependencies: [],
        contradictions: [],
        epic_risks: [],
        without_cases: [],
      }),
    );
    expect(
      await screen.findByText("Todavía no hay historias que comparar"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir a las historias" }),
    ).toHaveAttribute("href", "/p/p1/stories");
  });

  it("si la API falla muestra el error con reintento", async () => {
    setup(json({ detail: "Falla interna" }, 500));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falla interna");
    expect(screen.getByRole("button", { name: /Reintentar/ })).toBeVisible();
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const view = setup(report());
    await screen.findByRole("table", { name: "Riesgo por épica" });
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
