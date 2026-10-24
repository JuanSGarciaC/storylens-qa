import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeApi } from "../test/fakeApi";
import { App } from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const aiCheckbox = () =>
  screen.getByRole("checkbox", { name: /complementar con ia/i });

async function submitStory() {
  await userEvent.type(screen.getByLabelText("Título"), "Login rápido");
  await userEvent.type(
    screen.getByLabelText(/descripción/i),
    "Quiero un acceso rápido",
  );
  await userEvent.click(screen.getByRole("button", { name: "Analizar" }));
}

function analysisRequest(
  requests: { method: string; path: string; body: unknown }[],
) {
  return requests.find(
    (r) => r.method === "POST" && r.path.endsWith("/analyses"),
  );
}

describe("App con IA", () => {
  it("usa la IA por defecto cuando está configurada y marca sus hallazgos", async () => {
    const { requests } = installFakeApi({ ai: "ok" });
    render(<App />);
    await waitFor(() => expect(aiCheckbox()).toBeEnabled());
    expect(aiCheckbox()).toBeChecked();

    await submitStory();

    expect(
      await screen.findByText(/analizado con reglas \+ ia \(gemini-test\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText("IA · 85%")).toBeInTheDocument();
    expect(screen.getByLabelText("Puntaje 50 de 100")).toBeInTheDocument();
    expect(analysisRequest(requests)?.body).toEqual({ use_ai: true });
  });

  it("respeta que el usuario desmarque la IA", async () => {
    const { requests } = installFakeApi({ ai: "ok" });
    render(<App />);
    await waitFor(() => expect(aiCheckbox()).toBeEnabled());
    await userEvent.click(aiCheckbox());

    await submitStory();

    expect(
      await screen.findByText("Analizado solo con reglas."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^IA/)).not.toBeInTheDocument();
    expect(analysisRequest(requests)?.body).toEqual({ use_ai: false });
  });

  it("desactiva la casilla y avisa si la IA no está configurada", async () => {
    const { requests } = installFakeApi();
    render(<App />);

    expect(aiCheckbox()).toBeDisabled();
    expect(aiCheckbox()).not.toBeChecked();
    expect(screen.getByText(/la ia no está configurada/i)).toBeInTheDocument();

    await submitStory();
    await screen.findByText("Analizado solo con reglas.");
    expect(analysisRequest(requests)?.body).toEqual({ use_ai: false });
  });

  it("avisa cuando la IA no estuvo disponible y conserva el resultado de reglas", async () => {
    installFakeApi({ ai: "unavailable" });
    render(<App />);
    await waitFor(() => expect(aiCheckbox()).toBeEnabled());

    await submitStory();

    expect(
      await screen.findByText(/la ia no estuvo disponible/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Puntaje 60 de 100")).toBeInTheDocument();
  });

  it("avisa cuando la IA devolvió una respuesta inválida", async () => {
    installFakeApi({ ai: "invalid_response" });
    render(<App />);
    await waitFor(() => expect(aiCheckbox()).toBeEnabled());

    await submitStory();

    expect(
      await screen.findByText(/devolvió una respuesta inválida/i),
    ).toBeInTheDocument();
  });

  it("un hallazgo de IA se puede descartar con motivo y recalcula el puntaje", async () => {
    installFakeApi({ ai: "ok" });
    render(<App />);
    await waitFor(() => expect(aiCheckbox()).toBeEnabled());
    await submitStory();
    await screen.findByLabelText("Puntaje 50 de 100");

    await userEvent.click(
      screen.getByRole("button", { name: "Descartar US-AC-004" }),
    );
    await userEvent.type(
      screen.getByLabelText("Motivo del descarte"),
      "No aplica a esta historia",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar descarte" }),
    );

    expect(
      await screen.findByLabelText("Puntaje 60 de 100"),
    ).toBeInTheDocument();
  });
});
