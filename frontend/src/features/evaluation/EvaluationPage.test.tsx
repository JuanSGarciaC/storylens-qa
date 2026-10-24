import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EvaluationInfo, EvaluationRun } from "../../api/client";
import { makeMe, makeProject } from "../../test/fakeApi";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import { EvaluationPage } from "./EvaluationPage";

function run(overrides: Partial<EvaluationRun> = {}): EvaluationRun {
  return {
    id: "r1",
    project_id: "p1",
    mode: "rules",
    status: "succeeded",
    actor: "sistema",
    created_at: "2026-10-24T12:00:00Z",
    finished_at: "2026-10-24T12:00:01Z",
    catalog_version: "1.2",
    model_name: null,
    prompt_version: null,
    total: 16,
    processed: 16,
    metrics: {
      det: { precision: 0.8, recall: 0.5, f1: 0.6154, tp: 8, fp: 2, fn: 8 },
      ai: null,
    },
    details: {
      ai_status: { not_requested: 16 },
      stories: [{ id: "sin-criterios", missing: ["US-AC-001"], extra: [] }],
    },
    note: "",
    ...overrides,
  };
}

const AI_RUN = run({
  id: "r2",
  mode: "rules_ai",
  model_name: "gemini-test",
  prompt_version: "v3",
  created_at: "2026-10-24T13:00:00Z",
  metrics: {
    det: { precision: 0.8, recall: 0.5, f1: 0.6154, tp: 8, fp: 2, fn: 8 },
    ai: { precision: 0.9, recall: 0.7, f1: 0.7875, tp: 7, fp: 1, fn: 3 },
  },
  details: { measured_for_ai: 14, stories: [] },
});

const INJECTION_RUN = run({
  id: "r3",
  mode: "injection",
  total: 3,
  processed: 3,
  created_at: "2026-10-24T14:00:00Z",
  metrics: { injection: { passed: 2, failed: 1, not_evaluable: 0, total: 3 } },
  details: {
    injection: [
      { id: "rol-falso", status: "failed", reason: "La IA obedeció" },
      { id: "formato-json", status: "passed", reason: "La IA ignoró" },
    ],
  },
});

const INFO: EvaluationInfo = {
  golden_stories: 16,
  injection_cases: 3,
  ai_available: true,
  ai_quota_remaining_today: 40,
};

function setup(
  runs: EvaluationRun[],
  options: {
    demo?: boolean;
    anonymous?: boolean;
    quota?: number;
    aiConfigured?: boolean;
  } = {},
) {
  const project = makeProject({ is_demo: options.demo ?? false });
  const calls = stubFetch({
    me: options.anonymous ? { authenticated: false } : makeMe(),
    health: { status: "ok", ai_configured: options.aiConfigured ?? true },
    handler: ({ path, method }) => {
      if (path === "/projects/p1") return json(project);
      if (path === "/projects") return json([project]);
      if (path === "/projects/p1/evaluations/info") {
        return json({
          ...INFO,
          ai_quota_remaining_today: options.quota ?? 40,
        });
      }
      if (path === "/projects/p1/evaluations" && method === "POST") {
        return json(run({ id: "nuevo", status: "running", processed: 0 }), 202);
      }
      if (path === "/projects/p1/evaluations") return json(runs);
      return undefined;
    },
  });
  const view = renderPage(<EvaluationPage />, { entry: "/p/p1/evaluacion" });
  return { calls, view };
}

afterEach(() => vi.unstubAllGlobals());

describe("EvaluationPage", () => {
  it("muestra el historial y el detalle de la corrida más reciente con sus métricas", async () => {
    setup([run()]);
    const table = await screen.findByRole("table", {
      name: /Precisión, exhaustividad y F1/,
    });
    const row = within(table).getByText("Reglas automáticas").closest("tr")!;
    expect(within(row).getByText("80 %")).toBeInTheDocument();
    expect(within(row).getByText("50 %")).toBeInTheDocument();
    expect(screen.getByText(/catálogo/)).toHaveTextContent("v1.2");
    expect(screen.getByText(/Diferencias con lo esperado \(1/)).toBeVisible();
  });

  it("una corrida con IA aclara en cuántas historias se midió", async () => {
    setup([AI_RUN]);
    expect(
      await screen.findByText(/La IA se midió en 14 de 16 historias/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("gemini-test").length).toBeGreaterThan(0);
    expect(screen.getByText("v3")).toBeInTheDocument();
  });

  it("las pruebas de inyección muestran cuáles pasaron y cuáles fallaron", async () => {
    setup([INJECTION_RUN]);
    const summary = await screen.findByText(
      (_, el) =>
        el?.tagName === "P" &&
        /Pasaron 2 de 3 pruebas de inyección; 1 fallaron/.test(
          el.textContent ?? "",
        ),
    );
    expect(summary).toBeVisible();
    expect(screen.getByText("Falló")).toBeInTheDocument();
    expect(screen.getByText("Pasó")).toBeInTheDocument();
  });

  it("evaluar solo con reglas llama a la API con ese modo", async () => {
    const { calls } = setup([run()]);
    await userEvent.click(
      await screen.findByRole("button", { name: "Evaluar solo con reglas" }),
    );
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.path === "/projects/p1/evaluations" &&
            (c.body as { mode: string }).mode === "rules",
        ),
      ).toBe(true),
    );
  });

  it("sin IA o sin cuota suficiente los botones de IA se deshabilitan con el motivo", async () => {
    setup([run()], { quota: 5 });
    expect(
      await screen.findByRole("button", { name: "Evaluar con reglas e IA" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/no alcanza para la evaluación completa/),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Evaluar solo con reglas" }),
    ).toBeEnabled();
  });

  it("anónimos y demo ven las corridas pero ningún botón para ejecutar", async () => {
    setup([run()], { demo: true });
    await screen.findByRole("table", { name: "Evaluaciones realizadas" });
    expect(
      screen.queryByRole("button", { name: /Evaluar|Probar/ }),
    ).not.toBeInTheDocument();
  });

  it("compara dos corridas y muestra el cambio de cada métrica compartida", async () => {
    setup([AI_RUN, run()]);
    await userEvent.selectOptions(
      await screen.findByLabelText("Corrida base"),
      "r1",
    );
    await userEvent.selectOptions(screen.getByLabelText("Comparar con"), "r2");
    const table = await screen.findByRole("table", {
      name: "Cambio entre las dos corridas",
    });
    // r1 no tiene IA: solo se comparan las reglas automáticas, que no cambiaron.
    expect(within(table).getAllByText("Sin cambio")).toHaveLength(3);
    expect(within(table).queryByText(/reglas de IA/)).not.toBeInTheDocument();
  });

  it("sin corridas muestra un estado vacío", async () => {
    setup([]);
    expect(
      await screen.findByText("Todavía no hay evaluaciones"),
    ).toBeInTheDocument();
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { view } = setup([AI_RUN, run(), INJECTION_RUN]);
    await screen.findByRole("table", { name: "Evaluaciones realizadas" });
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
