import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../../api/client";
import type { Project, Recommendation, StoryItem } from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useStory } from "../../app/useStory";
import { useAccess } from "../../shared/useAccess";
import { useAiGate } from "../../shared/useAiGate";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Spinner } from "../../shared/ui/Spinner";
import { ReportLinks } from "../reports/ReportLinks";
import { CloseForm } from "./CloseForm";
import { ExecutionItem } from "./ExecutionItem";
import type { ExecutionActions, Feedback } from "./ExecutionItem";
import { SessionChecklist } from "./SessionChecklist";
import { safeHttpUrl } from "./evidenceRules";
import { RECOMMENDATION_LABEL, RECOMMENDATION_TONE } from "./labels";
import { useSessionDetail } from "./useSessionDetail";

const message = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la acción.";

type Where = { key: string } & Feedback;

function SessionView({
  story,
  project,
  sessionId,
}: {
  story: StoryItem;
  project: Project;
  sessionId: string;
}) {
  const access = useAccess(project);
  const gate = useAiGate(access);
  const data = useSessionDetail(story.id, sessionId);
  const [busy, setBusy] = useState(false);
  const [where, setWhere] = useState<Where | null>(null);

  if (data.loading) return <Spinner label="Cargando sesión…" />;
  if (data.error || !data.detail) {
    return <ErrorNotice message={data.error} onRetry={data.reload} />;
  }
  const detail = data.detail;
  const closed = detail.closed_at !== null;
  const readOnly = closed || !access.canWrite;
  const total = detail.executions.length;
  const envUrl = safeHttpUrl(detail.environment_url);
  const feedbackFor = (key: string) =>
    where && where.key === key ? { kind: where.kind, text: where.text } : null;

  /** Ejecuta un cambio y vuelve a pedir la sesión, para mostrar lo que quedó guardado. */
  async function act(
    key: string,
    change: (notify: (text: string) => void) => Promise<unknown>,
  ): Promise<boolean> {
    setBusy(true);
    setWhere(null);
    let notice = "";
    try {
      await change((text) => (notice = text));
      data.set(await api.getSession(sessionId));
      if (notice) setWhere({ key, kind: "notice", text: notice });
      return true;
    } catch (e) {
      setWhere({ key, kind: "error", text: message(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const useAi = gate.enabled;
  const actions: ExecutionActions = {
    onSave: (ex, changes) =>
      void act(ex.id, () => api.updateExecution(ex.id, changes)),
    onNote: (ex, text) => act(ex.id, () => api.addNoteEvidence(ex.id, text)),
    onLink: (ex, url, description) =>
      act(ex.id, () => api.addLinkEvidence(ex.id, url, description)),
    onImage: (ex, file, description) =>
      act(ex.id, () => api.uploadImageEvidence(ex.id, file, description)),
    onDraftDefect: (ex) =>
      void act(ex.id, async (notify) => {
        let failed = false;
        try {
          const result = await api.draftDefect(ex.id, useAi);
          if (useAi && result.ai_status !== "ok") {
            failed = true;
            notify(
              "La IA no estuvo disponible: se usó la plantilla del defecto.",
            );
          }
        } catch (e) {
          failed = true;
          throw e;
        } finally {
          if (useAi) await gate.afterAiCall(failed);
        }
      }),
    onSaveDefect: (ex, changes) =>
      void act(ex.id, () => api.updateDefect(ex.defect!.id, changes)),
  };

  const draftHint = useAi
    ? "Se redactará con IA (Gemini); el texto del caso se envía a Google AI Studio. Revísalo antes de guardar."
    : `Se usará la plantilla del defecto, sin IA.${gate.reason ? ` ${gate.reason}` : ""}`;

  const close = (recommendation: Recommendation, summary: string) =>
    void act("close", async () => {
      await api.closeSession(sessionId, recommendation, summary);
    });

  return (
    <div className="page">
      <header className="page__head">
        <p className="hint">
          <Link to={`/p/${project.id}/stories/${story.id}/sessions`}>
            Sesiones de la historia
          </Link>
        </p>
        <h1 className="page__title wrap">{detail.environment_name}</h1>
        <p>
          <Badge tone={closed ? "neutral" : "info"}>
            {closed ? "Cerrada" : "En curso"}
          </Badge>
        </p>
        <p className="page__lead wrap">
          {envUrl ? (
            <a href={envUrl} target="_blank" rel="noopener noreferrer">
              {detail.environment_url}
            </a>
          ) : (
            detail.environment_url
          )}{" "}
          · Build: {detail.build_version || "—"} · Responsable:{" "}
          {detail.tester_name || "—"}
        </p>
        <p>
          <strong>
            {total - detail.pending} de {total} casos ejecutados
          </strong>{" "}
          · Pasaron: {detail.counts.passed} · Fallaron: {detail.counts.failed} ·
          Bloqueados: {detail.counts.blocked}
        </p>
        <ReportLinks
          path={`/qa-sessions/${sessionId}/report`}
          what="reporte de la sesión"
        />
        {closed ? (
          <p className="hint">La sesión está cerrada: solo lectura.</p>
        ) : !access.canWrite ? (
          <p className="hint">{access.reason}</p>
        ) : null}
        {gate.aiDown && !readOnly ? (
          <div>
            <Button variant="ghost" onClick={gate.recheck}>
              Comprobar de nuevo
            </Button>
          </div>
        ) : null}
      </header>

      <SessionChecklist
        items={detail.checklist}
        disabled={readOnly || busy}
        error={where?.key === "checklist" ? where.text : ""}
        onToggle={(item, checked) =>
          void act("checklist", () => api.updateChecklistItem(item.id, checked))
        }
      />

      <section aria-labelledby="executions-title" className="stack">
        <h2 id="executions-title">Ejecución de casos</h2>
        <ul className="executions">
          {detail.executions.map((execution) => (
            <ExecutionItem
              key={execution.id}
              execution={execution}
              readOnly={readOnly}
              busy={busy}
              feedback={feedbackFor(execution.id)}
              draftHint={draftHint}
              {...actions}
            />
          ))}
        </ul>
      </section>

      {closed ? (
        <section aria-label="Resultado de la sesión" className="notice">
          <p>
            <strong>Recomendación final:</strong>{" "}
            {detail.recommendation ? (
              <Badge tone={RECOMMENDATION_TONE[detail.recommendation]}>
                {RECOMMENDATION_LABEL[detail.recommendation]}
              </Badge>
            ) : (
              "—"
            )}
          </p>
          {detail.summary ? <p className="wrap">{detail.summary}</p> : null}
        </section>
      ) : access.canWrite ? (
        <CloseForm
          session={detail}
          busy={busy}
          error={where?.key === "close" ? where.text : ""}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

export function SessionDetailPage() {
  const { projectId, storyId, sessionId } = useParams();
  const { project } = useProject();
  const { story, loading, error } = useStory(projectId, storyId);
  if (error) return <ErrorNotice message={error} />;
  if (loading || !story || !project || !sessionId) {
    return <Spinner label="Cargando sesión…" />;
  }
  return (
    <SessionView
      key={`${story.id}/${sessionId}`}
      story={story}
      project={project}
      sessionId={sessionId}
    />
  );
}
