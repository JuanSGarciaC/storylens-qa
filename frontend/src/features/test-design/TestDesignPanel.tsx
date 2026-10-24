import { useCallback, useEffect, useState } from "react";
import {
  generateCases,
  getTraceability,
  listCases,
  suggestGherkin,
  updateCaseStatus,
  type CaseStatus,
  type GherkinSuggestion,
  type TestCase,
  type Traceability,
} from "../../api/client";

const TECHNIQUE_LABEL: Record<TestCase["technique"], string> = {
  equivalence_partitioning: "Partición de equivalencia",
  boundary_value: "Valores límite",
  decision_table: "Tabla de decisión",
  state_transition: "Transición de estados",
  scenario: "Escenario",
  error_guessing: "Predicción de errores",
};

const STATUS_LABEL: Record<CaseStatus, string> = {
  proposed: "Propuesto",
  accepted: "Aceptado",
  rejected: "Rechazado",
};

const PRIORITY_LABEL: Record<TestCase["priority"], string> = {
  high: "Prioridad alta",
  medium: "Prioridad media",
  low: "Prioridad baja",
};

interface Props {
  storyId: string;
  aiAvailable: boolean;
}

function CaseItem({
  testCase,
  busy,
  onStatus,
}: {
  testCase: TestCase;
  busy: boolean;
  onStatus: (testCase: TestCase, status: CaseStatus) => void;
}) {
  return (
    <li className={`case status-${testCase.status}`}>
      <p className="finding-head">
        <strong>{testCase.title}</strong>
        <span className="badge">{STATUS_LABEL[testCase.status]}</span>
      </p>
      <p className="meta">
        {TECHNIQUE_LABEL[testCase.technique]} ·{" "}
        {PRIORITY_LABEL[testCase.priority]} ·{" "}
        {testCase.criterion_index
          ? `Criterio ${testCase.criterion_index}`
          : "Sin criterio asociado"}
        {testCase.origin === "ai" && " · Sugerido por IA"}
      </p>
      {testCase.preconditions && (
        <p>
          <strong>Precondiciones:</strong> {testCase.preconditions}
        </p>
      )}
      <ol>
        {testCase.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      {testCase.test_data && (
        <p>
          <strong>Datos:</strong> {testCase.test_data}
        </p>
      )}
      <p>
        <strong>Resultado esperado:</strong> {testCase.expected_result}
      </p>
      <div className="actions">
        {testCase.status !== "accepted" && (
          <button
            type="button"
            disabled={busy}
            aria-label={`Aceptar caso ${testCase.title}`}
            onClick={() => onStatus(testCase, "accepted")}
          >
            Aceptar
          </button>
        )}
        {testCase.status !== "rejected" && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            aria-label={`Rechazar caso ${testCase.title}`}
            onClick={() => onStatus(testCase, "rejected")}
          >
            Rechazar
          </button>
        )}
        {testCase.status !== "proposed" && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            aria-label={`Restablecer caso ${testCase.title}`}
            onClick={() => onStatus(testCase, "proposed")}
          >
            Restablecer
          </button>
        )}
      </div>
    </li>
  );
}

export function TestDesignPanel({ storyId, aiAvailable }: Props) {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [trace, setTrace] = useState<Traceability | null>(null);
  const [gherkin, setGherkin] = useState<GherkinSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCases(storyId), getTraceability(storyId)])
      .then(([loadedCases, loadedTrace]) => {
        if (cancelled) return;
        setCases(loadedCases);
        setTrace(loadedTrace);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Error inesperado.");
      });
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshTrace = async () => setTrace(await getTraceability(storyId));

  const handleGenerate = () =>
    run(async () => {
      setCases(await generateCases(storyId));
      await refreshTrace();
    });

  const handleStatus = (testCase: TestCase, status: CaseStatus) =>
    run(async () => {
      const updated = await updateCaseStatus(testCase.id, status);
      setCases((current) =>
        current.map((c) => (c.id === updated.id ? updated : c)),
      );
      await refreshTrace();
    });

  const handleGherkin = () =>
    run(async () => setGherkin(await suggestGherkin(storyId)));

  return (
    <section className="card" aria-labelledby="design-title">
      <h2 id="design-title">Casos de prueba</h2>

      <div className="actions">
        <button
          type="button"
          disabled={busy || !aiAvailable}
          onClick={handleGenerate}
        >
          Generar casos con IA
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || !aiAvailable}
          onClick={handleGherkin}
        >
          Sugerir Gherkin
        </button>
      </div>
      {!aiAvailable && (
        <p className="hint">
          La IA no está configurada en el servidor: no se pueden generar casos.
        </p>
      )}

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {cases.length === 0 ? (
        <p className="meta">Aún no hay casos de prueba para esta historia.</p>
      ) : (
        <ul className="cases">
          {cases.map((testCase) => (
            <CaseItem
              key={testCase.id}
              testCase={testCase}
              busy={busy}
              onStatus={handleStatus}
            />
          ))}
        </ul>
      )}

      {trace && trace.rows.length > 0 && (
        <>
          <h3>Trazabilidad criterio ↔ caso</h3>
          <p className="meta">
            Cobertura (criterios con al menos un caso aceptado):{" "}
            <strong>{Math.round(trace.coverage * 100)}%</strong>
          </p>
          <table className="trace">
            <thead>
              <tr>
                <th scope="col">Criterio</th>
                <th scope="col">Aceptados</th>
                <th scope="col">Propuestos</th>
              </tr>
            </thead>
            <tbody>
              {trace.rows.map((row) => (
                <tr key={row.index}>
                  <th scope="row">
                    {row.index}. {row.text}
                    {!row.covered && (
                      <span className="badge"> · Sin cobertura</span>
                    )}
                  </th>
                  <td>{row.accepted_ids.length}</td>
                  <td>{row.proposed_ids.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {gherkin && (
        <>
          <h3>Gherkin sugerido</h3>
          {gherkin.scenarios.length === 0 ? (
            <p className="meta">La IA no devolvió escenarios válidos.</p>
          ) : (
            gherkin.scenarios.map((scenario, index) => (
              <pre key={index} className="gherkin">
                {scenario.criterion_index
                  ? `# Criterio ${scenario.criterion_index}\n`
                  : ""}
                {scenario.text}
              </pre>
            ))
          )}
        </>
      )}
    </section>
  );
}
