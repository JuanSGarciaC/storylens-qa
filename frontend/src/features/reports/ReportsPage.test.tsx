import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditEvent, StoryItem } from "../../api/client";
import { makeAuditEvent, makeMe, makeProject } from "../../test/fakeApi";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import { ReportsPage } from "./ReportsPage";

afterEach(() => vi.unstubAllGlobals());

function story(n: number, analyzed = true): StoryItem {
  return {
    id: `s-${n}`,
    project_id: "p1",
    title: `Historia ${n}`,
    description: "Como usuario quiero algo",
    notes: "",
    acceptance_criteria: [],
    created_at: "2026-10-23T12:00:00Z",
    latest_analysis: analyzed
      ? ({
          id: `a-${n}`,
          created_at: "2026-10-23T12:00:00Z",
          score: 80,
          verdict: "ready_with_notes",
        } as StoryItem["latest_analysis"])
      : null,
  };
}

const SESSION = {
  id: "qs1",
  story_id: "s-1",
  environment_name: "Staging",
  environment_url: "https://qa.example.com",
  build_version: "1.0",
  tester_name: "Ana",
  started_at: "2026-10-23T12:00:00Z",
  closed_at: null,
  recommendation: null,
  summary: "",
};

function setup(
  options: {
    stories?: StoryItem[];
    audit?: AuditEvent[] | number;
    anonymous?: boolean;
    demo?: boolean;
  } = {},
) {
  const project = makeProject({ is_demo: options.demo ?? false });
  const calls = stubFetch({
    me: options.anonymous ? { authenticated: false } : makeMe(),
    handler: ({ path }) => {
      if (path === "/projects/p1") return json(project);
      if (path === "/projects") return json([project]);
      if (path === "/projects/p1/stories") {
        return json(options.stories ?? [story(1), story(2, false)]);
      }
      if (path === "/stories/s-1/qa-sessions") return json([SESSION]);
      if (path.startsWith("/projects/p1/audit")) {
        const audit = options.audit ?? [];
        if (typeof audit === "number") {
          return json(
            { detail: "Solo el dueño puede ver la auditoría" },
            audit,
          );
        }
        const offset = Number(
          new URL(path, "http://x").searchParams.get("offset"),
        );
        return json(audit.slice(offset, offset + 50));
      }
      return undefined;
    },
  });
  const view = renderPage(<ReportsPage />, { entry: "/p/p1" });
  return { view, calls };
}

const auditCalls = (calls: { path: string }[]) =>
  calls.filter((c) => c.path.includes("/audit"));

describe("ReportsPage", () => {
  it("enlaza los informes de análisis en md y pdf con la URL exacta", async () => {
    setup();
    const md = await screen.findByRole("link", {
      name: /Historia 1.*Markdown/,
    });
    expect(md).toHaveAttribute("href", "/api/v1/analyses/a-1/report?format=md");
    expect(
      screen.getByRole("link", { name: /Historia 1.*PDF/ }),
    ).toHaveAttribute("href", "/api/v1/analyses/a-1/report?format=pdf");
    expect(screen.queryByRole("link", { name: /Historia 2/ })).toBeNull();
  });

  it("carga las sesiones solo al elegir una historia y enlaza su informe", async () => {
    const { calls } = setup();
    await screen.findByRole("link", { name: /Historia 1.*PDF/ });
    expect(calls.some((c) => c.path.includes("qa-sessions"))).toBe(false);
    await userEvent.selectOptions(
      screen.getByLabelText("Historia con sesiones"),
      "s-1",
    );
    expect(
      await screen.findByRole("link", { name: /Staging.*Markdown/ }),
    ).toHaveAttribute("href", "/api/v1/qa-sessions/qs1/report?format=md");
    expect(screen.getByRole("link", { name: /Staging.*PDF/ })).toHaveAttribute(
      "href",
      "/api/v1/qa-sessions/qs1/report?format=pdf",
    );
    expect(calls.filter((c) => c.path.includes("qa-sessions"))).toHaveLength(1);
  });

  it("con 500 historias pinta 50, muestra más y el filtro halla una", async () => {
    setup({ stories: Array.from({ length: 500 }, (_, i) => story(i + 1)) });
    await screen.findByRole("link", { name: /Historia 1 .*PDF/ });
    const items = () =>
      within(
        screen.getByRole("list", { name: "Informes de análisis" }),
      ).getAllByRole("listitem");
    expect(items()).toHaveLength(50);
    await userEvent.click(screen.getByRole("button", { name: "Mostrar más" }));
    expect(items()).toHaveLength(100);
    await userEvent.type(screen.getByRole("searchbox"), "Historia 500");
    expect(items()).toHaveLength(1);
  });

  it("auditoría vacía muestra un estado vacío", async () => {
    setup({ audit: [] });
    expect(await screen.findByText("Sin eventos de auditoría")).toBeVisible();
  });

  it("lista la auditoría con fecha es-ES, IDs en mono y carga más", async () => {
    const events = Array.from({ length: 60 }, (_, i) =>
      makeAuditEvent({ id: i + 1, entity_id: `ent-${i + 1}` }),
    );
    const { calls } = setup({ audit: events });
    const table = await screen.findByRole("table", { name: "Auditoría" });
    expect(within(table).getAllByRole("row")).toHaveLength(51);
    expect(within(table).getAllByText(/23\/10\/2026/).length).toBeGreaterThan(
      0,
    );
    expect(within(table).getByText("ent-1")).toHaveClass("mono");
    await userEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    expect(await within(table).findByText("ent-60")).toBeVisible();
    expect(auditCalls(calls).map((c) => c.path)).toEqual([
      "/projects/p1/audit?limit=50&offset=0",
      "/projects/p1/audit?limit=50&offset=50",
    ]);
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("anónimo no ve ni pide la auditoría pero sí los informes", async () => {
    const { calls } = setup({ anonymous: true, demo: true, audit: [] });
    expect(
      await screen.findByRole("link", { name: /Historia 1.*PDF/ }),
    ).toBeVisible();
    expect(screen.queryByText("Auditoría")).toBeNull();
    expect(auditCalls(calls)).toHaveLength(0);
  });

  it("un 403 de la auditoría se avisa en línea sin romper el resto", async () => {
    setup({ audit: 403 });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Solo el dueño puede ver la auditoría",
    );
    expect(screen.getByRole("link", { name: /Historia 1.*PDF/ })).toBeVisible();
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { view } = setup({ audit: [makeAuditEvent()] });
    await screen.findByRole("table", { name: "Auditoría" });
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
