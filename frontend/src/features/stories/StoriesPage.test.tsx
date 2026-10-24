import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoryItem } from "../../api/client";
import { makeMe, makeNamed, makeProject } from "../../test/fakeApi";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import type { Handler } from "../../test/renderPage";
import { StoriesPage } from "./StoriesPage";

afterEach(() => vi.unstubAllGlobals());

function story(n: number, overrides: Partial<StoryItem> = {}): StoryItem {
  return {
    id: `s-${n}`,
    project_id: "p1",
    title: `Historia ${n}`,
    description: "Como usuario quiero algo",
    notes: "",
    acceptance_criteria: [],
    created_at: "2026-10-23T12:00:00Z",
    latest_analysis: null,
    ...overrides,
  };
}

function analyzed(score: number, verdict: string) {
  return {
    id: `a-${score}`,
    created_at: "2026-10-23T12:00:00Z",
    score,
    verdict,
  } as StoryItem["latest_analysis"];
}

function setup(
  stories: StoryItem[],
  options: { demo?: boolean; anonymous?: boolean; extra?: Handler } = {},
) {
  const project = makeProject({ is_demo: options.demo ?? false });
  const calls = stubFetch({
    me: options.anonymous ? { authenticated: false } : makeMe(),
    handler: (call) => {
      const { path } = call;
      if (path === "/projects/p1") return json(project);
      if (path === "/projects") return json([project]);
      if (path === "/projects/p1/stories" && call.method === "GET") {
        return json(stories);
      }
      if (path === "/projects/p1/epics") return json([makeNamed("Pagos")]);
      if (path === "/projects/p1/versions") return json([makeNamed("v1")]);
      return options.extra?.(call);
    },
  });
  const view = renderPage(<StoriesPage />, { entry: "/p/p1" });
  return { view, calls };
}

const rows = () => screen.getAllByRole("row").slice(1);

describe("StoriesPage", () => {
  it("con 500 historias pinta 50 filas, muestra más y el filtro halla la última", async () => {
    const all = Array.from({ length: 500 }, (_, i) => story(i + 1));
    setup(all);
    await screen.findByRole("table");
    expect(rows()).toHaveLength(50);
    await userEvent.click(screen.getByRole("button", { name: "Mostrar más" }));
    expect(rows()).toHaveLength(100);
    await userEvent.type(screen.getByRole("searchbox"), "Historia 500");
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Historia 500" })).toHaveAttribute(
      "href",
      "/p/p1/stories/s-500/analysis",
    );
  });

  it("tras «Mostrar más» el foco pasa a la primera fila nueva y se anuncia", async () => {
    setup(Array.from({ length: 60 }, (_, i) => story(i + 1)));
    await screen.findByRole("table");
    const more = screen.getByRole("button", { name: "Mostrar más" });
    await userEvent.click(more);
    expect(
      screen.queryByRole("button", { name: "Mostrar más" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Historia 51" })).toHaveFocus();
    const hint = screen.getByText("Mostrando 60 de 60.");
    expect(hint).toHaveAttribute("aria-live", "polite");
  });

  it("un título largo sin espacios no rompe la tabla", async () => {
    const { view } = setup([story(1, { title: "x".repeat(500) })]);
    const link = await screen.findByRole("link", { name: "x".repeat(500) });
    expect(link.closest("td")).toHaveClass("table__title");
    expect(view.container.querySelectorAll("th")).toHaveLength(6);
  });

  it("sin coincidencias ofrece limpiar filtros", async () => {
    setup([story(1), story(2)]);
    await screen.findByRole("table");
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("Ninguna historia coincide")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Limpiar filtros" }),
    );
    expect(rows()).toHaveLength(2);
  });

  it("filtra por épica, versión y estado y ordena por puntaje", async () => {
    setup([
      story(1, {
        epic_id: "n-Pagos",
        latest_analysis: analyzed(40, "not_ready"),
      }),
      story(2, { version_id: "n-v1", latest_analysis: analyzed(95, "ready") }),
      story(3, { latest_analysis: analyzed(70, "ready_with_notes") }),
      story(4),
    ]);
    await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByLabelText("Épica"), "n-Pagos");
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("Historia 1")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Épica"), "");
    await userEvent.selectOptions(screen.getByLabelText("Versión"), "n-v1");
    expect(rows()).toHaveLength(1);
    await userEvent.selectOptions(screen.getByLabelText("Versión"), "");
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "notes");
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("Historia 3")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "");
    await userEvent.selectOptions(screen.getByLabelText("Orden"), "score-desc");
    expect(rows().map((r) => within(r).getByRole("link").textContent)).toEqual([
      "Historia 2",
      "Historia 3",
      "Historia 1",
      "Historia 4",
    ]);
  });

  it("un título con HTML se muestra como texto", async () => {
    const { view } = setup([story(1, { title: "<script>alert(1)</script>" })]);
    expect(
      await screen.findByText("<script>alert(1)</script>"),
    ).toBeInTheDocument();
    expect(view.container.querySelector("script")).toBeNull();
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("anónimo no ve alta ni importación y ve el motivo", async () => {
    setup([story(1)], { anonymous: true });
    await screen.findByRole("table");
    expect(screen.queryByText(/Importar historias/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Crear historia" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Inicia sesión para editar.")).toBeInTheDocument();
  });

  it("proyecto demo no permite escribir", async () => {
    setup([story(1)], { demo: true });
    await screen.findByRole("table");
    expect(screen.queryByText(/Importar historias/)).not.toBeInTheDocument();
    expect(screen.getByText(/solo lectura/)).toBeInTheDocument();
  });

  it("proyecto vacío muestra EmptyState con las acciones", async () => {
    setup([]);
    expect(await screen.findByText("Aún no hay historias")).toBeInTheDocument();
    expect(screen.getByText(/Importar historias/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear historia" }),
    ).toBeInTheDocument();
  });

  it("crea una historia y la lista", async () => {
    const created = story(9, { title: "Nueva" });
    const { calls } = setup([], {
      extra: ({ method, path }) =>
        method === "POST" && path === "/projects/p1/stories"
          ? json(created, 201)
          : undefined,
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Crear historia" }),
    );
    await userEvent.type(screen.getByLabelText("Título"), "Nueva");
    await userEvent.type(screen.getByLabelText("Descripción"), "Como yo");
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar historia" }),
    );
    expect(
      await screen.findByRole("link", { name: "Nueva" }),
    ).toBeInTheDocument();
    const post = calls.find((c) => c.method === "POST");
    expect(post?.body).toMatchObject({
      title: "Nueva",
      description: "Como yo",
    });
  });

  it("importa un CSV con una fila inválida y confirma solo las válidas", async () => {
    const preview = {
      format: "csv",
      headers: ["Summary", "Description"],
      mapping: { title: "Summary", description: "Description" },
      truncated: false,
      rows: [
        {
          index: 1,
          key: "B-1",
          title: "Retirar",
          description: "Como cliente",
          acceptance_criteria: [],
          issues: [],
          duplicate: false,
          importable: true,
        },
        {
          index: 2,
          key: "B-2",
          title: "Vacía",
          description: "",
          acceptance_criteria: [],
          issues: ["Sin descripción"],
          duplicate: false,
          importable: false,
        },
      ],
    };
    const { calls } = setup([], {
      extra: ({ method, path }) => {
        if (path === "/projects/p1/stories/import") return json(preview);
        if (path === "/projects/p1/stories/import:confirm" && method === "POST")
          return json({ created: [story(1, { title: "Retirar" })] }, 201);
        return undefined;
      },
    });
    await userEvent.click(
      await screen.findByText("Importar historias desde Jira (CSV o JSON)"),
    );
    await userEvent.upload(
      screen.getByLabelText(/archivo de jira/i),
      new File(["a,b"], "j.csv", { type: "text/csv" }),
    );
    expect(
      await screen.findByText(/Sin descripción: no se puede importar/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 válida/)).toBeInTheDocument();
    expect(screen.getByText(/1 inválida/)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Importar fila 2" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Importar 1 historia" }),
    );
    await waitFor(() =>
      expect(calls.some((c) => c.path.endsWith("import:confirm"))).toBe(true),
    );
    expect(await screen.findByText("Se importó 1 historia.")).toBeVisible();
  });
});
