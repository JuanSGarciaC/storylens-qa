from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.problems import problem
from app.api.routers import (
    analysis,
    audit,
    auth,
    findings,
    projects,
    qa_sessions,
    stories,
    story_import,
    test_design,
)
from app.application.auth import LoginThrottle, ensure_owner
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
from app.infrastructure.persistence.database import get_engine, init_db
from app.infrastructure.persistence.sql_users import SqlUserRepository


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    settings = get_settings()
    with Session(get_engine()) as session:
        ensure_owner(SqlUserRepository(session), settings.owner_email, settings.owner_password)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="StoryLens QA API", version="0.4.0", lifespan=lifespan)
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
    def health() -> dict[str, object]:
        return {"status": "ok", "ai_configured": settings.ai_configured}

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(projects.router, prefix="/api/v1")
    app.include_router(audit.router, prefix="/api/v1")
    app.include_router(analysis.router, prefix="/api/v1")
    app.include_router(story_import.router, prefix="/api/v1")
    app.include_router(stories.router, prefix="/api/v1")
    app.include_router(findings.router, prefix="/api/v1")
    app.include_router(test_design.router, prefix="/api/v1")
    app.include_router(qa_sessions.router, prefix="/api/v1")
    return app


app = create_app()
