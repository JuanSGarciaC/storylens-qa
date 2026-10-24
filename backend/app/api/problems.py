from fastapi.responses import JSONResponse


def problem(status_code: int, title: str, detail: str | None = None) -> JSONResponse:
    """Respuesta de error en formato Problem Details (RFC 9457)."""
    body = {"type": "about:blank", "title": title, "status": status_code, "detail": detail or title}
    return JSONResponse(body, status_code=status_code, media_type="application/problem+json")
