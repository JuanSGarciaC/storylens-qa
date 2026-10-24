import { Link } from "react-router-dom";
import { listImportJobs } from "../../api/client";
import { useLoad } from "../../shared/useLoad";
import { STATUS_LABEL } from "../imports/jobStatus";

/** Últimas importaciones del proyecto: permiten volver a ver el avance tras cerrar la pestaña. */
export function RecentImports({ projectId }: { projectId: string }) {
  const jobs = useLoad(() => listImportJobs(projectId), `jobs:${projectId}`);
  if (jobs.loading || jobs.error || !jobs.data || jobs.data.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="recent-imports">
      <h2 id="recent-imports">Importaciones recientes</h2>
      <ul className="recent-imports">
        {jobs.data.slice(0, 5).map((job) => (
          <li key={job.id}>
            <Link to={`/p/${projectId}/imports/${job.id}`}>{job.filename}</Link>{" "}
            <span className="hint">
              {STATUS_LABEL[job.status] ?? job.status} · {job.processed} de{" "}
              {job.total} filas ·{" "}
              {new Date(job.created_at).toLocaleString("es-ES")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
