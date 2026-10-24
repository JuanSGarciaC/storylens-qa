from dataclasses import dataclass


@dataclass(frozen=True)
class StoredUser:
    id: str
    email: str
    password_hash: str
