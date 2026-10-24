import { Link } from "react-router-dom";
import { getCrossAnalysis } from "../../api/client";
import type { CrossAnalysis } from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useLoad } from "../../shared/useLoad";
import { Badge } from "../../shared/ui/Badge";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Spinner } from "../../shared/ui/Spinner";

const LEVEL: Record<
  string,
  { label: string; tone: "danger" | "warn" | "ok" | "neutral" }
> = {
  high: { label: "Riesgo alto", tone: "danger" },
  medium: { label: "Riesgo medio", tone: "warn" },
  low: { label: "Riesgo bajo", tone: "ok" },
  unknown: { label: "Sin datos", tone: "neutral" },
};

function StoryLink({
  projectId,
  id,
  titles,
}: {
  projectId: string;
  id: string;
  titles: Map<string, string>;
}) {
  return (
    <Link to={`/p/${projectId}/stories/${id}/analysis`}>
      {titles.get(id) ?? id}
    </Link>
  );
}

function Section({
  id,
  title,
  hint,
  count,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>
        {title} <span className="mono">({count})</span>
      </h2>
      <p className="hint">{hint}</p>
      {count === 0 ? <p>Nada que señalar.</p> : children}
    </section>
  );
}

function Report({
  projectId,
  data,
}: {
  projectId: string;
  data: CrossAnalysis;
}) {
  const titles = new Map(data.stories.map((s) => [s.id, s.title]));
  const link = (id: string) => (
    <StoryLink projectId={projectId} id={id} titles={titles} />
  );

  if (data.total_stories === 0) {
    return (
      <EmptyState
        title="Todavía no hay historias que comparar"
        body="El análisis transversal compara las historias del proyecto entre sí. Agrega o importa historias para empezar."
        action={<Link to={`/p/${projectId}/stories`}>Ir a las historias</Link>}
      />
    );
  }

  return (
    <>
      <p className="hint">
        Calculado sobre {data.total_stories}{" "}
        {data.total_stories === 1 ? "historia" : "historias"}, sin IA: son
        comparaciones de texto. Todo lo que es una sospecha se marca como
        hipótesis.
      </p>

      <Section
        id="epic-risk"
        title="Riesgo por épica"
        hint="Cada nivel se explica con los conteos reales del grupo; las historias sin analizar no cuentan como buenas ni como malas."
        count={data.epic_risks.length}
      >
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Riesgo por épica</caption>
            <thead>
              <tr>
                <th scope="col">Épica</th>
                <th scope="col">Nivel</th>
                <th scope="col">Historias</th>
                <th scope="col">Analizadas</th>
                <th scope="col">No listas</th>
                <th scope="col">Sin casos aceptados</th>
                <th scope="col">Puntaje medio</th>
                <th scope="col">Por qué</th>
              </tr>
            </thead>
            <tbody>
              {data.epic_risks.map((r) => (
                <tr key={r.epic_id ?? "none"}>
                  <td>{r.epic_name}</td>
                  <td>
                    <Badge tone={LEVEL[r.level]?.tone ?? "neutral"}>
                      {LEVEL[r.level]?.label ?? r.level}
                    </Badge>
                  </td>
                  <td className="mono">{r.stories}</td>
                  <td className="mono">{r.analyzed}</td>
                  <td className="mono">{r.not_ready}</td>
                  <td className="mono">{r.without_cases}</td>
                  <td className="mono">{r.average_score ?? "—"}</td>
                  <td>{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="duplicates"
        title="Posibles duplicados"
        hint="Pares de historias con texto muy parecido (6 de cada 10 palabras relevantes en común, o el mismo título)."
        count={data.duplicates.length}
      >
        <ul>
          {data.duplicates.map((d) => (
            <li key={`${d.a_id}-${d.b_id}`}>
              {link(d.a_id)} y {link(d.b_id)}{" "}
              <span className="mono">{Math.round(d.similarity * 100)} %</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="dependencies"
        title="Dependencias"
        hint="Historias que mencionan a otra por su clave o por su título."
        count={data.dependencies.length}
      >
        <ul>
          {data.dependencies.map((d) => (
            <li key={`${d.from_id}-${d.to_id}`}>
              {link(d.from_id)} depende de {link(d.to_id)}{" "}
              <span className="hint">({d.evidence})</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="contradictions"
        title="Posibles contradicciones (hipótesis)"
        hint="Mismo tema con cifras distintas, o una historia que exige lo que otra prohíbe. Revísalas a mano: el sistema sospecha, no afirma."
        count={data.contradictions.length}
      >
        <ul>
          {data.contradictions.map((c) => (
            <li key={`${c.a_id}-${c.b_id}`}>
              {link(c.a_id)} y {link(c.b_id)}
              <br />
              <span className="hint">{c.reason}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="without-cases"
        title="Historias sin casos de prueba aceptados"
        hint="Solo cuentan los casos aceptados, igual que en la trazabilidad."
        count={data.without_cases.length}
      >
        <ul>
          {data.without_cases.map((id) => (
            <li key={id}>
              <Link to={`/p/${projectId}/stories/${id}/tests`}>
                {titles.get(id) ?? id}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/** Módulo 5: comparación de las historias del proyecto entre sí. */
export function CrossAnalysisPage() {
  const { project } = useProject();
  const projectId = project?.id;
  const data = useLoad(
    () => getCrossAnalysis(projectId ?? ""),
    `cross:${projectId}`,
  );
  if (!project || !projectId) return <Spinner label="Cargando proyecto…" />;
  return (
    <>
      <h1>Análisis transversal</h1>
      {data.loading ? (
        <Spinner label="Comparando historias…" />
      ) : data.error || !data.data ? (
        <ErrorNotice message={data.error} onRetry={data.reload} />
      ) : (
        <Report projectId={projectId} data={data.data} />
      )}
    </>
  );
}
