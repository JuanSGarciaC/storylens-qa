import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeSession, setupSessions } from "../../test/sessionApi";
import type { SessionOptions } from "../../test/sessionApi";
import { SessionsPage } from "./SessionsPage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ENTRY = "/p/p1/stories/s1/sessions";

function setup(options: SessionOptions = {}) {
  return setupSessions(<SessionsPage />, ENTRY, options);
}

async function fillAndStart() {
  await userEvent.type(await screen.findByLabelText("Ambiente"), "QA");
  await userEvent.type(
    screen.getByLabelText("URL del ambiente"),
    "https://qa.example.com",
  );
  await userEvent.type(screen.getByLabelText("Build / versión"), "1.4.2");
  await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

describe("SessionsPage", () => {
  it("sin sesiones muestra un estado vacío y el formulario", async () => {
    setup();
    expect(
      await screen.findByText("Esta historia aún no tiene sesiones"),
    ).toBeVisible();
    expect(screen.getByLabelText("Ambiente")).toBeEnabled();
  });

  it("lista las sesiones con estado y enlace al detalle", async () => {
    setup({
      sessions: [
        makeSession(),
        makeSession({
          id: "qs2",
          environment_name: "Staging",
          closed_at: "2026-10-23T12:00:00Z",
          recommendation: "reject",
        }),
      ],
    });
    const open = await screen.findByRole("link", { name: /^QA/ });
    expect(open).toHaveAttribute("href", "/p/p1/stories/s1/sessions/qs1");
    expect(screen.getByText("En curso")).toBeVisible();
    expect(screen.getByText("Cerrada")).toBeVisible();
    expect(screen.getByText("Rechazar la historia")).toHaveClass("badge");
  });

  it("crea la sesión y navega a su detalle", async () => {
    const { calls } = setup();
    await fillAndStart();
    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/p/p1/stories/s1/sessions/new1",
    );
    expect(
      calls.find((c) => c.method === "POST" && c.path.endsWith("/qa-sessions"))
        ?.body,
    ).toMatchObject({
      environment_name: "QA",
      environment_url: "https://qa.example.com",
      build_version: "1.4.2",
    });
  });

  it("explica por qué no se puede iniciar sin casos aceptados", async () => {
    setup({ acceptedCases: 0 });
    await fillAndStart();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no hay casos de prueba aceptados/i,
    );
    expect(screen.getByTestId("where")).toHaveTextContent(ENTRY);
  });

  it("rechaza una URL de ambiente que no sea http o https", async () => {
    const { calls } = setup();
    await userEvent.type(await screen.findByLabelText("Ambiente"), "QA");
    await userEvent.type(
      screen.getByLabelText("URL del ambiente"),
      "javascript:alert(1)",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Iniciar sesión" }),
    );
    expect(await screen.findByText(/http:\/\/ o https:\/\//)).toBeVisible();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("anónimo ve la lista sin formulario y con el motivo", async () => {
    setup({ anonymous: true, sessions: [makeSession()] });
    expect(await screen.findByText("Inicia sesión para editar.")).toBeVisible();
    expect(screen.queryByLabelText("Ambiente")).toBeNull();
    expect(screen.getByRole("link", { name: /^QA/ })).toBeVisible();
  });

  it("una historia ajena al proyecto se muestra como no encontrada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupSessions(<SessionsPage />, "/p/otro/stories/s1/sessions");
    expect(await screen.findByText("Recurso no encontrado")).toBeVisible();
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { view } = setup({ sessions: [makeSession()] });
    await screen.findByRole("link", { name: /^QA/ });
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
