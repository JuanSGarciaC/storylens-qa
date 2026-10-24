import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeApi } from "../test/fakeApi";
import { App } from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function submitStory(title = "Login rápido") {
  await userEvent.type(screen.getByLabelText("Título"), title);
  await userEvent.type(
    screen.getByLabelText(/descripción/i),
    "Quiero un acceso rápido",
  );
  await userEvent.type(
    screen.getByLabelText(/criterios/i),
    "- Primero\n- Segundo",
  );
  await userEvent.click(screen.getByRole("button", { name: "Analizar" }));
}

describe("App", () => {
  it("muestra el historial vacío al cargar", async () => {
    installFakeApi();
    render(<App />);
    expect(
      await screen.findByText(/aún no has analizado/i),
    ).toBeInTheDocument();
  });

  it("carga un ejemplo en el formulario y se puede analizar sin escribir nada", async () => {
    const { requests } = installFakeApi();
    render(<App />);

    await userEvent.click(
      screen.getByRole("button", { name: "Ejemplo bien escrito" }),
    );
    expect(screen.getByLabelText("Título")).toHaveValue("Retirar efectivo");
    expect(
      (screen.getByLabelText(/criterios/i) as HTMLTextAreaElement).value,
    ).toContain("Saldo insuficiente");
    expect(requests.some((r) => r.method === "POST")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Analizar" }));
    expect(await screen.findByText("No lista")).toBeInTheDocument();
  });

  it("analiza una historia, la guarda y la muestra en el historial", async () => {
    const { requests } = installFakeApi();
    render(<App />);
    await submitStory();

    expect(await screen.findByText("No lista")).toBeInTheDocument();
    expect(screen.getByLabelText("Puntaje 60 de 100")).toBeInTheDocument();
    expect(screen.getByText("Bloqueante")).toBeInTheDocument();

    const history = screen.getByRole("region", { name: "Historial" });
    expect(
      await within(history).findByText("Login rápido"),
    ).toBeInTheDocument();
    expect(within(history).getByText(/60\/100/)).toBeInTheDocument();

    const created = requests.find(
      (r) => r.method === "POST" && r.path === "/projects/p1/stories",
    );
    expect(created?.body).toMatchObject({
      acceptance_criteria: ["Primero", "Segundo"],
    });
  });

  it("descartar exige un motivo, recalcula el puntaje y lo conserva", async () => {
    installFakeApi();
    render(<App />);
    await submitStory();
    await screen.findByText("No lista");

    await userEvent.click(
      screen.getByRole("button", { name: "Descartar US-AMB-001" }),
    );
    const confirm = screen.getByRole("button", { name: "Confirmar descarte" });
    expect(confirm).toBeDisabled(); // sin motivo no se puede descartar

    await userEvent.type(
      screen.getByLabelText("Motivo del descarte"),
      "Lo aprobó el PO",
    );
    await userEvent.click(confirm);

    expect(
      await screen.findByLabelText("Puntaje 70 de 100"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Motivo del descarte: Lo aprobó el PO"),
    ).toBeInTheDocument();
    const history = screen.getByRole("region", { name: "Historial" });
    expect(within(history).getByText(/70\/100/)).toBeInTheDocument();
  });

  it("restablecer un hallazgo descartado devuelve el puntaje", async () => {
    installFakeApi();
    render(<App />);
    await submitStory();
    await screen.findByText("No lista");

    await userEvent.click(
      screen.getByRole("button", { name: "Descartar US-AMB-001" }),
    );
    await userEvent.type(
      screen.getByLabelText("Motivo del descarte"),
      "motivo",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar descarte" }),
    );
    await screen.findByLabelText("Puntaje 70 de 100");

    await userEvent.click(
      screen.getByRole("button", { name: "Restablecer US-AMB-001" }),
    );
    expect(
      await screen.findByLabelText("Puntaje 60 de 100"),
    ).toBeInTheDocument();
  });

  it("abre una historia del historial", async () => {
    installFakeApi({ withStory: true });
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Historia previa" }),
    );
    expect(
      await screen.findByLabelText("Puntaje 60 de 100"),
    ).toBeInTheDocument();
  });

  it("elimina una historia solo si se confirma", async () => {
    installFakeApi({ withStory: true });
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(<App />);

    const remove = await screen.findByRole("button", {
      name: "Eliminar Historia previa",
    });
    await userEvent.click(remove);
    expect(screen.getByText("Historia previa")).toBeInTheDocument(); // canceló

    await userEvent.click(remove);
    expect(
      await screen.findByText(/aún no has analizado/i),
    ).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("muestra un error accesible si el servidor falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("error (500)");
  });

  it("muestra un error si no hay conexión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo conectar",
    );
  });
});
