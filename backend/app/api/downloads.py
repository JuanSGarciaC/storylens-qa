from typing import Literal

from fastapi import Response

from app.infrastructure.reports.pdf import markdown_to_pdf

ReportFormat = Literal["md", "pdf"]


def report_download(text: str, filename: str, title: str, fmt: ReportFormat) -> Response:
    """Reporte como descarga, en Markdown o PDF. El nombre ya viene limpio (ASCII, sin rutas)."""
    if fmt == "pdf":
        content: str | bytes = markdown_to_pdf(text, title)
        media_type = "application/pdf"
    else:
        content = text
        media_type = "text/markdown; charset=utf-8"
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}.{fmt}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
