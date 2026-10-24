import { Component } from "react";
import type { ReactNode } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Analysis, StoryItem } from "../../api/client";
import { makeMe, makeProject } from "../../test/fakeApi";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import type { Call } from "../../test/renderPage";
import { AnalysisPage } from "./AnalysisPage";

afterEach(() => vi.unstubAllGlobals());

type Finding = Analysis["findings"][number];

const BLOCKING: Finding = {
  id: "f-block",
  rule_id: "US-AC-001",
  source: "rule",
  severity: "blocking",
  message: "La historia no tiene criterios de aceptación.",
  suggestion: "Agregue criterios verificables.",
  reference: "3C (Confirmación)",
  evidence_text: null,
  decision: "pending",
  dismiss_reason: null,
  confidence: null,
};
const MAJOR: Finding = {
  id: "f-major",
  rule_id: "US-AMB-001",
  source: "rule",
  severity: "major",
  message: "Se usa el término vago «rápido».",
  suggestion: "Reemplácelo por un valor medible.",
  reference: "ISO/IEC/IEEE 29148:2018",
  evidence_text: "acceso rápido",
  decision: "pending",
  dismiss_reason: null,
  confidence: null,
};
const AI_FINDING: Finding = {
  ...MAJOR,
  id: "f-ai",
  rule_id: "US-AC-004",
  source: "ai",
  message: "Solo se describe el camino feliz.",
  confidence: 0.85,
};

function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: "a1",
    story_id: "s1",
    created_at: "2026-10-23T12:00:00Z",
    score: 60,
    verdict: "not_ready",
    used_ai: false,
    ai_status: "not_requested",
    model_name: null,
    prompt_version: null,
    rules_catalog_version: "1.0.0",
    findings: [{ ...BLOCKING }, { ...MAJOR }],
    ...overrides,
  };
}

function makeStory(overrides: Partial<StoryItem> = {}): StoryItem {
  return {
    id: "s1",
    project_id: "p1",
    title: "Login rápido",
    description: "Como usuario quiero un acceso rápido",
    notes: "",
    acceptance_criteria: ["Primero", "Segundo"],
    created_at: "2026-10-23T12:00:00Z",
    latest_analysis: {
      id: "a1",
      score: 60,
      verdict: "not_ready",
      created_at: "2026-10-23T12:00:00Z",
    },
    ...overrides,
  };
}

type Options = {
  story?: StoryItem;
  analysis?: Analysis | null;
  created?: Analysis;
  demo?: boolean;
  anonymous?: boolean;
  aiConfigured?: boolean;
  quota?: number;
  deleteStatus?: number;
  createStatus?: number;
  /** Cuota que informa /health tras la primera consulta de IA; "down" = /health no responde. */
  quotaAfter?: number | "down";
};

function setup(options: Options = {}) {
  const analysis =
    options.analysis === undefined ? makeAnalysis() : options.analysis;
  const story =
    options.story ??
    makeStory(analysis ? {} : { latest_analysis: null as never });
  const project = makeProject({ is_demo: options.demo ?? false });
  const calls = stubFetch({
    me: options.anonymous ? { authenticated: false } : makeMe(),
    health: () => {
      const spent = calls.some(
        (c) => c.method === "POST" && c.path.endsWith("/analyses"),
      );
      if (spent && options.quotaAfter === "down") {
        return new Response(null, { status: 503 });
      }
      return {
        status: "ok",
        ai_configured: options.aiConfigured ?? true,
        ai_quota_remaining_today:
          spent && options.quotaAfter !== undefined
            ? options.quotaAfter
            : options.quota,
      };
    },
    handler: (call: Call) => {
      const { path, method } = call;
      if (path === "/projects/p1") return json(project);
      if (path === "/projects") return json([project]);
      if (path === `/stories/${story.id}` && method === "GET") {
        return json(story);
      }
      if (path === `/stories/${story.id}` && method === "DELETE") {
        return options.deleteStatus
          ? json({ detail: "No tienes permiso para eliminar" }, 403)
          : new Response(null, { status: 204 });
      }
      if (path === "/analyses/a1") return json(analysis);
      if (path === `/stories/${story.id}/analyses` && method === "POST") {
        if (options.createStatus) {
          return json(
            { detail: "Límite de análisis alcanzado" },
            options.createStatus,
          );
        }
        return json(options.created ?? makeAnalysis(), 201);
      }
      const finding = path.match(/^\/findings\/(.+)$/);
      if (finding && method === "PATCH" && analysis) {
        const body = call.body as { decision: Finding["decision"] };
        const updated = {
          ...analysis,
          score: body.decision === "dismissed" ? 90 : 60,
          findings: analysis.findings.map((f) =>
            f.id === finding[1]
              ? {
                  ...f,
                  decision: body.decision,
                  dismiss_reason:
                    (call.body as { dismiss_reason: string | null })
                      .dismiss_reason ?? null,
                }
              : f,
          ),
        };
        return json(updated);
      }
      return undefined;
    },
  });
  const view = renderPage(
    <Boundary>
      <AnalysisPage />
    </Boundary>,
    { entry: `/p/p1/stories/${story.id}/analysis` },
  );
  return { view, calls };
}

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

const req = (calls: Call[], method: string, pattern: RegExp) =>
  calls.find((c) => c.method === method && pattern.test(c.path));

describe("AnalysisPage - resultado", () => {
  it("muestra el puntaje grande con gradiente y el veredicto", async () => {
    setup();
    const score = await screen.findByLabelText("Puntaje 60 de 100");
    expect(score.querySelector(".gradient-text")).not.toBeNull();
    expect(screen.getByText("No lista")).toBeInTheDocument();
  });

  it("agrupa los hallazgos por severidad con etiqueta textual", async () => {
    setup();
    await screen.findByLabelText("Puntaje 60 de 100");
    expect(
      screen.getByRole("heading", { name: /^Bloqueante/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Mayor/ })).toBeInTheDocument();
    // sin hallazgos menores ni informativos no hay grupo vacío
    expect(screen.queryByRole("heading", { name: /^Menor/ })).toBeNull();
  });

  it("la referencia normativa va en mono y el texto largo en prose", async () => {
    setup();
    const norm = await screen.findByText("ISO/IEC/IEEE 29148:2018");
    expect(norm).toHaveClass("mono");
    const message = screen.getByText(/término vago/);
    expect(message.closest(".prose")).not.toBeNull();
  });

  it("puntaje 95 con un bloqueante muestra la alerta crítica sobre el puntaje", async () => {
    setup({ analysis: makeAnalysis({ score: 95 }) });
    const score = await screen.findByLabelText("Puntaje 95 de 100");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/bloqueante/i);
    expect(
      alert.compareDocumentPosition(score) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // es la única caja: los hallazgos no son notices
    expect(document.querySelectorAll(".notice")).toHaveLength(1);
  });

  it("sin bloqueantes activos no hay alerta crítica", async () => {
    setup({
      analysis: makeAnalysis({ findings: [{ ...MAJOR }], score: 90 }),
    });
    await screen.findByLabelText("Puntaje 90 de 100");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("un análisis sin hallazgos lo dice", async () => {
    setup({ analysis: makeAnalysis({ findings: [], score: 100 }) });
    expect(
      await screen.findByText(/no se encontraron hallazgos/i),
    ).toBeInTheDocument();
  });

  it("el título largo y el HTML se muestran como texto sin romper el layout", async () => {
    const long = "x".repeat(20000);
    setup({
      story: makeStory({
        title: "<script>alert(1)</script>",
        description: long,
      }),
    });
    await screen.findByLabelText("Puntaje 60 de 100");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "<script>alert(1)</script>",
      }),
    ).toBeInTheDocument();
    const text = screen.getByText(long);
    expect(text).toHaveClass("wrap");
    expect(document.querySelector("script")).toBeNull();
  });

  it("sin análisis muestra un estado vacío con la acción Analizar", async () => {
    const { calls } = setup({ analysis: null });
    expect(
      await screen.findByText(/aún no tiene análisis/i),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Analizar" }));
    expect(await screen.findByLabelText("Puntaje 60 de 100")).toBeVisible();
    expect(req(calls, "POST", /\/analyses$/)?.body).toEqual({ use_ai: false });
  });

  it("una historia ajena al proyecto se trata como no encontrada", async () => {
    setup({ story: makeStory({ project_id: "otro" }) });
    expect(await screen.findByText("Recurso no encontrado")).toBeVisible();
  });
});

describe("AnalysisPage - decisiones", () => {
  it("descartar sin motivo no envía la petición", async () => {
    const { calls } = setup();
    await screen.findByLabelText("Puntaje 60 de 100");
    await userEvent.click(
      screen.getByRole("button", { name: "Descartar US-AMB-001" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar descarte" }),
    );
    expect(screen.getByText(/indica un motivo/i)).toBeInTheDocument();
    expect(req(calls, "PATCH", /findings/)).toBeUndefined();
  });

  it("descartar con motivo recalcula el puntaje y muestra el motivo", async () => {
    const { calls } = setup();
    await screen.findByLabelText("Puntaje 60 de 100");
    await userEvent.click(
      screen.getByRole("button", { name: "Descartar US-AMB-001" }),
    );
    await userEvent.type(
      screen.getByLabelText("Motivo del descarte"),
      "Lo aprobó el PO",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar descarte" }),
    );
    expect(await screen.findByLabelText("Puntaje 90 de 100")).toBeVisible();
    expect(
      screen.getByText("Motivo del descarte: Lo aprobó el PO"),
    ).toBeInTheDocument();
    expect(req(calls, "PATCH", /f-major/)?.body).toEqual({
      decision: "dismissed",
      dismiss_reason: "Lo aprobó el PO",
    });
  });

  it("aceptar y restablecer un hallazgo", async () => {
    const { calls } = setup();
    await screen.findByLabelText("Puntaje 60 de 100");
    await userEvent.click(
      screen.getByRole("button", { name: "Aceptar US-AMB-001" }),
    );
    expect(await screen.findByText(/Aceptado/)).toBeInTheDocument();
    expect(req(calls, "PATCH", /f-major/)?.body).toMatchObject({
      decision: "accepted",
    });
  });

  it("un visitante anónimo no ve acciones de decisión", async () => {
    setup({ anonymous: true });
    await screen.findByLabelText("Puntaje 60 de 100");
    expect(screen.queryByRole("button", { name: /Descartar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Aceptar/ })).toBeNull();
  });
});

describe("AnalysisPage - IA", () => {
  it("sin IA configurada deshabilita el botón, explica el motivo y Analizar sigue funcionando", async () => {
    const { calls } = setup({ aiConfigured: false });
    await screen.findByLabelText("Puntaje 60 de 100");
    const ai = await screen.findByRole("button", { name: "Analizar con IA" });
    await waitFor(() => expect(ai).toBeDisabled());
    expect(screen.getByText("La IA no está configurada.")).toBeVisible();
    const rules = screen.getByRole("button", { name: "Analizar" });
    expect(rules).toBeEnabled();
    await userEvent.click(rules);
    await waitFor(() =>
      expect(req(calls, "POST", /\/analyses$/)?.body).toEqual({
        use_ai: false,
      }),
    );
  });

  it("Analizar con IA envía use_ai y marca los hallazgos de IA", async () => {
    const { calls } = setup({
      created: makeAnalysis({
        score: 50,
        used_ai: true,
        ai_status: "ok",
        model_name: "gemini-test",
        findings: [{ ...BLOCKING }, { ...AI_FINDING }],
      }),
    });
    await screen.findByLabelText("Puntaje 60 de 100");
    const ai = screen.getByRole("button", { name: "Analizar con IA" });
    await waitFor(() => expect(ai).toBeEnabled());
    await userEvent.click(ai);
    expect(await screen.findByLabelText("Puntaje 50 de 100")).toBeVisible();
    expect(screen.getByText("IA · 85%")).toBeInTheDocument();
    expect(screen.getByText(/gemini-test/)).toBeInTheDocument();
    expect(req(calls, "POST", /\/analyses$/)?.body).toEqual({ use_ai: true });
  });

  it.each([
    ["unavailable", /La IA no pudo participar \(.*servicio/i],
    ["invalid_response", /La IA no pudo participar \(.*respuesta inválida/i],
  ] as const)(
    "con ai_status %s avisa y conserva los hallazgos por reglas",
    async (status, notice) => {
      setup({ analysis: makeAnalysis({ ai_status: status }) });
      expect(await screen.findByText(notice)).toBeInTheDocument();
      expect(screen.getByText(/término vago/)).toBeInTheDocument();
      expect(screen.getByText(/no tiene criterios/)).toBeInTheDocument();
    },
  );

  it("muestra las consultas de IA restantes cuando se conocen", async () => {
    setup({ quota: 7 });
    expect(await screen.findByText(/quedan 7 consultas de ia/i)).toBeVisible();
  });

  it("con cuota agotada deshabilita la IA y lo explica", async () => {
    setup({ quota: 0 });
    const ai = await screen.findByRole("button", { name: "Analizar con IA" });
    await waitFor(() => expect(ai).toBeDisabled());
    expect(screen.getByText(/sin consultas de ia/i)).toBeVisible();
  });

  it("anónimo: no puede analizar y ve el motivo", async () => {
    setup({ anonymous: true });
    await screen.findByLabelText("Puntaje 60 de 100");
    expect(screen.getByRole("button", { name: "Analizar" })).toBeDisabled();
    expect(screen.getByText("Inicia sesión para editar.")).toBeVisible();
  });
});

describe("AnalysisPage - cuota y fallos de IA", () => {
  const aiAnalysis = makeAnalysis({
    used_ai: true,
    ai_status: "ok",
    model_name: "gemini-test",
  });

  it("tras un análisis con IA actualiza las consultas restantes", async () => {
    setup({ quota: 5, quotaAfter: 4, created: aiAnalysis });
    expect(await screen.findByText(/quedan 5 consultas/i)).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Analizar con IA" }),
    );
    expect(await screen.findByText(/quedan 4 consultas/i)).toBeVisible();
  });

  it("si la cuota se agota a mitad, deshabilita la IA y las reglas siguen", async () => {
    const { calls } = setup({
      quota: 1,
      quotaAfter: 0,
      created: makeAnalysis({ ai_status: "unavailable" }),
    });
    await screen.findByText(/queda 1 consulta/i);
    await userEvent.click(
      screen.getByRole("button", { name: "Analizar con IA" }),
    );
    expect(await screen.findByText(/sin consultas de ia/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Analizar con IA" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analizar" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Analizar" }));
    await waitFor(() =>
      expect(
        calls.filter(
          (c) => c.method === "POST" && c.path.endsWith("/analyses"),
        ),
      ).toHaveLength(2),
    );
  });

  it("con /health caído y la IA no disponible, la deshabilita con motivo visible", async () => {
    setup({
      quota: 3,
      quotaAfter: "down",
      created: makeAnalysis({ ai_status: "unavailable" }),
    });
    await screen.findByText(/quedan 3 consultas/i);
    await userEvent.click(
      screen.getByRole("button", { name: "Analizar con IA" }),
    );
    expect(
      await screen.findByText(/la ia no está disponible ahora/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Analizar con IA" }),
    ).toBeDisabled();
  });

  it.each([429, 403])(
    "si crear el análisis falla con %s muestra el mensaje y conserva el análisis",
    async (status) => {
      setup({ createStatus: status });
      await screen.findByLabelText("Puntaje 60 de 100");
      await userEvent.click(screen.getByRole("button", { name: "Analizar" }));
      const alert = await screen.findByText("Límite de análisis alcanzado");
      expect(alert).toHaveAttribute("role", "alert");
      expect(alert).not.toHaveClass("notice");
      expect(screen.getByLabelText("Puntaje 60 de 100")).toBeVisible();
      expect(screen.getByRole("button", { name: "Analizar" })).toBeEnabled();
    },
  );

  it("un ai_status desconocido avisa con motivo desconocido", async () => {
    setup({ analysis: makeAnalysis({ ai_status: "otro" as never }) });
    expect(
      await screen.findByText(
        /La IA no pudo participar \(motivo desconocido\)/,
      ),
    ).toBeVisible();
  });

  it("un fallo al descartar se muestra junto al hallazgo sin caja", async () => {
    setup();
    await screen.findByLabelText("Puntaje 60 de 100");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ detail: "Sin permiso para decidir" }, 403)),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Aceptar US-AMB-001" }),
    );
    const alert = await screen.findByText("Sin permiso para decidir");
    expect(alert.closest("li")).not.toBeNull();
    expect(document.querySelectorAll(".notice")).toHaveLength(1); // solo la crítica
  });
});

describe("AnalysisPage - eliminar historia", () => {
  it("pide confirmación, elimina y vuelve al listado", async () => {
    const { calls } = setup();
    await screen.findByLabelText("Puntaje 60 de 100");
    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar historia" }),
    );
    expect(req(calls, "DELETE", /s1/)).toBeUndefined();
    await userEvent.click(
      screen.getByRole("button", { name: "Sí, eliminar historia" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent("/p/p1/stories"),
    );
    expect(screen.getByTestId("where").textContent).not.toMatch(/s1/);
    expect(req(calls, "DELETE", /s1/)).toBeDefined();
  });

  it("cancelar no elimina y devuelve el foco al botón", async () => {
    const { calls } = setup();
    await screen.findByLabelText("Puntaje 60 de 100");
    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar historia" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(req(calls, "DELETE", /s1/)).toBeUndefined();
    expect(
      screen.getByRole("button", { name: "Eliminar historia" }),
    ).toHaveFocus();
  });

  it("muestra el detalle de un 403", async () => {
    setup({ deleteStatus: 403 });
    await screen.findByLabelText("Puntaje 60 de 100");
    await userEvent.click(
      screen.getByRole("button", { name: "Eliminar historia" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Sí, eliminar historia" }),
    );
    expect(
      await screen.findByText("No tienes permiso para eliminar"),
    ).toBeVisible();
    expect(screen.getByTestId("where")).toHaveTextContent("/analysis");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Eliminar historia" }),
      ).toHaveFocus(),
    );
    expect(document.querySelectorAll(".notice")).toHaveLength(1);
  });

  it.each([
    ["anónimo", { anonymous: true }],
    ["demostración", { demo: true }],
  ])("se oculta para %s", async (_name, options) => {
    setup(options);
    await screen.findByLabelText("Puntaje 60 de 100");
    expect(
      screen.queryByRole("button", { name: "Eliminar historia" }),
    ).toBeNull();
  });
});

describe("AnalysisPage - accesibilidad", () => {
  it("no tiene violaciones axe con resultado, alerta y formulario de descarte", async () => {
    const { view } = setup({ analysis: makeAnalysis({ score: 95 }) });
    await screen.findByLabelText("Puntaje 95 de 100");
    await userEvent.click(
      screen.getByRole("button", { name: "Descartar US-AMB-001" }),
    );
    const results = await axe(view.container);
    expect(results).toHaveNoViolations();
    expect(
      within(view.container).getByLabelText("Motivo del descarte"),
    ).toBeVisible();
  });

  it("el estado vacío no tiene violaciones axe", async () => {
    const { view } = setup({ analysis: null });
    await screen.findByText(/aún no tiene análisis/i);
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
