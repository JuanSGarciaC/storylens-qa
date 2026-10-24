from fastapi import Request

from app.api.deps import Projects, Resolver
from app.api.principal import CurrentPrincipal
from app.application.errors import ForbiddenError, NotAuthenticatedError, NotFoundError

# Rutas (sin el prefijo /api/v1) que cualquiera puede usar: no guardan nada ni usan IA.
PUBLIC_PATHS = frozenset(
    {
        "/health",
        "/rules",
        "/analyze",
        "/auth/login",
        "/auth/logout",
        "/auth/me",
    }
)
LIST_PROJECTS_PATH = "/projects"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
DEMO_READ_ONLY = "El proyecto de demostración es de solo lectura"


def enforce_access(
    request: Request, principal: CurrentPrincipal, projects: Projects, resolver: Resolver
) -> None:
    """Regla única de acceso para todas las rutas.

    Escribir exige ser el dueño y que el proyecto no sea la demo. Leer exige que el proyecto sea
    la demo o del dueño; si no, 404 para no revelar que existe.
    """
    # FastAPI registra las rutas incluidas sin el prefijo; /health sí lo lleva.
    template = getattr(request.scope.get("route"), "path", request.url.path)
    template = template.removeprefix("/api/v1")
    if template in PUBLIC_PATHS:
        return
    is_write = request.method not in SAFE_METHODS
    if is_write and not principal.is_owner:
        raise NotAuthenticatedError("Inicia sesión para hacer cambios")

    project_id = resolver.project_of(request.path_params)
    project = projects.get_project(project_id) if project_id else None
    if project is None:
        # Recurso inexistente: la ruta responde 404 al dueño; el anónimo nunca llega a saberlo.
        if principal.is_owner or template == LIST_PROJECTS_PATH:
            return
        raise NotFoundError("Recurso no encontrado")
    if project.is_demo:
        if is_write:
            raise ForbiddenError(DEMO_READ_ONLY)
        return
    if principal.is_owner and project.owner_id == principal.user_id:
        return
    raise NotFoundError("Recurso no encontrado")
