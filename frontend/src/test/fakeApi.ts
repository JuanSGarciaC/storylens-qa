import { vi } from "vitest";
import type {
  Analysis,
  AuditEvent,
  Defect,
  Evidence,
  Execution,
  Me,
  Named,
  Project,
  SessionDetail,
  StoryItem,
  TestCase,
} from "../api/client";

export const PROJECT_ID = "p1";

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    name: "Banca móvil",
    description: "App de banca para clientes",
    objective: "Reducir defectos en producción",
    settings: {
      disabled_rules: [],
      penalties: null,
      not_ready_below: 60,
      ready_from: 85,
    },
    is_demo: false,
    created_at: "2026-10-23T12:00:00Z",
    ...overrides,
  };
}

export function makeMe(overrides: Partial<Me> = {}): Me {
  return { authenticated: true, email: "dueno@example.com", ...overrides };
}

export function makeNamed(name: string, overrides: Partial<Named> = {}): Named {
  return { id: `n-${name}`, project_id: PROJECT_ID, name, ...overrides };
}

export function makeAuditEvent(
  overrides: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    id: 1,
    at: "2026-10-23T12:00:00Z",
    actor: "dueno@example.com",
    action: "story.created",
    entity: "story",
    entity_id: "s-1",
    project_id: PROJECT_ID,
    detail: "",
    ...overrides,
  };
}

const PENALTY = { blocking: 30, major: 10, minor: 4, info: 0 } as const;

type Finding = Analysis["findings"][number];

function baseFindings(): Finding[] {
  return [
    {
      id: "f-block",
      rule_id: "US-AC-001",
      source: "rule",
      severity: "blocking",
      message: "La historia no tiene criterios de aceptación.",
      suggestion: "Agregue criterios verificables.",
      reference: "3C (Confirmación)",
      evidence_text: null,
      decision: "pending",
      dismiss_reason: null,
      confidence: null,
    },
    {
      id: "f-major",
      rule_id: "US-AMB-001",
      source: "rule",
      severity: "major",
      message: "Se usa el término vago «rápido».",
      suggestion: "Reemplácelo por un valor medible.",
      reference: "ISO/IEC/IEEE 29148:2018",
      evidence_text: "acceso rápido",
      decision: "pending",
      dismiss_reason: null,
      confidence: null,
    },
  ];
}

function aiFinding(): Finding {
  return {
    id: "f-ai",
    rule_id: "US-AC-004",
    source: "ai",
    severity: "major",
    message: "Solo se describe el camino feliz.",
    suggestion: "Agregue criterios de error.",
    reference: "ISTQB CTFL v4.0",
    evidence_text: "Primero",
    decision: "pending",
    dismiss_reason: null,
    confidence: 0.85,
  };
}

function scoreOf(findings: Finding[]) {
  const active = findings.filter((f) => f.decision !== "dismissed");
  const value = Math.max(
    0,
    100 - active.reduce((sum, f) => sum + PENALTY[f.severity], 0),
  );
  const blocking = active.some((f) => f.severity === "blocking");
  const verdict =
    blocking || value < 60
      ? "not_ready"
      : value < 85
        ? "ready_with_notes"
        : "ready";
  return { value, verdict };
}

/** "ok" = la IA responde; "unavailable"/"invalid_response" = está configurada pero falla. */
export type AiBehavior = "ok" | "unavailable" | "invalid_response";

/** Simula el backend en memoria y reemplaza `fetch`. Sin `ai`, la IA no está configurada. */
export function installFakeApi(
  options: {
    withStory?: boolean;
    ai?: AiBehavior;
    /** La IA está configurada pero la generación de casos responde 503. */
    generateFails?: boolean;
  } = {},
) {
  const stories: StoryItem[] = [];
  const analyses: Record<string, Analysis> = {};
  const requests: { method: string; path: string; body: unknown }[] = [];
  const cases: TestCase[] = [];

  function makeCase(
    storyId: string,
    n: number,
    title: string,
    technique: TestCase["technique"],
    criterion: number,
  ): TestCase {
    return {
      id: `c-${n}`,
      story_id: storyId,
      title,
      technique,
      criterion_index: criterion,
      preconditions: "Saldo 500",
      steps: ["Elegir Retirar", "Ingresar 100"],
      test_data: "",
      expected_result: "El saldo queda en 400",
      gherkin: null,
      priority: "high",
      origin: "ai",
      status: "proposed",
    };
  }

  function summarize(storyId: string) {
    const story = stories.find((s) => s.id === storyId)!;
    const analysis = Object.values(analyses).find(
      (a) => a.story_id === storyId,
    )!;
    const { value, verdict } = scoreOf(analysis.findings);
    analysis.score = value;
    analysis.verdict = verdict;
    story.latest_analysis = {
      id: analysis.id!,
      score: value,
      verdict,
      created_at: "2026-10-23T12:00:00Z",
    };
  }

  function addStory(id: string, title: string) {
    stories.unshift({
      id,
      project_id: PROJECT_ID,
      title,
      description: "Como usuario quiero un acceso rápido para entrar",
      notes: "",
      acceptance_criteria: [],
      created_at: "2026-10-23T12:00:00Z",
      latest_analysis: null,
    });
  }

  function addAnalysis(storyId: string, useAi: boolean) {
    const findings = baseFindings();
    let ai_status: Analysis["ai_status"] = "not_requested";
    if (useAi) {
      ai_status = options.ai ?? "unavailable";
      if (ai_status === "ok") findings.push(aiFinding());
    }
    const analysis: Analysis = {
      id: `a-${storyId}`,
      story_id: storyId,
      created_at: "2026-10-23T12:00:00Z",
      score: 0,
      verdict: "not_ready",
      used_ai: ai_status === "ok",
      ai_status,
      model_name: ai_status === "ok" ? "gemini-test" : null,
      prompt_version: ai_status === "ok" ? "analysis-v1" : null,
      rules_catalog_version: "1.0.0",
      findings,
    };
    analyses[analysis.id!] = analysis;
    summarize(storyId);
    return analysis;
  }

  if (options.withStory) {
    addStory("s-old", "Historia previa");
    addAnalysis("s-old", false);
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  // --- sesiones de revisión en el ambiente QA ---
  const sessions: SessionDetail[] = [];
  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}-${++sequence}`;
  const NOW = "2026-10-23T12:00:00Z";

  function recompute(session: SessionDetail) {
    const count = (result: Execution["result"]) =>
      session.executions.filter((e) => e.result === result).length;
    session.counts = {
      passed: count("passed"),
      failed: count("failed"),
      blocked: count("blocked"),
      not_run: count("not_run"),
    };
    session.pending = session.counts.not_run;
    const failures = session.counts.failed + session.counts.blocked;
    session.suggested_recommendation =
      session.pending > 0 ? null : failures === 0 ? "accept" : "reject";
  }

  function findExecution(id: string) {
    for (const session of sessions) {
      const execution = session.executions.find((e) => e.id === id);
      if (execution) return { session, execution };
    }
    return undefined;
  }

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const path = url.replace("/api/v1", "");
    const form = init.body instanceof FormData ? init.body : null;
    const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ method, path, body });

    if (method === "GET" && path === "/health") {
      return json({ status: "ok", ai_configured: options.ai !== undefined });
    }
    if (method === "GET" && path === `/projects/${PROJECT_ID}/stories`) {
      return json(stories);
    }
    if (method === "GET" && path === "/projects") return json([makeProject()]);
    if (method === "GET" && path === "/auth/me") return json(makeMe());
    if (method === "GET" && path === `/projects/${PROJECT_ID}`) {
      return json(makeProject());
    }
    if (method === "GET" && path === `/projects/${PROJECT_ID}/epics`) {
      return json([]);
    }
    if (method === "GET" && path === `/projects/${PROJECT_ID}/versions`) {
      return json([]);
    }

    if (
      method === "POST" &&
      path === `/projects/${PROJECT_ID}/stories/import`
    ) {
      const mapping = form?.get("mapping");
      return json({
        format: "csv",
        headers: ["Summary", "Description", "Issue key"],
        mapping: mapping
          ? JSON.parse(String(mapping))
          : {
              title: "Summary",
              description: "Description",
              acceptance_criteria: null,
              key: "Issue key",
            },
        truncated: false,
        rows: [
          {
            index: 1,
            key: "BANK-1",
            title: "Retirar efectivo",
            description: "Como cliente quiero retirar",
            acceptance_criteria: ["Uno"],
            issues: [],
            duplicate: false,
            importable: true,
          },
          {
            index: 2,
            key: "BANK-2",
            title: "Sin texto",
            description: "",
            acceptance_criteria: [],
            issues: ["Sin descripción"],
            duplicate: false,
            importable: false,
          },
          {
            index: 3,
            key: "BANK-3",
            title: "Login",
            description: "Como usuario quiero entrar",
            acceptance_criteria: [],
            issues: [],
            duplicate: false,
            importable: true,
          },
        ],
      });
    }
    if (
      method === "POST" &&
      path === `/projects/${PROJECT_ID}/stories/import:confirm`
    ) {
      const selected: number[] = JSON.parse(String(form?.get("selected")));
      const titles: Record<number, string> = {
        1: "Retirar efectivo",
        3: "Login",
      };
      selected.forEach((index) => addStory(`s-imp-${index}`, titles[index]));
      return json({ created: stories.slice(0, selected.length) }, 201);
    }

    if (method === "POST" && path === `/projects/${PROJECT_ID}/stories`) {
      addStory("s-new", body.title);
      return json(stories[0], 201);
    }

    const analysisFor = path.match(/^\/stories\/([^/]+)\/analyses$/);
    if (method === "POST" && analysisFor) {
      return json(addAnalysis(analysisFor[1], body?.use_ai ?? true), 201);
    }

    const analysisId = path.match(/^\/analyses\/(.+)$/);
    if (method === "GET" && analysisId) return json(analyses[analysisId[1]]);

    const findingId = path.match(/^\/findings\/(.+)$/);
    if (method === "PATCH" && findingId) {
      const analysis = Object.values(analyses).find((a) =>
        a.findings.some((f) => f.id === findingId[1]),
      )!;
      const finding = analysis.findings.find((f) => f.id === findingId[1])!;
      finding.decision = body.decision;
      finding.dismiss_reason =
        body.decision === "dismissed" ? body.dismiss_reason : null;
      summarize(analysis.story_id!);
      return json(analysis);
    }

    const storyId = path.match(/^\/stories\/([^/]+)$/);
    if (method === "DELETE" && storyId) {
      stories.splice(
        stories.findIndex((s) => s.id === storyId[1]),
        1,
      );
      return new Response(null, { status: 204 });
    }

    const casesFor = path.match(/^\/stories\/([^/]+)\/test-cases$/);
    if (method === "GET" && casesFor) {
      return json(cases.filter((c) => c.story_id === casesFor[1]));
    }

    const generateFor = path.match(/^\/stories\/([^/]+)\/test-cases:generate$/);
    if (method === "POST" && generateFor) {
      if (options.ai === undefined || options.generateFails) {
        return json(
          { detail: "La IA no está disponible en este momento" },
          503,
        );
      }
      const kept = cases.filter((c) => c.status !== "proposed");
      cases.splice(0, cases.length, ...kept);
      cases.push(
        makeCase(generateFor[1], 1, "Retiro menor al saldo", "scenario", 1),
        makeCase(generateFor[1], 2, "Límite del saldo", "boundary_value", 2),
      );
      return json(cases);
    }

    const caseId = path.match(/^\/test-cases\/(.+)$/);
    if (method === "PATCH" && caseId) {
      const testCase = cases.find((c) => c.id === caseId[1])!;
      testCase.status = body.status;
      return json(testCase);
    }

    if (method === "GET" && /^\/stories\/[^/]+\/traceability$/.test(path)) {
      const rows = ["Criterio uno", "Criterio dos"].map((text, i) => {
        const linked = cases.filter((c) => c.criterion_index === i + 1);
        const accepted = linked
          .filter((c) => c.status === "accepted")
          .map((c) => c.id);
        return {
          index: i + 1,
          text,
          accepted_ids: accepted,
          proposed_ids: linked
            .filter((c) => c.status === "proposed")
            .map((c) => c.id),
          covered: accepted.length > 0,
        };
      });
      const coverage = rows.filter((r) => r.covered).length / rows.length;
      return json({ rows, unlinked_ids: [], coverage });
    }

    if (method === "POST" && /^\/stories\/[^/]+\/gherkin:suggest$/.test(path)) {
      if (options.ai === undefined)
        return json({ detail: "La IA no está configurada" }, 503);
      return json({
        scenarios: [
          {
            criterion_index: 1,
            text: [
              "Escenario: Retiro",
              "Dado un saldo de 500",
              "Cuando retiro 100",
              "Entonces el saldo queda en 400",
            ].join("\n"),
          },
        ],
        model_name: "gemini-test",
        prompt_version: "gherkin-v1",
      });
    }

    const sessionsFor = path.match(/^\/stories\/([^/]+)\/qa-sessions$/);
    if (sessionsFor && method === "GET") {
      return json(
        sessions
          .filter((s) => s.story_id === sessionsFor[1])
          .map((s) => ({
            id: s.id,
            story_id: s.story_id,
            environment_name: s.environment_name,
            environment_url: s.environment_url,
            build_version: s.build_version,
            tester_name: s.tester_name,
            started_at: s.started_at,
            closed_at: s.closed_at,
            recommendation: s.recommendation,
            summary: s.summary,
          })),
      );
    }
    if (sessionsFor && method === "POST") {
      const accepted = cases.filter(
        (c) => c.story_id === sessionsFor[1] && c.status === "accepted",
      );
      if (accepted.length === 0) {
        return json(
          {
            detail:
              "No hay casos de prueba aceptados: acepta al menos uno antes de iniciar la sesión",
          },
          422,
        );
      }
      const item = (
        phase: SessionDetail["checklist"][number]["phase"],
        text: string,
      ) => ({
        id: nextId("ck"),
        phase,
        text,
        checked: false,
        note: "",
      });
      const session: SessionDetail = {
        id: nextId("qs"),
        story_id: sessionsFor[1],
        environment_name: body.environment_name,
        environment_url: body.environment_url,
        build_version: body.build_version,
        tester_name: body.tester_name,
        started_at: NOW,
        closed_at: null,
        recommendation: null,
        summary: "",
        checklist: [
          item("preparation", "Ambiente QA disponible y accesible"),
          item("execution", "Cada caso ejecutado tiene resultado y evidencia"),
          item("closure", "Recomendación final definida"),
        ],
        executions: accepted.map((c): Execution => ({
          id: nextId("ex"),
          test_case_id: c.id,
          case_title: c.title,
          technique: c.technique,
          criterion_index: c.criterion_index,
          preconditions: c.preconditions,
          steps: c.steps,
          expected_result: c.expected_result,
          result: "not_run",
          actual_result: "",
          notes: "",
          executed_at: null,
          evidences: [],
          defect: null,
        })),
        counts: { passed: 0, failed: 0, blocked: 0, not_run: 0 },
        pending: 0,
        suggested_recommendation: null,
      };
      recompute(session);
      sessions.push(session);
      return json(session, 201);
    }

    const sessionId = path.match(/^\/qa-sessions\/([^/:]+)$/);
    if (sessionId && method === "GET") {
      const session = sessions.find((s) => s.id === sessionId[1]);
      return session
        ? json(session)
        : json({ detail: "Sesión no encontrada" }, 404);
    }

    const closeId = path.match(/^\/qa-sessions\/([^/:]+):close$/);
    if (closeId && method === "POST") {
      const session = sessions.find((s) => s.id === closeId[1])!;
      if (session.pending > 0) {
        return json(
          { detail: `Faltan ${session.pending} casos por ejecutar` },
          409,
        );
      }
      session.closed_at = NOW;
      session.recommendation = body.recommendation;
      session.summary = body.summary;
      return json(session);
    }

    const checklistId = path.match(/^\/checklist-items\/(.+)$/);
    if (checklistId && method === "PATCH") {
      const item = sessions
        .flatMap((s) => s.checklist)
        .find((i) => i.id === checklistId[1])!;
      item.checked = body.checked;
      return json(item);
    }

    const executionId = path.match(/^\/executions\/([^/]+)$/);
    if (executionId && method === "PATCH") {
      const found = findExecution(executionId[1])!;
      Object.assign(found.execution, body);
      found.execution.executed_at =
        found.execution.result === "not_run" ? null : NOW;
      recompute(found.session);
      return json(found.execution);
    }

    const evidenceFor = path.match(
      /^\/executions\/([^/]+)\/evidences(\/image)?$/,
    );
    if (evidenceFor && method === "POST") {
      const found = findExecution(evidenceFor[1])!;
      const id = nextId("ev");
      let evidence: Evidence;
      if (evidenceFor[2]) {
        evidence = {
          id,
          execution_id: found.execution.id,
          type: "image",
          description: String(form?.get("description") ?? ""),
          uploaded_at: NOW,
          url: `/api/v1/evidences/${id}/file`,
        };
      } else if (body.type === "note") {
        evidence = {
          id,
          execution_id: found.execution.id,
          type: "note",
          description: body.text,
          uploaded_at: NOW,
          url: null,
        };
      } else {
        evidence = {
          id,
          execution_id: found.execution.id,
          type: "link",
          description: body.description,
          uploaded_at: NOW,
          url: body.url,
        };
      }
      found.execution.evidences.push(evidence);
      return json(evidence, 201);
    }

    const defectFor = path.match(/^\/executions\/([^/]+)\/defect-draft$/);
    if (defectFor && method === "POST") {
      const { session, execution } = findExecution(defectFor[1])!;
      if (execution.result !== "failed") {
        return json(
          { detail: "Solo se puede redactar un defecto de un caso fallido" },
          409,
        );
      }
      const aiOk = Boolean(body?.use_ai) && options.ai === "ok";
      const defect: Defect = {
        id: execution.defect?.id ?? nextId("df"),
        execution_id: execution.id,
        title: aiOk
          ? "Título redactado por IA"
          : `Falla en: ${execution.case_title}`,
        preconditions: execution.preconditions,
        steps: execution.steps,
        expected_result: execution.expected_result,
        actual_result:
          execution.actual_result || "(sin descripción del resultado obtenido)",
        severity: "major",
        priority: "high",
        frequency: "always",
        environment: `${session.environment_name} (${session.environment_url})`,
        build_version: session.build_version,
        ai_assisted: aiOk,
        created_at: NOW,
      };
      execution.defect = defect;
      const ai_status = !body?.use_ai
        ? "not_requested"
        : aiOk
          ? "ok"
          : "unavailable";
      return json({ defect, ai_status }, 201);
    }

    const defectId = path.match(/^\/defect-drafts\/(.+)$/);
    if (defectId && method === "PATCH") {
      const defect = sessions
        .flatMap((s) => s.executions)
        .map((e) => e.defect)
        .find((d) => d?.id === defectId[1])!;
      Object.assign(defect, body);
      return json(defect);
    }

    return json({ detail: "ruta no simulada" }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { requests };
}
