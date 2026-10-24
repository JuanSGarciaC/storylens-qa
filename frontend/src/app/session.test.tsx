import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProjects, type Project } from "../api/client";
import { makeMe, makeProject } from "../test/fakeApi";
import { useAccess } from "../shared/useAccess";
import { SessionProvider, useSession } from "./session";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

function Probe() {
  const { status, me } = useSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{me?.email ?? "-"}</span>
      <button onClick={() => void listProjects().catch(() => undefined)}>
        llamar
      </button>
    </div>
  );
}

function renderApp(path = "/proyectos/p1/historias") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <Probe />
        <Where />
      </SessionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SessionProvider", () => {
  it("pasa a waking si getMe no responde en 4 s y ofrece reintentar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    renderApp();
    expect(screen.queryByText(/despertando/i)).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(4100));
    expect(screen.getByText(/El servidor está despertando…/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  it("ante fallo de red reintenta solo con 1 s, 2 s y 4 s y luego se detiene", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError("net")));
    vi.stubGlobal("fetch", fetchMock);
    renderApp();
    await act(() => vi.advanceTimersByTimeAsync(0));
    const calls = () => fetchMock.mock.calls.length;
    const base = calls(); // getMe + health del primer intento
    expect(base).toBeGreaterThan(0);
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(calls()).toBe(base);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(calls()).toBe(base * 2);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(calls()).toBe(base * 3);
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(calls()).toBe(base * 4);
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(calls()).toBe(base * 4);
    expect(screen.getByText(/despertando/i)).toBeVisible();
  });

  it("el botón Reintentar vuelve a intentar y llega a ready", async () => {
    let up = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (!up) throw new TypeError("net");
        return url.endsWith("/health")
          ? json({ status: "ok", ai_configured: true })
          : json(makeMe());
      }),
    );
    renderApp();
    await act(() => vi.advanceTimersByTimeAsync(10000));
    up = true;
    await act(async () =>
      screen.getByRole("button", { name: "Reintentar" }).click(),
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("email")).toHaveTextContent("dueno@example.com");
  });

  it("un 401 estando ready redirige a /login?next=<ruta actual>", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/health")) {
          return json({ status: "ok", ai_configured: true });
        }
        if (url.endsWith("/auth/me")) return json(makeMe());
        return json({ detail: "No autenticado" }, 401);
      }),
    );
    renderApp("/proyectos/p1/historias?x=1");
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    await act(async () => screen.getByText("llamar").click());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByTestId("where")).toHaveTextContent(
      `/login?next=${encodeURIComponent("/proyectos/p1/historias?x=1")}`,
    );
    expect(screen.getByTestId("email")).toHaveTextContent("-");
  });
});

describe("useAccess", () => {
  function AccessProbe({ project }: { project?: Project }) {
    const a = useAccess(project);
    return (
      <div data-testid="a">
        {JSON.stringify([a.canWrite, a.canUseAi, a.reason])}
      </div>
    );
  }

  async function access(authenticated: boolean, is_demo: boolean, ai = true) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/health")
          ? json({ status: "ok", ai_configured: ai })
          : json(authenticated ? makeMe() : { authenticated: false }),
      ),
    );
    render(
      <MemoryRouter>
        <SessionProvider>
          <AccessProbe project={makeProject({ is_demo })} />
        </SessionProvider>
      </MemoryRouter>,
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    return JSON.parse(screen.getByTestId("a").textContent ?? "null");
  }

  const DEMO = "Estás viendo el proyecto de demostración: es de solo lectura.";

  it("anónimo en demo", async () => {
    expect(await access(false, true)).toEqual([false, false, DEMO]);
  });
  it("anónimo en proyecto real", async () => {
    expect(await access(false, false)).toEqual([
      false,
      false,
      "Inicia sesión para editar.",
    ]);
  });
  it("dueño en demo", async () => {
    expect(await access(true, true)).toEqual([false, false, DEMO]);
  });
  it("dueño en proyecto real", async () => {
    expect(await access(true, false)).toEqual([true, true, null]);
  });
  it("dueño sin IA configurada", async () => {
    expect(await access(true, false, false)).toEqual([
      true,
      false,
      "La IA no está configurada.",
    ]);
  });
});
