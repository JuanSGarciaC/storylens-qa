import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeProject } from "../../test/fakeApi";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import type { Handler } from "../../test/renderPage";
import { ProjectsPage } from "./ProjectsPage";

const demo = makeProject({ id: "demo", name: "Proyecto demo", is_demo: true });
const own = makeProject({ id: "p1", name: "Banca móvil" });

afterEach(() => vi.unstubAllGlobals());

function setup(opts: { authenticated: boolean; handler?: Handler }) {
  const calls = stubFetch({
    me: opts.authenticated
      ? { authenticated: true, email: "dueno@example.com" }
      : { authenticated: false },
    handler: (call) => {
      const custom = opts.handler?.(call);
      if (custom) return custom;
      if (call.path === "/projects" && call.method === "GET") {
        return json(opts.authenticated ? [demo, own] : [demo]);
      }
      return undefined;
    },
  });
  const view = renderPage(<ProjectsPage />, { entry: "/" });
  return { calls, view };
}

describe("ProjectsPage", () => {
  it("lista el demo etiquetado «Demostración» y los proyectos propios", async () => {
    setup({ authenticated: true });
    expect(await screen.findByText("Banca móvil")).toBeInTheDocument();
    expect(screen.getByText("Demostración")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Proyecto demo/ })).toHaveAttribute(
      "href",
      "/p/demo",
    );
  });

  it("anónimo: sin formulario de alta y con el motivo", async () => {
    setup({ authenticated: false });
    await screen.findByText("Proyecto demo");
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Crear proyecto" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Inicia sesión para crear/)).toBeInTheDocument();
  });

  it("crea un proyecto con nombre, descripción y objetivo", async () => {
    const { calls } = setup({
      authenticated: true,
      handler: (call) =>
        call.method === "POST" && call.path === "/projects"
          ? json(makeProject({ id: "nuevo", name: "Nuevo" }), 201)
          : undefined,
    });
    const user = userEvent.setup();
    await screen.findByText("Banca móvil");
    await user.type(screen.getByLabelText("Nombre"), "Nuevo");
    await user.type(screen.getByLabelText("Descripción"), "Desc");
    await user.type(screen.getByLabelText("Objetivo"), "Meta");
    await user.click(screen.getByRole("button", { name: "Crear proyecto" }));
    await waitFor(() =>
      expect(
        calls.find((c) => c.method === "POST" && c.path === "/projects")?.body,
      ).toEqual({ name: "Nuevo", description: "Desc", objective: "Meta" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent("/p/nuevo"),
    );
  });

  it("muestra el detalle del 403 del servidor", async () => {
    setup({
      authenticated: true,
      handler: (call) =>
        call.method === "POST"
          ? json({ detail: "No tienes permiso para crear" }, 403)
          : undefined,
    });
    const user = userEvent.setup();
    await screen.findByText("Banca móvil");
    await user.type(screen.getByLabelText("Nombre"), "X");
    await user.click(screen.getByRole("button", { name: "Crear proyecto" }));
    expect(
      await screen.findByText("No tienes permiso para crear"),
    ).toBeInTheDocument();
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { view } = setup({ authenticated: true });
    await screen.findByText("Banca móvil");
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
