import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { ApiError } from "../api/client";
import { ErrorNotice } from "../shared/ui/ErrorNotice";
import { EmptyState } from "../shared/ui/EmptyState";

export function NotFound({
  title = "Página no encontrada",
}: {
  title?: string;
}) {
  return (
    <EmptyState
      title={title}
      body="La dirección no existe o ya no está disponible. Revisa que sea correcta o vuelve al listado."
      action={<Link to="/">Volver a proyectos</Link>}
    />
  );
}

/** `errorElement` de las pantallas: un 404 de la API se presenta como «no encontrado». */
export function RouteError() {
  const error = useRouteError();
  const notFound =
    (error instanceof ApiError && error.status === 404) ||
    (isRouteErrorResponse(error) && error.status === 404);
  if (notFound) return <NotFound title="Recurso no encontrado" />;
  return (
    <ErrorNotice
      message={
        error instanceof Error
          ? error.message
          : "Algo salió mal al mostrar esta pantalla."
      }
    />
  );
}
