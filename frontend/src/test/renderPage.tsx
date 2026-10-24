import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { vi } from "vitest";
import { ProjectProvider } from "../app/ProjectContext";
import { SessionProvider } from "../app/session";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export type Call = { method: string; path: string; body: unknown };
export type Handler = (call: Call) => Response | undefined;

/** Sustituye `fetch`: `/health` y `/auth/me` por defecto; el resto, por `handler`. */
export function stubFetch(
  options: {
    me?: unknown;
    handler?: Handler;
    health?: unknown | (() => unknown);
  } = {},
): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = url.replace("/api/v1", "");
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
      const call = { method, path, body };
      calls.push(call);
      if (path === "/health") {
        const health =
          typeof options.health === "function"
            ? options.health()
            : options.health;
        if (health instanceof Response) return health;
        return json(health ?? { status: "ok", ai_configured: true });
      }
      if (path === "/auth/me") {
        return json(
          options.me ?? { authenticated: true, email: "dueno@example.com" },
        );
      }
      return options.handler?.(call) ?? json({ detail: "no simulada" }, 404);
    }),
  );
  return calls;
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function Scoped({ children }: { children: ReactElement }) {
  const { projectId } = useParams();
  return <ProjectProvider projectId={projectId}>{children}</ProjectProvider>;
}

/** Monta una pantalla con sesión, proyecto de la ruta y router, como el Shell. */
export function renderPage(page: ReactElement, options: { entry: string }) {
  return render(
    <MemoryRouter initialEntries={[options.entry]}>
      <SessionProvider>
        <Routes>
          <Route
            path="/"
            element={
              <ProjectProvider projectId={undefined}>{page}</ProjectProvider>
            }
          />
          <Route path="/p/:projectId" element={<Scoped>{page}</Scoped>} />
          <Route
            path="/p/:projectId/settings"
            element={<Scoped>{page}</Scoped>}
          />
          <Route
            path="/p/:projectId/stories/:storyId/analysis"
            element={<Scoped>{page}</Scoped>}
          />
          <Route
            path="/p/:projectId/stories/:storyId/tests"
            element={<Scoped>{page}</Scoped>}
          />
          <Route
            path="/p/:projectId/stories/:storyId/sessions"
            element={<Scoped>{page}</Scoped>}
          />
          <Route
            path="/p/:projectId/stories/:storyId/sessions/:sessionId"
            element={<Scoped>{page}</Scoped>}
          />
          <Route
            path="/p/:projectId/transversal"
            element={<Scoped>{page}</Scoped>}
          />
          <Route
            path="/p/:projectId/imports/:jobId"
            element={<Scoped>{page}</Scoped>}
          />
          <Route path="*" element={<div>otra ruta</div>} />
        </Routes>
        <Where />
      </SessionProvider>
    </MemoryRouter>,
  );
}
