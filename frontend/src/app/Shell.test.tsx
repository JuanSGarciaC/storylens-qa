import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { makeProject } from "../test/fakeApi";
import { RouteError } from "./NotFound";
import { Shell } from "./Shell";
import { RootLayout, routes } from "./routes";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function stubApi(opts: { me?: unknown; health?: unknown } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/health")) {
        return json(
          opts.health ?? {
            status: "ok",
            ai_configured: true,
            ai_quota_remaining_today: 7,
          },
        );
      }
      if (url.endsWith("/auth/me")) {
        return json(
          opts.me ?? { authenticated: true, email: "qa@ejemplo.com" },
        );
      }
      if (url.endsWith("/stories/s1") || url.endsWith("/stories/s2")) {
        const own = url.endsWith("/s1");
        return json({
          id: own ? "s1" : "s2",
          project_id: own ? "x" : "y",
          title: own ? "Historia propia" : "Historia ajena",
        });
      }
      if (url.endsWith("/projects/x")) {
        return json(makeProject({ id: "x", name: "Proyecto X" }));
      }
      if (url.endsWith("/projects")) {
        return json([
          makeProject({ id: "x", name: "Proyecto X" }),
          makeProject({ id: "y", name: "Proyecto Y" }),
        ]);
      }
      return json({ detail: "No encontrado" }, 404);
    }),
  );
}

function stubWidth(narrow: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: narrow,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

function renderAt(path: string, customRoutes = routes) {
  const router = createMemoryRouter(customRoutes, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

afterEach(() => vi.unstubAllGlobals());

describe("Shell", () => {
  it("muestra los módulos, los próximos deshabilitados y el estado de IA", async () => {
    stubApi();
    stubWidth(false);
    renderAt("/p/x");
    const nav = await screen.findByRole("navigation", { name: "Módulos" });
    expect(
      within(nav).getByRole("link", { name: /Historias/ }),
    ).toHaveAttribute("href", "/p/x/stories");
    expect(within(nav).getByRole("link", { name: /Informes/ })).toHaveAttribute(
      "href",
      "/p/x/reports",
    );
    const soon = within(nav).getAllByText("Próximamente");
    expect(soon).toHaveLength(3);
    expect(
      within(nav).queryByRole("link", { name: /Análisis transversal/ }),
    ).toBeNull();
    expect(await screen.findByText(/7 consultas de IA hoy/)).toBeVisible();
    expect(screen.getByText(/qa@ejemplo.com/)).toBeVisible();
  });

  it("proyecto inexistente (404) muestra NotFound con enlace de vuelta", async () => {
    stubApi();
    stubWidth(false);
    renderAt("/p/zzz");
    expect(
      await screen.findByRole("heading", { name: /no encontrado/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Volver a proyectos" }),
    ).toHaveAttribute("href", "/");
  });

  it("historia que no pertenece al proyecto (404) muestra NotFound", async () => {
    stubApi();
    stubWidth(false);
    function Boom(): never {
      throw new ApiError("Historia no encontrada", 404);
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderAt("/p/x/stories/s9/analysis", [
      {
        element: <RootLayout />,
        children: [
          {
            element: <Shell />,
            children: [
              {
                errorElement: <RouteError />,
                children: [
                  {
                    path: "p/:projectId/stories/:storyId/analysis",
                    element: <Boom />,
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    expect(
      await screen.findByRole("link", { name: "Volver a proyectos" }),
    ).toBeVisible();
  });

  it("Ctrl+K abre la paleta, filtra y Enter navega; Esc devuelve el foco", async () => {
    stubApi();
    stubWidth(false);
    const user = userEvent.setup();
    const { router } = renderAt("/p/x");
    const opener = await screen.findByRole("button", { name: /Buscar/ });
    opener.focus();
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const input = within(dialog).getByRole("combobox");
    expect(input).toHaveFocus();
    await user.type(input, "informes");
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/p/x/reports"),
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    opener.focus();
    await user.keyboard("{Control>}k{/Control}");
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("la paleta atrapa el foco y navega con flechas", async () => {
    stubApi();
    stubWidth(false);
    const user = userEvent.setup();
    const { router } = renderAt("/p/x");
    await screen.findByRole("navigation", { name: "Módulos" });
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog");
    await user.tab();
    await user.tab();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    await user.keyboard("{Control>}k{/Control}");
    await screen.findByRole("dialog");
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() =>
      expect(router.state.location.pathname).not.toBe("/p/x"),
    );
  });

  it("por debajo de 768 px la barra lateral se colapsa a un botón Menú", async () => {
    stubApi();
    stubWidth(true);
    const user = userEvent.setup();
    renderAt("/p/x");
    const menu = await screen.findByRole("button", { name: "Menú" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Módulos" })).toBeNull();
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Módulos" })).toBeVisible();
  });

  it("no tiene violaciones de axe", async () => {
    stubApi();
    stubWidth(false);
    const { container } = renderAt("/p/x");
    await screen.findByRole("navigation", { name: "Módulos" });
    await screen.findByText(/7 consultas de IA hoy/);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("una historia propia se carga; una ajena o inexistente da el mismo NotFound", async () => {
    stubApi();
    stubWidth(false);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const own = renderAt("/p/x/stories/s1/tests");
    expect(await screen.findByText(/Historia propia/)).toBeVisible();
    own.unmount();

    for (const id of ["s2", "nope"]) {
      const view = renderAt(`/p/x/stories/${id}/tests`);
      expect(
        await screen.findByRole("heading", { name: "Recurso no encontrado" }),
      ).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Volver a proyectos" }),
      ).toBeVisible();
      view.unmount();
    }
  });

  it("Esc cierra el menú móvil y devuelve el foco a Menú", async () => {
    stubApi();
    stubWidth(true);
    const user = userEvent.setup();
    renderAt("/p/x");
    const menu = await screen.findByRole("button", { name: "Menú" });
    await user.click(menu);
    const link = await screen.findByRole("link", { name: /Historias/ });
    link.focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Módulos" })).toBeNull();
    expect(menu).toHaveFocus();
  });

  it("al navegar desde el menú móvil el foco pasa al contenido", async () => {
    stubApi();
    stubWidth(true);
    const user = userEvent.setup();
    const { router } = renderAt("/p/x");
    await user.click(await screen.findByRole("button", { name: "Menú" }));
    await user.click(await screen.findByRole("link", { name: /Informes/ }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/p/x/reports"),
    );
    expect(document.getElementById("contenido")).toHaveFocus();
    expect(screen.queryByRole("navigation", { name: "Módulos" })).toBeNull();
  });

  it("con proyecto inexistente no hay enlaces de proyecto y el título se actualiza", async () => {
    stubApi();
    stubWidth(false);
    renderAt("/p/zzz");
    await screen.findByRole("heading", { name: "Proyecto no encontrado" });
    const nav = screen.getByRole("navigation", { name: "Módulos" });
    expect(within(nav).queryByRole("link", { name: /Informes/ })).toBeNull();
    expect(within(nav).queryByText("Configuración")).toBeNull();
  });

  it("el título del documento incluye pantalla y proyecto", async () => {
    stubApi();
    stubWidth(false);
    renderAt("/p/x/reports");
    await waitFor(() =>
      expect(document.title).toBe("Informes · Proyecto X · StoryLens"),
    );
  });

  it("Home/End mueven la selección de la paleta", async () => {
    stubApi();
    stubWidth(false);
    const user = userEvent.setup();
    const { router } = renderAt("/p/x");
    await screen.findByRole("navigation", { name: "Módulos" });
    await user.keyboard("{Control>}k{/Control}");
    await screen.findByRole("dialog");
    await user.keyboard("{End}");
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{Home}{Enter}");
    await waitFor(() => expect(router.state.location.pathname).toBe("/p/x"));
  });
});
