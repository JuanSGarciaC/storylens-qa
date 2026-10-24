import { useState, type FormEvent } from "react";
import type { Defect, DefectUpdate } from "../../api/client";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Field } from "../../shared/ui/Field";
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

export function DefectForm({ defect, readOnly, busy, onSave }: Props) {
  const [title, setTitle] = useState(defect.title);
  const [severity, setSeverity] = useState(defect.severity);
  const [priority, setPriority] = useState(defect.priority);
  const [frequency, setFrequency] = useState(defect.frequency);
  const [steps, setSteps] = useState(defect.steps.join("\n"));
  const [expected, setExpected] = useState(defect.expected_result);
  const [actual, setActual] = useState(defect.actual_result);

  function submit(event: FormEvent) {
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
      className="form-grid defect"
      onSubmit={submit}
      aria-label="Borrador de defecto"
    >
      <p>
        <strong>Borrador de defecto</strong>{" "}
        {defect.ai_assisted ? (
          <Badge tone="info">Redacción asistida por IA</Badge>
        ) : null}
      </p>
      <p className="hint wrap">
        Ambiente: {defect.environment} · Build: {defect.build_version || "—"}
      </p>
      <Field label="Título del defecto">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={readOnly}
        />
      </Field>
      <Field label="Severidad">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Defect["severity"])}
          disabled={readOnly}
        >
          {options(SEVERITY_LABEL)}
        </select>
      </Field>
      <Field label="Prioridad">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Defect["priority"])}
          disabled={readOnly}
        >
          {options(PRIORITY_LABEL)}
        </select>
      </Field>
      <Field label="Frecuencia">
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Defect["frequency"])}
          disabled={readOnly}
        >
          {options(FREQUENCY_LABEL)}
        </select>
      </Field>
      <Field label="Pasos para reproducir" hint="Uno por línea">
        <textarea
          rows={4}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          disabled={readOnly}
        />
      </Field>
      <Field label="Resultado esperado">
        <textarea
          rows={2}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          disabled={readOnly}
        />
      </Field>
      <Field label="Resultado obtenido">
        <textarea
          rows={2}
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          disabled={readOnly}
        />
      </Field>
      {!readOnly ? (
        <div>
          <Button type="submit" disabled={busy || !title.trim()}>
            Guardar defecto
          </Button>
        </div>
      ) : null}
    </form>
  );
}
