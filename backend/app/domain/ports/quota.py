from typing import Protocol


class QuotaPort(Protocol):
    def try_acquire(self, key: str) -> bool:
        """Reserva una llamada de IA para `key` (el modelo). False si el tope está agotado."""
        ...
