"""Graba el GIF del README (el dueño escribe una historia, la analiza con reglas y decide un hallazgo)
y la captura de «Prueba tu historia».

Contra una instancia desechable (sin volumen, sin IA):

    docker build -t storylens-qa-gif .
    docker run -d --rm --name storylens-qa-gif -p 8091:8000 -e DATABASE_URL=sqlite:////tmp/gif.db \
      -e OWNER_EMAIL=owner@e2e.local -e OWNER_PASSWORD=e2e-password-123 \
      -e SESSION_SECRET=e2e-secret-e2e-secret-e2e-secret-0123456789 storylens-qa-gif
    uv run --with playwright --with pillow scripts/demo_gif.py
    docker stop storylens-qa-gif
"""
import argparse
import tempfile
from pathlib import Path

from PIL import Image
from playwright.sync_api import expect, sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://localhost:8091")
ap.add_argument("--channel", default="msedge", help="navegador instalado: msedge o chrome")
ap.add_argument("--email", default="owner@e2e.local")
ap.add_argument("--password", default="e2e-password-123")
ap.add_argument("--out", default="docs/screenshots/flujo-en-vivo.gif")
args = ap.parse_args()

WIDTH = 800
frames: list[tuple[Path, int]] = []
tmp = Path(tempfile.mkdtemp())

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel=args.channel)
    page = browser.new_page(viewport={"width": 1100, "height": 780}, device_scale_factor=1, locale="es-ES")

    def frame(ms: int = 120) -> None:
        path = tmp / f"{len(frames):04d}.png"
        page.screenshot(path=path)
        frames.append((path, ms))

    def type_into(label: str, text: str) -> None:
        field = page.get_by_label(label)
        for end in [*range(8, len(text), 8), len(text)]:
            field.fill(text[:end])
            frame(70)

    def scroll_to(locator) -> None:
        # Desplazamiento por pasos para que el GIF no salte de golpe.
        target = locator.bounding_box()["y"] - 90
        for _ in range(6):
            page.mouse.wheel(0, target / 6)
            page.wait_for_timeout(60)
            frame(70)

    # Captura de «Prueba tu historia», sin sesión, antes de grabar.
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(f"{args.url}/probar")
    page.get_by_role("button", name="Analizar", exact=True).click()
    expect(page.get_by_role("heading", name="Hallazgos")).to_be_visible()
    # Criterios, botón y resultado en el mismo encuadre.
    page.get_by_text("Descripción", exact=True).evaluate("e => e.scrollIntoView({block: 'start'})")
    page.wait_for_timeout(600)
    page.screenshot(path=Path(args.out).with_name("14-prueba-tu-historia.png"))
    page.set_viewport_size({"width": 1100, "height": 780})

    # Preparación, fuera de cámara: sesión y proyecto.
    page.goto(f"{args.url}/login")
    page.get_by_label("Correo").fill(args.email)
    page.get_by_label("Contraseña").fill(args.password)
    page.get_by_role("button", name="Iniciar sesión").click()
    page.get_by_label("Nombre").fill("Banca móvil")
    page.get_by_role("button", name="Crear proyecto").click()
    expect(page.get_by_role("heading", name="Banca móvil")).to_be_visible()
    page.get_by_role("link", name="Historias", exact=True).click()
    page.get_by_role("button", name="Crear historia").click()
    page.mouse.move(0, 0)

    frame(600)
    type_into("Título", "Transferir dinero")
    type_into("Descripción", "Como cliente quiero transferir dinero de forma rápida y fácil")
    type_into("Criterios de aceptación", "La transferencia debe ser rápida\nEl sistema debe ser amigable")
    frame(900)
    page.get_by_role("button", name="Guardar historia").click()
    expect(page.get_by_text("Historia creada.")).to_be_visible()
    frame(900)

    page.get_by_role("link", name="Transferir dinero").click()
    analyze = page.get_by_role("button", name="Analizar", exact=True)
    expect(analyze).to_be_visible()
    frame(900)
    analyze.click()
    findings = page.get_by_role("heading", name="Hallazgos")
    expect(findings).to_be_visible()
    page.mouse.wheel(0, -2000)  # el foco baja al resultado; el título de la historia debe verse
    for _ in range(6):  # entrada escalonada del resultado
        frame(90)
        page.wait_for_timeout(80)
    frame(2200)

    scroll_to(findings)
    frame(2200)
    accept = page.get_by_role("button", name="Aceptar ").first
    accept.scroll_into_view_if_needed()
    accept.click()
    expect(page.get_by_text("Aceptado", exact=True).first).to_be_visible()
    page.mouse.move(0, 0)
    frame(3000)
    browser.close()

imgs = [Image.open(p).convert("RGB") for p, _ in frames]
imgs = [f.resize((WIDTH, round(f.height * WIDTH / f.width)), Image.LANCZOS) for f in imgs]
# Paleta común (inicio, mitad y final): sin ella cada fotograma trae la suya y el archivo se dispara.
strip = Image.new("RGB", (WIDTH, imgs[0].height * 3))
for i, f in enumerate((imgs[0], imgs[len(imgs) // 2], imgs[-1])):
    strip.paste(f, (0, i * f.height))
# Octree conserva los colores vivos; el corte por mediana deja gris una interfaz oscura.
palette = strip.quantize(255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
quantized = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in imgs]
out = Path(args.out)
quantized[0].save(out, save_all=True, append_images=quantized[1:], duration=[ms for _, ms in frames], loop=0, optimize=True)
size_kb = out.stat().st_size // 1024
print(len(imgs), "fotogramas,", sum(ms for _, ms in frames) / 1000, "s,", size_kb, "KB")
assert size_kb < 1024, "el GIF supera 1 MB"
