# 08 — Guía de desarrollo

## Requisitos locales
- Python 3.12+ y `uv` (gestor de dependencias recomendado) o `pip`.
- Node.js LTS y `pnpm` o `npm`.
- Docker Desktop (opcional, para `docker compose`).
- Git y cuenta de GitHub.

## Variables de entorno
Copia `.env.example` a `backend/.env` y completa los valores. El frontend solo necesita la URL del backend (`VITE_API_BASE_URL`), **nunca** la key de Gemini.

### Cuenta del dueño, demo y migraciones (Fase A)

| Variable | Qué hace |
|----------|----------|
| `OWNER_EMAIL`, `OWNER_PASSWORD`, `SESSION_SECRET` | Crean la cuenta del dueño al arrancar. Sin las tres solo se ve la demo. |
| `SESSION_TTL_HOURS`, `COOKIE_SECURE` | Duración de la sesión (12 h) y cookie solo por HTTPS. |
| `SEED_DEMO` | Crea el proyecto de demostración de solo lectura si no existe (por defecto `true`). |
| `RUN_MIGRATIONS` | Aplica Alembic al arrancar (por defecto `true`). |
| `AI_REQUESTS_PER_MINUTE`, `AI_DAILY_LIMIT` | Topes propios de IA (5 y 50). Al agotarse, la IA se apaga y se usan las reglas. **Costo cero: nunca se paga por pasarse.** |

Migraciones: `alembic` vive en `backend/` (`alembic.ini`, `migrations/`). Tras cambiar un modelo, genera su migración (`alembic revision --autogenerate -m "..."`) y revísala a mano; el test `test_migration_matches_models` falla si falta. Si tienes una base SQLite creada antes de las migraciones, bórrala: el arranque se negará a usarla.

PostgreSQL gratuito (Neon, Supabase): `pip install -e ".[postgres]"` y `DATABASE_URL=postgres://...` (se normaliza solo).

## Convenciones de código
| Ámbito | Convención |
|--------|-----------|
| Idioma | Código e identificadores en inglés; textos de UI, mensajes de reglas y documentación en español |
| Python | ruff (lint + formato), mypy en modo estricto en `domain/` y `application/`, tipado en todo |
| TypeScript | `strict: true`, ESLint + Prettier, componentes funcionales, sin `any` |
| Nombres | Archivos Python `snake_case`; componentes React `PascalCase`; carpetas de *features* en `kebab-case` |
| Reglas | ID estable `US-<GRUPO>-<NNN>`; nunca se reutiliza un ID eliminado |
| Prompts | Un archivo por versión; nunca se edita una versión publicada, se crea otra |

## Flujo de trabajo con Git
- Rama principal `main` protegida; trabajo en ramas `feat/…`, `fix/…`, `docs/…`, `test/…`.
- Commits con **Conventional Commits** (`feat: agrega regla US-AMB-001`).
- Pull request por funcionalidad, aunque trabajes solo: deja visible el proceso en el portafolio.
- Versionado semántico y `CHANGELOG.md` desde la Fase 1.

## Definition of Done (del propio proyecto)
- Código con pruebas que cubren el caso feliz y los errores.
- CI en verde.
- Documentación actualizada (catálogo, API, ADR si hubo decisión nueva).
- Sin secretos en el diff.
- Accesible con teclado si toca la UI.

## Cuándo escribir un ADR
Cuando una decisión sea difícil de revertir o haya alternativas razonables descartadas (cambiar de base de datos, de modelo de IA, pasar a procesamiento asíncrono). Plantilla en `docs/adr/000-plantilla.md`.
