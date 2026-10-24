import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Metric, Metrics, TraceabilityMatrix } from "../../api/client";
import { makeMe, makeNamed, makeProject } from "../../test/fakeApi";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import { MetricsPage } from "./MetricsPage";

function metric(overrides: Partial<Metric>): Metric {
  return {
    id: "analyzed_stories",
    label: "Historias analizadas",
    definition: "Historias con al menos un análisis.",
    numerator: 2,
    denominator: 4,
    value: 50,
    unit: "percent",
    ...overrides,
  };
}

const METRICS: Metrics = {
  metrics: [
    metric({}),
    metric({
      id: "average_score",
      label: "Puntaje medio",
      numerator: 130,
      denominator: 2,
      value: 65,
      unit: "score",
    }),
    metric({
      id: "pass_rate",
      label: "Casos que pasan",
      numerator: null,
      denominator: 0,
      value: null,
    }),
    metric({
      id: "improvement_effect",
      label: "Efecto de las mejoras",
      numerator: 30,
      denominator: 1,
      value: 30,
      unit: "points",
    }),
  ],
  breakdowns: [
    {
      id: "findings_by_severity",
      label: "Hallazgos por severidad",
      items: [
        { key: "blocking", count: 3 },
        { key: "major", count: 1 },
      ],
    },
    {
      id: "defects_by_severity",
      label: "Defectos por severidad",
      items: [],
    },
  ],
};

const MATRIX: TraceabilityMatrix = {
  total: 3,
  rows: [
    {
      story_id: "s1",
      story_title: "Retirar efectivo",
      criterion_index: 1,
      criterion: "El saldo se descuenta",
      cases: [{ id: "c1", title: "Retiro válido" }],
      last_result: "failed",
      defects: 1,
    },
    {
      story_id: "s1",
      story_title: "Retirar efectivo",
      criterion_index: 2,
      criterion: "Se rechaza si excede el saldo",
      cases: [],
      last_result: null,
      defects: 0,
    },
  ],
};

function setup(
  options: { matrix?: TraceabilityMatrix; versions?: number } = {},
) {
  const project = makeProject();
  const versions = Array.from({ length: options.versions ?? 0 }, (_, i) =>
    makeNamed(`v${i + 1}`),
  );
  const calls = stubFetch({
    me: makeMe(),
    handler: ({ path }) => {
      if (path === "/projects/p1") return json(project);
      if (path === "/projects") return json([project]);
      if (path === "/projects/p1/metrics") return json(METRICS);
      if (path.startsWith("/projects/p1/traceability-matrix")) {
        return json(options.matrix ?? MATRIX);
      }
      if (path === "/projects/p1/versions") return json(versions);
      if (path.startsWith("/projects/p1/version-comparison")) {
        return json({
          added: [{ id: "n1", title: "Perfil" }],
          removed: [],
          changed: [{ from_id: "a", to_id: "b", what: ["descripción"] }],
          unchanged: 2,
        });
      }
      return undefined;
    },
  });
  const view = renderPage(<MetricsPage />, { entry: "/p/p1/metricas" });
  return { calls, view };
}

afterEach(() => vi.unstubAllGlobals());

describe("MetricsPage", () => {
  it("cada métrica muestra su valor, su denominador y su definición", async () => {
    setup();
    const label = await screen.findByText("Historias analizadas");
    const card = label.closest(".metric") as HTMLElement;
    expect(within(card).getByText("50 %")).toBeInTheDocument();
    expect(within(card).getByText("2 de 4")).toBeInTheDocument();
    expect(
      within(card).getByText("Historias con al menos un análisis."),
    ).toBeInTheDocument();
  });

  it("el puntaje medio dice cuántas historias promedia, no «130 de 2»", async () => {
    setup();
    const card = (await screen.findByText("Puntaje medio")).closest(
      ".metric",
    ) as HTMLElement;
    expect(
      within(card).getByText("Promedio de 2 historias analizadas"),
    ).toBeInTheDocument();
    expect(within(card).queryByText(/130 de 2/)).not.toBeInTheDocument();
  });

  it("sin datos dice «Sin datos» en vez de mostrar un cero", async () => {
    setup();
    const card = (await screen.findByText("Casos que pasan")).closest(
      ".metric",
    ) as HTMLElement;
    expect(within(card).getByText("Sin datos")).toBeInTheDocument();
    expect(within(card).queryByText(/^0/)).not.toBeInTheDocument();
    expect(
      within(card).getByText("Sin elementos para calcularla"),
    ).toBeInTheDocument();
  });

  it("el efecto de las mejoras lleva signo y unidad", async () => {
    setup();
    expect(await screen.findByText("+30 pts")).toBeInTheDocument();
  });

  it("los desgloses escriben los conteos y avisan cuando no hay datos", async () => {
    setup();
    const figure = (await screen.findByText("Hallazgos por severidad")).closest(
      "figure",
    ) as HTMLElement;
    expect(within(figure).getByText("Bloqueante")).toBeInTheDocument();
    expect(within(figure).getByText("3")).toBeInTheDocument();
    const empty = screen.getByText("Defectos por severidad").closest("figure")!;
    expect(within(empty).getByText("Sin datos.")).toBeInTheDocument();
  });

  it("la matriz marca los criterios sin casos como «Sin cobertura» y pagina", async () => {
    const { calls } = setup();
    const table = await screen.findByRole("table", {
      name: /Matriz de trazabilidad/,
    });
    expect(within(table).getByText("Sin cobertura")).toBeInTheDocument();
    expect(within(table).getByText("Falló")).toBeInTheDocument();
    expect(within(table).getByText("Sin ejecutar")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 2 de 3 criterios.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar más" }));
    expect(
      calls.some((c) => c.path.includes("traceability-matrix?limit=200")),
    ).toBe(true);
  });

  it("sin criterios la matriz muestra un estado vacío", async () => {
    setup({ matrix: { total: 0, rows: [] } });
    expect(
      await screen.findByText("Todavía no hay criterios que trazar"),
    ).toBeInTheDocument();
  });

  it("con menos de dos versiones explica qué hacer", async () => {
    setup({ versions: 1 });
    expect(
      await screen.findByText(/hacen falta al menos dos/),
    ).toBeInTheDocument();
  });

  it("compara dos versiones y lista lo nuevo y lo que cambió", async () => {
    setup({ versions: 2 });
    await userEvent.selectOptions(await screen.findByLabelText("Desde"), "v1");
    await userEvent.selectOptions(screen.getByLabelText("Hasta"), "v2");
    expect(await screen.findByText("Perfil")).toBeInTheDocument();
    expect(screen.getByText("Nueva")).toBeInTheDocument();
    expect(screen.getByText(/descripción/)).toBeInTheDocument();
    expect(screen.getByText(/Sin cambios:/)).toHaveTextContent("2");
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { view } = setup({ versions: 2 });
    await screen.findByRole("table", { name: /Matriz de trazabilidad/ });
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
