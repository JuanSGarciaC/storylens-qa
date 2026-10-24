import { TECHNIQUE_LABEL } from "./techniques";
import { useState } from "react";
import { useParams } from "react-router-dom";
import * as api from "../../api/client";
import type {
  CaseStatus,
  GherkinSuggestion,
  Project,
  StoryItem,
  TestCase,
  Traceability,
} from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useStory } from "../../app/useStory";
import { useAccess } from "../../shared/useAccess";
import { useAiGate } from "../../shared/useAiGate";
import { useLoad } from "../../shared/useLoad";
import { Badge, type Tone } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Spinner } from "../../shared/ui/Spinner";

const TECHNIQUES = Object.keys(TECHNIQUE_LABEL) as TestCase["technique"][];

// El estado siempre se escribe: el color solo refuerza.
const STATUS: Record<CaseStatus, { label: string; tone: Tone }> = {
  proposed: { label: "Propuesto", tone: "neutral" },
  accepted: { label: "Aceptado", tone: "ok" },
  rejected: { label: "Rechazado", tone: "danger" },
};

const PRIORITY_LABEL: Record<TestCase["priority"], string> = {
  high: "Prioridad alta",
  medium: "Prioridad media",
  low: "Prioridad baja",
};

const ErrorText = ({ message }: { message: string }) => (
  <p role="alert" className="field__error wrap">
    {message}
  </p>
);

type Loaded = { cases: TestCase[]; trace: Traceability };

function CaseItem({
  testCase,
  canWrite,
  busy,
  error,
  onStatus,
}: {
  testCase: TestCase;
  canWrite: boolean;
  busy: boolean;
  error: string;
  onStatus: (testCase: TestCase, status: CaseStatus) => void;
}) {
  const status = STATUS[testCase.status];
  const action = (to: CaseStatus, verb: string) =>
    testCase.status === to ? null : (
      <Button
        variant="ghost"
        disabled={busy}
        aria-label={`${verb} caso ${testCase.title}`}
        onClick={() => onStatus(testCase, to)}
      >
        {verb}
      </Button>
    );
  return (
    <li className="case">
      <div className="case__head">
        <strong className="wrap">{testCase.title}</strong>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="hint wrap">
        {PRIORITY_LABEL[testCase.priority]} ·{" "}
        {testCase.criterion_index
          ? `Criterio ${testCase.criterion_index}`
          : "Sin criterio asociado"}
        {testCase.origin === "ai" && " · Sugerido por IA"}
      </p>
      <div className="prose wrap">
        {testCase.preconditions ? (
          <p>
            <strong>Precondiciones:</strong> {testCase.preconditions}
          </p>
        ) : null}
        <ol>
          {testCase.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
        {testCase.test_data ? (
          <p>
            <strong>Datos:</strong> {testCase.test_data}
          </p>
        ) : null}
        <p>
          <strong>Resultado esperado:</strong> {testCase.expected_result}
        </p>
      </div>
      {testCase.gherkin ? (
        <pre className="gherkin" tabIndex={0}>
          {testCase.gherkin}
        </pre>
      ) : null}
      {error ? <ErrorText message={error} /> : null}
      {canWrite ? (
        <div className="toolbar">
          {action("accepted", "Aceptar")}
          {action("rejected", "Rechazar")}
          {action("proposed", "Restablecer")}
        </div>
      ) : null}
    </li>
  );
}

function TraceTable({
  trace,
  cases,
}: {
  trace: Traceability;
  cases: TestCase[];
}) {
  const title = (id: string) => cases.find((c) => c.id === id)?.title ?? id;
  const list = (ids: string[]) =>
    ids.length === 0 ? (
      <span className="hint">Ninguno</span>
    ) : (
      <ul className="trace__cases">
        {ids.map((id) => (
          <li key={id} className="wrap">
            {title(id)}
          </li>
        ))}
      </ul>
    );
  return (
    <div className="trace-wrap">
      <table className="trace">
        <thead>
          <tr>
            <th scope="col">Criterio</th>
            <th scope="col">Casos aceptados</th>
            <th scope="col">Casos propuestos</th>
          </tr>
        </thead>
        <tbody>
          {trace.rows.map((row) => (
            <tr key={row.index} className={row.covered ? "" : "trace__gap"}>
              <th scope="row">
                <span className="wrap">
                  {row.index}. {row.text}
                </span>
                {!row.covered ? <Badge tone="warn">Sin cobertura</Badge> : null}
              </th>
              <td>{list(row.accepted_ids)}</td>
              <td>{list(row.proposed_ids)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestsView({ story, project }: { story: StoryItem; project: Project }) {
  const access = useAccess(project);
  const gate = useAiGate(access);
  const data = useLoad<Loaded>(async () => {
    const [cases, trace] = await Promise.all([
      api.listCases(story.id),
      api.getTraceability(story.id),
    ]);
    return { cases, trace };
  }, `tests-${story.id}`);
  const [busy, setBusy] = useState<"generate" | "gherkin" | "status" | null>(
    null,
  );
  const [aiError, setAiError] = useState("");
  const [caseError, setCaseError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [gherkin, setGherkin] = useState<GherkinSuggestion | null>(null);
  const [traceStale, setTraceStale] = useState(false);

  if (data.loading) return <Spinner label="Cargando casos de prueba…" />;
  if (data.error || !data.data) {
    return <ErrorNotice message={data.error} onRetry={data.reload} />;
  }
  const { cases, trace } = data.data;
  const message = (e: unknown) =>
    e instanceof Error ? e.message : "No se pudo completar.";

  /** Aplica los casos ya guardados y refresca la trazabilidad sin que su fallo cuente como error de la acción. */
  async function applyCases(next: TestCase[]) {
    data.set({ cases: next, trace });
    try {
      data.set({ cases: next, trace: await api.getTraceability(story.id) });
      setTraceStale(false);
    } catch {
      setTraceStale(true);
    }
  }

  async function retryTrace() {
    setBusy("status");
    try {
      data.set({ cases, trace: await api.getTraceability(story.id) });
      setTraceStale(false);
    } catch {
      setTraceStale(true);
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setBusy("generate");
    setAiError("");
    setCaseError(null);
    let failed = false;
    try {
      const next = await api.generateCases(story.id);
      await applyCases(next);
    } catch (e) {
      failed = true;
      setAiError(message(e));
    } finally {
      // Se refresca siempre: la consulta pudo gastarse aunque la petición fallara.
      await gate.afterAiCall(failed);
      setBusy(null);
    }
  }

  async function suggest() {
    setBusy("gherkin");
    setAiError("");
    setCaseError(null);
    let failed = false;
    try {
      setGherkin(await api.suggestGherkin(story.id));
    } catch (e) {
      failed = true;
      setAiError(message(e));
    } finally {
      await gate.afterAiCall(failed);
      setBusy(null);
    }
  }

  async function changeStatus(testCase: TestCase, status: CaseStatus) {
    setBusy("status");
    setAiError("");
    setCaseError(null);
    try {
      const updated = await api.updateCaseStatus(testCase.id, status);
      await applyCases(cases.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e) {
      setCaseError({ id: testCase.id, message: message(e) });
    } finally {
      setBusy(null);
    }
  }

  const toolbar = (
    <>
      <div className="toolbar">
        <Button
          disabled={!gate.enabled || busy !== null}
          loading={busy === "generate"}
          onClick={() => void generate()}
        >
          Generar casos
        </Button>
        <Button
          variant="ghost"
          disabled={!gate.enabled || busy !== null}
          loading={busy === "gherkin"}
          onClick={() => void suggest()}
        >
          Sugerir Gherkin
        </Button>
      </div>
      {gate.reason ? <p className="hint">{gate.reason}</p> : null}
      {gate.aiDown ? (
        <div>
          <Button variant="ghost" onClick={gate.recheck}>
            Comprobar de nuevo
          </Button>
        </div>
      ) : null}
      {aiError ? <ErrorText message={aiError} /> : null}
    </>
  );

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title wrap">
          {story.title || "Historia sin título"}
        </h1>
        <p className="page__lead">
          Casos de prueba, Gherkin y trazabilidad con los criterios.
        </p>
      </header>

      {cases.length === 0 ? (
        <EmptyState
          title="Esta historia aún no tiene casos de prueba"
          body="Genera una propuesta con técnicas de diseño de pruebas (partición de equivalencia, valores límite, tablas de decisión…) y revisa cada caso antes de aceptarlo."
          action={toolbar}
        />
      ) : (
        <section aria-labelledby="actions-title" className="stack">
          <h2 id="actions-title" className="visually-hidden">
            Acciones
          </h2>
          {toolbar}
        </section>
      )}

      {cases.length > 0 ? (
        <section aria-labelledby="cases-title" className="stack">
          <h2 id="cases-title">Casos de prueba</h2>
          {TECHNIQUES.map((technique) => {
            const group = cases.filter((c) => c.technique === technique);
            if (group.length === 0) return null;
            const headingId = `tech-${technique}`;
            return (
              <section
                key={technique}
                aria-labelledby={headingId}
                className="stack"
              >
                <h3 id={headingId} className="finding-group__title">
                  {TECHNIQUE_LABEL[technique]}{" "}
                  <span className="hint">({group.length})</span>
                </h3>
                <ul className="cases">
                  {group.map((testCase) => (
                    <CaseItem
                      key={testCase.id}
                      testCase={testCase}
                      canWrite={access.canWrite}
                      busy={busy !== null}
                      error={
                        caseError && caseError.id === testCase.id
                          ? caseError.message
                          : ""
                      }
                      onStatus={(c, s) => void changeStatus(c, s)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </section>
      ) : null}

      {traceStale ? (
        <div role="status" className="toolbar">
          <span className="hint">No se pudo actualizar la trazabilidad</span>
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void retryTrace()}
          >
            Reintentar trazabilidad
          </Button>
        </div>
      ) : null}

      {trace.rows.length > 0 ? (
        <section aria-labelledby="trace-title" className="stack">
          <h2 id="trace-title">Trazabilidad criterio y caso</h2>
          <p className="hint">
            Cobertura (criterios con al menos un caso aceptado):{" "}
            <strong>{Math.round(trace.coverage * 100)}%</strong>
          </p>
          <TraceTable trace={trace} cases={cases} />
        </section>
      ) : null}

      {gherkin ? (
        <section aria-labelledby="gherkin-title" className="stack">
          <h2 id="gherkin-title">Gherkin sugerido</h2>
          {gherkin.scenarios.length === 0 ? (
            <p className="hint">La IA no devolvió escenarios válidos.</p>
          ) : (
            gherkin.scenarios.map((scenario, index) => (
              <pre key={index} className="gherkin" tabIndex={0}>
                {scenario.criterion_index
                  ? `# Criterio ${scenario.criterion_index}\n`
                  : ""}
                {scenario.text}
              </pre>
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}

export function TestsPage() {
  const { projectId, storyId } = useParams();
  const { project } = useProject();
  const { story, loading, error } = useStory(projectId, storyId);
  if (error) return <ErrorNotice message={error} />;
  if (loading || !story || !project) {
    return <Spinner label="Cargando historia…" />;
  }
  return <TestsView key={story.id} story={story} project={project} />;
}
