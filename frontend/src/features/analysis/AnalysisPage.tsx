import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "../../api/client";
import type {
  Analysis,
  Decision,
  Finding,
  Project,
  StoryItem,
} from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useSession } from "../../app/session";
import { useStory } from "../../app/useStory";
import { useAccess } from "../../shared/useAccess";
import { useLoad } from "../../shared/useLoad";
import { Badge, type Tone } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Field } from "../../shared/ui/Field";
import { Spinner } from "../../shared/ui/Spinner";
import { ReportLinks } from "../reports/ReportLinks";

const VERDICT: Record<string, { label: string; tone: Tone }> = {
  ready: { label: "Lista", tone: "ok" },
  ready_with_notes: { label: "Lista con observaciones", tone: "warn" },
  not_ready: { label: "No lista", tone: "danger" },
};

// El color nunca es la única señal: cada grupo lleva su etiqueta de texto.
const SEVERITIES: { key: Finding["severity"]; label: string }[] = [
  { key: "blocking", label: "Bloqueante" },
  { key: "major", label: "Mayor" },
  { key: "minor", label: "Menor" },
  { key: "info", label: "Info" },
];

const ErrorText = ({ message }: { message: string }) => (
  <p role="alert" className="field__error wrap">
    {message}
  </p>
);

type OnDecide = (
  finding: Finding,
  decision: Decision,
  reason?: string,
) => Promise<boolean>;

function FindingItem({
  finding,
  canDecide,
  busy,
  error,
  onDecide,
}: {
  finding: Finding;
  canDecide: boolean;
  busy: boolean;
  error: string;
  onDecide: OnDecide;
}) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const item = useRef<HTMLLIElement>(null);
  const dismissButton = useRef<HTMLButtonElement>(null);
  const dismissed = finding.decision === "dismissed";

  async function decide(decision: Decision, why?: string) {
    if (await onDecide(finding, decision, why)) {
      setDismissing(false);
      setReason("");
      item.current?.focus();
    }
  }

  function confirmDismiss() {
    if (!reason.trim()) {
      setReasonError("Indica un motivo para descartar el hallazgo.");
      return;
    }
    void decide("dismissed", reason.trim());
  }

  return (
    <li className="finding" ref={item} tabIndex={-1}>
      <div className="finding__head">
        <code className="mono">{finding.rule_id}</code>
        {finding.source === "ai" ? (
          <Badge tone="info">
            IA
            {finding.confidence != null &&
              ` · ${Math.round(finding.confidence * 100)}%`}
          </Badge>
        ) : null}
        {finding.decision === "accepted" ? (
          <Badge tone="ok">Aceptado</Badge>
        ) : null}
        {dismissed ? <Badge tone="neutral">Descartado</Badge> : null}
      </div>
      <div className="prose wrap">
        <p className="finding__message">{finding.message}</p>
        {finding.evidence_text ? (
          <blockquote>{finding.evidence_text}</blockquote>
        ) : null}
        <p>
          <strong>Sugerencia:</strong> {finding.suggestion}
        </p>
      </div>
      <p className="hint wrap">
        Norma: <span className="mono">{finding.reference}</span>
      </p>
      {dismissed && finding.dismiss_reason ? (
        <p className="hint wrap">
          Motivo del descarte: {finding.dismiss_reason}
        </p>
      ) : null}

      {error ? <ErrorText message={error} /> : null}
      {!canDecide ? null : dismissing ? (
        <div className="finding__actions">
          <Field label="Motivo del descarte" error={reasonError}>
            <input
              autoFocus
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError("");
              }}
            />
          </Field>
          <div className="toolbar">
            <Button disabled={busy} onClick={confirmDismiss}>
              Confirmar descarte
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDismissing(false);
                setReason("");
                setReasonError("");
                // El botón vuelve a montarse en el siguiente render.
                requestAnimationFrame(() => dismissButton.current?.focus());
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="toolbar">
          {finding.decision === "pending" ? (
            <>
              <Button
                variant="ghost"
                disabled={busy}
                aria-label={`Aceptar ${finding.rule_id}`}
                onClick={() => void decide("accepted")}
              >
                Aceptar
              </Button>
              <Button
                ref={dismissButton}
                variant="ghost"
                disabled={busy}
                aria-label={`Descartar ${finding.rule_id}`}
                onClick={() => setDismissing(true)}
              >
                Descartar
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              disabled={busy}
              aria-label={`Restablecer ${finding.rule_id}`}
              onClick={() => void decide("pending")}
            >
              Restablecer
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function AiNotice({ analysis }: { analysis: Analysis }) {
  let text: string;
  switch (analysis.ai_status) {
    case "ok":
      text = `Analizado con reglas + IA${
        analysis.model_name ? ` (${analysis.model_name})` : ""
      }. Los hallazgos de IA son sugerencias: tú decides.`;
      break;
    case "not_requested":
      text = "Analizado solo con reglas.";
      break;
    case "unavailable":
      text =
        "La IA no pudo participar (sin configurar, límite alcanzado o servicio caído). Este resultado usa solo las reglas.";
      break;
    case "invalid_response":
      text =
        "La IA no pudo participar (devolvió una respuesta inválida). Este resultado usa solo las reglas.";
      break;
    default:
      text =
        "La IA no pudo participar (motivo desconocido). Este resultado usa solo las reglas.";
  }
  return (
    <p className="ai-note" role="status">
      {text}
    </p>
  );
}

function Findings({
  analysis,
  canDecide,
  busy,
  decideError,
  onDecide,
}: {
  analysis: Analysis;
  canDecide: boolean;
  busy: boolean;
  decideError: { id: string; message: string } | null;
  onDecide: OnDecide;
}) {
  const base = useId();
  if (analysis.findings.length === 0) {
    return <p>No se encontraron hallazgos con las reglas actuales.</p>;
  }
  return (
    <>
      {SEVERITIES.map(({ key, label }) => {
        const group = analysis.findings.filter((f) => f.severity === key);
        if (group.length === 0) return null;
        const headingId = `${base}-${key}`;
        return (
          <section key={key} aria-labelledby={headingId}>
            <h3 id={headingId} className="finding-group__title">
              {label} <span className="hint">({group.length})</span>
            </h3>
            <ul className="findings">
              {group.map((finding) => (
                <FindingItem
                  key={finding.id ?? `${finding.rule_id}-${finding.message}`}
                  finding={finding}
                  canDecide={canDecide}
                  busy={busy}
                  error={
                    decideError && decideError.id === finding.id
                      ? decideError.message
                      : ""
                  }
                  onDecide={onDecide}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function StoryText({ story }: { story: StoryItem }) {
  return (
    <section aria-labelledby="story-text-title" className="story-text">
      <h2 id="story-text-title">Historia analizada</h2>
      <div className="prose">
        <p className="wrap story-text__body">{story.description}</p>
        {story.acceptance_criteria.length > 0 ? (
          <>
            <h3>Criterios de aceptación</h3>
            <ol>
              {story.acceptance_criteria.map((criterion, index) => (
                <li key={index} className="wrap">
                  {criterion}
                </li>
              ))}
            </ol>
          </>
        ) : null}
        {story.notes ? (
          <>
            <h3>Notas</h3>
            <p className="wrap story-text__body">{story.notes}</p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function AnalysisView({
  story,
  project,
}: {
  story: StoryItem;
  project: Project;
}) {
  const navigate = useNavigate();
  const { refreshProjects } = useProject();
  const { aiQuotaRemaining, refreshHealth } = useSession();
  const access = useAccess(project);
  const analysisId = story.latest_analysis?.id;
  const data = useLoad<Analysis | null>(
    () => (analysisId ? api.getAnalysis(analysisId) : Promise.resolve(null)),
    `analysis-${story.id}`,
  );
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<"rules" | "ai" | null>(null);
  const [analyzeError, setAnalyzeError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [decideError, setDecideError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  // La IA respondió «no disponible» y /health no pudo confirmarlo: se bloquea hasta el próximo refresco.
  const [aiDown, setAiDown] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);

  // Si la IA quedó marcada como caída, se vuelve a comprobar al volver a la pestaña.
  useEffect(() => {
    if (!aiDown) return;
    const recheck = () => {
      if (document.visibilityState !== "visible") return;
      void refreshHealth().then((ok) => ok && setAiDown(false));
    };
    document.addEventListener("visibilitychange", recheck);
    return () => document.removeEventListener("visibilitychange", recheck);
  }, [aiDown, refreshHealth]);

  useEffect(() => {
    if (confirmDelete) cancelDelete.current?.focus();
  }, [confirmDelete]);

  if (data.loading) return <Spinner label="Cargando análisis…" />;
  if (data.error)
    return <ErrorNotice message={data.error} onRetry={data.reload} />;
  const analysis = data.data ?? null;

  const outOfQuota = aiQuotaRemaining === 0;
  const aiEnabled = access.canUseAi && !outOfQuota && !aiDown;
  const quotaText =
    access.canUseAi && aiQuotaRemaining !== null
      ? aiQuotaRemaining === 0
        ? "Sin consultas de IA hoy."
        : `${aiQuotaRemaining === 1 ? "Queda 1 consulta" : `Quedan ${aiQuotaRemaining} consultas`} de IA hoy.`
      : null;
  const reason =
    access.reason ??
    (aiDown && !outOfQuota
      ? "La IA no está disponible ahora (límite alcanzado o servicio caído)."
      : quotaText);

  async function guard(
    action: () => Promise<void>,
    onError: (message: string) => void,
  ): Promise<boolean> {
    setBusy(true);
    setAnalyzeError("");
    setDeleteError("");
    setDecideError(null);
    try {
      await action();
      return true;
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo completar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function analyze(useAi: boolean) {
    setRunning(useAi ? "ai" : "rules");
    setNotice("");
    let unavailable = false;
    await guard(async () => {
      try {
        const result = await api.createAnalysis(story.id, useAi);
        unavailable = result.ai_status === "unavailable";
        data.set(result);
        setNotice("Análisis completado.");
      } finally {
        if (useAi) {
          // Se refresca siempre: la consulta pudo gastarse aunque la petición fallara.
          const refreshed = await refreshHealth();
          setAiDown(unavailable && !refreshed);
        }
      }
    }, setAnalyzeError);
    setRunning(null);
  }

  const decide: OnDecide = (finding, decision, why) =>
    guard(
      async () => {
        if (!finding.id) throw new Error("El hallazgo aún no se ha guardado.");
        data.set(await api.decideFinding(finding.id, decision, why));
      },
      (message) => setDecideError({ id: finding.id ?? "", message }),
    );

  async function remove() {
    const ok = await guard(async () => {
      await api.deleteStory(story.id);
      refreshProjects();
      navigate(`/p/${project.id}/stories`);
    }, setDeleteError);
    if (!ok) {
      setConfirmDelete(false);
      // El botón sigue deshabilitado hasta el próximo render.
      requestAnimationFrame(() => deleteButton.current?.focus());
    }
  }

  const toolbar = (
    <>
      <div className="toolbar">
        <Button
          disabled={!access.canWrite || busy}
          loading={running === "rules"}
          onClick={() => void analyze(false)}
        >
          Analizar
        </Button>
        <Button
          variant="ghost"
          disabled={!aiEnabled || busy}
          loading={running === "ai"}
          onClick={() => void analyze(true)}
        >
          Analizar con IA
        </Button>
      </div>
      {reason ? <p className="hint">{reason}</p> : null}
      {aiDown ? (
        <div>
          <Button
            variant="ghost"
            onClick={() =>
              void refreshHealth().then((ok) => ok && setAiDown(false))
            }
          >
            Comprobar de nuevo
          </Button>
        </div>
      ) : null}
      {analyzeError ? <ErrorText message={analyzeError} /> : null}
    </>
  );

  const blocking = (analysis?.findings ?? []).filter(
    (f) => f.severity === "blocking" && f.decision !== "dismissed",
  ).length;
  const verdict = analysis
    ? (VERDICT[analysis.verdict] ?? {
        label: analysis.verdict,
        tone: "neutral",
      })
    : null;

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title wrap">
          {story.title || "Historia sin título"}
        </h1>
        <p className="page__lead">Análisis de calidad de la historia.</p>
      </header>

      <div aria-live="polite">
        {notice ? (
          <p role="status" className="hint">
            {notice}
          </p>
        ) : null}
      </div>
      {!analysis || !verdict ? (
        <section aria-labelledby="result-title">
          <h2 id="result-title" className="visually-hidden">
            Resultado
          </h2>
          <EmptyState
            title="Esta historia aún no tiene análisis"
            body="Analízala con las reglas de calidad para ver su puntaje y los hallazgos. La IA es opcional y complementa las reglas."
            action={toolbar}
          />
        </section>
      ) : (
        <>
          <section aria-labelledby="result-title" className="result">
            <h2 id="result-title">Resultado</h2>
            {blocking > 0 ? (
              <div className="notice" role="alert">
                <span>
                  {blocking === 1
                    ? "Hay 1 hallazgo bloqueante sin descartar"
                    : `Hay ${blocking} hallazgos bloqueantes sin descartar`}
                  : la historia no está lista aunque el puntaje sea alto.
                </span>
              </div>
            ) : null}
            <div className="score-row">
              <div
                className="score"
                role="img"
                aria-label={`Puntaje ${analysis.score} de 100`}
              >
                <span className="score__value gradient-text">
                  {analysis.score}
                </span>
                <span className="score__max">/ 100</span>
              </div>
              <Badge tone={verdict.tone}>{verdict.label}</Badge>
            </div>
            <AiNotice analysis={analysis} />
            {analysis.id ? (
              <ReportLinks
                path={`/analyses/${analysis.id}/report`}
                what="reporte del análisis"
              />
            ) : null}
            {toolbar}
          </section>

          <section aria-labelledby="findings-title">
            <h2 id="findings-title">Hallazgos</h2>
            <Findings
              analysis={analysis}
              canDecide={access.canWrite}
              busy={busy}
              decideError={decideError}
              onDecide={decide}
            />
            <p className="hint">
              Catálogo de reglas v{analysis.rules_catalog_version}
              {analysis.prompt_version &&
                ` · prompt ${analysis.prompt_version}`}
            </p>
          </section>
        </>
      )}

      <StoryText story={story} />

      {access.canWrite ? (
        <section className="danger-zone" aria-label="Eliminar historia">
          <Button
            ref={deleteButton}
            variant="danger"
            aria-expanded={confirmDelete}
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Eliminar historia
          </Button>
          {deleteError ? <ErrorText message={deleteError} /> : null}
          {confirmDelete ? (
            <div role="group" aria-labelledby="delete-question">
              <p id="delete-question">
                Se eliminará la historia con sus análisis, casos y sesiones. No
                se puede deshacer.
              </p>
              <div className="toolbar">
                <Button
                  variant="danger"
                  loading={busy}
                  onClick={() => void remove()}
                >
                  Sí, eliminar historia
                </Button>
                <Button
                  ref={cancelDelete}
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setConfirmDelete(false);
                    deleteButton.current?.focus();
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export function AnalysisPage() {
  const { projectId, storyId } = useParams();
  const { project } = useProject();
  const { story, loading, error } = useStory(projectId, storyId);
  if (error) return <ErrorNotice message={error} />;
  if (loading || !story || !project) {
    return <Spinner label="Cargando historia…" />;
  }
  return <AnalysisView key={story.id} story={story} project={project} />;
}
