import { Link } from "react-router-dom";
import * as api from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useLoad } from "../../shared/useLoad";
import { Badge } from "../../shared/ui/Badge";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Ring } from "../../shared/ui/Ring";
import { Spinner } from "../../shared/ui/Spinner";
import { summarizeStories } from "./classifyStory";

const NONE = "—";

/** Un decimal con coma; enteros sin decimales. */
function formatScore(value: number | null): string {
  if (value === null) return NONE;
  return (Math.round(value * 10) / 10).toString().replace(".", ",");
}

export function ProjectOverviewPage() {
  const { project, projectId } = useProject();
  const stories = useLoad(
    () => api.listStories(projectId ?? ""),
    `stories-${projectId}`,
  );

  if (!project) return <Spinner label="Cargando proyecto…" />;

  let body;
  if (stories.loading) body = <Spinner label="Cargando historias…" />;
  else if (stories.error || !stories.data) {
    body = <ErrorNotice message={stories.error} onRetry={stories.reload} />;
  } else if (stories.data.length === 0) {
    body = (
      <>
        <h2 className="visually-hidden">Estado de las historias</h2>
        <EmptyState
          title="Aún no hay historias"
          body="Importa o crea historias de usuario para ver aquí el estado de calidad del proyecto."
          action={
            <Link to={`/p/${project.id}/stories`}>Importar historias</Link>
          }
        />
      </>
    );
  } else {
    const s = summarizeStories(stories.data, project.settings);
    body = (
      <>
        <div className="stats" role="group" aria-label="Cifras">
          <dl className="stat">
            <dt>Historias</dt>
            <dd className="gradient-text">{s.total}</dd>
          </dl>
          <dl className="stat">
            <dt>No listas</dt>
            <dd className="gradient-text">
              {s.notReadyPercent === null ? NONE : `${s.notReadyPercent} %`}
            </dd>
            <dd className="hint">con bloqueantes o puntaje bajo</dd>
          </dl>
          <dl className="stat">
            <dt>Puntaje medio</dt>
            <dd className="gradient-text">{formatScore(s.meanScore)}</dd>
          </dl>
        </div>
        {s.analyzed === 0 ? (
          <p className="hint">
            Ninguna historia tiene análisis todavía: los porcentajes y el
            puntaje medio aparecerán al analizar la primera.
          </p>
        ) : (
          <p className="hint">
            Porcentaje y puntaje calculados sobre {s.analyzed} de {s.total}{" "}
            historias analizadas.
          </p>
        )}
        <section className="panel" aria-labelledby="estado-titulo">
          <h2 id="estado-titulo">Historias por estado</h2>
          <Ring
            segments={[
              {
                label: "Sin analizar",
                value: s.counts.unanalyzed,
                tone: "neutral",
              },
              {
                label: "No listas",
                value: s.counts.notReady,
                tone: "danger",
              },
              {
                label: "Aprobadas con observaciones",
                value: s.counts.notes,
                tone: "warn",
              },
              { label: "Listas", value: s.counts.ready, tone: "ok" },
            ]}
          />
        </section>
      </>
    );
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">
          {project.name}
          {project.is_demo ? <Badge tone="info">Demostración</Badge> : null}
        </h1>
        {project.description ? (
          <p className="page__lead">{project.description}</p>
        ) : null}
        {project.objective ? (
          <p className="page__lead">Objetivo: {project.objective}</p>
        ) : null}
      </header>
      {body}
    </div>
  );
}
