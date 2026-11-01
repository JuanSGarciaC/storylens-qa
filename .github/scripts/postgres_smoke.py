"""Arranca la app contra PostgreSQL: migraciones, siembra de la demo y lectura pública.

Se ejecuta dos veces en CI: la segunda comprueba que migrar y sembrar sean idempotentes.
"""

from fastapi.testclient import TestClient

from app.main import app

with TestClient(app) as client:
    assert client.get("/api/v1/health").status_code == 200
    projects = client.get("/api/v1/projects").json()
    assert [p["is_demo"] for p in projects] == [True], projects
    stories = client.get(f"/api/v1/projects/{projects[0]['id']}/stories").json()
    assert stories and all(s["latest_analysis"] for s in stories)
    metrics = client.get(f"/api/v1/projects/{projects[0]['id']}/metrics")
    assert metrics.status_code == 200, metrics.text
print("PostgreSQL OK:", len(stories), "historias de la demo")
