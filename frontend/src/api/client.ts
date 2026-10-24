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
export type ImportJob = Schemas["ImportJobOut"];
export type ImportJobDetail = Schemas["ImportJobDetailOut"];
export type ImportJobItem = Schemas["ImportItemOut"];
export type ImportMapping = Record<string, string | null>;
export type DefectDraftResult = Schemas["DefectDraftOut"];
export type Project = Schemas["ProjectOut"];
export type ProjectInput = Schemas["ProjectIn"];
export type ProjectPatch = Schemas["ProjectPatch"];
export type Me = Schemas["MeOut"];
export type Named = Schemas["NamedOut"];
export type Rule = Schemas["RuleOut"];
export type AuditEvent = Schemas["AuditEventOut"];
export type Recommendation = NonNullable<SessionDetail["recommendation"]>;

/** Codifica un id para usarlo como segmento de ruta. */
const enc = encodeURIComponent;

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

/** URL del API para enlaces de descarga; única fuente de la base. */
export const apiUrl = (path: string): string => `${BASE_URL}${path}`;

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
  request<Project>(`/projects/${enc(projectId)}`);

export const updateProject = (projectId: string, patch: ProjectPatch) =>
  request<Project>(`/projects/${enc(projectId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const deleteProject = (projectId: string) =>
  request<void>(`/projects/${enc(projectId)}`, { method: "DELETE" });

export const listEpics = (projectId: string) =>
  request<Named[]>(`/projects/${enc(projectId)}/epics`);

export const createEpic = (projectId: string, name: string) =>
  request<Named>(`/projects/${enc(projectId)}/epics`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const listVersions = (projectId: string) =>
  request<Named[]>(`/projects/${enc(projectId)}/versions`);

export const createVersion = (projectId: string, name: string) =>
  request<Named>(`/projects/${enc(projectId)}/versions`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const listAudit = (projectId: string, limit = 50, offset = 0) =>
  request<AuditEvent[]>(
    `/projects/${enc(projectId)}/audit?limit=${limit}&offset=${offset}`,
  );

export const listRules = () => request<Rule[]>("/rules");

// --- historias ---
export const listStories = (projectId: string) =>
  request<StoryItem[]>(`/projects/${enc(projectId)}/stories`);

export const getStory = (storyId: string) =>
  request<StoryItem>(`/stories/${enc(storyId)}`);

export const createStory = (projectId: string, story: StoryInput) =>
  request<StoryItem>(`/projects/${enc(projectId)}/stories`, {
    method: "POST",
    body: JSON.stringify(story),
  });

export const deleteStory = (storyId: string) =>
  request<void>(`/stories/${enc(storyId)}`, { method: "DELETE" });

export const createAnalysis = (storyId: string, useAi: boolean) =>
  request<Analysis>(`/stories/${enc(storyId)}/analyses`, {
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
  request<Analysis>(`/analyses/${enc(analysisId)}`);

export const decideFinding = (
  findingId: string,
  decision: Decision,
  reason?: string,
) =>
  request<Analysis>(`/findings/${enc(findingId)}`, {
    method: "PATCH",
    body: JSON.stringify({ decision, dismiss_reason: reason ?? null }),
  });

export const listCases = (storyId: string) =>
  request<TestCase[]>(`/stories/${enc(storyId)}/test-cases`);

export const generateCases = (storyId: string) =>
  request<TestCase[]>(`/stories/${enc(storyId)}/test-cases:generate`, {
    method: "POST",
    body: JSON.stringify({ techniques: [] }),
  });

export const updateCaseStatus = (caseId: string, status: CaseStatus) =>
  request<TestCase>(`/test-cases/${enc(caseId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const getTraceability = (storyId: string) =>
  request<Traceability>(`/stories/${enc(storyId)}/traceability`);

export const suggestGherkin = (storyId: string) =>
  request<GherkinSuggestion>(`/stories/${enc(storyId)}/gherkin:suggest`, {
    method: "POST",
  });

// --- sesiones de revisión en el ambiente QA ---
export const listSessions = (storyId: string) =>
  request<SessionSummary[]>(`/stories/${enc(storyId)}/qa-sessions`);

export const createSession = (storyId: string, input: SessionInput) =>
  request<SessionDetail>(`/stories/${enc(storyId)}/qa-sessions`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getSession = (sessionId: string) =>
  request<SessionDetail>(`/qa-sessions/${enc(sessionId)}`);

export const closeSession = (
  sessionId: string,
  recommendation: Recommendation,
  summary: string,
) =>
  request<SessionDetail>(`/qa-sessions/${enc(sessionId)}:close`, {
    method: "POST",
    body: JSON.stringify({ recommendation, summary }),
  });

export const updateChecklistItem = (itemId: string, checked: boolean) =>
  request<ChecklistItem>(`/checklist-items/${enc(itemId)}`, {
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
  request<Execution>(`/executions/${enc(executionId)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

export const addNoteEvidence = (executionId: string, text: string) =>
  request<Evidence>(`/executions/${enc(executionId)}/evidences`, {
    method: "POST",
    body: JSON.stringify({ type: "note", text }),
  });

export const addLinkEvidence = (
  executionId: string,
  url: string,
  description: string,
) =>
  request<Evidence>(`/executions/${enc(executionId)}/evidences`, {
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
  return request<Evidence>(`/executions/${enc(executionId)}/evidences/image`, {
    method: "POST",
    body: form,
  });
};

export const draftDefect = (executionId: string, useAi: boolean) =>
  request<DefectDraftResult>(`/executions/${enc(executionId)}/defect-draft`, {
    method: "POST",
    body: JSON.stringify({ use_ai: useAi }),
  });

export const updateDefect = (defectId: string, changes: DefectUpdate) =>
  request<Defect>(`/defect-drafts/${enc(defectId)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

function importForm(
  file: File,
  mapping: ImportMapping | null,
  selected?: number[],
  useAi?: boolean,
) {
  const form = new FormData();
  form.append("file", file);
  if (mapping) form.append("mapping", JSON.stringify(mapping));
  if (selected) form.append("selected", JSON.stringify(selected));
  if (useAi !== undefined) form.append("use_ai", String(useAi));
  return form;
}

export const previewImport = (
  projectId: string,
  file: File,
  mapping: ImportMapping | null,
) =>
  request<ImportPreview>(`/projects/${enc(projectId)}/stories/import`, {
    method: "POST",
    body: importForm(file, mapping),
  });

/** Crea la importación en segundo plano; el avance se consulta con `getImportJob`. */
export const startImportJob = (
  projectId: string,
  file: File,
  mapping: ImportMapping | null,
  selected: number[],
  useAi: boolean,
) =>
  request<ImportJob>(`/projects/${enc(projectId)}/import-jobs`, {
    method: "POST",
    body: importForm(file, mapping, selected, useAi),
  });

export const listImportJobs = (projectId: string) =>
  request<ImportJob[]>(`/projects/${enc(projectId)}/import-jobs`);

export const getImportJob = (
  jobId: string,
  options: { limit?: number; offset?: number; status?: string } = {},
) => {
  const query = new URLSearchParams();
  if (options.limit !== undefined) query.set("limit", String(options.limit));
  if (options.offset !== undefined) query.set("offset", String(options.offset));
  if (options.status) query.set("status", options.status);
  const suffix = query.size ? `?${query}` : "";
  return request<ImportJobDetail>(`/import-jobs/${enc(jobId)}${suffix}`);
};

export const retryImportJob = (jobId: string) =>
  request<ImportJob>(`/import-jobs/${enc(jobId)}:retry`, { method: "POST" });

export const cancelImportJob = (jobId: string) =>
  request<ImportJob>(`/import-jobs/${enc(jobId)}:cancel`, { method: "POST" });
