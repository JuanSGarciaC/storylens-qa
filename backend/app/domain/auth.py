import base64
import hashlib
import hmac
import secrets

_SCRYPT_N, _SCRYPT_R, _SCRYPT_P, _KEY_LEN = 2**14, 8, 1, 32


def hash_password(password: str) -> str:
    """Hash con scrypt y sal aleatoria: `scrypt$n$r$p$sal_hex$hash_hex`."""
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_KEY_LEN
    )
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${salt.hex()}${key.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Comparación en tiempo constante. Un formato inválido nunca valida."""
    try:
        scheme, n, r, p, salt_hex, key_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = bytes.fromhex(key_hex)
        candidate = hashlib.scrypt(
            password.encode(),
            salt=bytes.fromhex(salt_hex),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(candidate, expected)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _mac(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def sign_session(user_id: str, secret: str, now: float, ttl_seconds: int) -> str:
    """Token `payload.firma`; el payload lleva el usuario y el instante de expiración."""
    payload = _b64(f"{user_id}|{int(now) + ttl_seconds}".encode())
    return f"{payload}.{_mac(payload, secret)}"


def read_session(token: str, secret: str, now: float) -> str | None:
    """Devuelve el id de usuario, o None si el token está vacío, manipulado o expirado."""
    if not secret or not token or len(token) > 1024:
        return None
    payload, _, signature = token.partition(".")
    if not payload or not hmac.compare_digest(_mac(payload, secret), signature):
        return None
    try:
        user_id, _, expires = _unb64(payload).decode().rpartition("|")
        if not user_id or now > int(expires):
            return None
    except (ValueError, UnicodeDecodeError):
        return None
    return user_id
