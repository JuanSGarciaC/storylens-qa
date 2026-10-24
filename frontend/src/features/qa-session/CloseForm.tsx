import { useState, type FormEvent } from "react";
import type { Recommendation, SessionDetail } from "../../api/client";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Field } from "../../shared/ui/Field";
import { RECOMMENDATION_LABEL, RECOMMENDATION_TONE } from "./labels";

interface Props {
  session: SessionDetail;
  busy: boolean;
  error: string;
  onClose: (recommendation: Recommendation, summary: string) => void;
}

export function CloseForm({ session, busy, error, onClose }: Props) {
  // Hasta que la persona elija, el formulario sigue la sugerencia (que cambia al ejecutar casos).
  const [chosen, setChosen] = useState<Recommendation | null>(null);
  const [summary, setSummary] = useState("");
  const hasFailures = session.counts.failed + session.counts.blocked > 0;
  const stillValid = chosen !== null && !(chosen === "accept" && hasFailures);
  const recommendation: Recommendation = stillValid
    ? chosen
    : (session.suggested_recommendation ?? "reject");
  const suggested = session.suggested_recommendation;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("¿Cerrar la sesión? Después no se podrá modificar.")) {
      return;
    }
    onClose(recommendation, summary);
  }

  return (
    <form className="form-grid" onSubmit={submit} aria-label="Cerrar sesión">
      <h2>Cierre de la sesión</h2>
      {session.pending > 0 ? (
        <p className="notice">
          Faltan {session.pending} casos por ejecutar. Registra un resultado
          para cada uno antes de cerrar.
        </p>
      ) : suggested ? (
        <p className="notice">
          Recomendación sugerida según los resultados:{" "}
          <Badge tone={RECOMMENDATION_TONE[suggested]}>
            {RECOMMENDATION_LABEL[suggested]}
          </Badge>
          . La decisión final es tuya.
        </p>
      ) : null}
      <Field label="Recomendación final">
        <select
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
      </Field>
      <Field label="Resumen">
        <textarea
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="field__error wrap">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={busy} disabled={session.pending > 0}>
          Cerrar sesión
        </Button>
      </div>
    </form>
  );
}
