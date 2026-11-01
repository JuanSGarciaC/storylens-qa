from pathlib import Path

import yaml

from app.domain.entities import Story
from app.domain.evaluation import GoldenStory

GOLDEN_PATH = Path(__file__).parent / "golden_set.yaml"
# Historias «no vistas», escritas después de las reglas: miden si generalizan.
HOLDOUT_PATH = Path(__file__).parent / "holdout_set.yaml"


def load_golden(path: Path = GOLDEN_PATH) -> list[GoldenStory]:
    """Un conjunto etiquetado: historias con las reglas que un analista QA esperaría."""
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return [
        GoldenStory(
            id=raw["id"],
            note=raw.get("note", ""),
            story=Story(
                title=raw["title"],
                description=raw["description"],
                acceptance_criteria=tuple(raw.get("criteria", [])),
                notes=raw.get("notes", ""),
            ),
            expected=frozenset(raw["expected"]),
        )
        for raw in data["stories"]
    ]
