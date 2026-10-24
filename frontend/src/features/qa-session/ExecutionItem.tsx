import { useState, type FormEvent } from "react";
import type {
  DefectUpdate,
  Execution,
  ExecutionChanges,
} from "../../api/client";
import { Badge, type Tone } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Field } from "../../shared/ui/Field";
import { DefectForm } from "./DefectForm";
import { EvidenceSection } from "./EvidenceSection";
import { RESULT_LABEL } from "./labels";

const RESULT_TONE: Record<Execution["result"], Tone> = {
  not_run: "neutral",
  passed: "ok",
  failed: "danger",
  blocked: "warn",
};

export type Feedback = { kind: "error" | "notice"; text: string };

export interface ExecutionActions {
  onSave: (execution: Execution, changes: ExecutionChanges) => void;
  onNote: (execution: Execution, text: string) => Promise<boolean>;
  onLink: (
    execution: Execution,
    url: string,
    description: string,
  ) => Promise<boolean>;
  onImage: (
    execution: Execution,
    file: File,
    description: string,
  ) => Promise<boolean>;
  onDraftDefect: (execution: Execution) => void;
  onSaveDefect: (execution: Execution, changes: DefectUpdate) => void;
}

interface Props extends ExecutionActions {
  execution: Execution;
  /** Cerrada o sin permiso de escritura. */
  readOnly: boolean;
  busy: boolean;
  feedback: Feedback | null;
  /** Texto bajo «Redactar defecto»: si se usará IA o la plantilla, y por qué. */
  draftHint: string;
}

export function ExecutionItem({
  execution,
  readOnly,
  busy,
  feedback,
  draftHint,
  onSave,
  onNote,
  onLink,
  onImage,
  onDraftDefect,
  onSaveDefect,
}: Props) {
  const [result, setResult] = useState(execution.result);
  const [actual, setActual] = useState(execution.actual_result);
  const [notes, setNotes] = useState(execution.notes);
  const label = execution.case_title;
  const { defect } = execution;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(execution, { result, actual_result: actual, notes });
  }

  return (
    <li className="execution">
      <div className="case__head">
        <h3 className="wrap">{label}</h3>
        <Badge tone={RESULT_TONE[execution.result]}>
          {RESULT_LABEL[execution.result]}
        </Badge>
      </div>
      <p className="hint">
        {execution.criterion_index
          ? `Criterio ${execution.criterion_index}`
          : "Sin criterio asociado"}
      </p>
      <div className="prose wrap">
        {execution.preconditions ? (
          <p>
            <strong>Precondiciones:</strong> {execution.preconditions}
          </p>
        ) : null}
        <ol>
          {execution.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
        <p>
          <strong>Resultado esperado:</strong> {execution.expected_result}
        </p>
      </div>

      <form
        className="form-grid"
        onSubmit={submit}
        aria-label={`Resultado de ${label}`}
      >
        <Field label="Resultado">
          <select
            aria-label={`Resultado del caso ${label}`}
            value={result}
            onChange={(e) => setResult(e.target.value as Execution["result"])}
            disabled={readOnly}
          >
            {(Object.keys(RESULT_LABEL) as Execution["result"][]).map((key) => (
              <option key={key} value={key}>
                {RESULT_LABEL[key]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Resultado obtenido">
          <textarea
            rows={2}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            disabled={readOnly}
          />
        </Field>
        <Field label="Notas">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readOnly}
          />
        </Field>
        {!readOnly ? (
          <div>
            <Button type="submit" disabled={busy}>
              Guardar resultado
            </Button>
          </div>
        ) : null}
      </form>

      <EvidenceSection
        label={label}
        evidences={execution.evidences}
        canEdit={!readOnly}
        busy={busy}
        onNote={(text) => onNote(execution, text)}
        onLink={(url, description) => onLink(execution, url, description)}
        onImage={(file, description) => onImage(execution, file, description)}
      />

      {execution.result === "failed" ? (
        <section aria-label={`Defecto de ${label}`} className="stack">
          {defect ? (
            <DefectForm
              key={defect.id + defect.title + defect.ai_assisted}
              defect={defect}
              readOnly={readOnly}
              busy={busy}
              onSave={(changes) => onSaveDefect(execution, changes)}
            />
          ) : (
            <p className="hint">
              Aún no hay un defecto registrado para este caso fallido.
            </p>
          )}
          {!readOnly ? (
            <div className="stack">
              <div>
                <Button
                  variant="ghost"
                  disabled={busy}
                  aria-label={`${defect ? "Regenerar" : "Redactar"} defecto de ${label}`}
                  onClick={() => onDraftDefect(execution)}
                >
                  {defect ? "Regenerar defecto" : "Redactar defecto"}
                </Button>
              </div>
              <p className="hint">{draftHint}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {feedback ? (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={
            feedback.kind === "error" ? "field__error wrap" : "hint wrap"
          }
        >
          {feedback.text}
        </p>
      ) : null}
    </li>
  );
}
