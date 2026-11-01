import { Navigate, useParams } from "react-router-dom";
import * as api from "../api/client";
import { useLoad } from "../shared/useLoad";
import { ErrorNotice } from "../shared/ui/ErrorNotice";
import { Spinner } from "../shared/ui/Spinner";
import { NotFound } from "./NotFound";

/** `/demo/<pantalla>` lleva al proyecto demo actual: enlaces estables aunque la demo se vuelva a sembrar. */
export function DemoRedirect() {
  const rest = useParams()["*"] ?? "";
  const list = useLoad(() => api.listProjects(), "projects");
  if (list.error)
    return <ErrorNotice message={list.error} onRetry={list.reload} />;
  if (!list.data) return <Spinner label="Cargando la demo…" />;
  const demo = list.data.find((project) => project.is_demo);
  if (!demo) return <NotFound />;
  return <Navigate replace to={`/p/${demo.id}${rest ? `/${rest}` : ""}`} />;
}
