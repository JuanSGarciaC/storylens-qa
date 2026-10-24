import type { components } from "./schema";

type Schemas = components["schemas"];

export type StoryInput = Schemas["StoryIn"];
export type StoryItem = Schemas["StoryOut"];
export type Analysis = Schemas["AnalysisOut"];
export type Finding = Schemas["FindingOut"];
export type Decision = Schemas["Decision"];
export type TestCase = Schemas["CaseOut"];
export type CaseStatus = TestCase["status"];
export type Technique = TestCase["technique"];
export type Traceability = Schemas["TraceabilityOut"];
export type GherkinSuggestion = Schemas["GherkinOut"];
export type SessionSummary = Schemas["SessionSummaryOut"];
export type SessionDetail = Schemas["SessionDetailOut"];
export type SessionInput = Schemas["SessionIn"];
export type ChecklistItem = Schemas["ChecklistItemOut"];
export type Execution = Schemas["ExecutionOut"];
export type ExecutionResult = Execution["result"];
export type Evidence = Schemas["EvidenceOut"];
export type Defect = Schemas["DefectOut"];
export type DefectUpdate = Schemas["DefectUpdate"];
export type ImportPreview = Schemas["ImportPreviewOut"];
export type ImportRow = Schemas["ImportRowOut"];
export type ImportMapping = Record<string, string | null>;
export type DefectDraftResult = Schemas["DefectDraftOut"];
export type Project = Schemas["ProjectOut"];
export type ProjectInput = Schemas["ProjectIn"];
export type ProjectPatch = Schemas["ProjectPatch"];
export type Me = Schemas["MeOut"];
export type Named = Schemas["NamedOut"];
export type AuditEvent = Schemas["AuditEventOut"];
export type Recommendation = NonNullable<SessionDetail["recommendation"]>;

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Registra qué hacer ante un 401 (salvo en /auth/*): normalmente, volver al login. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

/** Usa el `detail` del Problem Details cuando es texto; si no, un mensaje genérico. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // cuerpo vacío o que no es JSON: se usa el mensaje genérico
  }
  if (response.status === 422) {
    return "Los datos enviados no son válidos (revisa el tamaño máximo).";
  }
  return `El servidor respondió con un error (${response.status}).`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    // Con FormData el navegador fija el Content-Type (con el límite del multipart).
    const headers: HeadersInit =
      typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {};
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor.", 0);
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/")) {
      unauthorizedHandler?.();
    }
    throw new ApiError(await errorMessage(response), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// --- sesión ---
export const login = (email: string, password: string) =>
  request<Me>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = () => request<void>("/auth/logout", { method: "POST" });

export const getMe = (signal?: AbortSignal) =>
  request<Me>("/auth/me", { signal });

// --- proyectos ---
export const listProjects = () => request<Project[]>("/projects");

export const createProject = (input: ProjectInput) =>
  request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getProject = (projectId: string) =>
  request<Project>(`/projects/${projectId}`);

export const updateProject = (projectId: string, patch: ProjectPatch) =>
  request<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const deleteProject = (projectId: string) =>
  request<void>(`/projects/${projectId}`, { method: "DELETE" });

export const listEpics = (projectId: string) =>
  request<Named[]>(`/projects/${projectId}/epics`);

export const createEpic = (projectId: string, name: string) =>
  request<Named>(`/projects/${projectId}/epics`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const listVersions = (projectId: string) =>
  request<Named[]>(`/projects/${projectId}/versions`);

export const createVersion = (projectId: string, name: string) =>
  request<Named>(`/projects/${projectId}/versions`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const listAudit = (projectId: string, limit = 50, offset = 0) =>
  request<AuditEvent[]>(
    `/projects/${projectId}/audit?limit=${limit}&offset=${offset}`,
  );

// --- historias ---
export const listStories = (projectId: string) =>
  request<StoryItem[]>(`/projects/${projectId}/stories`);

export const getStory = (storyId: string) =>
  request<StoryItem>(`/stories/${storyId}`);

export const createStory = (projectId: string, story: StoryInput) =>
  request<StoryItem>(`/projects/${projectId}/stories`, {
    method: "POST",
    body: JSON.stringify(story),
  });

export const deleteStory = (storyId: string) =>
  request<void>(`/stories/${storyId}`, { method: "DELETE" });

export const createAnalysis = (storyId: string, useAi: boolean) =>
  request<Analysis>(`/stories/${storyId}/analyses`, {
    method: "POST",
    body: JSON.stringify({ use_ai: useAi }),
  });

export interface Health {
  status: string;
  ai_configured: boolean;
  /** Consultas de IA que quedan hoy; ausente o nulo si el servidor no lo informa. */
  ai_quota_remaining_today?: number | null;
}

export const getHealth = (signal?: AbortSignal) =>
  request<Health>("/health", { signal });

export const getAnalysis = (analysisId: string) =>
  request<Analysis>(`/analyses/${analysisId}`);

export const decideFinding = (
  findingId: string,
  decision: Decision,
  reason?: string,
) =>
  request<Analysis>(`/findings/${findingId}`, {
    method: "PATCH",
    body: JSON.stringify({ decision, dismiss_reason: reason ?? null }),
  });

export const listCases = (storyId: string) =>
  request<TestCase[]>(`/stories/${storyId}/test-cases`);

export const generateCases = (storyId: string) =>
  request<TestCase[]>(`/stories/${storyId}/test-cases:generate`, {
    method: "POST",
    body: JSON.stringify({ techniques: [] }),
  });

export const updateCaseStatus = (caseId: string, status: CaseStatus) =>
  request<TestCase>(`/test-cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const getTraceability = (storyId: string) =>
  request<Traceability>(`/stories/${storyId}/traceability`);

export const suggestGherkin = (storyId: string) =>
  request<GherkinSuggestion>(`/stories/${storyId}/gherkin:suggest`, {
    method: "POST",
  });

// --- sesiones de revisión en el ambiente QA ---
export const listSessions = (storyId: string) =>
  request<SessionSummary[]>(`/stories/${storyId}/qa-sessions`);

export const createSession = (storyId: string, input: SessionInput) =>
  request<SessionDetail>(`/stories/${storyId}/qa-sessions`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getSession = (sessionId: string) =>
  request<SessionDetail>(`/qa-sessions/${sessionId}`);

export const closeSession = (
  sessionId: string,
  recommendation: Recommendation,
  summary: string,
) =>
  request<SessionDetail>(`/qa-sessions/${sessionId}:close`, {
    method: "POST",
    body: JSON.stringify({ recommendation, summary }),
  });

export const updateChecklistItem = (itemId: string, checked: boolean) =>
  request<ChecklistItem>(`/checklist-items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ checked }),
  });

export interface ExecutionChanges {
  result?: ExecutionResult;
  actual_result?: string;
  notes?: string;
}

export const updateExecution = (
  executionId: string,
  changes: ExecutionChanges,
) =>
  request<Execution>(`/executions/${executionId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

export const addNoteEvidence = (executionId: string, text: string) =>
  request<Evidence>(`/executions/${executionId}/evidences`, {
    method: "POST",
    body: JSON.stringify({ type: "note", text }),
  });

export const addLinkEvidence = (
  executionId: string,
  url: string,
  description: string,
) =>
  request<Evidence>(`/executions/${executionId}/evidences`, {
    method: "POST",
    body: JSON.stringify({ type: "link", url, description }),
  });

export const uploadImageEvidence = (
  executionId: string,
  file: File,
  description: string,
) => {
  const form = new FormData();
  form.append("file", file);
  form.append("description", description);
  return request<Evidence>(`/executions/${executionId}/evidences/image`, {
    method: "POST",
    body: form,
  });
};

export const draftDefect = (executionId: string, useAi: boolean) =>
  request<DefectDraftResult>(`/executions/${executionId}/defect-draft`, {
    method: "POST",
    body: JSON.stringify({ use_ai: useAi }),
  });

export const updateDefect = (defectId: string, changes: DefectUpdate) =>
  request<Defect>(`/defect-drafts/${defectId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

function importForm(
  file: File,
  mapping: ImportMapping | null,
  selected?: number[],
) {
  const form = new FormData();
  form.append("file", file);
  if (mapping) form.append("mapping", JSON.stringify(mapping));
  if (selected) form.append("selected", JSON.stringify(selected));
  return form;
}

export const previewImport = (
  projectId: string,
  file: File,
  mapping: ImportMapping | null,
) =>
  request<ImportPreview>(`/projects/${projectId}/stories/import`, {
    method: "POST",
    body: importForm(file, mapping),
  });

export const confirmImport = (
  projectId: string,
  file: File,
  mapping: ImportMapping | null,
  selected: number[],
) =>
  request<{ created: StoryItem[] }>(
    `/projects/${projectId}/stories/import:confirm`,
    {
      method: "POST",
      body: importForm(file, mapping, selected),
    },
  );
