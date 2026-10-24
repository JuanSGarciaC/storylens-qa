import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeNamed, makeProject } from "../../test/fakeApi";
import { RootLayout, routes } from "../../app/routes";
import { json, renderPage, stubFetch } from "../../test/renderPage";
import type { Handler } from "../../test/renderPage";
import { SettingsPage } from "./SettingsPage";

afterEach(() => vi.unstubAllGlobals());

const RULES = [
  {
    id: "US-AC-001",
    name: "Criterios presentes",
    reference: "3C",
    type: "structure",
    severity: "blocking",
    description: "Debe haber criterios",
  },
  {
    id: "US-AMB-001",
    name: "Términos vagos",
    reference: "29148",
    type: "language",
    severity: "major",
    description: "Evita vaguedad",
  },
];

function setup(opts: { demo?: boolean; handler?: Handler } = {}) {
  const project = makeProject({ is_demo: opts.demo ?? false });
  const calls = stubFetch({
    handler: (call) => {
      const custom = opts.handler?.(call);
      if (custom) return custom;
      if (call.method === "GET") {
        if (call.path === "/projects/p1") return json(project);
        if (call.path === "/projects") return json([project]);
        if (call.path === "/rules") return json(RULES);
        if (call.path === "/projects/p1/epics") {
          return json([makeNamed("Pagos")]);
        }
        if (call.path === "/projects/p1/versions") return json([]);
      }
      return undefined;
    },
  });
  const view = renderPage(<SettingsPage />, { entry: "/p/p1/settings" });
  return { calls, view };
}

describe("SettingsPage", () => {
  it("guarda reglas desactivadas y umbrales", async () => {
    const { calls } = setup({
      handler: (call) =>
        call.method === "PATCH" ? json(makeProject()) : undefined,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("checkbox", { name: /Términos vagos/ }),
    );
    const low = screen.getByLabelText("No lista por debajo de");
    await user.clear(low);
    await user.type(low, "50");
    await user.click(screen.getByRole("button", { name: "Guardar reglas" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        settings: {
          disabled_rules: ["US-AMB-001"],
          penalties: null,
          not_ready_below: 50,
          ready_from: 85,
        },
      }),
    );
  });

  it("rechaza umbrales incoherentes sin llamar al servidor", async () => {
    const { calls } = setup();
    const user = userEvent.setup();
    await screen.findByRole("checkbox", { name: /Términos vagos/ });
    const low = screen.getByLabelText("No lista por debajo de");
    await user.clear(low);
    await user.type(low, "90");
    await user.click(screen.getByRole("button", { name: "Guardar reglas" }));
    expect(await screen.findByText(/menor que/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("muestra el detalle del 403 al guardar", async () => {
    setup({
      handler: (call) =>
        call.method === "PATCH"
          ? json(
              { detail: "Solo el dueño puede cambiar la configuración" },
              403,
            )
          : undefined,
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Guardar reglas" }),
    );
    expect(
      await screen.findByText("Solo el dueño puede cambiar la configuración"),
    ).toBeInTheDocument();
  });

  it("demo: todo deshabilitado con el motivo accesible", async () => {
    const { view } = setup({ demo: true });
    await screen.findByRole("checkbox", { name: /Términos vagos/ });
    const reason =
      "Estás viendo el proyecto de demostración: es de solo lectura.";
    for (const name of [
      "Guardar reglas",
      "Guardar datos",
      "Agregar épica",
      "Agregar versión",
      "Eliminar proyecto",
    ]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(reason);
    }
    expect(
      screen.getByRole("checkbox", { name: /Términos vagos/ }),
    ).toBeDisabled();
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("borrar exige escribir el nombre del proyecto", async () => {
    const { calls } = setup({
      handler: (call) =>
        call.method === "DELETE"
          ? new Response(null, { status: 204 })
          : undefined,
    });
    const user = userEvent.setup();
    const remove = await screen.findByRole("button", {
      name: "Eliminar proyecto",
    });
    expect(remove).toBeDisabled();
    const confirm = screen.getByLabelText(/Escribe «Banca móvil»/);
    await user.type(confirm, "Banca");
    expect(remove).toBeDisabled();
    await user.type(confirm, " móvil");
    expect(remove).toBeEnabled();
    await user.click(remove);
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "DELETE" && c.path === "/projects/p1"),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe("/"),
    );
  });

  it("agrega una épica", async () => {
    const { calls } = setup({
      handler: (call) =>
        call.method === "POST" ? json(makeNamed("Nueva"), 201) : undefined,
    });
    const user = userEvent.setup();
    expect(await screen.findByText("Pagos")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nueva épica"), "Nueva");
    await user.click(screen.getByRole("button", { name: "Agregar épica" }));
    await waitFor(() =>
      expect(
        calls.find(
          (c) => c.path === "/projects/p1/epics" && c.method === "POST",
        )?.body,
      ).toEqual({ name: "Nueva" }),
    );
  });

  it("rechaza umbrales vacíos sin llamar al servidor", async () => {
    const { calls } = setup();
    const user = userEvent.setup();
    await screen.findByRole("checkbox", { name: /Términos vagos/ });
    await user.clear(screen.getByLabelText("No lista por debajo de"));
    await user.click(screen.getByRole("button", { name: "Guardar reglas" }));
    expect(await screen.findByText(/menor que/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("dentro del Shell real, la confirmación sobrevive al guardado sin remontar", async () => {
    const saved = makeProject({
      settings: {
        disabled_rules: [],
        penalties: null,
        not_ready_below: 50,
        ready_from: 85,
      },
    });
    stubFetch({
      handler: (call) => {
        if (call.method === "PATCH") return json(saved);
        if (call.path === "/projects/p1") return json(makeProject());
        if (call.path === "/projects") return json([makeProject()]);
        if (call.path === "/rules") return json(RULES);
        if (call.path.endsWith("/epics") || call.path.endsWith("/versions")) {
          return json([]);
        }
        return undefined;
      },
    });
    const router = createMemoryRouter(
      [{ element: <RootLayout />, children: routes[0].children }],
      { initialEntries: ["/p/p1/settings"] },
    );
    render(<RouterProvider router={router} />);
    const user = userEvent.setup();
    const low = await screen.findByLabelText("No lista por debajo de");
    await screen.findByRole("checkbox", { name: /Términos vagos/ });
    await user.clear(low);
    await user.type(low, "50");
    await user.click(screen.getByRole("button", { name: "Guardar reglas" }));
    expect(
      await screen.findByText("Reglas y umbrales guardados."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("No lista por debajo de")).toBe(low);
    expect(screen.queryByText("Cargando proyecto…")).not.toBeInTheDocument();
  });
});
