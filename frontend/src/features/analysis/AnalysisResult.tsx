import { useState } from "react";
import type { Analysis, Decision, Finding } from "../../api/client";
import { ReportLinks } from "../reports/ReportLinks";

const VERDICT_LABEL: Record<string, string> = {
  ready: "Lista",
  ready_with_notes: "Lista con observaciones",
  not_ready: "No lista",
};

// El color nunca es la única señal: cada severidad lleva icono y texto.
const SEVERITY: Record<Finding["severity"], { label: string; icon: string }> = {
  blocking: { label: "Bloqueante", icon: "⛔" },
  major: { label: "Mayor", icon: "▲" },
  minor: { label: "Menor", icon: "●" },
  info: { label: "Info", icon: "ℹ" },
};

export type OnDecide = (
  finding: Finding,
  decision: Decision,
  reason?: string,
) => void;

function FindingActions({
  finding,
  busy,
  onDecide,
}: {
  finding: Finding;
  busy: boolean;
  onDecide: OnDecide;
}) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");

  if (dismissing) {
    return (
      <div className="actions">
        <label>
          Motivo del descarte
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={busy || !reason.trim()}
          onClick={() => {
            onDecide(finding, "dismissed", reason.trim());
            setDismissing(false);
          }}
        >
          Confirmar descarte
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setDismissing(false)}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="actions">
      {finding.decision === "pending" ? (
        <>
          <button
            type="button"
            disabled={busy}
            aria-label={`Aceptar ${finding.rule_id}`}
            onClick={() => onDecide(finding, "accepted")}
          >
            Aceptar
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            aria-label={`Descartar ${finding.rule_id}`}
            onClick={() => setDismissing(true)}
          >
            Descartar
          </button>
        </>
      ) : (
        <button
          type="button"
          className="secondary"
          disabled={busy}
          aria-label={`Restablecer ${finding.rule_id}`}
          onClick={() => onDecide(finding, "pending")}
        >
          Restablecer
        </button>
      )}
    </div>
  );
}

function FindingItem({
  finding,
  busy,
  onDecide,
}: {
  finding: Finding;
  busy: boolean;
  onDecide: OnDecide;
}) {
  const severity = SEVERITY[finding.severity];
  const dismissed = finding.decision === "dismissed";
  return (
    <li
      className={`finding sev-${finding.severity}${dismissed ? " dismissed" : ""}`}
    >
      <p className="finding-head">
        <span className="badge">
          <span aria-hidden="true">{severity.icon}</span> {severity.label}
          {finding.decision === "accepted" && " · Aceptado"}
          {dismissed && " · Descartado"}
          {finding.source === "ai" && (
            <span
              className="chip"
              title="Sugerido por IA: revísalo antes de aceptarlo"
            >
              IA
              {finding.confidence != null &&
                ` · ${Math.round(finding.confidence * 100)}%`}
            </span>
          )}
        </span>
        <code>{finding.rule_id}</code>
      </p>
      <p className="finding-message">{finding.message}</p>
      {finding.evidence_text && (
        <blockquote>{finding.evidence_text}</blockquote>
      )}
      <p className="suggestion">
        <strong>Sugerencia:</strong> {finding.suggestion}
      </p>
      <p className="reference">Norma: {finding.reference}</p>
      {dismissed && finding.dismiss_reason && (
        <p className="reference">
          Motivo del descarte: {finding.dismiss_reason}
        </p>
      )}
      <FindingActions finding={finding} busy={busy} onDecide={onDecide} />
    </li>
  );
}

function AiNotice({ analysis }: { analysis: Analysis }) {
  switch (analysis.ai_status) {
    case "ok":
      return (
        <p className="notice">
          Analizado con reglas + IA
          {analysis.model_name ? ` (${analysis.model_name})` : ""}. Los
          hallazgos de IA son sugerencias: tú decides.
        </p>
      );
    case "unavailable":
      return (
        <p className="notice warn">
          La IA no estuvo disponible (sin configurar, límite alcanzado o
          servicio caído). Este resultado usa solo las reglas.
        </p>
      );
    case "invalid_response":
      return (
        <p className="notice warn">
          La IA devolvió una respuesta inválida. Este resultado usa solo las
          reglas.
        </p>
      );
    default:
      return <p className="notice">Analizado solo con reglas.</p>;
  }
}

interface Props {
  analysis: Analysis;
  busy: boolean;
  onDecide: OnDecide;
}

export function AnalysisResult({ analysis, busy, onDecide }: Props) {
  return (
    <section className="card" aria-labelledby="result-title">
      <h2 id="result-title">Resultado</h2>

      <div className="summary">
        <div className="score" aria-label={`Puntaje ${analysis.score} de 100`}>
          <strong>{analysis.score}</strong>
          <span>/ 100</span>
        </div>
        <p className={`verdict verdict-${analysis.verdict}`}>
          {VERDICT_LABEL[analysis.verdict] ?? analysis.verdict}
        </p>
      </div>

      <progress max={100} value={analysis.score} aria-hidden="true" />

      {analysis.id && (
        <ReportLinks
          path={`/analyses/${analysis.id}/report`}
          what="reporte del análisis"
        />
      )}

      <AiNotice analysis={analysis} />

      {analysis.findings.length === 0 ? (
        <p>No se encontraron hallazgos con las reglas actuales.</p>
      ) : (
        <ul className="findings">
          {analysis.findings.map((finding) => (
            <FindingItem
              key={finding.id ?? `${finding.rule_id}-${finding.message}`}
              finding={finding}
              busy={busy}
              onDecide={onDecide}
            />
          ))}
        </ul>
      )}

      <p className="meta">
        Catálogo de reglas v{analysis.rules_catalog_version}
        {analysis.prompt_version && ` · prompt ${analysis.prompt_version}`}
      </p>
    </section>
  );
}
