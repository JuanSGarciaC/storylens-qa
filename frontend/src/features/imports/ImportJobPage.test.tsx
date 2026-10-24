import { Component, type ReactNode } from "react";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportJobDetail } from "../../api/client";
import { makeMe, makeProject } from "../../test/fakeApi";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import type { Handler } from "../../test/renderPage";
import { ImportJobPage } from "./ImportJobPage";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>no encontrado</p> : this.props.children;
  }
}

function jobDetail(overrides: Partial<ImportJobDetail> = {}): ImportJobDetail {
  return {
    id: "j1",
    project_id: "p1",
    filename: "jira.csv",
    status: "running",
    use_ai: false,
    total: 4,
    processed: 1,
    done: 1,
    skipped: 0,
    failed: 0,
    pending: 3,
    note: "",
    created_at: "2026-10-24T12:00:00Z",
    updated_at: "2026-10-24T12:00:00Z",
    items: [
      {
        row_index: 1,
        key: "K-1",
        title: "Retirar efectivo",
        status: "done",
        story_id: "s1",
        error: "",
        ai_status: "not_requested",
      },
    ],
    items_total: 4,
    ...overrides,
  };
}

function setup(
  responses: (call: number) => Response | undefined,
  options: { demo?: boolean; anonymous?: boolean; extra?: Handler } = {},
) {
  let gets = 0;
  const project = makeProject({ is_demo: options.demo ?? false });
  const calls = stubFetch({
    me: options.anonymous ? { authenticated: false } : makeMe(),
    handler: (call) => {
      if (call.path === "/projects/p1") return json(project);
      if (call.path === "/projects") return json([project]);
      if (call.method === "GET" && call.path.startsWith("/import-jobs/j1")) {
        gets += 1;
        return responses(gets);
      }
      return options.extra?.(call);
    },
  });
  const view = renderPage(
    <Boundary>
      <ImportJobPage />
    </Boundary>,
    { entry: "/p/p1/imports/j1" },
  );
  return { calls, view, gets: () => gets };
}

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("ImportJobPage", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("muestra el avance, consulta sola y se detiene al terminar", async () => {
    const { gets } = setup((n) =>
      n === 1
        ? json(jobDetail())
        : json(
            jobDetail({
              status: "succeeded",
              processed: 4,
              done: 4,
              pending: 0,
            }),
          ),
    );
    expect(await screen.findByText("1 de 4 filas")).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
    await tick(2000);
    expect(await screen.findByText("4 de 4 filas")).toBeInTheDocument();
    expect(screen.getByText("Terminada")).toBeInTheDocument();
    const after = gets();
    await tick(20000);
    expect(gets()).toBe(after); // trabajo terminado: no se sigue consultando
  });

  it("con filas fallidas ofrece reintentar y reanuda la consulta", async () => {
    let retried = false;
    const { calls } = setup(
      () =>
        json(
          retried
            ? jobDetail({ status: "queued", failed: 0, pending: 1 })
            : jobDetail({
                status: "partial",
                processed: 4,
                done: 3,
                failed: 1,
                pending: 0,
              }),
        ),
      {
        extra: (call) => {
          if (call.method === "POST" && call.path === "/import-jobs/j1:retry") {
            retried = true;
            return json(jobDetail({ status: "queued" }), 200);
          }
          return undefined;
        },
      },
    );
    expect(await screen.findByText("Terminada con errores")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Reintentar filas fallidas o pendientes",
      }),
    );
    await waitFor(() =>
      expect(calls.some((c) => c.path === "/import-jobs/j1:retry")).toBe(true),
    );
    expect(await screen.findByText("En cola")).toBeVisible();
  });

  it("un trabajo activo se puede cancelar", async () => {
    const { calls } = setup(() => json(jobDetail()), {
      extra: (call) =>
        call.method === "POST" && call.path === "/import-jobs/j1:cancel"
          ? json(jobDetail({ status: "cancelled" }))
          : undefined,
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Cancelar importación" }),
    );
    await waitFor(() =>
      expect(calls.some((c) => c.path === "/import-jobs/j1:cancel")).toBe(true),
    );
  });

  it("anónimos y demo ven el avance pero no los botones de escritura", async () => {
    setup(() => json(jobDetail({ status: "partial", failed: 1, pending: 0 })), {
      demo: true,
    });
    expect(await screen.findByText("Terminada con errores")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Reintentar|Cancelar/ }),
    ).not.toBeInTheDocument();
  });

  it("si una consulta falla conserva lo mostrado, avisa y reintenta", async () => {
    const { gets } = setup((n) =>
      n === 2 ? json({ detail: "caído" }, 500) : json(jobDetail()),
    );
    expect(await screen.findByText("1 de 4 filas")).toBeInTheDocument();
    await tick(2000);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo actualizar el avance",
    );
    expect(screen.getByText("1 de 4 filas")).toBeInTheDocument();
    await tick(6000);
    await waitFor(() => expect(gets()).toBeGreaterThanOrEqual(3));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("una importación inexistente o de otro proyecto se trata como no encontrada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setup(() => json({ detail: "No encontrado" }, 404));
    expect(await screen.findByText("no encontrado")).toBeInTheDocument();
    vi.unstubAllGlobals();
    setup(() => json(jobDetail({ project_id: "otro" })));
    expect(await screen.findAllByText("no encontrado")).not.toHaveLength(0);
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { view } = setup(() =>
      json(jobDetail({ status: "succeeded", pending: 0 })),
    );
    await screen.findByText("Terminada");
    vi.useRealTimers();
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
