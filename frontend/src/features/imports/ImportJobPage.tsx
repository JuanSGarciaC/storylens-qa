import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../../api/client";
import type { ImportJobDetail } from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useAccess } from "../../shared/useAccess";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Spinner } from "../../shared/ui/Spinner";
import {
  AI_LABEL,
  ITEM_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  isActive,
} from "./jobStatus";

const PAGE_SIZE = 50;
const POLL_MIN_MS = 1500;
const POLL_MAX_MS = 5000;

type Loaded = {
  key: string;
  job?: ImportJobDetail;
  notFound?: api.ApiError;
  error?: string;
  /** El último intento de actualizar falló, pero seguimos mostrando lo que ya había. */
  stale?: boolean;
};

const ITEM_TONE = {
  pending: "info",
  done: "ok",
  skipped: "neutral",
  failed: "danger",
} as const;

/** Avance de una importación: se consulta sola mientras el trabajo siga activo. */
export function ImportJobPage() {
  const { projectId, jobId } = useParams();
  const { project } = useProject();
  const access = useAccess(project);
  const [filter, setFilter] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const idle = useRef({ processed: -1, count: 0 });
  const key = `${projectId}/${jobId}`;

  useEffect(() => {
    if (!projectId || !jobId) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const again = (ms: number) => {
      timer = setTimeout(() => setTick((n) => n + 1), ms);
    };
    api.getImportJob(jobId, { limit, status: filter || undefined }).then(
      (job) => {
        if (!current) return;
        if (job.project_id !== projectId) {
          setLoaded({
            key,
            notFound: new api.ApiError("Importación no encontrada", 404),
          });
          return;
        }
        setLoaded({ key, job });
        if (!isActive(job.status)) return;
        // Si no hay avance, se espera un poco más entre consultas.
        const last = idle.current;
        last.count = job.processed === last.processed ? last.count + 1 : 0;
        last.processed = job.processed;
        again(Math.min(POLL_MIN_MS + last.count * 1000, POLL_MAX_MS));
      },
      (error: unknown) => {
        if (!current) return;
        if (error instanceof api.ApiError && error.status === 404) {
          setLoaded({ key, notFound: error });
          return;
        }
        const message =
          error instanceof Error ? error.message : "No se pudo cargar.";
        setLoaded((prev) =>
          prev && prev.key === key && prev.job
            ? { ...prev, stale: true }
            : { key, error: message },
        );
        again(POLL_MAX_MS);
      },
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key, projectId, jobId, limit, filter, tick]);

  const fresh = loaded && loaded.key === key ? loaded : null;
  if (fresh?.notFound) throw fresh.notFound;
  const job = fresh?.job;

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError("");
    try {
      await action();
      idle.current = { processed: -1, count: 0 };
      setTick((n) => n + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setBusy(false);
    }
  }

  if (!fresh) return <Spinner label="Cargando importación…" />;
  if (!job) {
    return (
      <ErrorNotice
        message={fresh.error ?? "No se pudo cargar la importación."}
        onRetry={() => setTick((n) => n + 1)}
      />
    );
  }

  const active = isActive(job.status);
  const canRetry =
    !active &&
    (job.failed > 0 || job.pending > 0) &&
    job.status !== "cancelled";
  const storiesPath = `/p/${projectId}/stories`;

  return (
    <>
      <h1>Importación de historias</h1>
      <p>
        <span className="mono">{job.filename}</span>{" "}
        <Badge tone={STATUS_TONE[job.status] ?? "neutral"}>
          {STATUS_LABEL[job.status] ?? job.status}
        </Badge>
      </p>

      <p role="status">
        <progress max={job.total} value={job.processed} />{" "}
        <span className="mono">
          {job.processed} de {job.total} filas
        </span>
      </p>
      <dl className="stats">
        <div>
          <dt>Importadas</dt>
          <dd>{job.done}</dd>
        </div>
        <div>
          <dt>Omitidas (ya existían)</dt>
          <dd>{job.skipped}</dd>
        </div>
        <div>
          <dt>Con error</dt>
          <dd>{job.failed}</dd>
        </div>
        <div>
          <dt>Pendientes</dt>
          <dd>{job.pending}</dd>
        </div>
      </dl>
      {job.note && <p className="hint">{job.note}</p>}
      {fresh.stale && (
        <p role="alert" className="hint">
          No se pudo actualizar el avance; se reintentará solo.
        </p>
      )}
      {job.use_ai && (
        <p className="hint">
          Se pidió análisis con IA. Si la cuota se agota, el resto de las
          historias se analiza solo con reglas.
        </p>
      )}

      {access.canWrite && (
        <p>
          {active && (
            <Button
              variant="ghost"
              loading={busy}
              onClick={() => void act(() => api.cancelImportJob(job.id))}
            >
              Cancelar importación
            </Button>
          )}
          {canRetry && (
            <Button
              loading={busy}
              onClick={() => void act(() => api.retryImportJob(job.id))}
            >
              Reintentar filas fallidas o pendientes
            </Button>
          )}
        </p>
      )}
      {actionError && <p role="alert">{actionError}</p>}

      <h2>Resultado por fila</h2>
      <label>
        Mostrar{" "}
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setLimit(PAGE_SIZE);
          }}
        >
          <option value="">Todas</option>
          {Object.entries(ITEM_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {job.items.length === 0 ? (
        <EmptyState
          title="Sin filas que mostrar"
          body="Ninguna fila coincide con este filtro."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">
              Resultado de cada fila de la importación
            </caption>
            <thead>
              <tr>
                <th scope="col">Fila</th>
                <th scope="col">Historia</th>
                <th scope="col">Estado</th>
                <th scope="col">Análisis</th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {job.items.map((item) => (
                <tr key={item.row_index}>
                  <td className="mono">{item.row_index}</td>
                  <td className="table__title">
                    {item.story_id ? (
                      <Link
                        to={`/p/${projectId}/stories/${item.story_id}/analysis`}
                      >
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                    {item.key && <span className="mono"> {item.key}</span>}
                  </td>
                  <td>
                    <Badge
                      tone={ITEM_TONE[item.status as keyof typeof ITEM_TONE]}
                    >
                      {ITEM_LABEL[item.status] ?? item.status}
                    </Badge>
                  </td>
                  <td>
                    {item.ai_status
                      ? (AI_LABEL[item.ai_status] ?? item.ai_status)
                      : "—"}
                  </td>
                  <td>{item.error || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {job.items.length < job.items_total && (
        <Button variant="ghost" onClick={() => setLimit(limit + PAGE_SIZE)}>
          Mostrar más
        </Button>
      )}
      <p>
        <Link to={storiesPath}>Volver a las historias</Link>
      </p>
    </>
  );
}
