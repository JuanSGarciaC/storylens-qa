import { screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoryItem } from "../../api/client";
import { makeProject } from "../../test/fakeApi";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import { ProjectOverviewPage } from "./ProjectOverviewPage";

afterEach(() => vi.unstubAllGlobals());

function story(
  id: string,
  latest: { score: number; verdict: string } | null,
): StoryItem {
  return {
    id,
    project_id: "p1",
    title: id,
    description: "",
    notes: "",
    acceptance_criteria: [],
    created_at: "2026-10-23T12:00:00Z",
    latest_analysis: latest && {
      id: `a-${id}`,
      created_at: "2026-10-23T12:00:00Z",
      ...latest,
    },
  };
}

function setup(stories: StoryItem[]) {
  stubFetch({
    handler: ({ path }) => {
      if (path === "/projects/p1") return json(makeProject());
      if (path === "/projects") return json([makeProject()]);
      if (path === "/projects/p1/stories") return json(stories);
      return undefined;
    },
  });
  return renderPage(<ProjectOverviewPage />, { entry: "/p/p1" });
}

describe("ProjectOverviewPage", () => {
  it("3 historias: promedio exacto y el Ring suma 3", async () => {
    const view = setup([
      story("a", { score: 55, verdict: "not_ready" }),
      story("b", { score: 70, verdict: "ready_with_notes" }),
      story("c", { score: 90, verdict: "ready" }),
    ]);
    const figures = await screen.findByRole("group", { name: "Cifras" });
    expect(within(figures).getByText("71,7")).toBeInTheDocument();
    expect(within(figures).getByText("33 %")).toBeInTheDocument();
    const ring = screen.getByRole("img", { name: /Distribución/ });
    expect(ring.getAttribute("aria-label")).toBe(
      "Distribución: Sin analizar 0, Con bloqueantes 1, Aprobadas con observaciones 1, Listas 1",
    );
    expect(document.body.textContent).not.toMatch(/NaN/);
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("sin historias: EmptyState con acción, sin NaN ni 0 %", async () => {
    const view = setup([]);
    const link = await screen.findByRole("link", {
      name: "Importar historias",
    });
    expect(link).toHaveAttribute("href", "/p/p1/stories");
    expect(document.body.textContent).not.toMatch(/NaN|0 %/);
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("historias sin analizar: cifras con guion, nunca 0 %", async () => {
    setup([story("a", null)]);
    const figures = await screen.findByRole("group", { name: "Cifras" });
    expect(within(figures).getAllByText("—")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/NaN|0 %/);
  });
});
