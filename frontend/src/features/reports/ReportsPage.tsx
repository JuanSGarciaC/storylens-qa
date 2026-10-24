import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../../api/client";
import type { AuditEvent, StoryItem } from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useSession } from "../../app/session";
import { useLoad } from "../../shared/useLoad";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Spinner } from "../../shared/ui/Spinner";

const CHUNK = 50;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Enlaces de descarga; `label` identifica el informe para lectores de pantalla. */
function Downloads({ path, label }: { path: string; label: string }) {
  return (
    <span className="report-links">
      <a href={api.apiUrl(`${path}?format=md`)} download>
        {`${label} (Markdown)`}
      </a>
      {" · "}
      <a href={api.apiUrl(`${path}?format=pdf`)} download>
        {`${label} (PDF)`}
      </a>
    </span>
  );
}

function AnalysisReports({ stories }: { stories: StoryItem[] }) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(CHUNK);
  const analyzed = useMemo(
    () => stories.filter((s) => s.latest_analysis),
    [stories],
  );
  const matches = useMemo(() => {
    const needle = text.trim().toLowerCase();
    if (!needle) return analyzed;
    return analyzed.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.id.toLowerCase().includes(needle),
    );
  }, [analyzed, text]);

  return (
    <section aria-labelledby="rep-analysis" className="stack">
      <h2 id="rep-analysis">Informes de análisis</h2>
      {analyzed.length === 0 ? (
        <EmptyState
          title="Aún no hay análisis"
          body="Analiza una historia para poder descargar su informe."
        />
      ) : (
        <>
          <div className="filters" role="search">
            <div className="field">
              <label className="field__label" htmlFor="rep-text">
                Buscar historia
              </label>
              <input
                id="rep-text"
                type="search"
                value={text}
                placeholder="Título o ID"
                onChange={(e) => {
                  setText(e.target.value);
                  setShown(CHUNK);
                }}
              />
            </div>
          </div>
          <p role="status" className="hint">
            {matches.length} de {analyzed.length} historias con análisis
          </p>
          <ul className="sessions" aria-label="Informes de análisis">
            {matches.slice(0, shown).map((s) => (
              <li key={s.id} className="session-row">
                <span className="wrap">{s.title || "Historia sin título"}</span>
                <Downloads
                  path={`/analyses/${s.latest_analysis!.id}/report`}
                  label={`Informe de ${s.title || "historia sin título"}`}
                />
              </li>
            ))}
          </ul>
          {matches.length > shown ? (
            <div>
              <Button
                variant="ghost"
                onClick={() => setShown((n) => n + CHUNK)}
              >
                Mostrar más
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function StorySessions({ story }: { story: StoryItem }) {
  const list = useLoad(
    () => api.listSessions(story.id),
    `sessions-${story.id}`,
  );
  if (list.loading) return <Spinner label="Cargando sesiones…" />;
  if (list.error || !list.data) {
    return <ErrorNotice message={list.error} onRetry={list.reload} />;
  }
  if (list.data.length === 0) {
    return (
      <EmptyState
        title="Esta historia aún no tiene sesiones"
        body="Los informes aparecen cuando se inicia una sesión QA."
      />
    );
  }
  return (
    <ul className="sessions" aria-label="Informes de sesiones QA">
      {list.data.map((session) => (
        <li key={session.id} className="session-row">
          <span className="wrap">
            {session.environment_name} · {formatDate(session.started_at)}
          </span>
          <Downloads
            path={`/qa-sessions/${session.id}/report`}
            label={`Informe de la sesión ${session.environment_name}`}
          />
        </li>
      ))}
    </ul>
  );
}

function SessionReports({ stories }: { stories: StoryItem[] }) {
  const [storyId, setStoryId] = useState("");
  const story = stories.find((s) => s.id === storyId);
  return (
    <section aria-labelledby="rep-sessions" className="stack">
      <h2 id="rep-sessions">Informes de sesiones QA</h2>
      <div className="filters">
        <div className="field">
          <label className="field__label" htmlFor="rep-story">
            Historia con sesiones
          </label>
          <select
            id="rep-story"
            value={storyId}
            onChange={(e) => setStoryId(e.target.value)}
          >
            <option value="">Elige una historia…</option>
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || "Historia sin título"}
              </option>
            ))}
          </select>
        </div>
      </div>
      {story ? <StorySessions key={story.id} story={story} /> : null}
    </section>
  );
}

function AuditSection({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  async function loadMore() {
    setBusy(true);
    setError("");
    try {
      const page = await api.listAudit(projectId, CHUNK, events.length);
      setEvents((prev) => [...prev, ...page]);
      setMore(page.length === CHUNK);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar la auditoría.",
      );
      setMore(false);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadMore();
    // Solo la primera página al montar; las demás las pide «Cargar más».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section aria-labelledby="rep-audit" className="stack">
      <h2 id="rep-audit">Auditoría</h2>
      {error ? (
        <p role="alert" className="notice wrap">
          {error}
        </p>
      ) : null}
      {busy && events.length === 0 ? (
        <Spinner label="Cargando auditoría…" />
      ) : null}
      {!busy && !error && events.length === 0 ? (
        <EmptyState
          title="Sin eventos de auditoría"
          body="Las acciones sobre el proyecto quedarán registradas aquí."
        />
      ) : null}
      {events.length > 0 ? (
        <div className="table-wrap">
          <table className="table" aria-label="Auditoría">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Actor</th>
                <th scope="col">Acción</th>
                <th scope="col">Entidad</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{formatDate(ev.at)}</td>
                  <td className="wrap">{ev.actor}</td>
                  <td className="mono wrap">{ev.action}</td>
                  <td className="wrap">
                    {ev.entity}{" "}
                    <span className="mono" title={ev.entity_id}>
                      {ev.entity_id}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {more && events.length > 0 ? (
        <div>
          <Button
            variant="ghost"
            loading={busy}
            onClick={() => void loadMore()}
          >
            Cargar más
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function ReportsPage() {
  const { project, projectId } = useProject();
  const { me } = useSession();
  const stories = useLoad(
    () => api.listStories(projectId ?? ""),
    `reports-${projectId}`,
  );
  if (!project) return <Spinner label="Cargando proyecto…" />;

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Informes</h1>
        <p className="page__lead">
          Descarga los informes de calidad en PDF o Markdown.
        </p>
      </header>
      {stories.loading ? (
        <Spinner label="Cargando historias…" />
      ) : stories.error || !stories.data ? (
        <ErrorNotice message={stories.error} onRetry={stories.reload} />
      ) : (
        <>
          <AnalysisReports stories={stories.data} />
          <SessionReports stories={stories.data} />
        </>
      )}
      {me?.authenticated ? <AuditSection projectId={project.id} /> : null}
    </div>
  );
}
