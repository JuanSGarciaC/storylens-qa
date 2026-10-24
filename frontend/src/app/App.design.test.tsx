import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeApi } from "../test/fakeApi";
import { App } from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Analiza una historia y espera a que aparezca el panel de casos de prueba. */
async function openDesignPanel(ai?: Parameters<typeof installFakeApi>[0]) {
  installFakeApi(ai);
  render(<App />);
  if (ai?.ai) {
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: /complementar con ia/i }),
      ).toBeEnabled(),
    );
  }
  await userEvent.type(
    screen.getByLabelText(/descripción/i),
    "Quiero retirar efectivo",
  );
  await userEvent.click(screen.getByRole("button", { name: "Analizar" }));
  await screen.findByRole("heading", { name: "Casos de prueba" });
}

async function generate() {
  await userEvent.click(
    screen.getByRole("button", { name: "Generar casos con IA" }),
  );
  await screen.findByText("Retiro menor al saldo");
}

describe("Diseño de pruebas", () => {
  it("aparece tras analizar una historia y genera casos con su técnica y criterio", async () => {
    await openDesignPanel({ ai: "ok" });
    expect(screen.getByText(/aún no hay casos de prueba/i)).toBeInTheDocument();

    await generate();

    expect(screen.getByText("Límite del saldo")).toBeInTheDocument();
    expect(screen.getByText(/valores límite/i)).toBeInTheDocument();
    expect(screen.getByText(/criterio 2/i)).toBeInTheDocument();
    expect(screen.getAllByText(/sugerido por ia/i).length).toBeGreaterThan(0);
  });

  it("aceptar un caso actualiza el estado y la cobertura de la trazabilidad", async () => {
    await openDesignPanel({ ai: "ok" });
    await generate();
    expect(screen.getByText("0%")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Aceptar caso Retiro menor al saldo",
      }),
    );

    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Aceptado")).toBeInTheDocument();
    expect(screen.getAllByText(/sin cobertura/i)).toHaveLength(1);
  });

  it("rechazar y restablecer un caso", async () => {
    await openDesignPanel({ ai: "ok" });
    await generate();

    await userEvent.click(
      screen.getByRole("button", { name: "Rechazar caso Límite del saldo" }),
    );
    expect(await screen.findByText("Rechazado")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Restablecer caso Límite del saldo" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Rechazado")).not.toBeInTheDocument(),
    );
  });

  it("muestra el Gherkin sugerido", async () => {
    await openDesignPanel({ ai: "ok" });

    await userEvent.click(
      screen.getByRole("button", { name: "Sugerir Gherkin" }),
    );

    expect(
      await screen.findByText(/dado un saldo de 500/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/# criterio 1/i)).toBeInTheDocument();
  });

  it("sin IA configurada desactiva la generación y lo explica", async () => {
    await openDesignPanel();

    expect(
      screen.getByRole("button", { name: "Generar casos con IA" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Sugerir Gherkin" }),
    ).toBeDisabled();
    expect(screen.getByText(/no se pueden generar casos/i)).toBeInTheDocument();
  });

  it("muestra el error del servidor si la IA falla al generar", async () => {
    await openDesignPanel({ ai: "ok", generateFails: true });

    await userEvent.click(
      screen.getByRole("button", { name: "Generar casos con IA" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La IA no está disponible en este momento",
    );
  });
});
