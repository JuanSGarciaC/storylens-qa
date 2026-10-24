# Fase A — Fundaciones: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al backend existente proyectos aislados (con épicas y versiones), cuenta de dueño con sesión, modo demo público de solo lectura, auditoría, configuración de reglas por proyecto, cuota de IA persistente y migraciones Alembic.

**Architecture:** Se conserva la arquitectura hexagonal actual (`domain` → `application` → `infrastructure`/`api`). Los recursos de colección (`stories`, importación) pasan a colgar de `/api/v1/projects/{project_id}/...`; los recursos por id (`/stories/{id}`, `/qa-sessions/{id}`, …) mantienen su ruta, porque sus UUID son globales, pero ahora verifican a qué proyecto pertenecen. El acceso se decide en una capa de dependencias (`api/access.py`).

**Tech Stack:** Python 3.12, FastAPI, SQLModel/SQLAlchemy, Alembic (nuevo), pytest, ruff, mypy. Sin dependencias de autenticación externas: hash con `hashlib.scrypt` y cookie firmada con `hmac` (stdlib).

**Spec:** `docs/superpowers/specs/2026-10-24-storylens-v3-design.md` (§3, §5 fase A, §7, §8, §12). Requisitos de producto: `README.md`.

## Global Constraints

- **Costo 0, sin excepciones**: nada de servicios de pago; si la cuota de IA se agota, la IA se desactiva y todo sigue con reglas determinísticas (`ai_status` ≠ `ok`, nunca un 500).
- Parte limpio: **sin migración de datos antiguos**; Alembic empieza con una migración inicial del esquema nuevo.
- Todo texto visible al usuario (errores de API, informes) en **español**; errores en formato Problem Details (`problem()` de `app/main.py`).
- Una sola cuenta de dueño, creada desde variables de entorno; **sin registro abierto**.
- Demo pública: proyecto con `is_demo = True`, lectura anónima, **ninguna escritura** (ni anónima ni del dueño) y **sin IA** para anónimos.
- Límite de IA persistido en base de datos, global, configurable por entorno; valores por defecto `ai_requests_per_minute = 5`, `ai_daily_limit = 50`.
- Evidencias: máx. 1 MB por imagen en esta versión (hoy `max_evidence_mb = 5`; se cambia a 1).
- Ningún test llama a Gemini real (existe `tests/unit/test_no_real_ai_in_tests.py`; no debe romperse).
- `ruff check .`, `ruff format --check .`, `mypy` (estricto en `app/domain` y `app/application`) y `pytest` deben pasar al final de cada tarea.
- Commits: mensaje corto en inglés estilo `feat:`/`test:`/`chore:` y la línea final `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Los secretos solo por variables de entorno; nada en el repositorio.

## Review Focus

Entradas/condiciones que el spec implica pero que ninguna prueba "obvia" cubriría; cada una tiene su test en la tarea indicada:

1. Inicio de sesión repetido con clave errónea (fuerza bruta) y email inexistente → misma respuesta genérica y bloqueo temporal (Tarea 5).
2. Cookie de sesión manipulada, vacía o expirada → se trata como anónimo, nunca 500 (Tarea 5).
3. Pedir una historia del proyecto B bajo la ruta del proyecto A, o un id inexistente → 404 sin filtrar existencia (Tarea 3 y 6).
4. Borrar un proyecto con historias, sesiones QA, evidencias y archivos → sin huérfanos en base de datos ni en disco (Tarea 2).
5. Dos peticiones de IA simultáneas en el límite de cuota, y cuota agotada a mitad de un análisis → no se excede el límite y el análisis termina con reglas (Tarea 10).
6. Arranque sin `OWNER_EMAIL`/`OWNER_PASSWORD` → la app arranca solo con demo; el dueño no puede entrar (Tarea 5).
7. Intentar modificar o borrar el proyecto demo siendo dueño → 403 (Tarea 6).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `app/domain/entities/project.py` (nuevo) | `ProjectSettings`, `StoredProject`, `Epic`, `Version` |
| `app/domain/ports/projects.py` (nuevo) | `ProjectRepository` (Protocol) |
| `app/domain/auth.py` (nuevo) | hash de clave y firma/lectura de token de sesión (puro, sin FastAPI) |
| `app/domain/audit.py` (nuevo) | `AuditEvent`, `AuditLog` (Protocol) |
| `app/domain/ports/quota.py` (nuevo) | `QuotaPort` |
| `app/application/projects.py` (nuevo) | casos de uso de proyectos, épicas, versiones |
| `app/application/demo.py` (nuevo) | `seed_demo` idempotente |
| `app/infrastructure/persistence/models.py` | + `ProjectRow`, `EpicRow`, `VersionRow`, `UserRow`, `AuditEventRow`, `AIUsageRow`; `StoryRow.project_id/epic_id/version_id` |
| `app/infrastructure/persistence/sql_project_repository.py` (nuevo) | implementación SQL de proyectos, usuarios, auditoría |
| `app/infrastructure/persistence/sql_quota.py` (nuevo) | cuota de IA persistente |
| `app/infrastructure/persistence/migrations.py` (nuevo) | `upgrade_to_head(database_url)` |
| `app/api/access.py` (nuevo) | `Principal`, resolución de proyecto por recurso, dependencias de lectura/escritura |
| `app/api/routers/projects.py`, `auth.py`, `audit.py` (nuevos) | rutas |
| `app/api/schemas/project.py`, `auth.py` (nuevos) | esquemas Pydantic |
| `backend/alembic.ini`, `backend/migrations/` (nuevos) | Alembic |

---

### Task 0: Entorno de trabajo y commit base

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Produces: entorno `backend/.venv` con dependencias de desarrollo; línea base de pruebas verde; primer commit del repo.

- [ ] **Step 1:** En `backend/`, crear el entorno: `python -m venv .venv` y `.venv/Scripts/python -m pip install -e ".[dev]"`.
- [ ] **Step 2:** Añadir a `.gitignore` las líneas `.venv/`, `.superpowers/` y `backend/storylens.db` si no existen.
- [ ] **Step 3: Línea base.** Run: `.venv/Scripts/python -m pytest` → Expected: todas PASS (anotar el número). Run: `.venv/Scripts/python -m ruff check .` y `.venv/Scripts/python -m mypy` → Expected: sin errores. Si algo de la línea base falla, **detenerse y avisar al dueño** (no es parte de este plan arreglarlo en silencio).
- [ ] **Step 4: Commit base.** El repo no tiene commits. **Pedir confirmación al dueño** antes de ejecutar `git commit` (incluye todo lo ya añadido al índice); mensaje `chore: initial commit of existing backend, frontend and docs`.

---

### Task 1: Dominio y persistencia de proyectos

**Files:**
- Create: `app/domain/entities/project.py`, `app/domain/ports/projects.py`, `app/infrastructure/persistence/sql_project_repository.py`
- Modify: `app/domain/entities/__init__.py`, `app/domain/ports/__init__.py`, `app/infrastructure/persistence/models.py`
- Test: `tests/unit/test_project_repository.py`

**Interfaces:**
- Produces (`app/domain/entities/project.py`):
  - `ProjectSettings(disabled_rules: tuple[str, ...] = (), penalties: dict[str, int] | None = None, not_ready_below: int = 60, ready_from: int = 85)` — `frozen dataclass`; `penalties` usa como claves los valores de `Severity` (`"blocking"`, …).
  - `StoredProject(id: str, name: str, description: str, objective: str, settings: ProjectSettings, is_demo: bool, owner_id: str | None, created_at: datetime)`
  - `Epic(id: str, project_id: str, name: str)`, `Version(id: str, project_id: str, name: str)`
- Produces (`ProjectRepository` Protocol): `add_project(owner_id: str | None, name: str, description: str = "", objective: str = "", is_demo: bool = False) -> StoredProject`; `get_project(project_id: str) -> StoredProject | None`; `list_projects(owner_id: str | None, include_demo: bool = True) -> list[StoredProject]`; `update_project(project_id: str, *, name: str | None = None, description: str | None = None, objective: str | None = None, settings: ProjectSettings | None = None) -> StoredProject | None`; `delete_project_row(project_id: str) -> bool` (solo la fila y sus épicas/versiones; las historias las borra el caso de uso); `add_epic(project_id, name) -> Epic`; `list_epics(project_id) -> list[Epic]`; `add_version(project_id, name) -> Version`; `list_versions(project_id) -> list[Version]`; `get_demo_project() -> StoredProject | None`.
- Produces (modelos): `ProjectRow(id, name, description, objective, settings JSON, is_demo, owner_id, created_at)`, `EpicRow(id, project_id FK index, name)`, `VersionRow(id, project_id FK index, name)`; `StoryRow` gana `project_id: str` (FK `project.id`, index, obligatorio), `epic_id: str | None`, `version_id: str | None`.

- [ ] **Step 1: Write the failing test** `tests/unit/test_project_repository.py` con un fixture `repo` sobre SQLite en memoria (`create_engine("sqlite://", poolclass=StaticPool)` + `init_db(engine)`), y estos tests:
  - `test_add_and_get_project_roundtrips_settings`: crear con `name="Pagos"`, actualizar con `ProjectSettings(disabled_rules=("R-004",), ready_from=90)`, leer y comprobar `settings.ready_from == 90` y `settings.disabled_rules == ("R-004",)`.
  - `test_list_projects_includes_demo_and_filters_by_owner`: un proyecto de `owner_id="u1"`, otro de `"u2"` y uno `is_demo=True`; `list_projects("u1")` devuelve el de u1 y el demo; `list_projects("u1", include_demo=False)` solo el de u1; `list_projects(None)` solo el demo.
  - `test_epics_and_versions_are_scoped_to_project`: dos proyectos, una épica en cada uno; `list_epics(a)` contiene solo la suya.
  - `test_get_demo_project_returns_none_when_missing`.
- [ ] **Step 2: Run** `pytest tests/unit/test_project_repository.py -v` → Expected: FAIL (`ModuleNotFoundError`).
- [ ] **Step 3: Implement** entidades, Protocol, filas SQLModel y `SqlProjectRepository(session: Session)` siguiendo el estilo de `sql_repository.py` (`_new_id`, `_now`, `_aware`). `settings` se guarda como JSON (`sa_column=Column(JSON)`), convertido a/desde `ProjectSettings`. Exportar los nuevos nombres en los `__init__`.
- [ ] **Step 4: Run** el test → Expected: PASS. Ejecutar toda la suite: las pruebas de integración existentes **fallarán** porque `StoryRow.project_id` es obligatorio; es esperado y lo resuelve la Tarea 3 (marcar en el commit con `wip`). Alternativa aceptable: hacer `project_id` obligatorio recién en la Tarea 3.
- [ ] **Step 5: Commit** `feat: project, epic and version persistence`.

---

### Task 2: Casos de uso y API de proyectos

**Files:**
- Create: `app/application/projects.py`, `app/api/routers/projects.py`, `app/api/schemas/project.py`
- Modify: `app/api/deps.py` (añadir `get_project_repository` y alias `Projects`), `app/main.py` (incluir router)
- Test: `tests/integration/test_projects_api.py`

**Interfaces:**
- Consumes: `ProjectRepository` (Tarea 1); `StoryRepository`, `SessionRepository`, `EvidenceStorage`; `stories.delete_story` (existente).
- Produces (`app/application/projects.py`): `create_project(repo: ProjectRepository, owner_id: str | None, name: str, description: str, objective: str) -> StoredProject` (nombre vacío o >120 chars → `InvalidProjectError`); `update_project(repo, project_id, ...) -> StoredProject` (404 → `NotFoundError`); `delete_project(projects: ProjectRepository, repo: StoryRepository, sessions: SessionRepository, storage: EvidenceStorage, project_id: str) -> None` (borra cada historia con `stories.delete_story`, luego la fila); `class InvalidProjectError(Exception)` → mapeada a 422 en `main.py`.
- Produces (API, todas bajo `/api/v1`): `POST /projects` (201), `GET /projects`, `GET /projects/{project_id}`, `PATCH /projects/{project_id}` (nombre, descripción, objetivo, `settings`), `DELETE /projects/{project_id}` (204), `POST/GET /projects/{project_id}/epics`, `POST/GET /projects/{project_id}/versions`. Esquema `ProjectOut(id, name, description, objective, settings, is_demo, created_at)`. En esta tarea las rutas aún no exigen sesión (se añade en la Tarea 6); `owner_id` se pasa como `None`.
- Para evitar import circular, `list_stories` por proyecto llega en la Tarea 3; aquí `delete_project` usa un método nuevo de `StoryRepository`: `list_story_ids(project_id: str) -> list[str]` (añadirlo al Protocol y a `SqlStoryRepository`).

- [ ] **Step 1: Write the failing tests** (`tests/integration/test_projects_api.py`, fixture `client` existente):
  - `test_create_and_get_project`: `POST /api/v1/projects {"name": "Pagos"}` → 201 y `GET` devuelve `name == "Pagos"`, `is_demo is False`.
  - `test_rejects_empty_and_too_long_name`: `{"name": ""}` y `{"name": "x" * 121}` → 422.
  - `test_patch_settings_persists_thresholds`: `PATCH` con `{"settings": {"ready_from": 90, "disabled_rules": ["R-004"]}}` y `GET` posterior lo refleja.
  - `test_epics_and_versions_endpoints`.
  - `test_delete_project_removes_stories_sessions_and_evidence_files`: (Review Focus 4) crear proyecto → historia (vía repositorio directo, ya que la ruta anidada llega en la Tarea 3) → sesión QA → evidencia con archivo en `storage_dir`; tras `DELETE`, `GET /projects/{id}` da 404, no quedan filas de `StoryRow`/`SessionRow`/`EvidenceRow` y `storage_dir` queda sin archivos.
- [ ] **Step 2: Run** `pytest tests/integration/test_projects_api.py -v` → Expected: FAIL (404 de rutas).
- [ ] **Step 3: Implement** casos de uso, esquemas, router y `deps.py`; registrar `InvalidProjectError` → `problem(422, "Proyecto no válido", ...)`.
- [ ] **Step 4: Run** el archivo de tests → Expected: PASS; luego `ruff`/`mypy`.
- [ ] **Step 5: Commit** `feat: projects, epics and versions API`.

---

### Task 3: Historias e importación dentro de un proyecto

**Files:**
- Modify: `app/domain/ports/repositories.py`, `app/domain/entities/records.py`, `app/infrastructure/persistence/sql_repository.py`, `app/application/stories.py`, `app/application/story_import.py`, `app/api/routers/stories.py`, `app/api/routers/story_import.py`, `app/api/schemas/analysis.py` (`StoryIn` gana `epic_id`/`version_id` opcionales; `StoryOut` gana `project_id`, `epic_id`, `version_id`), `app/api/mappers.py`
- Modify (tests existentes): `tests/integration/conftest.py`, `test_ai_analysis_api.py`, `test_qa_sessions_api.py`, `test_reports_api.py`, `test_stories_api.py`, `test_story_import_api.py`, `test_test_design_api.py` (los ~10 usos de `POST /api/v1/stories` y `/stories/import*`)
- Test: `tests/integration/test_project_scoping_api.py`

**Interfaces:**
- Produces: `StoryRepository.add_story(project_id: str, story: Story, epic_id: str | None = None, version_id: str | None = None) -> StoredStory`; `list_stories(project_id: str, epic_id: str | None = None, version_id: str | None = None) -> list[StoredStory]`; `StoredStory` gana `project_id: str`, `epic_id: str | None`, `version_id: str | None`. `story_import.preview_import/confirm_import` reciben `project_id` y detectan duplicados **solo dentro de ese proyecto**.
- Produces (rutas): `POST /projects/{project_id}/stories`, `GET /projects/{project_id}/stories?epic_id=&version_id=`, `POST /projects/{project_id}/stories/import`, `POST /projects/{project_id}/stories/import:confirm`. Las rutas `/stories/{story_id}…` no cambian. Proyecto inexistente → 404 `NotFoundError`.
- Produces (fixtures): `project` fixture en `tests/integration/conftest.py` que devuelve el `id` de un proyecto creado vía API; los tests existentes cambian `POST /api/v1/stories` por `POST /api/v1/projects/{project}/stories`. La ruta `/api/v1/stories/import` pasa a `/api/v1/projects/{project}/stories/import`. La middleware `limit_upload_size` en `app/main.py` compara con `endswith` y sigue funcionando.

- [ ] **Step 1: Write the failing tests** (`test_project_scoping_api.py`):
  - `test_stories_are_listed_per_project`: crear A y B, una historia en cada una; `GET /projects/A/stories` devuelve exactamente la de A.
  - `test_story_filters_by_epic_and_version`: dos historias, una con `epic_id`; el filtro devuelve solo esa.
  - `test_epic_from_other_project_is_rejected`: crear historia en A con `epic_id` de B → 422.
  - `test_import_duplicates_are_detected_only_within_project`: importar el mismo CSV en A y luego en B: en B ninguna fila es `duplicate`; repetido en A, sí.
  - `test_story_in_unknown_project_returns_404` (Review Focus 3).
- [ ] **Step 2: Run** `pytest tests/integration/test_project_scoping_api.py -v` → Expected: FAIL.
- [ ] **Step 3: Implement** los cambios de repositorio, casos de uso, rutas y mapeadores; actualizar los tests existentes y el fixture `project`.
- [ ] **Step 4: Run** `pytest` completo → Expected: todos PASS (mismo número que la línea base, más los nuevos). `ruff`, `mypy`.
- [ ] **Step 5: Commit** `feat: scope stories and imports to projects`.

---

### Task 4: Registro de auditoría

**Files:**
- Create: `app/domain/audit.py`, `app/api/routers/audit.py`
- Modify: `app/infrastructure/persistence/models.py` (`AuditEventRow`), `app/infrastructure/persistence/sql_project_repository.py` (`SqlAuditLog`), `app/api/deps.py`, `app/main.py`, routers de proyectos/historias/hallazgos/sesiones (llamadas a `audit.record`)
- Test: `tests/integration/test_audit_api.py`

**Interfaces:**
- Produces: `AuditEvent(id: str, at: datetime, actor: str, action: str, entity: str, entity_id: str, project_id: str | None, detail: str)`; `AuditLog` Protocol: `record(actor: str, action: str, entity: str, entity_id: str, project_id: str | None, detail: str = "") -> None`; `list_events(project_id: str, limit: int = 50, offset: int = 0) -> list[AuditEvent]` (más reciente primero). `actor` es el email del dueño o `"sistema"`. Nunca se guardan secretos en `detail`.
- Acciones registradas (cadenas fijas): `project.created`, `project.updated`, `project.deleted`, `story.created`, `story.deleted`, `story.imported`, `analysis.run`, `finding.decided`, `session.closed`, `settings.changed`.
- Produces (API): `GET /projects/{project_id}/audit?limit=&offset=` (limit máx. 200).

- [ ] **Step 1: Write the failing tests:** `test_creating_project_and_story_records_events` (tras crear proyecto e historia, `GET /audit` contiene `project.created` y `story.created` con el `entity_id` correcto, orden descendente); `test_audit_pagination` (3 eventos, `limit=2&offset=1` devuelve 2 con el orden esperado); `test_audit_detail_never_contains_api_key_or_password` (probar `record` con texto sin secretos y que los routers solo pasan ids/nombres).
- [ ] **Step 2: Run** → Expected: FAIL.
- [ ] **Step 3: Implement** modelo, repositorio, dependencia `Audit` y llamadas en los puntos listados.
- [ ] **Step 4: Run** `pytest` completo → PASS.
- [ ] **Step 5: Commit** `feat: audit log`.

---

### Task 5: Cuenta de dueño y sesión

**Files:**
- Create: `app/domain/auth.py`, `app/api/routers/auth.py`, `app/api/schemas/auth.py`
- Modify: `app/config.py`, `app/infrastructure/persistence/models.py` (`UserRow`), `app/infrastructure/persistence/sql_project_repository.py` (`SqlUserRepository`), `app/main.py` (lifespan crea/actualiza dueño), `tests/integration/conftest.py`
- Test: `tests/unit/test_auth_domain.py`, `tests/integration/test_auth_api.py`

**Interfaces:**
- Produces (`app/domain/auth.py`, puro): `hash_password(password: str) -> str` (scrypt con sal aleatoria; formato `scrypt$<n>$<r>$<p>$<salt_hex>$<hash_hex>`); `verify_password(password: str, stored: str) -> bool` (tiempo constante, `False` ante formato inválido); `sign_session(user_id: str, secret: str, now: float, ttl_seconds: int) -> str`; `read_session(token: str, secret: str, now: float) -> str | None` (devuelve `user_id` o `None` si está manipulado, vacío o expirado).
- Produces (config): `owner_email: str | None`, `owner_password: str | None` (`Field(default=None, repr=False)`), `session_secret: str | None` (`repr=False`), `session_ttl_hours: int = 12`, `cookie_secure: bool = False`.
- Produces (API): `POST /auth/login {email, password}` → 200 y cookie `storylens_session` (`HttpOnly`, `SameSite=Lax`, `Secure` según config); 401 con el mismo cuerpo para email inexistente y clave errónea; tras 5 fallos en 15 min para el mismo email → 429 (contador en memoria, se limpia al reiniciar). `POST /auth/logout` (204, borra cookie). `GET /auth/me` → `{"authenticated": bool, "email": str | None}`.
- Produces (lifespan): `ensure_owner(users: UserRepository, email: str | None, password: str | None) -> None` crea el dueño o actualiza su hash si cambió; si falta `owner_email`, `owner_password` o `session_secret`, no hay dueño y el login responde 401 siempre (Review Focus 6).
- Produces (fixtures): en `conftest.py` definir las variables `OWNER_EMAIL=owner@test.local`, `OWNER_PASSWORD=test-pass-123`, `SESSION_SECRET=test-secret` antes de importar la app y llamar `get_settings.cache_clear()`; `client` crea el dueño y **inicia sesión** (la cookie queda en el `TestClient`); nuevo fixture `anon_client` con la misma base y sin cookie.

- [ ] **Step 1: Write the failing tests:**
  - Unit: `test_hash_roundtrip` (`verify_password("a", hash_password("a"))` es `True`, con otra clave `False`); `test_verify_rejects_garbage_hash`; `test_session_roundtrip`; `test_session_expired_returns_none` (now > ttl); `test_session_tampered_returns_none` (cambiar un carácter del token); `test_session_wrong_secret_returns_none`.
  - Integración: `test_login_sets_cookie_and_me_reports_authenticated`; `test_wrong_password_and_unknown_email_give_identical_401` (mismo status y cuerpo); `test_five_failures_lock_email_temporarily` (6.º intento → 429, incluso con la clave correcta); `test_tampered_cookie_is_anonymous` (cookie basura → `GET /auth/me` da `authenticated: false` y no 500); `test_logout_clears_session`; `test_no_owner_configured_means_login_fails` (Review Focus 6).
- [ ] **Step 2: Run** → Expected: FAIL.
- [ ] **Step 3: Implement.** Comparar firmas con `hmac.compare_digest`. El token es `base64url(user_id|exp)` + `.` + HMAC-SHA256.
- [ ] **Step 4: Run** `pytest` completo → PASS (los tests existentes siguen verdes porque `client` ya inicia sesión; aún no se exige).
- [ ] **Step 5: Commit** `feat: owner account with signed-cookie session`.

---

### Task 6: Control de acceso y modo demo de solo lectura

**Files:**
- Create: `app/api/access.py`
- Modify: todos los routers (`projects`, `stories`, `story_import`, `analysis`, `findings`, `test_design`, `qa_sessions`, `audit`), `app/api/deps.py` (`get_llm` depende del principal), `app/main.py`
- Test: `tests/integration/test_access_control_api.py`

**Interfaces:**
- Produces (`app/api/access.py`): `Principal(user_id: str | None)` con `is_owner` property; `get_principal(request, users) -> Principal` (lee la cookie con `read_session`; cualquier error → anónimo); `ProjectResolver` con `project_of_story(story_id)`, `project_of_analysis`, `project_of_finding`, `project_of_case`, `project_of_session`, `project_of_checklist_item`, `project_of_execution`, `project_of_evidence`, `project_of_defect` → `str | None`; dependencias `ReadProject` y `WriteProject` para rutas `/projects/{project_id}/...` y funciones `require_read(project_id)` / `require_write(project_id)` para rutas por id.
- Reglas: **lectura** permitida si el proyecto es demo o el principal es dueño; si no, **404** (no 401, para no revelar existencia). **Escritura** exige dueño (si no, 401) y que el proyecto no sea demo (si lo es, **403** "El proyecto de demostración es de solo lectura"). Rutas sin proyecto (`/auth/*`, `/health`, `/rules`) quedan públicas; `POST /analyze` (análisis suelto sin guardar) queda público pero **sin IA** para anónimos. `get_llm()` devuelve `None` si el principal no es dueño. `GET /projects` devuelve al anónimo solo el demo.
- Produces (`app/main.py`): `NotAuthenticatedError` → 401 y `ForbiddenError` → 403 en `problem()`.

- [ ] **Step 1: Write the failing tests** (`test_access_control_api.py`, parametrizados por router donde aplique):
  - `test_anonymous_can_read_demo_but_not_private_project`: con proyecto privado y proyecto demo (creado con `is_demo=True` directo en el repositorio), `anon_client.get(/projects/{demo}/stories)` → 200; con el privado → 404.
  - `test_anonymous_cannot_write_anywhere`: POST/PATCH/DELETE representativos de cada router (proyectos, historias, import, findings, test-cases, qa-sessions, checklist, executions, evidencias, defect-drafts) → 401.
  - `test_owner_cannot_write_demo_project`: dueño `PATCH`/`DELETE` del demo, crear historia en él, cerrar sesión de una historia demo → 403.
  - `test_item_routes_hide_other_projects_from_anonymous`: `anon_client.get(/stories/{id_de_historia_privada})` → 404; con id de historia demo → 200.
  - `test_anonymous_never_triggers_ai`: `POST /analyze` anónimo con `use_ai=true` y un `get_llm` sustituido por un fake que falla si se llama → 200 y `ai_status` ≠ `"ok"`.
- [ ] **Step 2: Run** → Expected: FAIL.
- [ ] **Step 3: Implement** y aplicar las dependencias router por router. Mantener las firmas de las funciones de caso de uso.
- [ ] **Step 4: Run** `pytest` completo → PASS.
- [ ] **Step 5: Commit** `feat: access control and read-only demo project`.

---

### Task 7: Siembra del proyecto demo

**Files:**
- Create: `app/application/demo.py`, `app/application/demo_data.py` (historias ficticias)
- Modify: `app/config.py` (`seed_demo: bool = True`), `app/main.py` (lifespan)
- Test: `tests/integration/test_demo_seed.py`

**Interfaces:**
- Consumes: `ProjectRepository`, `StoryRepository`, `analyze_story`.
- Produces: `seed_demo(projects: ProjectRepository, repo: StoryRepository) -> StoredProject` — idempotente: si `get_demo_project()` existe, no duplica; si no, crea el proyecto "Demo — Plataforma de pagos" (`is_demo=True`, `owner_id=None`), 2 épicas, 2 versiones, 8 historias ficticias de calidad variada (al menos una bloqueada, una con requerimientos vagos, una preparada) y un análisis determinístico (`use_ai=False`) por historia. Todo el texto es ficticio y en español. Los datos de sesiones QA, defectos, evaluación y métricas de la demo se amplían en las fases siguientes.

- [ ] **Step 1: Write the failing tests:** `test_seed_creates_demo_with_analyzed_stories` (8 historias, cada una con `latest_analysis` no nulo, al menos una con veredicto `not_ready` y una `ready`); `test_seed_is_idempotent` (dos llamadas → un solo proyecto demo y 8 historias); `test_startup_seeds_demo_when_enabled` (con `seed_demo=True` el cliente anónimo ve el demo en `GET /projects`).
- [ ] **Step 2: Run** → Expected: FAIL.
- [ ] **Step 3: Implement** y llamar a `seed_demo` en el lifespan tras `init_db`/migraciones.
- [ ] **Step 4: Run** `pytest` completo → PASS.
- [ ] **Step 5: Commit** `feat: seed read-only demo project`.

---

### Task 8: Configuración de reglas y umbrales por proyecto

**Files:**
- Modify: `app/domain/scoring/score.py`, `app/domain/rules/engine/runner.py`, `app/application/analyze_story.py`, `app/application/stories.py` (`run_analysis` recibe `settings`), `app/api/routers/stories.py`, `app/api/routers/analysis.py` (`GET /rules`)
- Test: `tests/unit/test_scoring.py` (ampliar), `tests/unit/test_rules_catalog.py` (ampliar), `tests/integration/test_project_settings_api.py`

**Interfaces:**
- Produces: `calculate_score(findings: Iterable[Finding], settings: ProjectSettings | None = None) -> Score` (usa `settings.penalties` para los pesos por severidad, `not_ready_below`, `ready_from`; sin settings = valores actuales); `evaluate_story(story: Story, catalog: Catalog | None = None, disabled_rules: Iterable[str] = ()) -> list[Finding]` (omite esas reglas); `analyze_story(story, llm, use_ai, settings: ProjectSettings | None = None)`. Validación al guardar settings: `0 <= not_ready_below < ready_from <= 100`, penalizaciones enteras ≥ 0, `disabled_rules` ⊆ ids del catálogo, si no → `InvalidProjectError` (422). Los bloqueantes siguen forzando `NOT_READY` aunque se relajen los umbrales (README §4).
- Se registra `settings.changed` en la auditoría.

- [ ] **Step 1: Write the failing tests:** unit `test_custom_thresholds_change_verdict` (mismo conjunto de hallazgos: con `ready_from=70` un puntaje 75 es `READY`, con el default `READY_WITH_NOTES`); `test_blocking_finding_still_not_ready_with_relaxed_thresholds`; `test_disabled_rule_produces_no_finding` (usar un id de regla determinista del catálogo con una historia que lo dispara); integración `test_analysis_uses_project_settings` (PATCH settings con una regla desactivada → el análisis nuevo no la incluye y `GET /analyses/{id}` lo refleja); `test_invalid_settings_rejected` (`ready_from=50, not_ready_below=60`, regla inexistente → 422).
- [ ] **Step 2: Run** → Expected: FAIL.
- [ ] **Step 3: Implement.** El `catalog_version` y la configuración usada se conservan en el análisis para interpretar resultados históricos (guardar `settings` aplicados en `AnalysisRow` como JSON `settings_snapshot`).
- [ ] **Step 4: Run** `pytest` completo → PASS.
- [ ] **Step 5: Commit** `feat: per-project rule and threshold settings`.

---

### Task 9: Cuota de IA persistente y degradación a reglas

**Files:**
- Create: `app/domain/ports/quota.py`, `app/infrastructure/persistence/sql_quota.py`
- Modify: `app/infrastructure/persistence/models.py` (`AIUsageRow(id, at)`), `app/infrastructure/llm/gemini.py` (inyectar `quota`), `app/infrastructure/llm/factory.py`, `app/config.py` (defaults `ai_requests_per_minute = 5`, `ai_daily_limit = 50`, `max_evidence_mb = 1`), `app/api/deps.py`, `.env.example`
- Test: `tests/unit/test_sql_quota.py`, `tests/unit/test_gemini_adapter.py` (ajustar), `tests/integration/test_ai_quota_api.py`

**Interfaces:**
- Produces: `QuotaPort` Protocol con `try_acquire() -> bool`; `SqlQuota(engine: Engine, per_minute: int, per_day: int, clock: Callable[[], datetime] = utcnow)` — dentro de una transacción cuenta filas de `AIUsageRow` en los últimos 60 s y 24 h, inserta una fila y devuelve `True` si ambos límites lo permiten; borra filas de más de 24 h. `InMemoryQuota(per_minute, per_day, clock)` (envuelve los `SlidingWindowLimiter` actuales) para tests y desarrollo sin DB. `GeminiAdapter.__init__` pasa a recibir `quota: QuotaPort` en lugar de `requests_per_minute`/`daily_limit`. `build_llm()` usa `SqlQuota(get_engine(), ...)`.
- Comportamiento: sin cuota → el adaptador lanza `LLMUnavailableError` (ya existente); los casos de uso ya lo traducen a `ai_status` ≠ `ok`/`AIUnavailableError`. `GET /health` añade `ai_quota_remaining_today: int | None`.

- [ ] **Step 1: Write the failing tests:** `test_quota_blocks_after_per_minute_limit` (reloj controlado: 5 `True`, 6.º `False`, tras 61 s vuelve `True`); `test_quota_blocks_after_daily_limit`; `test_quota_survives_new_instance` (segunda instancia sobre la misma DB sigue contando — simula reinicio); `test_quota_concurrent_acquires_do_not_exceed_limit` (Review Focus 5: 20 hilos con `per_minute=5` → exactamente 5 `True`); integración `test_exhausted_quota_degrades_to_rules` (cuota agotada, `POST /stories/{id}/analyses` con `use_ai=true` → 201 con hallazgos de reglas y `ai_status != "ok"`, no 500); actualizar `test_gemini_adapter.py` al nuevo constructor.
- [ ] **Step 2: Run** → Expected: FAIL.
- [ ] **Step 3: Implement.** Para la concurrencia en SQLite usar `BEGIN IMMEDIATE`; en PostgreSQL, `SELECT … FOR UPDATE` sobre una fila-contador o un lock asesor; documentar la elección en el ADR de la Tarea 10.
- [ ] **Step 4: Run** `pytest` completo + `test_no_real_ai_in_tests.py` → PASS.
- [ ] **Step 5: Commit** `feat: persistent AI quota with graceful degradation`.

---

### Task 10: Migraciones Alembic, CI y documentación

**Files:**
- Create: `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/versions/0001_initial.py`, `app/infrastructure/persistence/migrations.py`, `docs/adr/004-sesion-por-cookie-firmada.md`, `docs/adr/005-cuota-de-ia-persistente.md`
- Modify: `backend/pyproject.toml` (dependencia `alembic>=1.13`; incluir `migrations*` si hace falta), `app/main.py` (lifespan), `app/config.py` (`run_migrations: bool = True`), `.github/workflows/ci.yml`, `docs/04-modelo-de-datos-y-api.md`, `README.md` (sección de variables de entorno)
- Test: `tests/unit/test_migrations.py`

**Interfaces:**
- Produces: `upgrade_to_head(database_url: str) -> None` (invoca Alembic programáticamente). El lifespan llama `upgrade_to_head(settings.database_url)` si `run_migrations`, si no `init_db()`. Los tests siguen usando `init_db` con SQLite en memoria.

- [ ] **Step 1: Write the failing tests:** `test_upgrade_creates_all_tables` (SQLite en archivo temporal, `upgrade_to_head`, el conjunto de tablas es igual a `SQLModel.metadata.tables.keys()` más `alembic_version`); `test_migration_matches_models` (tras migrar, `alembic.autogenerate.compare_metadata` no produce diferencias); `test_upgrade_is_idempotent` (dos llamadas sin error).
- [ ] **Step 2: Run** → Expected: FAIL.
- [ ] **Step 3: Implement.** Generar `0001_initial.py` con autogenerate **al final** de las tareas anteriores (para incluir todas las tablas) y revisarlo a mano. Compatibilidad SQLite/PostgreSQL (`render_as_batch=True` en `env.py`). Las URLs `postgres://`/`postgresql://` de proveedores gratuitos se normalizan a `postgresql+psycopg://` — **añadir `psycopg[binary]` como extra opcional `postgres`**, no como dependencia obligatoria.
- [ ] **Step 4: Run** `pytest` completo, `ruff check .`, `ruff format --check .`, `mypy` → todo verde. Actualizar CI para ejecutar los mismos comandos (ya existen) y comprobar que el job de backend pasa en limpio.
- [ ] **Step 5: Docs.** Escribir los dos ADR (contexto, decisión, consecuencias, en español) y actualizar `docs/04` con las entidades nuevas (`Project`, `Epic`, `Version`, `User`, `AuditEvent`, `AIUsage`) y las rutas. En `README.md` documentar `OWNER_EMAIL`, `OWNER_PASSWORD`, `SESSION_SECRET`, `COOKIE_SECURE`, `AI_REQUESTS_PER_MINUTE`, `AI_DAILY_LIMIT`, `SEED_DEMO`, `RUN_MIGRATIONS` y actualizar `.env.example`.
- [ ] **Step 6: Commit** `feat: alembic migrations, docs and CI for phase A`.

---

## Nota para las fases siguientes

El frontend actual (`frontend/`) llama a rutas planas como `POST /stories`; la Tarea 3 las cambia. No se toca en esta fase: se reemplaza por completo en la Fase B. Mientras tanto sus pruebas (que simulan `fetch`) no deberían verse afectadas, pero la app vieja dejará de funcionar contra el backend nuevo; es esperado.
