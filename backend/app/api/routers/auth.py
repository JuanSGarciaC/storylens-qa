import time

from fastapi import APIRouter, Request, Response, status

from app.api.principal import SESSION_COOKIE, CurrentPrincipal, Users
from app.api.problems import problem
from app.api.schemas.auth import LoginIn, MeOut
from app.application.auth import LoginThrottle, authenticate, is_configured_owner
from app.config import get_settings
from app.domain.auth import sign_session

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=MeOut)
def login(payload: LoginIn, request: Request, response: Response, users: Users) -> MeOut | Response:
    settings = get_settings()
    throttle: LoginThrottle = request.app.state.login_throttle
    if throttle.is_locked(payload.email):
        return problem(429, "Demasiados intentos", "Espera unos minutos antes de volver a intentar")
    user = authenticate(users, payload.email, payload.password)
    if (
        user is None
        or not settings.session_secret
        or not is_configured_owner(user.email, settings.owner_email)
    ):
        throttle.record_failure(payload.email)
        return problem(401, "Credenciales no válidas", "Correo o contraseña incorrectos")
    throttle.reset(payload.email)
    ttl = settings.session_ttl_hours * 3600
    response.set_cookie(
        SESSION_COOKIE,
        sign_session(user.id, settings.session_secret, time.time(), ttl),
        max_age=ttl,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
    return MeOut(authenticated=True, email=user.email)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/auth/me", response_model=MeOut)
def me(principal: CurrentPrincipal) -> MeOut:
    return MeOut(authenticated=principal.is_owner, email=principal.email)
