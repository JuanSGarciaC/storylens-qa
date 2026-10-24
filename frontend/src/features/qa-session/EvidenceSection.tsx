import { useState } from "react";
import type { Evidence } from "../../api/client";
import { Button } from "../../shared/ui/Button";
import { Field } from "../../shared/ui/Field";
import {
  evidenceFileUrl,
  imageError,
  linkError,
  safeHttpUrl,
} from "./evidenceRules";

interface Props {
  label: string;
  evidences: Evidence[];
  canEdit: boolean;
  busy: boolean;
  /** Cada acción resuelve true si quedó guardada (entonces se limpia el campo). */
  onNote: (text: string) => Promise<boolean>;
  onLink: (url: string, description: string) => Promise<boolean>;
  onImage: (file: File, description: string) => Promise<boolean>;
}

function EvidenceItem({ evidence }: { evidence: Evidence }) {
  const detail = evidence.description ? `: ${evidence.description}` : "";
  if (evidence.type === "note") {
    return <span className="wrap">Nota: {evidence.description}</span>;
  }
  if (evidence.type === "link") {
    const href = safeHttpUrl(evidence.url);
    return href ? (
      <a className="wrap" href={href} target="_blank" rel="noopener noreferrer">
        Enlace{detail}
      </a>
    ) : (
      <span className="wrap">Enlace no seguro{detail}</span>
    );
  }
  const src = evidenceFileUrl(evidence.url);
  return src ? (
    <>
      <a className="wrap" href={src} target="_blank" rel="noopener noreferrer">
        Imagen{detail}
      </a>
      <img
        className="evidence__img"
        src={src}
        alt={`Vista previa${detail}`}
        loading="lazy"
      />
    </>
  ) : (
    <span className="wrap">Imagen no disponible{detail}</span>
  );
}

export function EvidenceSection({
  label,
  evidences,
  canEdit,
  busy,
  onNote,
  onLink,
  onImage,
}: Props) {
  const [note, setNote] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [problem, setProblem] = useState("");

  async function addLink() {
    const message = linkError(linkUrl);
    setProblem(message);
    if (message) return;
    if (await onLink(linkUrl.trim(), linkDescription)) {
      setLinkUrl("");
      setLinkDescription("");
    }
  }

  async function addImage() {
    if (!file) return;
    const message = imageError(file);
    setProblem(message);
    if (message) return;
    if (await onImage(file, imageDescription)) {
      setFile(null);
      setFileKey((n) => n + 1);
      setImageDescription("");
    }
  }

  return (
    <section aria-label={`Evidencias de ${label}`} className="stack">
      <h4>Evidencias</h4>
      {evidences.length === 0 ? (
        <p className="hint">Sin evidencias.</p>
      ) : (
        <ul className="evidences">
          {evidences.map((evidence) => (
            <li key={evidence.id}>
              <EvidenceItem evidence={evidence} />
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="stack">
          <div className="inline-form">
            <Field label="Nueva nota">
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button
              variant="ghost"
              disabled={busy || !note.trim()}
              aria-label={`Agregar nota a ${label}`}
              onClick={() => void onNote(note).then((ok) => ok && setNote(""))}
            >
              Agregar nota
            </Button>
          </div>
          <div className="inline-form">
            <Field label="URL del enlace">
              <input
                value={linkUrl}
                placeholder="https://"
                inputMode="url"
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </Field>
            <Field label="Descripción del enlace">
              <input
                value={linkDescription}
                onChange={(e) => setLinkDescription(e.target.value)}
              />
            </Field>
            <Button
              variant="ghost"
              disabled={busy || !linkUrl.trim()}
              aria-label={`Agregar enlace a ${label}`}
              onClick={() => void addLink()}
            >
              Agregar enlace
            </Button>
          </div>
          <div className="inline-form">
            <Field label="Imagen (PNG, JPEG o WebP, máx. 1 MB)">
              <input
                key={fileKey}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setProblem("");
                }}
              />
            </Field>
            <Field label="Descripción de la imagen">
              <input
                value={imageDescription}
                onChange={(e) => setImageDescription(e.target.value)}
              />
            </Field>
            <Button
              variant="ghost"
              disabled={busy || !file}
              aria-label={`Subir imagen a ${label}`}
              onClick={() => void addImage()}
            >
              Subir imagen
            </Button>
          </div>
          {problem ? (
            <p role="alert" className="field__error wrap">
              {problem}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
