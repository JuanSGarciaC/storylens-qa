import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "../../api/client";
import type { Project, SessionSummary, StoryItem } from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useStory } from "../../app/useStory";
import { useAccess } from "../../shared/useAccess";
import { useLoad } from "../../shared/useLoad";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Field } from "../../shared/ui/Field";
import { Spinner } from "../../shared/ui/Spinner";
import { safeHttpUrl } from "./evidenceRules";
import { RECOMMENDATION_LABEL, RECOMMENDATION_TONE } from "./labels";

function NewSessionForm({
  storyId,
  onCreated,
}: {
  storyId: string;
  onCreated: (session: SessionSummary) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [build, setBuild] = useState("");
  const [tester, setTester] = useState("");
  const [busy, setBusy] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!safeHttpUrl(url)) {
      setUrlError("La URL debe empezar con http:// o https://.");
      return;
    }
    setUrlError("");
    setBusy(true);
    try {
      onCreated(
        await api.createSession(storyId, {
          environment_name: name.trim(),
          environment_url: url.trim(),
          build_version: build.trim(),
          tester_name: tester.trim(),
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo iniciar la sesión.",
      );
      setBusy(false);
    }
  }

  return (
    <form
      className="form-grid"
      onSubmit={(e) => void submit(e)}
      aria-labelledby="new-session-title"
    >
      <h2 id="new-session-title">Nueva sesión</h2>
      <p className="hint">
        La sesión incluye los casos de prueba <strong>aceptados</strong> de esta
        historia.
      </p>
      <Field label="Ambiente">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="off"
        />
      </Field>
      <Field label="URL del ambiente" error={urlError}>
        <input
          value={url}
          placeholder="https://"
          inputMode="url"
          onChange={(e) => setUrl(e.target.value)}
          required
          autoComplete="off"
        />
      </Field>
      <Field label="Build / versión">
        <input value={build} onChange={(e) => setBuild(e.target.value)} />
      </Field>
      <Field label="Responsable">
        <input value={tester} onChange={(e) => setTester(e.target.value)} />
      </Field>
      {error ? (
        <p role="alert" className="field__error wrap">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          loading={busy}
          disabled={!name.trim() || !url.trim()}
        >
          Iniciar sesión
        </Button>
      </div>
    </form>
  );
}

function SessionsView({
  story,
  project,
}: {
  story: StoryItem;
  project: Project;
}) {
  const access = useAccess(project);
  const navigate = useNavigate();
  const list = useLoad(
    () => api.listSessions(story.id),
    `sessions-${story.id}`,
  );

  if (list.loading) return <Spinner label="Cargando sesiones…" />;
  if (list.error || !list.data) {
    return <ErrorNotice message={list.error} onRetry={list.reload} />;
  }
  const sessions = list.data;
  const base = `/p/${project.id}/stories/${story.id}/sessions`;

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title wrap">
          {story.title || "Historia sin título"}
        </h1>
        <p className="page__lead">
          Sesiones de revisión en el ambiente QA: ejecución de casos, evidencias
          y defectos.
        </p>
      </header>

      {access.canWrite ? (
        <NewSessionForm
          storyId={story.id}
          onCreated={(created) => void navigate(`${base}/${created.id}`)}
        />
      ) : (
        <p className="hint">{access.reason}</p>
      )}

      <section aria-labelledby="sessions-title" className="stack">
        <h2 id="sessions-title">Sesiones de esta historia</h2>
        {sessions.length === 0 ? (
          <EmptyState
            title="Esta historia aún no tiene sesiones"
            body="Inicia una sesión cuando tengas casos de prueba aceptados y un ambiente QA donde ejecutarlos."
          />
        ) : (
          <ul className="sessions">
            {sessions.map((session) => (
              <li key={session.id} className="session-row">
                <Link to={`${base}/${session.id}`} className="wrap">
                  {session.environment_name} ·{" "}
                  {new Date(session.started_at).toLocaleDateString("es")}
                </Link>
                <Badge tone={session.closed_at ? "neutral" : "info"}>
                  {session.closed_at ? "Cerrada" : "En curso"}
                </Badge>
                {session.recommendation ? (
                  <Badge tone={RECOMMENDATION_TONE[session.recommendation]}>
                    {RECOMMENDATION_LABEL[session.recommendation]}
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function SessionsPage() {
  const { projectId, storyId } = useParams();
  const { project } = useProject();
  const { story, loading, error } = useStory(projectId, storyId);
  if (error) return <ErrorNotice message={error} />;
  if (loading || !story || !project) {
    return <Spinner label="Cargando historia…" />;
  }
  return <SessionsView key={story.id} story={story} project={project} />;
}
