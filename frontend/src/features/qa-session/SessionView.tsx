import { useCallback, useEffect, useState } from "react";
import {
  addLinkEvidence,
  addNoteEvidence,
  closeSession,
  draftDefect,
  getSession,
  updateChecklistItem,
  updateDefect,
  updateExecution,
  uploadImageEvidence,
  type ChecklistItem,
  type Execution,
  type Recommendation,
  type SessionDetail,
} from "../../api/client";
import { ChecklistSection } from "./ChecklistSection";
import { CloseSessionForm } from "./CloseSessionForm";
import { ExecutionCard, type ExecutionActions } from "./ExecutionCard";
import { RECOMMENDATION_LABEL } from "./labels";
import { ReportLinks } from "../reports/ReportLinks";

interface Props {
  sessionId: string;
  aiAvailable: boolean;
  onClosed: () => void;
}

export function SessionView({ sessionId, aiAvailable, onClosed }: Props) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSession(sessionId)
      .then((loaded) => {
        if (!cancelled) setDetail(loaded);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Error inesperado.");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  /** Ejecuta un cambio y vuelve a pedir la sesión, para mostrar siempre lo que quedó guardado. */
  const act = useCallback(
    async (change: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await change();
        setDetail(await getSession(sessionId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado.");
      } finally {
        setBusy(false);
      }
    },
    [sessionId],
  );

  if (!detail) {
    return error ? (
      <p role="alert" className="error">
        {error}
      </p>
    ) : (
      <p className="meta">Cargando sesión…</p>
    );
  }

  const readOnly = detail.closed_at !== null;
  const total = detail.executions.length;

  const actions: ExecutionActions = {
    onSave: (execution, changes) =>
      void act(() => updateExecution(execution.id, changes)),
    onNote: (execution, text) =>
      void act(() => addNoteEvidence(execution.id, text)),
    onLink: (execution, url, description) =>
      void act(() => addLinkEvidence(execution.id, url, description)),
    onImage: (execution, file, description) =>
      void act(() => uploadImageEvidence(execution.id, file, description)),
    onDraftDefect: (execution: Execution) =>
      void act(async () => {
        const result = await draftDefect(execution.id, aiAvailable);
        if (aiAvailable && result.ai_status !== "ok") {
          setNotice(
            "La IA no estuvo disponible: se usó la plantilla del defecto.",
          );
        }
      }),
    onSaveDefect: (defectId, changes) =>
      void act(() => updateDefect(defectId, changes)),
  };

  const handleClose = (recommendation: Recommendation, summary: string) =>
    void act(async () => {
      await closeSession(sessionId, recommendation, summary);
      onClosed();
    });

  return (
    <div className="session">
      <header>
        <h3>
          {detail.environment_name}{" "}
          <span className={`badge ${readOnly ? "closed" : ""}`}>
            {readOnly ? "Cerrada" : "En curso"}
          </span>
        </h3>
        <p className="meta">
          <a
            href={detail.environment_url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {detail.environment_url}
          </a>{" "}
          · Build: {detail.build_version || "—"} · Responsable:{" "}
          {detail.tester_name || "—"}
        </p>
        <p>
          <strong>
            {total - detail.pending} de {total}
          </strong>{" "}
          casos ejecutados · Pasaron: {detail.counts.passed} · Fallaron:{" "}
          {detail.counts.failed} · Bloqueados: {detail.counts.blocked}
        </p>
        <ReportLinks
          path={`/qa-sessions/${sessionId}/report`}
          what="reporte de la sesión"
        />
      </header>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p className="notice warn">{notice}</p>}

      <ChecklistSection
        items={detail.checklist}
        readOnly={readOnly}
        busy={busy}
        onToggle={(item: ChecklistItem, checked) =>
          void act(() => updateChecklistItem(item.id, checked))
        }
      />

      <section aria-labelledby="executions-title">
        <h3 id="executions-title">Ejecución de casos</h3>
        <ul className="executions">
          {detail.executions.map((execution) => (
            <ExecutionCard
              key={execution.id}
              execution={execution}
              readOnly={readOnly}
              busy={busy}
              aiAvailable={aiAvailable}
              {...actions}
            />
          ))}
        </ul>
      </section>

      {readOnly ? (
        <section aria-label="Resultado de la sesión" className="notice">
          <strong>
            Recomendación final:{" "}
            {detail.recommendation
              ? RECOMMENDATION_LABEL[detail.recommendation]
              : "—"}
          </strong>
          {detail.summary && <p>{detail.summary}</p>}
        </section>
      ) : (
        <CloseSessionForm session={detail} busy={busy} onClose={handleClose} />
      )}
    </div>
  );
}
