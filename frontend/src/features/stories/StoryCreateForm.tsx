import { useState, type FormEvent } from "react";
import type { Named, StoryInput } from "../../api/client";
import { Button } from "../../shared/ui/Button";
import { Field } from "../../shared/ui/Field";
import { parseCriteria } from "../analysis/parseCriteria";

type Props = {
  epics: Named[];
  versions: Named[];
  busy: boolean;
  onSubmit: (story: StoryInput) => void;
  onCancel: () => void;
};

export function StoryCreateForm({
  epics,
  versions,
  busy,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [epicId, setEpicId] = useState("");
  const [versionId, setVersionId] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      acceptance_criteria: parseCriteria(criteria),
      epic_id: epicId || null,
      version_id: versionId || null,
    });
  }

  return (
    <form className="panel" onSubmit={handleSubmit} aria-label="Nueva historia">
      <Field label="Título">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
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
        <Field label="Épica (opcional)">
          <select value={epicId} onChange={(e) => setEpicId(e.target.value)}>
            <option value="">Sin épica</option>
            {epics.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Versión (opcional)">
          <select
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
          >
            <option value="">Sin versión</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="inline-form">
        <Button type="submit" loading={busy}>
          Guardar historia
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
