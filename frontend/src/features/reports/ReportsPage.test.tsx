import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { useNavigate } from "react-router-dom";
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
    gate?: Promise<void>;
    auditFails?: number;
  } = {},
) {
  const project = makeProject({ is_demo: options.demo ?? false });
  const calls = stubFetch({
    me: options.anonymous ? { authenticated: false } : makeMe(),
    handler: ({ path }) => {
      if (path === "/projects/p1") return json(project);
      if (path === "/projects")
        return json([project, makeProject({ id: "p2", name: "Otro" })]);
      if (path === "/projects/p2")
        return json(makeProject({ id: "p2", name: "Otro" }));
      if (path === "/projects/p2/stories") return json([]);
      if (path.startsWith("/projects/p2/audit"))
        return json([makeAuditEvent({ id: 99, entity_id: "solo-p2" })]);
      if (path === "/projects/p1/stories") {
        return json(options.stories ?? [story(1), story(2, false)]);
      }
      if (path === "/stories/s-1/qa-sessions") return json([SESSION]);
      if (path.startsWith("/projects/p1/audit")) {
        if (options.auditFails) {
          options.auditFails -= 1;
          return json({ detail: "Fallo temporal" }, 500);
        }
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
  if (options.gate) {
    const inner = fetch as unknown as (
      u: string,
      i?: RequestInit,
    ) => Promise<Response>;
    vi.stubGlobal("fetch", (u: string, i?: RequestInit) =>
      u.includes("/audit")
        ? options.gate!.then(() => inner(u, i))
        : inner(u, i),
    );
  }
  function GoTo() {
    const go = useNavigate();
    return <button onClick={() => go("/p/p2")}>ir a p2</button>;
  }
  const view = renderPage(
    <>
      <GoTo />
      <ReportsPage />
    </>,
    { entry: "/p/p1" },
  );
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

  it("no muestra el estado vacío antes de que responda la auditoría", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let flashed = false;
    const watcher = new MutationObserver(() => {
      if (document.body.textContent?.includes("Sin eventos de auditoría")) {
        flashed = true;
      }
    });
    watcher.observe(document.body, { childList: true, subtree: true });
    setup({ audit: [], gate });
    await screen.findByRole("link", { name: /Historia 1.*PDF/ });
    expect(screen.getByText("Cargando auditoría…")).toBeVisible();
    expect(screen.queryByText("Sin eventos de auditoría")).toBeNull();
    expect(flashed).toBe(false);
    await act(async () => release());
    expect(await screen.findByText("Sin eventos de auditoría")).toBeVisible();
  });

  it("al cambiar de proyecto pide la auditoría del nuevo y descarta la anterior", async () => {
    const { calls } = setup({
      audit: [makeAuditEvent({ entity_id: "solo-p1" })],
    });
    await screen.findByText("solo-p1");
    await userEvent.click(screen.getByRole("button", { name: "ir a p2" }));
    expect(await screen.findByText("solo-p2")).toBeVisible();
    expect(screen.queryByText("solo-p1")).toBeNull();
    expect(auditCalls(calls).map((c) => c.path)).toContain(
      "/projects/p2/audit?limit=50&offset=0",
    );
  });

  it("un error de auditoría permite reintentar", async () => {
    setup({ audit: [makeAuditEvent()], auditFails: 1 });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Fallo temporal",
    );
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("table", { name: "Auditoría" }),
    ).toBeVisible();
  });

  it("distingue historias con el mismo título en el selector", async () => {
    setup({
      stories: [
        { ...story(1), title: "Igual", id: "aaaaaaaa-1" },
        { ...story(2), title: "Igual", id: "bbbbbbbb-2" },
      ],
    });
    expect(
      await screen.findByRole("option", { name: "Igual (aaaaaaaa)" }),
    ).toBeVisible();
    expect(
      screen.getByRole("option", { name: "Igual (bbbbbbbb)" }),
    ).toBeVisible();
  });

  it("no duplica filas si las páginas se solapan", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const events = Array.from({ length: 51 }, (_, i) =>
      makeAuditEvent({ id: i + 1, entity_id: `e-${i + 1}` }),
    );
    // La segunda página (offset 50) devuelve el evento 50 otra vez y el 51.
    setup({ audit: [...events.slice(0, 49), events[49], ...events.slice(49)] });
    await screen.findByRole("table", { name: "Auditoría" });
    await userEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText("e-51");
    expect(screen.getAllByText("e-50")).toHaveLength(1);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
