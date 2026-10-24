import { useState, type FormEvent } from "react";
import type { Defect, DefectUpdate } from "../../api/client";
import { FREQUENCY_LABEL, PRIORITY_LABEL, SEVERITY_LABEL } from "./labels";

interface Props {
  defect: Defect;
  readOnly: boolean;
  busy: boolean;
  onSave: (changes: DefectUpdate) => void;
}

function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((key) => (
    <option key={key} value={key}>
      {labels[key]}
    </option>
  ));
}

export function DefectEditor({ defect, readOnly, busy, onSave }: Props) {
  const [title, setTitle] = useState(defect.title);
  const [severity, setSeverity] = useState(defect.severity);
  const [priority, setPriority] = useState(defect.priority);
  const [frequency, setFrequency] = useState(defect.frequency);
  const [steps, setSteps] = useState(defect.steps.join("\n"));
  const [expected, setExpected] = useState(defect.expected_result);
  const [actual, setActual] = useState(defect.actual_result);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({
      title: title.trim(),
      severity,
      priority,
      frequency,
      steps: steps
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      expected_result: expected,
      actual_result: actual,
    });
  }

  return (
    <form
      className="defect"
      onSubmit={handleSubmit}
      aria-label="Borrador de defecto"
    >
      <h4>
        Borrador de defecto
        {defect.ai_assisted && (
          <span className="chip">Redacción asistida por IA</span>
        )}
      </h4>
      <p className="meta">
        Ambiente: {defect.environment} · Build: {defect.build_version || "—"}
      </p>

      <label>
        Título del defecto
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={readOnly}
        />
      </label>

      <div className="row">
        <label>
          Severidad
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Defect["severity"])}
            disabled={readOnly}
          >
            {options(SEVERITY_LABEL)}
          </select>
        </label>
        <label>
          Prioridad
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Defect["priority"])}
            disabled={readOnly}
          >
            {options(PRIORITY_LABEL)}
          </select>
        </label>
        <label>
          Frecuencia
          <select
            value={frequency}
            onChange={(e) =>
              setFrequency(e.target.value as Defect["frequency"])
            }
            disabled={readOnly}
          >
            {options(FREQUENCY_LABEL)}
          </select>
        </label>
      </div>

      <label>
        Pasos para reproducir
        <span className="hint">Uno por línea</span>
        <textarea
          rows={4}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          disabled={readOnly}
        />
      </label>
      <label>
        Resultado esperado
        <textarea
          rows={2}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          disabled={readOnly}
        />
      </label>
      <label>
        Resultado obtenido
        <textarea
          rows={2}
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          disabled={readOnly}
        />
      </label>

      {!readOnly && (
        <button type="submit" disabled={busy || !title.trim()}>
          Guardar defecto
        </button>
      )}
    </form>
  );
}
