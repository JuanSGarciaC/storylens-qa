import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { Field } from "../../shared/ui/Field";
import {
  previewImport,
  startImportJob,
  type ImportMapping,
  type ImportPreview,
} from "../../api/client";

interface Props {
  projectId: string;
  busy: boolean;
  /** La IA solo se ofrece si el dueño la tiene disponible. */
  canUseAi: boolean;
  /** Ejecuta la acción mostrando carga y errores de la app. */
  run: (action: () => Promise<void>) => Promise<void>;
}

const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  description: "Descripción",
  acceptance_criteria: "Criterios de aceptación",
  key: "Clave (Jira)",
};

export function ImportPanel({ projectId, busy, canUseAi, run }: Props) {
  const navigate = useNavigate();
  const [useAi, setUseAi] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());

  const load = (chosen: File, chosenMapping: ImportMapping | null) =>
    run(async () => {
      const result = await previewImport(projectId, chosen, chosenMapping);
      setPreview(result);
      setMapping(result.mapping);
      setSkipped(new Set());
    });

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    setPreview(null);
    if (chosen) void load(chosen, null);
  }

  function handleMapping(field: string, column: string) {
    if (!file || !mapping) return;
    const next = { ...mapping, [field]: column || null };
    setMapping(next);
    void load(file, next);
  }

  function toggle(index: number) {
    setSkipped((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const chosenRows =
    preview?.rows.filter((r) => r.importable && !skipped.has(r.index)) ?? [];
  const validCount = preview?.rows.filter((r) => r.importable).length ?? 0;
  const invalidCount = (preview?.rows.length ?? 0) - validCount;

  function handleImport() {
    if (!file || !mapping) return;
    void run(async () => {
      const job = await startImportJob(
        projectId,
        file,
        mapping,
        chosenRows.map((r) => r.index),
        canUseAi && useAi,
      );
      setPreview(null);
      setFile(null);
      navigate(`/p/${projectId}/imports/${job.id}`);
    });
  }

  return (
    <details className="panel import">
      <summary>Importar historias desde Jira (CSV o JSON)</summary>
      <p className="hint">
        Exporta tus incidencias de Jira y súbelas aquí (hasta 500 historias).
        Verás una vista previa antes de crear nada y después el avance de la
        importación.
      </p>
      <Field label="Archivo de Jira (.csv o .json, máximo 1 MB)">
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          onChange={handleFile}
        />
      </Field>

      {preview && mapping && (
        <>
          <fieldset className="mapping">
            <legend>Mapeo de columnas</legend>
            {Object.keys(FIELD_LABEL).map((field) => (
              <Field key={field} label={FIELD_LABEL[field]}>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) => handleMapping(field, e.target.value)}
                  disabled={busy}
                >
                  <option value="">(no usar)</option>
                  {preview.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </fieldset>

          {preview.truncated && (
            <p className="notice">
              El archivo tiene más de 500 filas: divídelo en partes, porque una
              importación admite hasta 500 historias.
            </p>
          )}

          <p className="hint">
            {validCount} {validCount === 1 ? "válida" : "válidas"} ·{" "}
            {invalidCount} {invalidCount === 1 ? "inválida" : "inválidas"}
          </p>

          <ul
            className="import-rows"
            aria-label="Vista previa de la importación"
          >
            {preview.rows.map((row) => (
              <li key={row.index} className={row.importable ? "" : "disabled"}>
                <label className="import-rows__check">
                  <input
                    type="checkbox"
                    disabled={!row.importable}
                    checked={row.importable && !skipped.has(row.index)}
                    onChange={() => toggle(row.index)}
                    aria-label={`Importar fila ${row.index}`}
                  />
                  <span className="import-rows__text">
                    <span>
                      <strong>{row.title || "(sin título)"}</strong>
                      {row.key && <span className="mono"> {row.key}</span>}
                    </span>
                    <span className="hint">
                      {row.acceptance_criteria.length} criterios ·{" "}
                      {row.description.slice(0, 120) || "sin descripción"}
                    </span>
                    {row.duplicate && (
                      <span className="hint">
                        Ya existe una historia igual: se omitirá.
                      </span>
                    )}
                    {row.issues.map((issue) => (
                      <span key={issue} className="import-rows__problem">
                        {issue}: no se puede importar.
                      </span>
                    ))}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {canUseAi && (
            <label className="import-ai">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
              />{" "}
              Analizar también con IA mientras haya cuota (si se agota, el resto
              se analiza solo con reglas)
            </label>
          )}
          <div>
            <Button
              onClick={handleImport}
              disabled={busy || chosenRows.length === 0}
            >
              {`Importar ${chosenRows.length} ${chosenRows.length === 1 ? "historia" : "historias"}`}
            </Button>
          </div>
        </>
      )}
    </details>
  );
}
