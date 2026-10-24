import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../../app/session";
import { LoginPage, safeNext } from "./LoginPage";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function stubApi(loginResponse: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/health")) {
        return json({ status: "ok", ai_configured: false });
      }
      if (url.endsWith("/auth/me")) return json({ authenticated: false });
      if (url.endsWith("/auth/login")) return loginResponse();
      return json({}, 404);
    }),
  );
}

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

async function setup(entry: string) {
  const view = render(
    <MemoryRouter initialEntries={[entry]}>
      <SessionProvider>
        <LoginPage />
        <Where />
      </SessionProvider>
    </MemoryRouter>,
  );
  await screen.findByLabelText("Correo electrónico");
  return view;
}

async function submit(password = "x") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Correo electrónico"), "a@b.co");
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

afterEach(() => vi.unstubAllGlobals());

describe("LoginPage", () => {
  it("no tiene violaciones de accesibilidad", async () => {
    stubApi(() => json({}));
    const { container } = await setup("/login");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("login correcto navega a next interno", async () => {
    stubApi(() => json({ authenticated: true, email: "a@b.co" }));
    await setup("/login?next=%2Fproyectos%2Fp1%3Fx%3D1");
    await submit();
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent(
        "/proyectos/p1?x=1",
      ),
    );
  });

  it("ignora next externo y va a /", async () => {
    stubApi(() => json({ authenticated: true, email: "a@b.co" }));
    await setup("/login?next=https%3A%2F%2Fevil.test");
    await submit();
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/),
    );
  });

  it("safeNext rechaza rutas no internas", () => {
    expect(safeNext("/a/b?c=1")).toBe("/a/b?c=1");
    for (const bad of [
      "//evil.test",
      "https://evil.test",
      "/\\evil.test",
      "\\evil",
      "evil",
      "",
      null,
      "/a\nb",
    ]) {
      expect(safeNext(bad)).toBe("/");
    }
  });

  it("clave errónea muestra el detalle genérico del servidor", async () => {
    stubApi(() => json({ detail: "Credenciales inválidas" }, 401));
    await setup("/login");
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credenciales inválidas",
    );
    expect(screen.getByTestId("where")).toHaveTextContent("/login");
  });

  it("429 muestra el detalle del bloqueo temporal", async () => {
    stubApi(() =>
      json({ detail: "Demasiados intentos. Intenta de nuevo en 60 s." }, 429),
    );
    await setup("/login");
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Demasiados intentos. Intenta de nuevo en 60 s.",
    );
  });
});
