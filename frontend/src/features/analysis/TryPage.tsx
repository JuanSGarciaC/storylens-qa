import { useEffect, useRef, useState, type FormEvent } from "react";
import * as api from "../../api/client";
import type { Analysis } from "../../api/client";
import { Button } from "../../shared/ui/Button";
import { Field } from "../../shared/ui/Field";
import { Findings, ScoreSummary } from "./AnalysisPage";
import { parseCriteria } from "./parseCriteria";

// Ejemplo con defectos a propósito: un clic en «Analizar» ya enseña hallazgos.
const EXAMPLE = {
  title: "Transferir dinero",
  description: "Como cliente quiero transferir dinero de forma rápida y fácil",
  criteria: "La transferencia debe ser rápida\nEl sistema debe ser amigable",
};

/** Análisis con reglas de un texto suelto, abierto a cualquiera: no guarda nada ni usa IA. */
export function TryPage() {
  const [title, setTitle] = useState(EXAMPLE.title);
  const [description, setDescription] = useState(EXAMPLE.description);
  const [criteria, setCriteria] = useState(EXAMPLE.criteria);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const result = useRef<HTMLElement>(null);

  // En pantallas pequeñas el resultado queda bajo el formulario: el foco lo trae a la vista.
  useEffect(() => {
    if (analysis) result.current?.focus();
  }, [analysis]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setAnalysis(
        await api.analyzeText({
          title: title.trim(),
          description: description.trim(),
          acceptance_criteria: parseCriteria(criteria),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Prueba tu historia</h1>
        <p className="page__lead">
          Escribe una historia de usuario y analízala con las reglas de calidad.
          No se guarda nada y no se usa IA.
        </p>
      </header>

      <form
        className="panel"
        onSubmit={handleSubmit}
        aria-label="Historia a analizar"
      >
        <Field label="Título">
          <input
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field
          label="Descripción"
          hint="Como <rol> quiero <acción> para <beneficio>"
        >
          <textarea
            rows={3}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Criterios de aceptación" hint="Uno por línea">
          <textarea
            rows={5}
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
          />
        </Field>
        <div className="inline-form">
          <Button type="submit" loading={busy}>
            Analizar
          </Button>
        </div>
        {error ? (
          <p role="alert" className="field__error wrap">
            {error}
          </p>
        ) : null}
      </form>

      <div aria-live="polite">
        {analysis ? (
          <p role="status" className="hint">
            Análisis completado: {analysis.score} de 100.
          </p>
        ) : null}
      </div>
      {analysis ? (
        <>
          <section
            ref={result}
            tabIndex={-1}
            aria-labelledby="result-title"
            className="result"
          >
            <h2 id="result-title">Resultado</h2>
            <ScoreSummary analysis={analysis} />
          </section>
          <section aria-labelledby="findings-title">
            <h2 id="findings-title">Hallazgos</h2>
            <Findings analysis={analysis} />
            <p className="hint">
              Catálogo de reglas v{analysis.rules_catalog_version}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
