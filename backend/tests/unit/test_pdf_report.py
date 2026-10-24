from app.infrastructure.reports.pdf import markdown_to_pdf, to_latin1


def test_unsupported_characters_are_replaced_instead_of_failing():
    assert to_latin1("Qué «bien» — ok 😀 &lt;b>") == 'Qué "bien" - ok ? <b>'


def test_renders_every_block_type_and_survives_hostile_text():
    markdown = "\n".join(
        [
            "# Título 😀",
            "## Sección",
            "### Caso",
            "- **Resultado:** Pasó — «ok»",
            "  - Sub-ítem con sangría",
            "- [x] Marcado",
            "- [ ] Sin marcar",
            "1. Primer criterio",
            "",
            "https://qa.example.com/" + "a" * 400,
            "x" * 900,
            "**sin cerrar",
        ]
    )
    pdf = markdown_to_pdf(markdown, "Reporte")
    assert pdf.startswith(b"%PDF") and pdf.rstrip().endswith(b"%%EOF")


def test_long_documents_span_several_pages():
    pdf = markdown_to_pdf("\n".join(f"- línea {i}" for i in range(400)), "Largo")
    assert pdf.count(b"/Type /Page\n") + pdf.count(b"/Type /Page ") >= 3
