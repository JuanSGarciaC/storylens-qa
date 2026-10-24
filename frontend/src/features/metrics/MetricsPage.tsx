import { useState } from "react";
import { Link } from "react-router-dom";
import {
  compareVersions,
  getMetrics,
  getTraceabilityMatrix,
  listVersions,
} from "../../api/client";
import type { Metric } from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useLoad } from "../../shared/useLoad";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Spinner } from "../../shared/ui/Spinner";

const MATRIX_PAGE = 100;

const KEY_LABEL: Record<string, string> = {
  blocking: "Bloqueante",
  major: "Mayor",
  minor: "Menor",
  info: "Informativo",
  passed: "Pasó",
  failed: "Falló",
  blocked: "Bloqueado",
  critical: "Crítico",
  low: "Baja",
};

const RESULT_LABEL: Record<string, string> = {
  passed: "Pasó",
  failed: "Falló",
  blocked: "Bloqueado",
};

const RESULT_TONE = {
  passed: "ok",
  failed: "danger",
  blocked: "warn",
} as const;

function formatValue(metric: Metric): string {
  if (metric.value === null) return "Sin datos";
  if (metric.unit === "percent") return `${metric.value} %`;
  if (metric.unit === "points") {
    return `${metric.value > 0 ? "+" : ""}${metric.value} pts`;
  }
  return String(metric.value);
}

function MetricCard({ metric }: { metric: Metric }) {
  const hasData = metric.value !== null;
  return (
    <div className="metric">
      <dt>{metric.label}</dt>
      <dd>
        <span className={hasData ? "stat__value gradient-text" : "hint"}>
          {formatValue(metric)}
        </span>
        <span className="mono hint">
          {metric.denominator
            ? `${metric.numerator} de ${metric.denominator}`
            : "Sin elementos para calcularla"}
        </span>
      </dd>
      <dd className="hint">{metric.definition}</dd>
    </div>
  );
}

/** Barras horizontales: el conteo siempre va escrito, el color nunca es lo único. */
function Bars({
  label,
  items,
}: {
  label: string;
  items: { key: string; count: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((sum, i) => sum + i.count, 0);
  return (
    <figure className="bars">
      <figcaption>{label}</figcaption>
      {total === 0 ? (
        <p className="hint">Sin datos.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.key}>
              <span className="bars__label">
                {KEY_LABEL[item.key] ?? item.key}
              </span>
              <span className="bars__track" aria-hidden="true">
                <span
                  className="bars__fill"
                  style={{ width: `${(100 * item.count) / max}%` }}
                />
              </span>
              <span className="mono">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

function Matrix({ projectId }: { projectId: string }) {
  const [limit, setLimit] = useState(MATRIX_PAGE);
  const matrix = useLoad(
    () => getTraceabilityMatrix(projectId, limit),
    `matrix:${projectId}:${limit}`,
  );
  if (matrix.loading && !matrix.data) {
    return <Spinner label="Armando la matriz…" />;
  }
  if (matrix.error || !matrix.data) {
    return <ErrorNotice message={matrix.error} onRetry={matrix.reload} />;
  }
  const { rows, total } = matrix.data;
  if (total === 0) {
    return (
      <EmptyState
        title="Todavía no hay criterios que trazar"
        body="La matriz relaciona cada criterio de aceptación con sus casos, su última ejecución y sus defectos."
      />
    );
  }
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">
            Matriz de trazabilidad: criterio, casos aceptados, última ejecución
            y defectos
          </caption>
          <thead>
            <tr>
              <th scope="col">Historia</th>
              <th scope="col">Criterio</th>
              <th scope="col">Casos aceptados</th>
              <th scope="col">Última ejecución</th>
              <th scope="col">Defectos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.story_id}-${row.criterion_index}`}>
                <td className="table__title">
                  <Link to={`/p/${projectId}/stories/${row.story_id}/tests`}>
                    {row.story_title}
                  </Link>
                </td>
                <td className="table__title">
                  <span className="mono">{row.criterion_index}.</span>{" "}
                  {row.criterion}
                </td>
                <td>
                  {row.cases.length === 0 ? (
                    <Badge tone="warn">Sin cobertura</Badge>
                  ) : (
                    row.cases.map((c) => c.title).join(" · ")
                  )}
                </td>
                <td>
                  {row.last_result ? (
                    <Badge
                      tone={
                        RESULT_TONE[
                          row.last_result as keyof typeof RESULT_TONE
                        ] ?? "neutral"
                      }
                    >
                      {RESULT_LABEL[row.last_result] ?? row.last_result}
                    </Badge>
                  ) : (
                    "Sin ejecutar"
                  )}
                </td>
                <td className="mono">{row.defects}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" role="status">
        Mostrando {rows.length} de {total} criterios.
      </p>
      {rows.length < total && (
        <Button variant="ghost" onClick={() => setLimit(limit + MATRIX_PAGE)}>
          Mostrar más
        </Button>
      )}
    </>
  );
}

function Versions({ projectId }: { projectId: string }) {
  const versions = useLoad(
    () => listVersions(projectId),
    `versions:${projectId}`,
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const comparison = useLoad(
    () =>
      from && to ? compareVersions(projectId, from, to) : Promise.resolve(null),
    `compare:${projectId}:${from}:${to}`,
  );
  if (versions.loading) return <Spinner label="Cargando versiones…" />;
  const list = versions.data ?? [];
  if (list.length < 2) {
    return (
      <p>
        Para comparar versiones hacen falta al menos dos. Créalas en{" "}
        <Link to={`/p/${projectId}/settings`}>Configuración</Link> y asigna cada
        historia a una versión.
      </p>
    );
  }
  const options = list.map((v) => (
    <option key={v.id} value={v.id}>
      {v.name}
    </option>
  ));
  const result = comparison.data;
  return (
    <>
      <p>
        <label>
          Desde{" "}
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Elige una versión</option>
            {options}
          </select>
        </label>{" "}
        <label>
          Hasta{" "}
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Elige una versión</option>
            {options}
          </select>
        </label>
      </p>
      {comparison.error && <p role="alert">{comparison.error}</p>}
      {result && (
        <div role="status">
          <p className="hint">
            Las historias se emparejan por título. Sin cambios:{" "}
            <span className="mono">{result.unchanged}</span>.
          </p>
          <ul>
            {result.added.map((s) => (
              <li key={`a${s.id}`}>
                <Badge tone="ok">Nueva</Badge> {s.title}
              </li>
            ))}
            {result.removed.map((s) => (
              <li key={`r${s.id}`}>
                <Badge tone="danger">Ya no está</Badge> {s.title}
              </li>
            ))}
            {result.changed.map((c) => (
              <li key={`c${c.to_id}`}>
                <Badge tone="warn">Cambió</Badge>{" "}
                <Link to={`/p/${projectId}/stories/${c.to_id}/analysis`}>
                  historia
                </Link>
                : {c.what.join(" y ")}
              </li>
            ))}
          </ul>
          {result.added.length +
            result.removed.length +
            result.changed.length ===
            0 && <p>No hay diferencias entre estas versiones.</p>}
        </div>
      )}
    </>
  );
}

/** Módulo 9: métricas con su definición y su denominador visibles. */
export function MetricsPage() {
  const { project } = useProject();
  const projectId = project?.id;
  const data = useLoad(
    () => getMetrics(projectId ?? ""),
    `metrics:${projectId}`,
  );
  if (!project || !projectId) return <Spinner label="Cargando proyecto…" />;
  return (
    <>
      <h1>Métricas y mejora</h1>
      <p className="hint">
        Cada cifra muestra de cuántos elementos sale. Si no hay datos para
        calcularla, dice «Sin datos» en vez de mostrar un cero.
      </p>
      {data.loading ? (
        <Spinner label="Calculando métricas…" />
      ) : data.error || !data.data ? (
        <ErrorNotice message={data.error} onRetry={data.reload} />
      ) : (
        <>
          <dl className="metrics">
            {data.data.metrics.map((m) => (
              <MetricCard key={m.id} metric={m} />
            ))}
          </dl>
          <div className="bars-grid">
            {data.data.breakdowns.map((b) => (
              <Bars key={b.id} label={b.label} items={b.items} />
            ))}
          </div>
        </>
      )}

      <h2>Matriz de trazabilidad</h2>
      <Matrix projectId={projectId} />

      <h2>Comparación de versiones</h2>
      <Versions projectId={projectId} />
    </>
  );
}
