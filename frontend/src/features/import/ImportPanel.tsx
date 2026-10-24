import { useState, type ChangeEvent } from "react";
import {
  confirmImport,
  previewImport,
  type ImportMapping,
  type ImportPreview,
} from "../../api/client";

interface Props {
  projectId: string;
  busy: boolean;
  onImported: (count: number) => void | Promise<void>;
  /** Ejecuta la acción mostrando carga y errores de la app. */
  run: (action: () => Promise<void>) => Promise<void>;
}

const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  description: "Descripción",
  acceptance_criteria: "Criterios de aceptación",
  key: "Clave (Jira)",
};

export function ImportPanel({ projectId, busy, onImported, run }: Props) {
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

  function handleImport() {
    if (!file || !mapping) return;
    void run(async () => {
      const result = await confirmImport(
        projectId,
        file,
        mapping,
        chosenRows.map((r) => r.index),
      );
      setPreview(null);
      setFile(null);
      await onImported(result.created.length);
    });
  }

  return (
    <details className="card import">
      <summary>Importar historias desde Jira (CSV o JSON)</summary>
      <p className="hint">
        Exporta tus incidencias de Jira y súbelas aquí. Verás una vista previa
        antes de crear nada.
      </p>
      <label>
        Archivo de Jira (.csv o .json, máximo 1 MB)
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          onChange={handleFile}
        />
      </label>

      {preview && mapping && (
        <>
          <fieldset className="mapping">
            <legend>Mapeo de columnas</legend>
            {Object.keys(FIELD_LABEL).map((field) => (
              <label key={field}>
                {FIELD_LABEL[field]}
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
              </label>
            ))}
          </fieldset>

          {preview.truncated && (
            <p className="notice warn">
              El archivo tiene más de 200 filas: solo se muestran las primeras
              200.
            </p>
          )}

          <ul
            className="import-rows"
            aria-label="Vista previa de la importación"
          >
            {preview.rows.map((row) => (
              <li key={row.index} className={row.importable ? "" : "disabled"}>
                <label className="check">
                  <input
                    type="checkbox"
                    disabled={!row.importable}
                    checked={row.importable && !skipped.has(row.index)}
                    onChange={() => toggle(row.index)}
                    aria-label={`Importar fila ${row.index}`}
                  />
                  <span>
                    <strong>{row.title || "(sin título)"}</strong>
                    {row.key && <span className="chip">{row.key}</span>}
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
                      <span key={issue} className="hint problem">
                        {issue}: no se puede importar.
                      </span>
                    ))}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleImport}
            disabled={busy || chosenRows.length === 0}
          >
            {`Importar ${chosenRows.length} ${chosenRows.length === 1 ? "historia" : "historias"}`}
          </button>
        </>
      )}
    </details>
  );
}
