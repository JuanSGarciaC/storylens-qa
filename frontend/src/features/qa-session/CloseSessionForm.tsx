import { useState, type FormEvent } from "react";
import type { Recommendation, SessionDetail } from "../../api/client";
import { RECOMMENDATION_LABEL } from "./labels";

interface Props {
  session: SessionDetail;
  busy: boolean;
  onClose: (recommendation: Recommendation, summary: string) => void;
}

export function CloseSessionForm({ session, busy, onClose }: Props) {
  // Hasta que la persona elija, el formulario sigue la sugerencia (que cambia al ejecutar casos).
  const [chosen, setChosen] = useState<Recommendation | null>(null);
  const [summary, setSummary] = useState("");
  const hasFailures = session.counts.failed + session.counts.blocked > 0;
  const stillValid = chosen !== null && !(chosen === "accept" && hasFailures);
  const recommendation: Recommendation = stillValid
    ? chosen
    : (session.suggested_recommendation ?? "reject");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("¿Cerrar la sesión? Después no se podrá modificar."))
      return;
    onClose(recommendation, summary);
  }

  return (
    <form onSubmit={handleSubmit} className="form" aria-label="Cerrar sesión">
      <h3>Cierre de la sesión</h3>
      {session.pending > 0 ? (
        <p className="notice warn">
          Faltan {session.pending} casos por ejecutar. Registra un resultado
          para cada uno antes de cerrar.
        </p>
      ) : (
        session.suggested_recommendation && (
          <p className="notice">
            Recomendación sugerida según los resultados:{" "}
            <strong>
              {RECOMMENDATION_LABEL[session.suggested_recommendation]}
            </strong>
            . La decisión final es tuya.
          </p>
        )
      )}

      <label>
        Recomendación final
        <select
          aria-label="Recomendación final"
          value={recommendation}
          onChange={(e) => setChosen(e.target.value as Recommendation)}
        >
          {(Object.keys(RECOMMENDATION_LABEL) as Recommendation[]).map(
            (key) => (
              <option
                key={key}
                value={key}
                disabled={key === "accept" && hasFailures}
              >
                {RECOMMENDATION_LABEL[key]}
              </option>
            ),
          )}
        </select>
      </label>
      <label>
        Resumen
        <textarea
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>
      <button type="submit" disabled={busy || session.pending > 0}>
        Cerrar sesión
      </button>
    </form>
  );
}
