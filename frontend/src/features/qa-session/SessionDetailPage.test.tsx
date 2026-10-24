import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Call } from "../../test/renderPage";
import {
  CASE,
  makeExecution,
  makeSession,
  setupSessions,
} from "../../test/sessionApi";
import type { SessionOptions } from "../../test/sessionApi";
import { SessionDetailPage } from "./SessionDetailPage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ENTRY = "/p/p1/stories/s1/sessions/qs1";

function setup(options: SessionOptions = {}) {
  const sessions = options.sessions ?? (options.closed ? [] : [makeSession()]);
  const out = setupSessions(<SessionDetailPage />, ENTRY, {
    ...options,
    sessions,
  });
  return { ...out, session: sessions[0] };
}

const req = (calls: Call[], method: string, pattern: RegExp) =>
  calls.find((c) => c.method === method && pattern.test(c.path));

const resultSelect = () =>
  screen.getByRole("combobox", { name: `Resultado del caso ${CASE}` });

async function saveResult(result: string) {
  await userEvent.selectOptions(
    await screen.findByLabelText(`Resultado del caso ${CASE}`),
    result,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar resultado" }),
  );
}

describe("SessionDetailPage", () => {
  it("muestra el ambiente, el estado y el checklist de la sesión", async () => {
    setup();
    expect(
      await screen.findByRole("heading", { level: 1, name: "QA" }),
    ).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
    expect(screen.getByText("0 de 1 casos ejecutados")).toBeInTheDocument();
    expect(screen.getByText("0 de 2 ítems marcados")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "https://qa.example.com" });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("ofrece descargar el reporte de la sesión en Markdown y PDF", async () => {
    setup();
    for (const [label, format] of [
      ["Markdown", "md"],
      ["PDF", "pdf"],
    ]) {
      const link = await screen.findByRole("link", {
        name: `Descargar reporte de la sesión (${label})`,
      });
      expect(link.getAttribute("href")).toBe(
        `/api/v1/qa-sessions/qs1/report?format=${format}`,
      );
    }
  });

  it("marca ítems del checklist", async () => {
    const { calls } = setup();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: "Ambiente QA disponible y accesible",
      }),
    );
    expect(
      await screen.findByText("1 de 2 ítems marcados"),
    ).toBeInTheDocument();
    expect(req(calls, "PATCH", /checklist-items\/ck1/)?.body).toEqual({
      checked: true,
    });
  });

  it("no se puede cerrar con casos pendientes; al ejecutar todo sugiere aceptar y cierra", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    setup();
    expect(
      await screen.findByText(/faltan 1 casos por ejecutar/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    ).toBeDisabled();

    await saveResult("passed");

    const hint = await screen.findByText(/recomendación sugerida/i);
    expect(hint).toHaveTextContent("Aceptar la historia");
    await userEvent.type(screen.getByLabelText("Resumen"), "Todo bien");
    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    );

    expect(await screen.findByText("Cerrada")).toBeInTheDocument();
    const result = screen.getByRole("region", {
      name: "Resultado de la sesión",
    });
    expect(result).toHaveTextContent("Recomendación final:");
    expect(within(result).getByText("Aceptar la historia")).toHaveClass(
      "badge",
    );
    expect(within(result).getByText("Todo bien")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Guardar resultado" }),
    ).not.toBeInTheDocument();
    expect(resultSelect()).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Ambiente QA disponible y accesible",
      }),
    ).toBeDisabled();
  });

  it("no cierra si la persona cancela la confirmación", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { calls } = setup({
      sessions: [
        makeSession({ executions: [makeExecution(1, { result: "passed" })] }),
      ],
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Cerrar sesión" }),
    );
    expect(req(calls, "POST", /:close/)).toBeUndefined();
  });

  it("con un caso fallido no se puede elegir «Aceptar la historia»", async () => {
    setup();
    await saveResult("failed");
    const accept = await screen.findByRole("option", {
      name: "Aceptar la historia",
    });
    expect(accept).toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Rechazar la historia" }),
    ).toBeEnabled();
  });

  it("si el servidor rechaza el cierre muestra el motivo junto al formulario", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    setup({
      fails: /POST \/qa-sessions\/qs1:close/,
      sessions: [
        makeSession({ executions: [makeExecution(1, { result: "passed" })] }),
      ],
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Cerrar sesión" }),
    );
    const form = screen.getByRole("form", { name: "Cerrar sesión" });
    expect(await within(form).findByRole("alert")).toHaveTextContent(
      /fallo del servidor simulado/i,
    );
    expect(screen.queryByText("Cerrada")).not.toBeInTheDocument();
  });

  it("agrega notas, enlaces e imágenes como evidencia", async () => {
    const { calls } = setup();
    await userEvent.type(
      await screen.findByLabelText("Nueva nota"),
      "Se vio un error 500",
    );
    await userEvent.click(
      screen.getByRole("button", { name: `Agregar nota a ${CASE}` }),
    );
    expect(
      await screen.findByText("Nota: Se vio un error 500"),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("URL del enlace"),
      "https://jira.example.com/QA-1",
    );
    await userEvent.type(
      screen.getByLabelText("Descripción del enlace"),
      "Ticket",
    );
    await userEvent.click(
      screen.getByRole("button", { name: `Agregar enlace a ${CASE}` }),
    );
    const link = await screen.findByRole("link", { name: "Enlace: Ticket" });
    expect(link).toHaveAttribute("href", "https://jira.example.com/QA-1");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    const file = new File(["png"], "captura.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/^Imagen \(PNG/), file);
    await userEvent.click(
      screen.getByRole("button", { name: `Subir imagen a ${CASE}` }),
    );
    const image = await screen.findByRole("link", {
      name: "Imagen: Pantalla de error",
    });
    expect(image).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/api\/v1\/evidences\/.+\/file$/),
    );
    // La miniatura se carga desde el endpoint de evidencias.
    expect(
      screen.getByRole("img", { name: /Pantalla de error/ }),
    ).toHaveAttribute("src", expect.stringMatching(/^\/api\/v1\/evidences\//));
    expect(req(calls, "POST", /evidences\/image/)).toBeDefined();
  });

  it("rechaza en el cliente una imagen de más de 1 MB sin subirla", async () => {
    const { calls } = setup();
    const big = new File([new Uint8Array(1_500_000)], "grande.png", {
      type: "image/png",
    });
    await userEvent.upload(await screen.findByLabelText(/^Imagen \(PNG/), big);
    await userEvent.click(
      screen.getByRole("button", { name: `Subir imagen a ${CASE}` }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/1 MB/);
    expect(req(calls, "POST", /evidences\/image/)).toBeUndefined();
  });

  it("rechaza enlaces que no sean http o https", async () => {
    const { calls } = setup();
    for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>"]) {
      const url = await screen.findByLabelText("URL del enlace");
      await userEvent.clear(url);
      await userEvent.type(url, bad);
      await userEvent.click(
        screen.getByRole("button", { name: `Agregar enlace a ${CASE}` }),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /http:\/\/ o https:\/\//,
      );
    }
    expect(req(calls, "POST", /evidences$/)).toBeUndefined();
  });

  it("muestra notas y enlaces como texto, sin inyectar HTML", async () => {
    const { container } = setup({
      sessions: [
        makeSession({
          executions: [
            makeExecution(1, {
              evidences: [
                {
                  id: "e1",
                  execution_id: "ex1",
                  type: "note",
                  description: "<img src=x onerror=alert(1)>",
                  uploaded_at: "2026-10-23T12:00:00Z",
                  url: null,
                },
                {
                  id: "e2",
                  execution_id: "ex1",
                  type: "link",
                  description: "Malo",
                  uploaded_at: "2026-10-23T12:00:00Z",
                  url: "javascript:alert(1)",
                },
              ],
            }),
          ],
        }),
      ],
    }).view;
    expect(
      await screen.findByText("Nota: <img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
    expect(container.querySelector("img[src='x']")).toBeNull();
    // Un enlace con esquema peligroso nunca es un <a href>.
    expect(screen.queryByRole("link", { name: /Malo/ })).toBeNull();
    expect(screen.getByText(/Enlace no seguro: Malo/)).toBeInTheDocument();
  });

  it("redacta el defecto con IA; se puede editar y guardar", async () => {
    setup();
    expect(
      screen.queryByRole("form", { name: "Borrador de defecto" }),
    ).not.toBeInTheDocument();
    await saveResult("failed");
    await userEvent.click(
      await screen.findByRole("button", {
        name: `Redactar defecto de ${CASE}`,
      }),
    );
    const form = await screen.findByRole("form", {
      name: "Borrador de defecto",
    });
    expect(
      within(form).getByText("Redacción asistida por IA"),
    ).toBeInTheDocument();
    const title = within(form).getByLabelText("Título del defecto");
    expect(title).toHaveValue("Título redactado por IA");
    await userEvent.clear(title);
    await userEvent.type(title, "Mi título corregido");
    await userEvent.click(
      within(form).getByRole("button", { name: "Guardar defecto" }),
    );
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("form", { name: "Borrador de defecto" }),
        ).getByLabelText("Título del defecto"),
      ).toHaveValue("Mi título corregido"),
    );
  });

  it("si la IA falla usa la plantilla y lo avisa", async () => {
    setup({ ai: "unavailable" });
    await saveResult("failed");
    await userEvent.click(
      await screen.findByRole("button", {
        name: `Redactar defecto de ${CASE}`,
      }),
    );
    expect(
      await screen.findByText(/se usó la plantilla del defecto/i),
    ).toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Borrador de defecto" });
    expect(within(form).getByLabelText("Título del defecto")).toHaveValue(
      `Falla en: ${CASE}`,
    );
    expect(
      within(form).queryByText("Redacción asistida por IA"),
    ).not.toBeInTheDocument();
  });

  it("sin IA configurada redacta una plantilla (useAi=false) y explica el motivo", async () => {
    const { calls } = setup({ aiConfigured: false });
    await saveResult("failed");
    expect(await screen.findByText(/La IA no está configurada/)).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: `Redactar defecto de ${CASE}` }),
    );
    await screen.findByRole("form", { name: "Borrador de defecto" });
    expect(req(calls, "POST", /defect-draft/)?.body).toEqual({ use_ai: false });
  });

  it("una sesión cerrada es de solo lectura", async () => {
    setup({ closed: true });
    expect(await screen.findByText("Cerrada")).toBeInTheDocument();
    expect(
      screen.getByText(/La sesión está cerrada: solo lectura/),
    ).toBeInTheDocument();
    expect(resultSelect()).toBeDisabled();
    expect(screen.queryByLabelText("Nueva nota")).toBeNull();
    expect(screen.queryByRole("form", { name: "Cerrar sesión" })).toBeNull();
    const result = screen.getByRole("region", {
      name: "Resultado de la sesión",
    });
    expect(
      within(result).getByText("Aceptar con defectos menores"),
    ).toHaveClass("badge");
  });

  it("anónimo o demo ve la sesión en solo lectura con el motivo", async () => {
    const { unmount } = setup({ anonymous: true }).view;
    expect(await screen.findByText("Inicia sesión para editar.")).toBeVisible();
    expect(resultSelect()).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Ambiente QA disponible y accesible",
      }),
    ).toBeDisabled();
    expect(screen.queryByLabelText("Nueva nota")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
    unmount();
    vi.unstubAllGlobals();

    setup({ demo: true });
    expect(await screen.findByText(/proyecto de demostración/)).toBeVisible();
    expect(resultSelect()).toBeDisabled();
  });

  it("una sesión inexistente o de otra historia muestra el recurso como no encontrado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupSessions(<SessionDetailPage />, "/p/p1/stories/s1/sessions/nope");
    expect(await screen.findByText("Recurso no encontrado")).toBeVisible();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    setupSessions(<SessionDetailPage />, "/p/p1/stories/s1/sessions/qs9", {
      foreignSession: true,
    });
    expect(await screen.findByText("Recurso no encontrado")).toBeVisible();
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { view } = setup({
      sessions: [
        makeSession({
          executions: [
            makeExecution(1, {
              result: "failed",
              defect: {
                id: "d1",
                execution_id: "ex1",
                title: "Falla",
                preconditions: "",
                steps: ["a"],
                expected_result: "x",
                actual_result: "y",
                severity: "major",
                priority: "high",
                frequency: "always",
                environment: "QA",
                build_version: "1",
                ai_assisted: true,
                created_at: "2026-10-23T12:00:00Z",
              },
            }),
          ],
        }),
      ],
    });
    await screen.findByRole("form", { name: "Borrador de defecto" });
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
