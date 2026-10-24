import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeApi } from "../test/fakeApi";
import { App } from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function chooseFile() {
  render(<App />);
  await userEvent.click(
    screen.getByText("Importar historias desde Jira (CSV o JSON)"),
  );
  const file = new File(["Summary,Description\nA,B"], "jira.csv", {
    type: "text/csv",
  });
  await userEvent.upload(screen.getByLabelText(/archivo de jira/i), file);
  await screen.findByRole("list", { name: "Vista previa de la importación" });
}

describe("Importación desde Jira", () => {
  it("muestra la vista previa con el mapeo sugerido y marca las filas inválidas", async () => {
    installFakeApi();
    await chooseFile();

    expect(
      (screen.getByRole("combobox", { name: "Título" }) as HTMLSelectElement)
        .value,
    ).toBe("Summary");
    const rows = screen.getByRole("list", {
      name: "Vista previa de la importación",
    });
    expect(within(rows).getByText("Retirar efectivo")).toBeInTheDocument();
    expect(
      within(rows).getByText(/sin descripción: no se puede importar/i),
    ).toBeInTheDocument();
    expect(
      within(rows).getByRole("checkbox", { name: "Importar fila 2" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Importar 2 historias" }),
    ).toBeEnabled();
  });

  it("no crea nada hasta confirmar y respeta las filas desmarcadas", async () => {
    const { requests } = installFakeApi();
    await chooseFile();
    expect(requests.some((r) => r.path === "/stories/import:confirm")).toBe(
      false,
    );

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Importar fila 3" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Importar 1 historia" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Se importaron 1 historia",
    );
    expect(
      await screen.findByRole("button", { name: "Analizar Retirar efectivo" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
  });

  it("cambiar una columna pide una nueva vista previa con ese mapeo", async () => {
    const { requests } = installFakeApi();
    await chooseFile();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Descripción" }),
      "Issue key",
    );

    await waitFor(() =>
      expect(requests.filter((r) => r.path === "/stories/import").length).toBe(
        2,
      ),
    );
    expect(
      (
        screen.getByRole("combobox", {
          name: "Descripción",
        }) as HTMLSelectElement
      ).value,
    ).toBe("Issue key");
  });

  it("una historia importada se analiza desde el historial", async () => {
    installFakeApi();
    await chooseFile();
    await userEvent.click(
      screen.getByRole("button", { name: "Importar 2 historias" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Analizar Login" }),
    );

    expect(await screen.findByText("No lista")).toBeInTheDocument();
  });
});
