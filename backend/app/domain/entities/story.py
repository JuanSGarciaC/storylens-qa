from dataclasses import dataclass


@dataclass(frozen=True)
class Story:
    title: str
    description: str
    acceptance_criteria: tuple[str, ...] = ()
    notes: str = ""
