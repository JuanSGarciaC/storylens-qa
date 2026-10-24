"""Convierte el Markdown de un reporte en PDF.

Solo entiende el subconjunto que generan `application/reports`: títulos `#`/`##`/`###`, viñetas,
listas numeradas y negritas. Usa la fuente base Helvetica (latin-1), así que no necesita archivos
de fuentes; los caracteres fuera de latin-1 se sustituyen por equivalentes o por «?».
"""

import re

from fpdf import FPDF

_REPLACEMENTS = {
    "—": "-",
    "–": "-",
    "«": '"',
    "»": '"',
    "“": '"',
    "”": '"',
    "‘": "'",
    "’": "'",
    "…": "...",
    "•": "-",
}
_ENTITY_LT = "&lt;"
_NUMBERED = re.compile(r"^\d+\.\s")
_CHECKBOX = re.compile(r"^\[( |x)\]\s")

_HEADINGS = {"# ": (18, 9), "## ": (14, 7), "### ": (12, 6)}
BODY_SIZE = 10
LINE_HEIGHT = 5
INDENT = 5


def to_latin1(text: str) -> str:
    for source, target in _REPLACEMENTS.items():
        text = text.replace(source, target)
    return text.replace(_ENTITY_LT, "<").encode("latin-1", "replace").decode("latin-1")


class _Pdf(FPDF):
    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", size=8)
        self.cell(0, 6, to_latin1(f"Página {self.page_no()}"), align="C")


def _line(pdf: FPDF, text: str, indent: int = 0) -> None:
    """Escribe una línea con las negritas del Markdown (`**x**`) y salta al final."""
    margin = pdf.l_margin
    pdf.set_left_margin(margin + indent)
    pdf.set_x(margin + indent)
    for position, part in enumerate(to_latin1(text).split("**")):
        pdf.set_font("Helvetica", style="B" if position % 2 else "", size=BODY_SIZE)
        pdf.write(LINE_HEIGHT, part)
    pdf.set_font("Helvetica", size=BODY_SIZE)
    pdf.ln(LINE_HEIGHT)
    pdf.set_left_margin(margin)


def markdown_to_pdf(markdown: str, title: str) -> bytes:
    pdf = _Pdf(format="A4")
    pdf.set_title(to_latin1(title))
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", size=BODY_SIZE)

    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line.strip():
            pdf.ln(2)
            continue
        heading = next((p for p in _HEADINGS if line.startswith(p)), None)
        if heading:
            size, height = _HEADINGS[heading]
            pdf.ln(2)
            pdf.set_font("Helvetica", style="B", size=size)
            pdf.multi_cell(
                0, height, to_latin1(line[len(heading) :]), new_x="LMARGIN", new_y="NEXT"
            )
            pdf.set_font("Helvetica", size=BODY_SIZE)
            continue
        nested = len(line) - len(line.lstrip(" "))
        body = line.strip()
        indent = INDENT * (1 + nested // 2)
        if body.startswith("- "):
            body = body[2:]
            checkbox = _CHECKBOX.match(body)
            marker = (
                "[x] " if checkbox and checkbox.group(1) == "x" else "[ ] " if checkbox else "- "
            )
            _line(pdf, marker + (body[checkbox.end() :] if checkbox else body), indent)
        elif _NUMBERED.match(body):
            _line(pdf, body, indent)
        else:
            _line(pdf, body)
    return bytes(pdf.output())
