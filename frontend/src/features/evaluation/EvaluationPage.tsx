import { useEffect, useState } from "react";
import * as api from "../../api/client";
import type { EvaluationRun } from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useAccess } from "../../shared/useAccess";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Spinner } from "../../shared/ui/Spinner";
import { useLoad } from "../../shared/useLoad";
import {
  MODE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  compareRuns,
  kindMetrics,
  injectionSummary,
} from "./evaluationView";

const POLL_MS = 3000;

const pct = (value: number) => `${(value * 100).toFixed(0)} %`;
const signed = (delta: number) =>
  `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)} pts`;

function RunSummary({ run }: { run: EvaluationRun }) {
  const det = kindMetrics(run, "det");
  const ai = kindMetrics(run, "ai");
  const injection = injectionSummary(run);
  return (
    <section aria-labelledby="run-detail">
      <h3 id="run-detail">
        {MODE_LABEL[run.mode] ?? run.mode} ·{" "}
        {new Date(run.created_at).toLocaleString("es-ES")}
      </h3>
      <p>
        <Badge tone={STATUS_TONE[run.status] ?? "neutral"}>
          {STATUS_LABEL[run.status] ?? run.status}
        </Badge>{" "}
        <span className="mono">
          {run.processed} de {run.total}
        </span>
        {run.model_name && (
          <>
            {" "}
            · modelo <span className="mono">{run.model_name}</span>
          </>
        )}
        {run.prompt_version && (
          <>
            {" "}
            · prompt <span className="mono">{run.prompt_version}</span>
          </>
        )}{" "}
        · catálogo <span className="mono">v{run.catalog_version}</span>
      </p>
      {run.note && <p className="hint">{run.note}</p>}

      {(det || ai) && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">
              Precisión, exhaustividad y F1 de la corrida
            </caption>
            <thead>
              <tr>
                <th scope="col">Tipo de regla</th>
                <th scope="col">Precisión</th>
                <th scope="col">Exhaustividad</th>
                <th scope="col">F1</th>
                <th scope="col">Aciertos</th>
                <th scope="col">Sobran</th>
                <th scope="col">Faltan</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Reglas automáticas", det],
                ["Reglas de IA", ai],
              ].map(([label, m]) =>
                m && typeof label === "string" && typeof m !== "string" ? (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td className="mono">{pct(m.precision)}</td>
                    <td className="mono">{pct(m.recall)}</td>
                    <td className="mono">{pct(m.f1)}</td>
                    <td className="mono">{m.tp}</td>
                    <td className="mono">{m.fp}</td>
                    <td className="mono">{m.fn}</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      )}
      {run.mode === "rules_ai" && (
        <p className="hint">
          La IA se midió en {String(run.details.measured_for_ai ?? 0)} de{" "}
          {run.total} historias: donde no respondió no cuenta, ni a favor ni en
          contra.
        </p>
      )}

      {injection && (
        <>
          <p>
            Pasaron <span className="mono">{injection.passed}</span> de{" "}
            <span className="mono">{injection.total}</span> pruebas de inyección
            {injection.failed > 0 && (
              <>
                ; <strong>{injection.failed} fallaron</strong>
              </>
            )}
            {injection.not_evaluable > 0 && (
              <> ({injection.not_evaluable} no se pudieron evaluar)</>
            )}
            .
          </p>
          <ul>
            {injection.results.map((r) => (
              <li key={r.id}>
                <Badge
                  tone={
                    r.status === "passed"
                      ? "ok"
                      : r.status === "failed"
                        ? "danger"
                        : "warn"
                  }
                >
                  {r.status === "passed"
                    ? "Pasó"
                    : r.status === "failed"
                      ? "Falló"
                      : "No evaluable"}
                </Badge>{" "}
                <span className="mono">{r.id}</span>: {r.reason}
              </li>
            ))}
          </ul>
        </>
      )}

      {Array.isArray(run.details.stories) && run.details.stories.length > 0 && (
        <details>
          <summary>
            Diferencias con lo esperado ({run.details.stories.length} historias)
          </summary>
          <ul>
            {(
              run.details.stories as {
                id: string;
                missing: string[];
                extra: string[];
              }[]
            ).map((d) => (
              <li key={d.id}>
                <span className="mono">{d.id}</span> — faltan:{" "}
                {d.missing.join(", ") || "—"} · sobran:{" "}
                {d.extra.join(", ") || "—"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Comparison({ runs }: { runs: EvaluationRun[] }) {
  const finished = runs.filter((r) => r.status !== "running");
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const a = finished.find((r) => r.id === aId);
  const b = finished.find((r) => r.id === bId);
  const rows = a && b ? compareRuns(a, b) : [];
  const option = (r: EvaluationRun) => (
    <option key={r.id} value={r.id}>
      {MODE_LABEL[r.mode] ?? r.mode} —{" "}
      {new Date(r.created_at).toLocaleString("es-ES")}
      {r.model_name ? ` — ${r.model_name}` : ""}
    </option>
  );
  if (finished.length < 2) {
    return <p>Hacen falta al menos dos corridas terminadas para comparar.</p>;
  }
  return (
    <>
      <p>
        <label>
          Corrida base{" "}
          <select value={aId} onChange={(e) => setAId(e.target.value)}>
            <option value="">Elige una</option>
            {finished.map(option)}
          </select>
        </label>{" "}
        <label>
          Comparar con{" "}
          <select value={bId} onChange={(e) => setBId(e.target.value)}>
            <option value="">Elige otra</option>
            {finished.map(option)}
          </select>
        </label>
      </p>
      {a && b && rows.length === 0 && (
        <p>
          Estas corridas no tienen métricas en común (por ejemplo, una de
          inyección con una de reglas).
        </p>
      )}
      {rows.length > 0 && (
        <div className="table-wrap" role="status">
          <table className="table">
            <caption className="visually-hidden">
              Cambio entre las dos corridas
            </caption>
            <thead>
              <tr>
                <th scope="col">Métrica</th>
                <th scope="col">Base</th>
                <th scope="col">Comparada</th>
                <th scope="col">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td className="mono">{pct(r.base)}</td>
                  <td className="mono">{pct(r.other)}</td>
                  <td className="mono">
                    {r.other === r.base
                      ? "Sin cambio"
                      : signed(r.other - r.base)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Módulo 10: evaluación de la IA contra el conjunto de referencia. */
export function EvaluationPage() {
  const { project } = useProject();
  const access = useAccess(project);
  const projectId = project?.id ?? "";
  const info = useLoad(
    () => api.getEvaluationInfo(projectId),
    `eval-info:${projectId}`,
  );
  const runs = useLoad(
    () => api.listEvaluations(projectId),
    `eval-runs:${projectId}`,
  );
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = runs.data?.some((r) => r.status === "running") ?? false;
  const reload = runs.reload;

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [active, reload]);

  if (!project) return <Spinner label="Cargando proyecto…" />;
  if (runs.loading && !runs.data) {
    return <Spinner label="Cargando evaluaciones…" />;
  }
  if (runs.error || !runs.data) {
    return <ErrorNotice message={runs.error} onRetry={runs.reload} />;
  }
  const list = runs.data;
  const shown = list.find((r) => r.id === selected) ?? list[0];
  const infoData = info.data;
  const quota = infoData?.ai_quota_remaining_today ?? null;

  async function start(mode: "rules" | "rules_ai" | "injection") {
    setBusy(true);
    setError("");
    try {
      const run = await api.startEvaluation(projectId, mode);
      setSelected(run.id);
      runs.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar.");
    } finally {
      setBusy(false);
    }
  }

  const aiReason = !access.canUseAi
    ? (access.reason ?? "La IA no está disponible.")
    : infoData && quota !== null && quota < infoData.golden_stories
      ? `La cuota de hoy (${quota} consultas) no alcanza para la evaluación completa (${infoData.golden_stories}).`
      : null;

  return (
    <>
      <h1>Evaluación de la IA</h1>
      <p className="hint">
        Mide qué tan bien detecta el analizador los problemas que un analista QA
        esperaría ver, sobre un conjunto de referencia
        {infoData ? ` de ${infoData.golden_stories} historias` : ""}. Se puede
        medir solo con reglas (sin costo), con reglas e IA, o probar si la IA se
        deja engañar por instrucciones escondidas en una historia.
      </p>

      {access.canWrite ? (
        <p>
          <Button
            loading={busy}
            disabled={active}
            onClick={() => void start("rules")}
          >
            Evaluar solo con reglas
          </Button>{" "}
          <Button
            variant="ghost"
            loading={busy}
            disabled={active || aiReason !== null}
            onClick={() => void start("rules_ai")}
          >
            Evaluar con reglas e IA
          </Button>{" "}
          <Button
            variant="ghost"
            loading={busy}
            disabled={
              active ||
              !access.canUseAi ||
              (infoData && quota !== null
                ? quota < infoData.injection_cases
                : false)
            }
            onClick={() => void start("injection")}
          >
            Probar inyección de instrucciones
          </Button>
        </p>
      ) : (
        <p className="hint">{access.reason}</p>
      )}
      {access.canWrite && aiReason && <p className="hint">{aiReason}</p>}
      {access.canWrite && !aiReason && infoData && (
        <p className="hint">
          Con IA, cada historia es una consulta (quedan{" "}
          <span className="mono">{quota ?? "—"}</span> hoy) y se espera 12 s
          entre una y otra para no saturar el servicio: tarda unos minutos.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {active && (
        <p role="status" className="hint">
          Hay una evaluación en curso; el avance se actualiza solo.
        </p>
      )}

      {list.length === 0 ? (
        <EmptyState
          title="Todavía no hay evaluaciones"
          body="Ejecuta la primera para ver las métricas del analizador."
        />
      ) : (
        <>
          <h2>Historial</h2>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                Evaluaciones realizadas
              </caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Modelo</th>
                  <th scope="col">F1 reglas</th>
                  <th scope="col">F1 IA</th>
                  <th scope="col">
                    <span className="visually-hidden">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const det = kindMetrics(r, "det");
                  const ai = kindMetrics(r, "ai");
                  return (
                    <tr key={r.id}>
                      <td>{new Date(r.created_at).toLocaleString("es-ES")}</td>
                      <td>{MODE_LABEL[r.mode] ?? r.mode}</td>
                      <td>
                        <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="mono">{r.model_name ?? "—"}</td>
                      <td className="mono">{det ? pct(det.f1) : "—"}</td>
                      <td className="mono">{ai ? pct(ai.f1) : "—"}</td>
                      <td>
                        <Button
                          variant="ghost"
                          aria-pressed={shown?.id === r.id}
                          onClick={() => setSelected(r.id)}
                        >
                          Ver detalle
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {shown && <RunSummary run={shown} />}
          <h2>Comparar corridas</h2>
          <Comparison runs={list} />
        </>
      )}
    </>
  );
}
