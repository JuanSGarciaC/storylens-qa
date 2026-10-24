import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  getSession,
  getStory,
  listStories,
  login,
  setUnauthorizedHandler,
} from "./client";

function respond(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
  });
}

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe("cliente de API", () => {
  it("listStories pide las historias del proyecto con la cookie de sesión", async () => {
    const fetchMock = mockFetch(respond(200, []));
    await expect(listStories("p1")).resolves.toEqual([]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/v1/projects/p1/stories");
    expect(init.credentials).toBe("same-origin");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("un 401 fuera de /auth llama al manejador y lanza ApiError no autorizado", async () => {
    mockFetch(respond(401, { detail: "Sesión vencida" }));
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const error = await listStories("p1").catch((e: unknown) => e);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isUnauthorized).toBe(true);
    expect((error as ApiError).status).toBe(401);
  });

  it("un 401 en login no llama al manejador y conserva el detail", async () => {
    mockFetch(respond(401, { detail: "Credenciales incorrectas" }));
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(login("a@b.co", "mala")).rejects.toMatchObject({
      message: "Credenciales incorrectas",
      status: 401,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("un 403 conserva el detail en español", async () => {
    mockFetch(
      respond(403, {
        detail: "El proyecto de demostración es de solo lectura.",
      }),
    );
    await expect(listStories("p1")).rejects.toMatchObject({
      message: "El proyecto de demostración es de solo lectura.",
      status: 403,
    });
  });

  it("si fetch rechaza lanza el error de conexión", async () => {
    mockFetch(new TypeError("fail"));
    await expect(listStories("p1")).rejects.toMatchObject({
      message: "No se pudo conectar con el servidor.",
      status: 0,
    });
  });

  it("codifica los ids en la ruta para que no alteren el destino", async () => {
    const fetchMock = vi.fn(async () => respond(200, []));
    vi.stubGlobal("fetch", fetchMock);
    await listStories("../auth/me");
    await getStory("a/b?x=1");
    await getSession("s#1");
    const urls = fetchMock.mock.calls.map(
      (call) => (call as unknown as [string])[0],
    );
    expect(urls).toEqual([
      "/api/v1/projects/..%2Fauth%2Fme/stories",
      "/api/v1/stories/a%2Fb%3Fx%3D1",
      "/api/v1/qa-sessions/s%231",
    ]);
  });
});
