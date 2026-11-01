# 09 — Calidad y despliegue

Regla del proyecto: **costo cero**. Nada de esto pide tarjeta ni activa facturación; si un
proveedor la exige, se descarta.

## Pruebas

| Capa | Comando | Qué cubre |
|---|---|---|
| Backend | `cd backend && pytest` (+ `ruff check .`, `ruff format --check .`, `mypy`) | Dominio, aplicación y API con SQLite en memoria y una IA falsa |
| Frontend | `cd frontend && npm test` | Cada pantalla con Testing Library y `axe` |
| Extremo a extremo | `cd frontend && npm run test:e2e` | Navegador real contra el backend real y una base desechable; incluye `axe` (WCAG 2.1 AA) |
| Evaluación de la IA | pantalla «Evaluación de la IA» o `python evaluation/run_eval.py [--ai]` | Precisión, exhaustividad y F1 contra el conjunto de referencia |

Ninguna prueba llama a Gemini: la IA falsa responde en los tests y las pruebas E2E arrancan el
backend con la clave vacía.

**E2E en local:** necesitan Chromium. Si ya lo tienes, `CHROMIUM_PATH=<ruta al ejecutable>` y
`E2E_PYTHON=<python del backend>`; si no, `npx playwright install chromium`.

## Docker local

```bash
cp .env.example .env        # completa OWNER_EMAIL, OWNER_PASSWORD, SESSION_SECRET (y la clave de Gemini si quieres IA)
docker compose up --build   # http://localhost:8080
```

Un solo contenedor: FastAPI sirve la API y la interfaz compilada desde **el mismo origen**. Eso
importa: la sesión del dueño es una cookie `SameSite=Lax`, que el navegador solo envía si
interfaz y API comparten origen.

## Despliegue gratuito (en producción)

Demo pública: **https://storylens-qa.onrender.com**. Condiciones verificadas el 2026-10-31; los
planes gratuitos cambian, revísalas antes de replicarlo.

| Pieza | Servicio | Lo que hay que saber |
|---|---|---|
| App (API + interfaz) | [Render, plan gratuito](https://render.com/docs/free), imagen Docker | Se duerme tras 15 min sin tráfico (despertar ≈ 1 min); 750 horas al mes; disco efímero; sin tarjeta, al pasarse del límite suspende en vez de cobrar |
| Base de datos | [Neon](https://neon.com/pricing), PostgreSQL | Plan gratuito permanente, 1 GB por proyecto, sin tarjeta |

**Cómo se desplegó** (repetible):

1. Neon: `npx neonctl auth`, luego `neonctl projects create --name storylens-qa` y
   `neonctl connection-string --pooled`. La URL se guarda fuera del repositorio.
2. Render: *New → Blueprint* sobre este repositorio. [`render.yaml`](../render.yaml) define el
   servicio; Render genera `SESSION_SECRET` y `OWNER_PASSWORD`, y pide `DATABASE_URL` y
   `OWNER_EMAIL`. Cada cambio en `main` se despliega solo.
3. Al arrancar, la app aplica las migraciones y siembra el proyecto demo si no existe.

Decisiones que lo hacen funcionar gratis:

- **Mismo origen.** Un único servicio evita el problema de la cookie entre dominios (con la
  interfaz en otro hosting, la demo funciona pero el inicio de sesión del dueño no).
- **Todo en la base.** Las imágenes de evidencia se guardan en PostgreSQL (máx. 1 MB cada una),
  porque el disco de Render se borra al reiniciar.
- **Arranque en frío.** La interfaz muestra «El servidor está despertando…» con reintentos.
- **Enlaces estables a la demo.** `/demo/<pantalla>` (p. ej. `/demo/metricas`) lleva al proyecto
  demo vigente aunque se vuelva a sembrar con otro id.
- **Gemini.** No está activo en producción. Para activarlo: clave de capa gratuita, sin
  facturación, en `GEMINI_API_KEY` y `GEMINI_MODEL` del servicio. La demo pública nunca usa IA.
- **Variables en producción:** `DATABASE_URL`, `OWNER_EMAIL`, `OWNER_PASSWORD`,
  `SESSION_SECRET` y `COOKIE_SECURE=true` (ya en `render.yaml`).

## Documentación de la API

El backend publica su especificación en vivo: `/docs` (Swagger) y `/openapi.json`. Los tipos del
frontend se generan de ahí con `npm run gen:api`. Resumen de rutas: [04](04-modelo-de-datos-y-api.md).
