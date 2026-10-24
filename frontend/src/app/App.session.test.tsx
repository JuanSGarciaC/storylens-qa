import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeApi } from "../test/fakeApi";
import { App } from "./App";

const CASE = "Retiro menor al saldo";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type FakeOptions = Parameters<typeof installFakeApi>[0];

/** Analiza una historia, genera casos y (opcionalmente) acepta el primero. */
async function prepareStory(
  { accept }: { accept: boolean },
  options: FakeOptions = { ai: "ok" },
) {
  installFakeApi(options);
  render(<App />);
  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: /complementar con ia/i }),
    ).toBeEnabled(),
  );
  await userEvent.type(
    screen.getByLabelText(/descripción/i),
    "Quiero retirar efectivo",
  );
  await userEvent.click(screen.getByRole("button", { name: "Analizar" }));
  await screen.findByRole("heading", { name: "Casos de prueba" });
  await userEvent.click(
    screen.getByRole("button", { name: "Generar casos con IA" }),
  );
  await screen.findByText(CASE);
  if (accept) {
    await userEvent.click(
      screen.getByRole("button", { name: `Aceptar caso ${CASE}` }),
    );
    await screen.findByText("Aceptado");
  }
}

async function startSession() {
  await userEvent.type(screen.getByLabelText("Ambiente"), "QA");
  await userEvent.type(
    screen.getByLabelText("URL del ambiente"),
    "https://qa.example.com",
  );
  await userEvent.type(screen.getByLabelText("Build / versión"), "1.4.2");
  await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

async function openSession(options?: FakeOptions) {
  await prepareStory({ accept: true }, options);
  await startSession();
  await screen.findByRole("heading", { name: "Ejecución de casos" });
}

const resultSelect = () =>
  screen.getByRole("combobox", { name: `Resultado del caso ${CASE}` });

async function saveResult(result: string) {
  await userEvent.selectOptions(resultSelect(), result);
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar resultado" }),
  );
}

describe("Sesión de revisión en el ambiente QA", () => {
  it("no deja iniciar la sesión si no hay casos aceptados y explica por qué", async () => {
    await prepareStory({ accept: false });
    await startSession();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no hay casos de prueba aceptados/i,
    );
    expect(
      screen.queryByRole("heading", { name: "Ejecución de casos" }),
    ).not.toBeInTheDocument();
  });

  it("crea la sesión con el checklist y solo los casos aceptados", async () => {
    await openSession();

    // El estado aparece en el encabezado de la sesión (y también en la lista de sesiones).
    expect(
      screen.getByRole("heading", { name: /QA\s*En curso/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 de 1/)).toBeInTheDocument();
    expect(screen.getByText("0 de 3 ítems marcados")).toBeInTheDocument();
    const executions = screen
      .getByRole("heading", { name: "Ejecución de casos" })
      .closest("section")!;
    expect(within(executions).getByText(CASE)).toBeInTheDocument();
    expect(
      within(executions).queryByText("Límite del saldo"),
    ).not.toBeInTheDocument();
  });

  it("ofrece descargar el reporte de la sesión en Markdown y PDF", async () => {
    await openSession();
    for (const [label, format] of [
      ["Markdown", "md"],
      ["PDF", "pdf"],
    ]) {
      const link = screen.getByRole("link", {
        name: `Descargar reporte de la sesión (${label})`,
      });
      const href = link.getAttribute("href") ?? "";
      expect(href.startsWith("/api/v1/qa-sessions/")).toBe(true);
      expect(href.endsWith(`/report?format=${format}`)).toBe(true);
      expect(link).toHaveAttribute("download");
    }
  });

  it("marca ítems del checklist", async () => {
    await openSession();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "Ambiente QA disponible y accesible",
      }),
    );
    expect(
      await screen.findByText("1 de 3 ítems marcados"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "Ambiente QA disponible y accesible",
      }),
    ).toBeChecked();
  });

  it("no se puede cerrar con casos pendientes; al ejecutar todo sugiere aceptar y cierra", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openSession();
    expect(
      screen.getByText(/faltan 1 casos por ejecutar/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    ).toBeDisabled();

    await saveResult("passed");

    expect(
      await screen.findByText(/recomendación sugerida/i),
    ).toHaveTextContent("Aceptar la historia");
    await userEvent.type(screen.getByLabelText("Resumen"), "Todo bien");
    await userEvent.click(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    );

    expect(
      await screen.findByRole("heading", { name: /QA\s*Cerrada/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/recomendación final: aceptar la historia/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Todo bien")).toBeInTheDocument();
    // Cerrada = solo lectura
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

  it("con un caso fallido no se puede elegir «Aceptar la historia»", async () => {
    await openSession();
    await saveResult("failed");

    const accept = await screen.findByRole("option", {
      name: "Aceptar la historia",
    });
    expect(accept).toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Rechazar la historia" }),
    ).toBeEnabled();
  });

  it("si el servidor rechaza el cierre muestra el motivo", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openSession();
    await saveResult("passed");
    await screen.findByText(/recomendación sugerida/i);
    // Otro usuario deja un caso pendiente: el cierre falla en el servidor
    await userEvent.selectOptions(resultSelect(), "not_run");
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar resultado" }),
    );
    await screen.findByText(/faltan 1 casos por ejecutar/i);
    expect(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    ).toBeDisabled();
  });

  it("agrega notas, enlaces e imágenes como evidencia", async () => {
    await openSession();

    await userEvent.type(
      screen.getByLabelText("Nueva nota"),
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

    const file = new File(["png"], "captura.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/^Imagen \(PNG/), file);
    await userEvent.type(
      screen.getByLabelText("Descripción de la imagen"),
      "Pantalla de error",
    );
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
  });

  it("redacta el defecto de un caso fallido con IA, se puede editar y guardar", async () => {
    await openSession();
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

  it("si la IA no está disponible usa la plantilla y lo avisa", async () => {
    await openSession({ ai: "unavailable" });
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
});
