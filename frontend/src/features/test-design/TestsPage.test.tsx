import { Component } from "react";
import type { ReactNode } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoryItem, TestCase } from "../../api/client";
import { makeMe, makeProject } from "../../test/fakeApi";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import type { Call } from "../../test/renderPage";
import { TestsPage } from "./TestsPage";

afterEach(() => vi.unstubAllGlobals());

const LONG = `${"Criterio larguísimo ".repeat(8)}${"x".repeat(80)}`;

function makeCase(n: number, overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: `c${n}`,
    story_id: "s1",
    title: `Caso ${n}`,
    technique: "scenario",
    criterion_index: 1,
    preconditions: "Saldo 500",
    steps: ["Elegir Retirar", "Ingresar 100"],
    test_data: "",
    expected_result: "El saldo queda en 400",
    gherkin: null,
    priority: "high",
    origin: "ai",
    status: "proposed",
    ...overrides,
  };
}

function makeStory(): StoryItem {
  return {
    id: "s1",
    project_id: "p1",
    title: "Retirar efectivo",
    description: "Como cliente quiero retirar efectivo",
    notes: "",
    acceptance_criteria: ["Retiro menor al saldo", LONG],
    created_at: "2026-10-23T12:00:00Z",
    latest_analysis: null,
  };
}

type Options = {
  cases?: TestCase[];
  anonymous?: boolean;
  demo?: boolean;
  aiConfigured?: boolean;
  generateFails?: boolean;
  statusFails?: boolean;
  /** La trazabilidad falla después de la primera carga. */
  traceFailsAfterLoad?: boolean;
  quota?: number;
  foreign?: boolean;
};

class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <p>Recurso no encontrado</p>
    ) : (
      this.props.children
    );
  }
}

const traceRetry = { ok: false };

function setup(options: Options = {}) {
  let traceCalls = 0;
  traceRetry.ok = false;
  const story = makeStory();
  if (options.foreign) story.project_id = "otro";
  const project = makeProject({ is_demo: options.demo ?? false });
  const cases = options.cases ?? [];
  const calls = stubFetch({
    me: options.anonymous ? { authenticated: false } : makeMe(),
    health: {
      status: "ok",
      ai_configured: options.aiConfigured ?? true,
      ai_quota_remaining_today: options.quota,
    },
    handler: (call: Call) => {
      const { path, method } = call;
      if (path === "/projects/p1") return json(project);
      if (path === "/projects") return json([project]);
      if (path === "/stories/s1" && method === "GET") return json(story);
      if (path === "/stories/s1/test-cases" && method === "GET") {
        return json(cases);
      }
      if (path === "/stories/s1/test-cases:generate") {
        if (options.generateFails) {
          return json({ detail: "La IA no está disponible ahora" }, 503);
        }
        cases.splice(0, cases.length, makeCase(1), makeCase(2));
        return json(cases);
      }
      const one = path.match(/^\/test-cases\/(.+)$/);
      if (one && method === "PATCH") {
        if (options.statusFails) {
          return json({ detail: "No se pudo guardar el estado" }, 500);
        }
        const found = cases.find((c) => c.id === one[1])!;
        found.status = (call.body as { status: TestCase["status"] }).status;
        return json(found);
      }
      if (path === "/stories/s1/traceability") {
        traceCalls += 1;
        if (options.traceFailsAfterLoad && traceCalls > 1 && !traceRetry.ok) {
          return json({ detail: "Trazabilidad caída" }, 500);
        }
        const rows = story.acceptance_criteria.map((text, i) => {
          const linked = cases.filter((c) => c.criterion_index === i + 1);
          const accepted = linked.filter((c) => c.status === "accepted");
          return {
            index: i + 1,
            text,
            accepted_ids: accepted.map((c) => c.id),
            proposed_ids: linked
              .filter((c) => c.status === "proposed")
              .map((c) => c.id),
            covered: accepted.length > 0,
          };
        });
        return json({
          rows,
          unlinked_ids: [],
          coverage: rows.filter((r) => r.covered).length / rows.length,
        });
      }
      if (path === "/stories/s1/gherkin:suggest") {
        return json({
          scenarios: [
            {
              criterion_index: 1,
              text: "Escenario: Retiro\nDado un saldo de 500\nCuando retiro 100",
            },
          ],
          model_name: "m",
          prompt_version: "g1",
        });
      }
      return undefined;
    },
  });
  const view = renderPage(
    <Boundary>
      <TestsPage />
    </Boundary>,
    { entry: "/p/p1/stories/s1/tests" },
  );
  return { view, calls, cases };
}

const req = (calls: Call[], method: string, pattern: RegExp) =>
  calls.find((c) => c.method === method && pattern.test(c.path));

describe("TestsPage", () => {
  it("agrupa los casos por técnica con el estado como texto", async () => {
    setup({
      cases: [
        makeCase(1),
        makeCase(2, { technique: "boundary_value", status: "accepted" }),
      ],
    });
    const scenario = await screen.findByRole("region", { name: /Escenario/ });
    expect(within(scenario).getByText("Caso 1")).toBeInTheDocument();
    expect(within(scenario).getByText("Propuesto")).toBeInTheDocument();
    const limits = screen.getByRole("region", { name: /Valores límite/ });
    expect(within(limits).getByText("Caso 2")).toBeInTheDocument();
    expect(within(limits).getByText("Aceptado")).toBeInTheDocument();
  });

  it("marca los criterios sin casos con el texto «Sin cobertura»", async () => {
    setup({ cases: [makeCase(1, { status: "accepted" })] });
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).queryByText("Sin cobertura")).toBeNull();
    expect(within(rows[2]).getByText("Sin cobertura")).toBeInTheDocument();
    expect(within(rows[2]).getByText(/Criterio larguísimo/)).toHaveClass(
      "wrap",
    );
  });

  it("cambiar el estado llama a updateCaseStatus y muestra el nuevo valor", async () => {
    const { calls } = setup({ cases: [makeCase(1)] });
    await userEvent.click(
      await screen.findByRole("button", { name: "Aceptar caso Caso 1" }),
    );
    expect(await screen.findByText("Aceptado")).toBeInTheDocument();
    expect(req(calls, "PATCH", /test-cases\/c1/)?.body).toEqual({
      status: "accepted",
    });
    expect(await screen.findByText("50%")).toBeInTheDocument();
  });

  it("un fallo al cambiar el estado se muestra junto al caso", async () => {
    setup({ cases: [makeCase(1)], statusFails: true });
    await userEvent.click(
      await screen.findByRole("button", { name: "Aceptar caso Caso 1" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo guardar el estado",
    );
    expect(screen.getByText("Propuesto")).toBeInTheDocument();
  });

  it("si falla la trazabilidad tras cambiar el estado, el caso queda actualizado y se ofrece reintentar", async () => {
    setup({ cases: [makeCase(1)], traceFailsAfterLoad: true });
    await userEvent.click(
      await screen.findByRole("button", { name: "Aceptar caso Caso 1" }),
    );
    expect(await screen.findByText("Aceptado")).toBeInTheDocument();
    expect(
      await screen.findByText("No se pudo actualizar la trazabilidad"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No se pudo guardar el estado")).toBeNull();
    expect(screen.queryByText("Propuesto")).toBeNull();
    traceRetry.ok = true;
    await userEvent.click(
      screen.getByRole("button", { name: "Reintentar trazabilidad" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText("No se pudo actualizar la trazabilidad"),
      ).toBeNull(),
    );
    expect(await screen.findByText("50%")).toBeInTheDocument();
  });

  it("si falla la trazabilidad tras generar, los casos se muestran igualmente", async () => {
    setup({ traceFailsAfterLoad: true });
    await userEvent.click(
      await screen.findByRole("button", { name: "Generar casos" }),
    );
    expect((await screen.findAllByText("Caso 2")).length).toBeGreaterThan(0);
    expect(
      await screen.findByText("No se pudo actualizar la trazabilidad"),
    ).toBeInTheDocument();
    expect(screen.queryByText("La IA no está disponible ahora")).toBeNull();
    expect(screen.queryByText(/No se pudo completar/)).toBeNull();
  });

  it("anónimo ve los casos pero no los controles, y ve el motivo", async () => {
    setup({ cases: [makeCase(1)], anonymous: true });
    expect((await screen.findAllByText("Caso 1")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Aceptar caso/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Generar casos" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Sugerir Gherkin" }),
    ).toBeDisabled();
    expect(screen.getByText("Inicia sesión para editar.")).toBeInTheDocument();
  });

  it("el proyecto de demostración no ofrece controles de escritura", async () => {
    setup({ cases: [makeCase(1)], demo: true });
    expect((await screen.findAllByText("Caso 1")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Aceptar caso/ })).toBeNull();
    expect(screen.getByText(/proyecto de demostración/)).toBeInTheDocument();
  });

  it("sin IA configurada desactiva las acciones de IA y lo explica", async () => {
    setup({ cases: [makeCase(1)], aiConfigured: false });
    await screen.findAllByText("Caso 1");
    expect(
      screen.getByRole("button", { name: "Generar casos" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Sugerir Gherkin" }),
    ).toBeDisabled();
    expect(screen.getByText("La IA no está configurada.")).toBeInTheDocument();
    // La revisión manual sigue disponible.
    expect(
      screen.getByRole("button", { name: "Aceptar caso Caso 1" }),
    ).toBeEnabled();
  });

  it("sin casos muestra un EmptyState con la acción «Generar casos»", async () => {
    const { calls } = setup();
    expect(
      await screen.findByText(/aún no tiene casos de prueba/i),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Generar casos" }),
    );
    expect((await screen.findAllByText("Caso 2")).length).toBeGreaterThan(0);
    expect(req(calls, "POST", /test-cases:generate/)).toBeTruthy();
  });

  it("muestra el error de generación junto al botón", async () => {
    setup({ generateFails: true });
    await userEvent.click(
      await screen.findByRole("button", { name: "Generar casos" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La IA no está disponible ahora",
    );
  });

  it("sugiere Gherkin en monoespaciado y refresca el estado de la IA", async () => {
    const { calls } = setup({ cases: [makeCase(1)] });
    await userEvent.click(
      await screen.findByRole("button", { name: "Sugerir Gherkin" }),
    );
    const block = await screen.findByText(/Dado un saldo de 500/);
    expect(block.tagName).toBe("PRE");
    expect(block).toHaveClass("gherkin");
    expect(screen.getByText(/# Criterio 1/)).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.filter((c) => c.path === "/health").length).toBeGreaterThan(
        1,
      ),
    );
  });

  it("muestra el Gherkin guardado en un caso sin usar la IA", async () => {
    setup({
      cases: [makeCase(1, { gherkin: "Dado un saldo\nCuando retiro" })],
      aiConfigured: false,
    });
    const block = await screen.findByText(/Cuando retiro/);
    expect(block.tagName).toBe("PRE");
  });

  it("una historia ajena se muestra como no encontrada", async () => {
    setup({ foreign: true });
    expect(
      await screen.findByText("Recurso no encontrado"),
    ).toBeInTheDocument();
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { view } = setup({
      cases: [makeCase(1), makeCase(2, { technique: "boundary_value" })],
    });
    await screen.findAllByText("Caso 1");
    await screen.findByRole("table");
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
