from app.domain.auth import hash_password, read_session, sign_session, verify_password

SECRET = "secreto-de-prueba"


def test_hash_roundtrip() -> None:
    stored = hash_password("clave-123")

    assert verify_password("clave-123", stored) is True
    assert verify_password("otra", stored) is False


def test_hash_is_salted_and_never_contains_the_password() -> None:
    first, second = hash_password("clave-123"), hash_password("clave-123")

    assert first != second
    assert "clave-123" not in first


def test_verify_rejects_garbage_hash() -> None:
    for garbage in ("", "x", "scrypt$1$2", "md5$a$b$c$d$e", "scrypt$no$num$ber$zz$zz"):
        assert verify_password("clave", garbage) is False


def test_session_roundtrip() -> None:
    token = sign_session("user-1", SECRET, now=1000.0, ttl_seconds=60)

    assert read_session(token, SECRET, now=1030.0) == "user-1"


def test_session_expired_returns_none() -> None:
    token = sign_session("user-1", SECRET, now=1000.0, ttl_seconds=60)

    assert read_session(token, SECRET, now=1061.0) is None


def test_session_tampered_returns_none() -> None:
    token = sign_session("user-1", SECRET, now=1000.0, ttl_seconds=60)
    flipped = token[:-1] + ("0" if token[-1] != "0" else "1")
    other_user = sign_session("user-2", SECRET, now=1000.0, ttl_seconds=60)
    forged = other_user.split(".")[0] + "." + token.split(".")[1]

    assert read_session(flipped, SECRET, now=1001.0) is None
    assert read_session(forged, SECRET, now=1001.0) is None


def test_session_wrong_secret_returns_none() -> None:
    token = sign_session("user-1", SECRET, now=1000.0, ttl_seconds=60)

    assert read_session(token, "otro-secreto", now=1001.0) is None


def test_session_garbage_returns_none() -> None:
    for garbage in ("", "abc", ".", "a.b", "%%%.%%%", "x" * 5000):
        assert read_session(garbage, SECRET, now=1.0) is None


def test_session_requires_a_secret() -> None:
    token = sign_session("user-1", SECRET, now=1000.0, ttl_seconds=60)

    assert read_session(token, "", now=1001.0) is None
