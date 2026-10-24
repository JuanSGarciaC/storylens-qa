import { Component } from "react";
import type { ReactNode } from "react";
import type {
  Defect,
  Evidence,
  Execution,
  SessionDetail,
  StoryItem,
} from "../api/client";
import { makeMe, makeProject } from "./fakeApi";
import { json, renderPage, stubFetch } from "./renderPage";
import type { Call } from "./renderPage";

export const CASE = "Retiro menor al saldo";
const NOW = "2026-10-23T12:00:00Z";

export type SessionOptions = {
  anonymous?: boolean;
  demo?: boolean;
  aiConfigured?: boolean;
  /** Resultado del borrador con IA: "ok" o "unavailable" (cae a la plantilla). */
  ai?: "ok" | "unavailable";
  /** Sesiones previas; por defecto ninguna. */
  sessions?: SessionDetail[];
  closed?: boolean;
  foreignSession?: boolean;
  /** Rutas (regex sobre «MÉTODO ruta») que responden 500. */
  fails?: RegExp;
  acceptedCases?: number;
};

export function makeExecution(
  n: number,
  overrides: Partial<Execution> = {},
): Execution {
  return {
    id: `ex${n}`,
    test_case_id: `c${n}`,
    case_title: n === 1 ? CASE : `Caso ${n}`,
    technique: "scenario",
    criterion_index: 1,
    preconditions: "Saldo 500",
    steps: ["Elegir Retirar", "Ingresar 100"],
    expected_result: "El saldo queda en 400",
    result: "not_run",
    actual_result: "",
    notes: "",
    executed_at: null,
    evidences: [],
    defect: null,
    ...overrides,
  };
}

export function makeSession(
  overrides: Partial<SessionDetail> = {},
): SessionDetail {
  const session: SessionDetail = {
    id: "qs1",
    story_id: "s1",
    environment_name: "QA",
    environment_url: "https://qa.example.com",
    build_version: "1.4.2",
    tester_name: "Ana",
    started_at: NOW,
    closed_at: null,
    recommendation: null,
    summary: "",
    checklist: [
      {
        id: "ck1",
        phase: "preparation",
        text: "Ambiente QA disponible y accesible",
        checked: false,
        note: "",
      },
      {
        id: "ck2",
        phase: "closure",
        text: "Recomendación final definida",
        checked: false,
        note: "",
      },
    ],
    executions: [makeExecution(1)],
    counts: { passed: 0, failed: 0, blocked: 0, not_run: 1 },
    pending: 1,
    suggested_recommendation: null,
    ...overrides,
  };
  return recompute(session);
}

function recompute(session: SessionDetail) {
  const count = (r: Execution["result"]) =>
    session.executions.filter((e) => e.result === r).length;
  session.counts = {
    passed: count("passed"),
    failed: count("failed"),
    blocked: count("blocked"),
    not_run: count("not_run"),
  };
  session.pending = session.counts.not_run;
  const bad = session.counts.failed + session.counts.blocked;
  session.suggested_recommendation =
    session.pending > 0 ? null : bad === 0 ? "accept" : "reject";
  return session;
}

class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <p>Recurso no encontrado</p>
    ) : (
      this.props.children
    );
  }
}

/** Servidor simulado de historia + sesiones QA, y montaje de la pantalla. */
export function setupSessions(
  page: ReactNode,
  entry: string,
  options: SessionOptions = {},
) {
  const story: StoryItem = {
    id: "s1",
    project_id: "p1",
    title: "Retirar efectivo",
    description: "Como cliente quiero retirar efectivo",
    notes: "",
    acceptance_criteria: ["Retiro menor al saldo"],
    created_at: NOW,
    latest_analysis: null,
  };
  const project = makeProject({ is_demo: options.demo ?? false });
  const sessions = options.sessions ?? [];
  if (options.closed) {
    sessions.push(
      makeSession({
        closed_at: NOW,
        recommendation: "accept_with_minor_defects",
        summary: "Salió bien",
        executions: [makeExecution(1, { result: "passed" })],
      }),
    );
  }
  if (options.foreignSession) {
    sessions.push(makeSession({ id: "qs9", story_id: "otra" }));
  }
  let seq = 0;
  const calls = stubFetch({
    me: options.anonymous ? { authenticated: false } : makeMe(),
    health: { status: "ok", ai_configured: options.aiConfigured ?? true },
    handler: (call: Call) => {
      const { path, method, body } = call;
      const b = (body ?? {}) as Record<string, unknown>;
      if (options.fails?.test(`${method} ${path}`)) {
        return json({ detail: "Fallo del servidor simulado" }, 500);
      }
      if (path === "/projects/p1") return json(project);
      if (path === "/projects") return json([project]);
      if (path === "/stories/s1") return json(story);
      if (path === "/stories/s1/qa-sessions" && method === "GET") {
        return json(sessions.filter((s) => s.story_id === "s1"));
      }
      if (path === "/stories/s1/qa-sessions" && method === "POST") {
        if ((options.acceptedCases ?? 1) === 0) {
          return json(
            { detail: "No hay casos de prueba aceptados para la sesión" },
            422,
          );
        }
        const created = makeSession({
          id: `new${++seq}`,
          environment_name: String(b.environment_name),
          environment_url: String(b.environment_url),
        });
        sessions.push(created);
        return json(created, 201);
      }
      const session = path.match(/^\/qa-sessions\/([^/:]+)$/);
      if (session && method === "GET") {
        const found = sessions.find((s) => s.id === session[1]);
        return found
          ? json(found)
          : json({ detail: "Sesión no encontrada" }, 404);
      }
      const close = path.match(/^\/qa-sessions\/([^/:]+):close$/);
      if (close) {
        const found = sessions.find((s) => s.id === close[1])!;
        found.closed_at = NOW;
        found.recommendation = b.recommendation as never;
        found.summary = String(b.summary ?? "");
        return json(found);
      }
      const all = sessions.flatMap((s) => s.executions);
      const check = path.match(/^\/checklist-items\/(.+)$/);
      if (check) {
        const item = sessions
          .flatMap((s) => s.checklist)
          .find((i) => i.id === check[1])!;
        item.checked = Boolean(b.checked);
        return json(item);
      }
      const execution = path.match(/^\/executions\/([^/]+)$/);
      if (execution && method === "PATCH") {
        const found = all.find((e) => e.id === execution[1])!;
        Object.assign(found, b);
        const owner = sessions.find((s) => s.executions.includes(found))!;
        recompute(owner);
        return json(found);
      }
      const evidence = path.match(
        /^\/executions\/([^/]+)\/evidences(\/image)?$/,
      );
      if (evidence && method === "POST") {
        const found = all.find((e) => e.id === evidence[1])!;
        const id = `ev${++seq}`;
        const ev: Evidence = evidence[2]
          ? {
              id,
              execution_id: found.id,
              type: "image",
              description: "Pantalla de error",
              uploaded_at: NOW,
              url: `/api/v1/evidences/${id}/file`,
            }
          : b.type === "note"
            ? {
                id,
                execution_id: found.id,
                type: "note",
                description: String(b.text),
                uploaded_at: NOW,
                url: null,
              }
            : {
                id,
                execution_id: found.id,
                type: "link",
                description: String(b.description),
                uploaded_at: NOW,
                url: String(b.url),
              };
        found.evidences.push(ev);
        return json(ev, 201);
      }
      const draft = path.match(/^\/executions\/([^/]+)\/defect-draft$/);
      if (draft) {
        const found = all.find((e) => e.id === draft[1])!;
        const aiOk = Boolean(b.use_ai) && (options.ai ?? "ok") === "ok";
        const defect: Defect = {
          id: found.defect?.id ?? `df${++seq}`,
          execution_id: found.id,
          title: aiOk
            ? "Título redactado por IA"
            : `Falla en: ${found.case_title}`,
          preconditions: found.preconditions,
          steps: found.steps,
          expected_result: found.expected_result,
          actual_result: found.actual_result || "(sin descripción)",
          severity: "major",
          priority: "high",
          frequency: "always",
          environment: "QA (https://qa.example.com)",
          build_version: "1.4.2",
          ai_assisted: aiOk,
          created_at: NOW,
        };
        found.defect = defect;
        const ai_status = !b.use_ai
          ? "not_requested"
          : aiOk
            ? "ok"
            : "unavailable";
        return json({ defect, ai_status }, 201);
      }
      const defect = path.match(/^\/defect-drafts\/(.+)$/);
      if (defect && method === "PATCH") {
        const found = all
          .map((e) => e.defect)
          .find((d) => d?.id === defect[1])!;
        Object.assign(found, b);
        return json(found);
      }
      return undefined;
    },
  });
  const view = renderPage(<Boundary>{page}</Boundary>, { entry });
  return { view, calls, sessions };
}
