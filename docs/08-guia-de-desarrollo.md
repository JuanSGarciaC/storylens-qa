# 08 — Guía de desarrollo

## Requisitos locales
- Python 3.12+ y `uv` (gestor de dependencias recomendado) o `pip`.
- Node.js LTS y `pnpm` o `npm`.
- Docker Desktop (opcional, para `docker compose`).
- Git y cuenta de GitHub.

## Variables de entorno
Copia `.env.example` a `backend/.env` y completa los valores. El frontend usa por defecto `/api/v1` (ver [Variable de entorno del frontend](#frontend-fase-b)) y **nunca** debe recibir la key de Gemini.

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

## Frontend (Fase B)

React 19 + Vite + TypeScript + React Router. Sin librerías de UI ni de estado: componentes propios en `frontend/src/shared/ui` y estilos por capas en `frontend/src/styles` (`tokens`, `base`, `components`, `shell`, `pages`). El sistema de diseño está en `design-system/storylens-qa/MASTER.md` (las páginas con reglas propias, en `design-system/storylens-qa/pages/`).

### Cómo verlo (demo)
```bash
# Terminal 1: backend (SQLite local, con el proyecto de demostración)
cd backend && uvicorn app.main:app --reload     # http://localhost:8000
# Terminal 2: frontend
cd frontend && npm install && npm run dev       # http://localhost:5173
```
Sin sesión se ve el proyecto de demostración en solo lectura. Para el flujo completo del dueño define `OWNER_EMAIL`, `OWNER_PASSWORD` y `SESSION_SECRET` en `backend/.env` y entra por `/login`. Vite reenvía `/api` a `http://localhost:8000`.

### Rutas
| Ruta | Pantalla |
|------|----------|
| `/login` | Acceso del dueño |
| `/` | Lista de proyectos |
| `/p/:projectId` | Resumen del proyecto |
| `/p/:projectId/stories` | Historias: alta, importación CSV/JSON, filtros |
| `/p/:projectId/stories/:storyId/analysis` | Análisis (reglas o IA) y revisión de hallazgos |
| `/p/:projectId/stories/:storyId/tests` | Diseño de pruebas y trazabilidad |
| `/p/:projectId/stories/:storyId/sessions[/:sessionId]` | Sesiones QA, ejecuciones, evidencias, defectos |
| `/p/:projectId/reports` | Informes (Markdown/PDF) y auditoría |
| `/p/:projectId/settings` | Configuración del proyecto |

`Ctrl+K` abre la paleta de comandos.

### Scripts (`frontend/`)
| Script | Qué hace |
|--------|----------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprobación de tipos y build de producción |
| `npm run lint` / `npm run format:check` | ESLint / Prettier |
| `npm test` | Vitest (jsdom, con pruebas de accesibilidad axe) |
| `npm run gen:api` | Regenera `src/api/schema.d.ts` desde el backend en marcha |

### Variable de entorno del frontend
`VITE_API_BASE_URL` (ver `frontend/.env.example`): base de la API, por defecto `/api/v1`. **El login del dueño exige mismo origen**: el cliente envía credenciales `same-origin`, el backend no activa `allow_credentials` y la cookie de sesión es `SameSite=Lax`. Con una URL absoluta de otro dominio (p. ej. `https://mi-api.example.com/api/v1` más `CORS_ORIGINS`) la demo anónima funciona, pero el login no. Para un hosting estático separado, lo recomendado es mantener `/api/v1` y reenviar `/api/v1/*` al backend con un rewrite o proxy del propio host. La alternativa, ligada al despliegue y que requiere un cambio futuro en el backend, es `credentials: "include"` en el cliente, `allow_credentials` en CORS y la cookie con `SameSite=None; Secure`. Es pública en el bundle: nunca pongas secretos aquí. Todo enlace o `fetch` pasa por `apiUrl()` en `src/api/client.ts`.
