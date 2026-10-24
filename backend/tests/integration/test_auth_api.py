from fastapi.testclient import TestClient
from sqlmodel import Session

from app.application.auth import ensure_owner
from app.config import get_settings
from app.infrastructure.persistence.sql_users import SqlUserRepository

EMAIL = "owner@test.local"
PASSWORD = "test-pass-123"


def login(client: TestClient, email: str = EMAIL, password: str = PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_login_sets_cookie_and_me_reports_authenticated(anon_client: TestClient) -> None:
    assert anon_client.get("/api/v1/auth/me").json() == {"authenticated": False, "email": None}

    response = login(anon_client)

    assert response.status_code == 200
    cookie = response.headers["set-cookie"].lower()
    assert "storylens_session=" in cookie and "httponly" in cookie and "samesite=lax" in cookie
    assert anon_client.get("/api/v1/auth/me").json() == {"authenticated": True, "email": EMAIL}


def test_wrong_password_and_unknown_email_give_identical_401(anon_client: TestClient) -> None:
    wrong_password = login(anon_client, password="mala")
    unknown_email = login(anon_client, email="nadie@test.local")

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    assert "set-cookie" not in wrong_password.headers


def test_five_failures_lock_email_temporarily(anon_client: TestClient) -> None:
    for _ in range(5):
        assert login(anon_client, password="mala").status_code == 401

    assert login(anon_client).status_code == 429  # incluso con la clave correcta
    assert login(anon_client, email="otro@test.local", password="x").status_code == 401


def test_tampered_cookie_is_anonymous(anon_client: TestClient) -> None:
    login(anon_client)
    anon_client.cookies.set("storylens_session", "esto-no-es-un-token")

    response = anon_client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["authenticated"] is False


def test_logout_clears_session(anon_client: TestClient) -> None:
    login(anon_client)

    assert anon_client.post("/api/v1/auth/logout").status_code == 204

    assert anon_client.get("/api/v1/auth/me").json()["authenticated"] is False


def test_no_session_secret_means_login_fails(anon_client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "session_secret", None)

    response = login(anon_client)

    assert response.status_code == 401
    assert "set-cookie" not in response.headers


def test_ensure_owner_without_credentials_creates_nobody(engine) -> None:
    """Review Focus 6: sin OWNER_EMAIL/OWNER_PASSWORD la app arranca solo con la demo."""
    with Session(engine) as db:
        users = SqlUserRepository(db)
        ensure_owner(users, None, None)
        ensure_owner(users, "x@test.local", None)
        ensure_owner(users, None, "algo")

        assert users.get_by_email("x@test.local") is None


def test_ensure_owner_updates_password_when_it_changes(engine) -> None:
    with Session(engine) as db:
        users = SqlUserRepository(db)
        first = ensure_owner(users, "a@test.local", "uno")
        second = ensure_owner(users, "a@test.local", "dos")

        assert first is not None and second is not None and first.id == second.id
        from app.domain.auth import verify_password

        stored = users.get_by_email("a@test.local")
        assert stored is not None
        assert verify_password("dos", stored.password_hash)
        assert not verify_password("uno", stored.password_hash)


def test_cookie_with_non_ascii_bytes_is_anonymous_not_a_500(anon_client: TestClient) -> None:
    response = anon_client.get(
        "/api/v1/auth/me", headers=[(b"cookie", b"storylens_session=abc.\xe9\xe9")]
    )

    assert response.status_code == 200
    assert response.json()["authenticated"] is False


def test_unknown_email_does_not_pay_an_extra_password_hash(engine, monkeypatch) -> None:
    """El tiempo de respuesta no debe delatar si el correo existe: solo se verifica."""
    import app.application.auth as auth_module

    def forbidden(_password: str) -> str:
        raise AssertionError("authenticate no debe hashear contraseñas")

    monkeypatch.setattr(auth_module, "hash_password", forbidden)
    with Session(engine) as db:
        users = SqlUserRepository(db)

        assert auth_module.authenticate(users, "nadie@test.local", "x") is None
        assert auth_module.authenticate(users, EMAIL, "mala") is None


def test_changing_owner_email_replaces_the_owner_and_keeps_projects(engine) -> None:
    from app.domain.auth import verify_password

    with Session(engine) as db:
        users = SqlUserRepository(db)
        old = ensure_owner(users, "viejo@test.local", "clave-vieja")
        assert old is not None

        new = ensure_owner(users, "nuevo@test.local", "clave-nueva")

        assert new is not None and new.id == old.id  # mismo id: sus proyectos le siguen
        assert users.get_by_email("viejo@test.local") is None
        stored = users.get_by_email("nuevo@test.local")
        assert stored is not None and verify_password("clave-nueva", stored.password_hash)
        assert not verify_password("clave-vieja", stored.password_hash)


def test_owner_removed_from_environment_cannot_log_in_or_keep_a_session(
    client: TestClient, anon_client: TestClient, monkeypatch
) -> None:
    assert login(anon_client).status_code == 200
    assert anon_client.get("/api/v1/auth/me").json()["authenticated"] is True

    monkeypatch.setattr(get_settings(), "owner_email", None)

    assert anon_client.get("/api/v1/auth/me").json()["authenticated"] is False
    assert login(TestClient(anon_client.app)).status_code == 401
