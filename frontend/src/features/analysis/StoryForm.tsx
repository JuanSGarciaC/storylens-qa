import { useState, type FormEvent } from "react";
import type { StoryInput } from "../../api/client";
import { EXAMPLES, type StoryExample } from "./examples";
import { parseCriteria } from "./parseCriteria";

interface Props {
  loading: boolean;
  aiAvailable: boolean;
  onSubmit: (story: StoryInput, useAi: boolean) => void;
}

export function StoryForm({ loading, aiAvailable, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [useAi, setUseAi] = useState(true);

  function loadExample(example: StoryExample) {
    setTitle(example.title);
    setDescription(example.description);
    setCriteria(example.criteria);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        acceptance_criteria: parseCriteria(criteria),
      },
      aiAvailable && useAi,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card form">
      <h2>Historia de usuario</h2>

      <div className="examples" role="group" aria-label="Cargar un ejemplo">
        <span className="hint">
          ¿Sin historia a mano? Prueba con un ejemplo:
        </span>
        {EXAMPLES.map((example) => (
          <button
            key={example.id}
            type="button"
            className="secondary"
            onClick={() => loadExample(example)}
          >
            {example.label}
          </button>
        ))}
      </div>

      <label>
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label>
        Descripción
        <textarea
          rows={3}
          value={description}
          placeholder="Como <rol> quiero <acción> para <beneficio>"
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </label>

      <label>
        Criterios de aceptación
        <span className="hint">Uno por línea</span>
        <textarea
          rows={6}
          value={criteria}
          placeholder="Dado… cuando… entonces…"
          onChange={(e) => setCriteria(e.target.value)}
        />
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={aiAvailable && useAi}
          disabled={!aiAvailable}
          onChange={(e) => setUseAi(e.target.checked)}
        />
        <span>
          Complementar con IA (Gemini)
          <span className="hint">
            {aiAvailable
              ? "El texto de la historia se envía a Google AI Studio. No pegues datos confidenciales."
              : "La IA no está configurada en el servidor: se usarán solo las reglas."}
          </span>
        </span>
      </label>

      <button type="submit" disabled={loading}>
        {loading ? "Analizando…" : "Analizar"}
      </button>
    </form>
  );
}
