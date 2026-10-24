"""Evalúa el analizador contra el conjunto de referencia.

Uso (desde backend/, con el entorno virtual activo):
    python ../evaluation/run_eval.py            # solo reglas: sin red, sin cuota
    python ../evaluation/run_eval.py --ai       # reglas + IA: consume cuota de Gemini

Mide precisión, exhaustividad (recall) y F1 por separado para las reglas automáticas y
para las reglas de IA, y escribe un informe en evaluation/reports/.
"""

import argparse
import time
from collections import Counter
from datetime import date
from pathlib import Path

import yaml

from app.application.analyze_story import analyze_story
from app.domain.entities import AIStatus, Source, Story
from app.domain.rules.catalog import load_catalog
from app.infrastructure.llm.factory import build_llm

ROOT = Path(__file__).resolve().parent
DEFAULT_PAUSE = 10.0  # segundos entre historias: ~6 peticiones/min (límite gratuito: 15)
MAX_CONSECUTIVE_AI_FAILURES = 2  # si la IA falla así de seguido, se detiene sin insistir


def load_stories() -> list[dict]:
    data = yaml.safe_load((ROOT / "golden-set" / "stories.yaml").read_text(encoding="utf-8"))
    return data["stories"]


def to_story(raw: dict) -> Story:
    return Story(
        title=raw["title"],
        description=raw["description"],
        acceptance_criteria=tuple(raw.get("criteria", [])),
        notes=raw.get("notes", ""),
    )


def ratios(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn) if tp + fn else 1.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ai", action="store_true", help="incluye el análisis con Gemini")
    parser.add_argument(
        "--pause", type=float, default=DEFAULT_PAUSE, help="segundos entre llamadas a la IA"
    )
    args = parser.parse_args()

    catalog = load_catalog()
    det_ids = {r.id for r in catalog.of_type("deterministic")}
    ai_ids = {r.id for r in catalog.of_type("ai")}

    llm = None
    if args.ai:
        llm = build_llm()
        if llm is None:
            raise SystemExit("La IA no está configurada (revisa GEMINI_API_KEY y GEMINI_MODEL).")

    totals = {"det": Counter(), "ai": Counter()}
    ai_status = Counter()
    rows = []
    stories = load_stories()
    consecutive_failures = 0
    aborted = False
    for index, raw in enumerate(stories):
        if args.ai and index:
            time.sleep(args.pause)
        result = analyze_story(to_story(raw), llm=llm, use_ai=args.ai)
        ai_status[result.ai_status] += 1
        ai_ok = result.ai_status == AIStatus.OK

        expected = set(raw["expected"])
        found = {f.rule_id for f in result.findings}
        found_ai = {f.rule_id for f in result.findings if f.source == Source.AI}
        row = {"id": raw["id"], "expected": expected, "found": found, "found_ai": found_ai}
        rows.append(row)

        for kind, ids, got in (
            ("det", det_ids, found - found_ai),
            ("ai", ai_ids, found_ai),
        ):
            # Si la IA no respondió, esa historia no cuenta para las métricas de IA.
            if kind == "ai" and not ai_ok:
                continue
            want = expected & ids
            totals[kind]["tp"] += len(want & got)
            totals[kind]["fp"] += len(got - want)
            totals[kind]["fn"] += len(want - got)
        print(f"{raw['id']:<32} esperado={sorted(expected)} encontrado={sorted(found)}", flush=True)

        if args.ai:
            consecutive_failures = 0 if ai_ok else consecutive_failures + 1
            if consecutive_failures >= MAX_CONSECUTIVE_AI_FAILURES:
                aborted = True
                print("La IA falló varias veces seguidas: se detiene para no insistir.")
                break

    mode = "reglas+ia" if args.ai else "solo-reglas"
    lines = [
        f"# Informe de evaluación — {mode} — {date.today().isoformat()}",
        "",
        f"- Historias: {len(stories)} · Catálogo de reglas v{catalog.version}",
    ]
    if args.ai:
        statuses = {status.value: count for status, count in ai_status.items()}
        lines.append(f"- Estado de la IA por historia: {statuses}")
        lines.append(
            f"- Historias medidas para la IA: {ai_status[AIStatus.OK]} de {len(stories)}"
            + (" · **evaluación incompleta: se detuvo por fallos de la IA**" if aborted else "")
        )
    lines += [
        "",
        "| Tipo | Precisión | Recall | F1 | TP | FP | FN |",
        "|---|---|---|---|---|---|---|",
    ]
    for kind, label in (("det", "Reglas automáticas"), ("ai", "Reglas de IA")):
        if kind == "ai" and not args.ai:
            continue
        t = totals[kind]
        p, r, f = ratios(t["tp"], t["fp"], t["fn"])
        lines.append(
            f"| {label} | {p:.2f} | {r:.2f} | {f:.2f} | {t['tp']} | {t['fp']} | {t['fn']} |"
        )

    lines += ["", "## Detalle", "", "| Historia | Faltan | Sobran |", "|---|---|---|"]
    scored = det_ids | (ai_ids if args.ai else set())
    for row in rows:
        want = row["expected"] & scored
        got = row["found"] & scored
        missing, extra = sorted(want - got), sorted(got - want)
        if missing or extra:
            lines.append(
                f"| {row['id']} | {', '.join(missing) or '—'} | {', '.join(extra) or '—'} |"
            )
    if lines[-1].startswith("|---"):
        lines.append("| (sin diferencias) | — | — |")

    out = ROOT / "reports" / f"{date.today().isoformat()}-{mode}.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n" + "\n".join(lines[:9]))
    print(f"\nInforme: {out}")


if __name__ == "__main__":
    main()
