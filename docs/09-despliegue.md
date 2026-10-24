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

`nginx` sirve la interfaz y reenvía `/api/` al backend en **el mismo origen**. Eso importa:
la sesión del dueño es una cookie `SameSite=Lax`, que el navegador solo envía si interfaz y API
comparten origen.

## Despliegue gratuito (sin ejecutar todavía)

Los planes gratuitos cambian: **verifica estas condiciones antes de elegir** (consultadas el
2026-10-24).

| Pieza | Opción | Lo que hay que saber |
|---|---|---|
| Interfaz estática | [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits) | 500 compilaciones al mes, 20 000 archivos, sin tarjeta |
| Backend | [Render, plan gratuito](https://render.com/docs/free) | Se duerme tras 15 min sin tráfico (despertar ≈ 1 min); 750 horas al mes; **sin disco persistente** |
| Base de datos | [Neon](https://neon.com/pricing) | Plan gratuito permanente, 0,5 GB por proyecto, se duerme a los 5 min, sin tarjeta |

Consecuencias de diseño:

- **Mismo origen.** Con la interfaz en Cloudflare Pages y el backend en Render hay dos orígenes:
  la demo anónima funciona, pero el inicio de sesión del dueño **no** (la cookie no viaja).
  Solución sin costo: una regla de reescritura de `/api/*` hacia el backend en el propio
  hosting estático (en Cloudflare Pages, un Worker o una regla `_redirects` con estado 200), o
  servir interfaz y API desde un único servicio con la imagen de Docker.
- **Base de datos.** SQLite en el disco de Render se pierde al dormirse el servicio. En la nube
  usa PostgreSQL gratuito (`pip install -e ".[postgres]"` y `DATABASE_URL=postgres://...`; se
  normaliza solo).
- **Evidencias de imagen.** Se guardan en disco (`EVIDENCE_DIR`), que en el plan gratuito de
  Render no persiste: las notas y los enlaces sí (están en la base), las imágenes **no**. Mientras
  no haya almacenamiento gratuito persistente, en la nube conviene usar solo notas y enlaces.
- **Arranque en frío.** La interfaz ya muestra «El servidor está despertando…» con reintentos.
- **Gemini.** Solo clave de capa gratuita, sin facturación, en una variable de entorno del
  backend; la demo pública nunca usa IA y la UI avisa que los datos enviados a la capa gratuita
  pueden usarse para mejorar modelos.
- **Variables obligatorias en producción:** `OWNER_EMAIL`, `OWNER_PASSWORD`,
  `SESSION_SECRET` (larga y aleatoria) y `COOKIE_SECURE=true` bajo HTTPS.

## Documentación de la API

El backend publica su especificación en vivo: `/docs` (Swagger) y `/openapi.json`. Los tipos del
frontend se generan de ahí con `npm run gen:api`. Resumen de rutas: [04](04-modelo-de-datos-y-api.md).
