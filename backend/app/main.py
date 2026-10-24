from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import Engine
from sqlmodel import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.access import enforce_access
from app.api.problems import problem
from app.api.routers import (
    analysis,
    audit,
    auth,
    cross_analysis,
    findings,
    import_jobs,
    projects,
    qa_sessions,
    stories,
    story_import,
    test_design,
)
from app.application.auth import LoginThrottle, ensure_owner
from app.application.demo import seed_demo
from app.application.errors import ForbiddenError, NotAuthenticatedError
from app.application.projects import InvalidProjectError
from app.application.qa_sessions import ConflictError, InvalidSessionDataError
from app.application.stories import InvalidDecisionError, NotFoundError
from app.application.test_design import (
    AIInvalidResponseError,
    AIUnavailableError,
    InvalidCaseError,
)
from app.config import get_settings
from app.domain.story_import import ImportFormatError
from app.infrastructure.persistence.database import get_engine, get_session, init_db
from app.infrastructure.persistence.migrations import upgrade_to_head
from app.infrastructure.persistence.sql_import_job_repository import SqlImportJobRepository
from app.infrastructure.persistence.sql_project_repository import SqlProjectRepository
from app.infrastructure.persistence.sql_quota import SqlQuota
from app.infrastructure.persistence.sql_repository import SqlStoryRepository
from app.infrastructure.persistence.sql_users import SqlUserRepository


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if settings.run_migrations:
        upgrade_to_head(settings.database_url)
    else:
        init_db()
    with Session(get_engine()) as session:
        SqlImportJobRepository(session).mark_interrupted()
        ensure_owner(SqlUserRepository(session), settings.owner_email, settings.owner_password)
        if settings.seed_demo:
            seed_demo(SqlProjectRepository(session), SqlStoryRepository(session))
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="StoryLens QA API",
        version="0.4.0",
        lifespan=lifespan,
        dependencies=[Depends(enforce_access)],
    )
    app.state.login_throttle = LoginThrottle()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return problem(exc.status_code, str(exc.detail))

    @app.exception_handler(NotFoundError)
    async def not_found(_: Request, exc: NotFoundError) -> JSONResponse:
        return problem(404, "No encontrado", str(exc))

    @app.exception_handler(InvalidDecisionError)
    async def invalid_decision(_: Request, exc: InvalidDecisionError) -> JSONResponse:
        return problem(422, "Decisión no válida", str(exc))

    @app.exception_handler(NotAuthenticatedError)
    async def not_authenticated(_: Request, exc: NotAuthenticatedError) -> JSONResponse:
        return problem(401, "Sesión requerida", str(exc))

    @app.exception_handler(ForbiddenError)
    async def forbidden(_: Request, exc: ForbiddenError) -> JSONResponse:
        return problem(403, "Acción no permitida", str(exc))

    @app.exception_handler(InvalidProjectError)
    async def invalid_project(_: Request, exc: InvalidProjectError) -> JSONResponse:
        return problem(422, "Proyecto no válido", str(exc))

    @app.exception_handler(InvalidCaseError)
    async def invalid_case(_: Request, exc: InvalidCaseError) -> JSONResponse:
        return problem(422, "Caso de prueba no válido", str(exc))

    @app.exception_handler(ImportFormatError)
    async def invalid_import(_: Request, exc: ImportFormatError) -> JSONResponse:
        return problem(422, "Importación no válida", str(exc))

    @app.exception_handler(ConflictError)
    async def conflict(_: Request, exc: ConflictError) -> JSONResponse:
        return problem(409, "Acción no permitida en este estado", str(exc))

    @app.exception_handler(InvalidSessionDataError)
    async def invalid_session_data(_: Request, exc: InvalidSessionDataError) -> JSONResponse:
        return problem(422, "Datos de la sesión no válidos", str(exc))

    @app.exception_handler(AIUnavailableError)
    async def ai_unavailable(_: Request, exc: AIUnavailableError) -> JSONResponse:
        return problem(503, "IA no disponible", str(exc))

    @app.exception_handler(AIInvalidResponseError)
    async def ai_invalid(_: Request, exc: AIInvalidResponseError) -> JSONResponse:
        return problem(502, "Respuesta de IA no válida", str(exc))

    @app.middleware("http")
    async def limit_upload_size(request: Request, call_next):  # type: ignore[no-untyped-def]
        """Rechaza subidas de imagen enormes antes de procesarlas (según Content-Length)."""
        if request.url.path.endswith(("/stories/import", "/stories/import:confirm")):
            declared = request.headers.get("content-length", "")
            if declared.isdigit() and int(declared) > 1_200_000:
                return problem(413, "Archivo demasiado grande", "El archivo supera 1 MB")
        if request.url.path.endswith("/evidences/image"):
            limit = (settings.max_evidence_mb + 1) * 1_000_000  # margen para el multipart
            declared = request.headers.get("content-length", "")
            if declared.isdigit() and int(declared) > limit:
                return problem(413, "Archivo demasiado grande", "La imagen supera el tamaño máximo")
        return await call_next(request)

    @app.get("/api/v1/health")
    def health(session: Annotated[Session, Depends(get_session)]) -> dict[str, object]:
        current = get_settings()  # al momento de la petición, no al importar el módulo
        remaining: int | None = None
        if current.ai_configured and current.gemini_model:
            engine = session.get_bind()
            assert isinstance(engine, Engine)
            quota = SqlQuota(engine, current.ai_requests_per_minute, current.ai_daily_limit)
            remaining = quota.remaining_today(current.gemini_model)
        return {
            "status": "ok",
            "ai_configured": current.ai_configured,
            "ai_quota_remaining_today": remaining,
        }

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(projects.router, prefix="/api/v1")
    app.include_router(audit.router, prefix="/api/v1")
    app.include_router(analysis.router, prefix="/api/v1")
    app.include_router(story_import.router, prefix="/api/v1")
    app.include_router(import_jobs.router, prefix="/api/v1")
    app.include_router(cross_analysis.router, prefix="/api/v1")
    app.include_router(stories.router, prefix="/api/v1")
    app.include_router(findings.router, prefix="/api/v1")
    app.include_router(test_design.router, prefix="/api/v1")
    app.include_router(qa_sessions.router, prefix="/api/v1")
    return app


app = create_app()
