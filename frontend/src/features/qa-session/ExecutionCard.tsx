import { useState, type FormEvent } from "react";
import type {
  DefectUpdate,
  Execution,
  ExecutionChanges,
} from "../../api/client";
import { DefectEditor } from "./DefectEditor";
import { RESULT_LABEL } from "./labels";

export interface ExecutionActions {
  onSave: (execution: Execution, changes: ExecutionChanges) => void;
  onNote: (execution: Execution, text: string) => void;
  onLink: (execution: Execution, url: string, description: string) => void;
  onImage: (execution: Execution, file: File, description: string) => void;
  onDraftDefect: (execution: Execution) => void;
  onSaveDefect: (defectId: string, changes: DefectUpdate) => void;
}

interface Props extends ExecutionActions {
  execution: Execution;
  readOnly: boolean;
  busy: boolean;
  aiAvailable: boolean;
}

export function ExecutionCard({
  execution,
  readOnly,
  busy,
  aiAvailable,
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
  const [note, setNote] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const label = execution.case_title;

  function submitResult(event: FormEvent) {
    event.preventDefault();
    onSave(execution, { result, actual_result: actual, notes });
  }

  return (
    <li className={`execution result-${execution.result}`}>
      <h4>{label}</h4>
      <p className="meta">
        {execution.criterion_index
          ? `Criterio ${execution.criterion_index}`
          : "Sin criterio"}{" "}
        · {RESULT_LABEL[execution.result]}
      </p>
      {execution.preconditions && (
        <p>
          <strong>Precondiciones:</strong> {execution.preconditions}
        </p>
      )}
      <ol>
        {execution.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <p>
        <strong>Resultado esperado:</strong> {execution.expected_result}
      </p>

      <form
        onSubmit={submitResult}
        aria-label={`Resultado de ${label}`}
        className="form"
      >
        <label>
          Resultado
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
        <label>
          Notas
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readOnly}
          />
        </label>
        {!readOnly && (
          <button type="submit" disabled={busy}>
            Guardar resultado
          </button>
        )}
      </form>

      <section aria-label={`Evidencias de ${label}`}>
        <h5>Evidencias</h5>
        {execution.evidences.length === 0 ? (
          <p className="meta">Sin evidencias.</p>
        ) : (
          <ul className="evidences">
            {execution.evidences.map((evidence) => (
              <li key={evidence.id}>
                {evidence.type === "image" && evidence.url && (
                  <a href={evidence.url} target="_blank" rel="noreferrer">
                    Imagen
                    {evidence.description ? `: ${evidence.description}` : ""}
                  </a>
                )}
                {evidence.type === "link" && evidence.url && (
                  <a
                    href={evidence.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Enlace
                    {evidence.description ? `: ${evidence.description}` : ""}
                  </a>
                )}
                {evidence.type === "note" && (
                  <span>Nota: {evidence.description}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <div className="evidence-forms">
            <div className="row">
              <label>
                Nueva nota
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button
                type="button"
                className="secondary"
                disabled={busy || !note.trim()}
                aria-label={`Agregar nota a ${label}`}
                onClick={() => {
                  onNote(execution, note);
                  setNote("");
                }}
              >
                Agregar nota
              </button>
            </div>
            <div className="row">
              <label>
                URL del enlace
                <input
                  type="url"
                  value={linkUrl}
                  placeholder="https://"
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </label>
              <label>
                Descripción del enlace
                <input
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="secondary"
                disabled={busy || !linkUrl.trim()}
                aria-label={`Agregar enlace a ${label}`}
                onClick={() => {
                  onLink(execution, linkUrl, linkDescription);
                  setLinkUrl("");
                  setLinkDescription("");
                }}
              >
                Agregar enlace
              </button>
            </div>
            <div className="row">
              <label>
                Imagen (PNG, JPEG o WebP, máx. 5 MB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label>
                Descripción de la imagen
                <input
                  value={imageDescription}
                  onChange={(e) => setImageDescription(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="secondary"
                disabled={busy || !file}
                aria-label={`Subir imagen a ${label}`}
                onClick={() => {
                  if (!file) return;
                  onImage(execution, file, imageDescription);
                  setFile(null);
                  setImageDescription("");
                }}
              >
                Subir imagen
              </button>
            </div>
          </div>
        )}
      </section>

      {execution.result === "failed" && (
        <section aria-label={`Defecto de ${label}`}>
          {execution.defect ? (
            <DefectEditor
              key={
                execution.defect.id +
                execution.defect.title +
                execution.defect.ai_assisted
              }
              defect={execution.defect}
              readOnly={readOnly}
              busy={busy}
              onSave={(changes) => onSaveDefect(execution.defect!.id, changes)}
            />
          ) : (
            <p className="meta">
              Aún no hay un defecto registrado para este caso fallido.
            </p>
          )}
          {!readOnly && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              aria-label={`${execution.defect ? "Regenerar" : "Redactar"} defecto de ${label}`}
              onClick={() => onDraftDefect(execution)}
            >
              {execution.defect ? "Regenerar defecto" : "Redactar defecto"}
              {aiAvailable ? " (con IA)" : ""}
            </button>
          )}
        </section>
      )}
    </li>
  );
}
