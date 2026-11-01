<div align="center">

# StoryLens QA

**Revisa requisitos, diseña pruebas y mide la calidad de tu software. Con reglas QA y, solo si quieres, con IA.**

[![CI](https://github.com/JuanSGarciaC/storylens-qa/actions/workflows/ci.yml/badge.svg)](https://github.com/JuanSGarciaC/storylens-qa/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Costo](https://img.shields.io/badge/costo-0-2ea44f)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

### [▶ Abrir la demo en vivo](https://storylens-qa.onrender.com)

<sub>Proyecto de ejemplo de solo lectura, sin registro. Hosting gratuito: si nadie la visitó en los últimos 15 minutos, la primera carga tarda cerca de un minuto en despertar.</sub>

<img src="docs/screenshots/00-analisis-por-reglas.png" alt="Análisis de una historia en la demo: puntaje 40 de 100, «No lista» por un hallazgo bloqueante citado a su norma" width="900">

</div>

StoryLens QA toma historias de usuario (escritas a mano o importadas de Jira), detecta lo que está mal redactado **antes** de que se convierta en un defecto, genera casos de prueba trazables, organiza sesiones de ejecución con evidencias y defectos, y resume todo en métricas con su denominador a la vista.

**Idea central:** un motor de reglas determinístico hace el trabajo siempre; la IA solo complementa. Si la IA falla o se agota la cuota gratuita, la app sigue funcionando con las reglas, sin errores. Todo corre **sin costo**.

## Qué incluye

| | Módulo | Qué hace |
|---|---|---|
| 1 | **Proyectos** | Aislamiento de datos, épicas, versiones, reglas y umbrales por proyecto, auditoría |
| 2 | **Historias e importación** | Alta manual o carga de CSV/JSON de Jira (hasta 500 filas) en segundo plano, con progreso y reintentos seguros |
| 3–4 | **Calidad de requisitos + IA** | Reglas citadas a normas (ISO/IEC/IEEE 29148, INVEST, ISTQB), puntaje, hallazgos que se aceptan o descartan, y hallazgos de IA con su confianza |
| 5 | **Análisis transversal** | Duplicados, dependencias, posibles contradicciones (siempre marcadas como hipótesis) y riesgo por épica |
| 6 | **Casos de prueba** | Generación con técnicas ISTQB, Gherkin sugerido y trazabilidad criterio → caso |
| 7 | **Sesiones de QA** | Checklist, resultados, evidencias (notas, enlaces, imágenes) y borradores de defecto |
| 8 | **Informes** | PDF y Markdown por análisis y por sesión |
| 9 | **Métricas** | Cada cifra con su definición y su denominador; «Sin datos» en vez de un cero inventado |
| 10 | **Evaluación de la IA** | Precisión, exhaustividad y F1 contra un conjunto de referencia, solo reglas frente a reglas e IA, y pruebas de inyección de instrucciones |

## Pruébalo en 1 minuto

| Qué ver | Enlace directo |
|---|---|
| Historias con su puntaje y estado | [/demo/stories](https://storylens-qa.onrender.com/demo/stories) |
| Resumen del proyecto | [/demo](https://storylens-qa.onrender.com/demo) |
| Métricas con su denominador | [/demo/metricas](https://storylens-qa.onrender.com/demo/metricas) |
| Riesgo por épica, duplicados y contradicciones | [/demo/transversal](https://storylens-qa.onrender.com/demo/transversal) |
| Evaluación contra el conjunto de referencia | [/demo/evaluacion](https://storylens-qa.onrender.com/demo/evaluacion) |
| Informes en PDF y Markdown | [/demo/reports](https://storylens-qa.onrender.com/demo/reports) |

La demo pública funciona solo con reglas: la IA queda reservada a la cuenta del dueño para no gastar la cuota gratuita.

## Capturas

Las capturas con IA se tomaron con Gemini real (capa gratuita) sobre una historia de ejemplo de banca móvil, antes del rediseño visual; las de la demo son del sitio actual.

### Análisis de una historia con IA

Las reglas y la IA conviven en el mismo resultado. Cada hallazgo cita su norma; los de IA llevan su confianza y siempre son sugerencias: tú decides.

<img src="docs/screenshots/05-analisis-con-ia.png" alt="Análisis con reglas e IA" width="900">

### Casos de prueba y Gherkin

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/06-casos-de-prueba-ia.png" alt="Casos de prueba generados por IA"><br><sub><b>Casos generados por IA</b>, aceptables o rechazables uno a uno.</sub></td>
    <td width="50%"><img src="docs/screenshots/07-gherkin-ia.png" alt="Escenario Gherkin sugerido por IA"><br><sub><b>Gherkin sugerido</b> para automatizar el caso.</sub></td>
  </tr>
</table>

### Sesión de QA con defecto redactado por IA

Resultados, evidencias y un borrador de defecto con la plantilla de ISO/IEC/IEEE 29119-3, para revisar antes de guardar.

<img src="docs/screenshots/08-sesion-qa-defecto-ia.png" alt="Borrador de defecto redactado por IA" width="900">

### Visión del proyecto

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/03-resumen-proyecto.png" alt="Resumen del proyecto"><br><sub><b>Resumen</b> con el estado real de las historias.</sub></td>
    <td width="50%"><img src="docs/screenshots/09-analisis-transversal.png" alt="Análisis transversal"><br><sub><b>Análisis transversal:</b> duplicados, dependencias y riesgo por épica.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/10-metricas.png" alt="Métricas con denominadores"><br><sub><b>Métricas</b> con definición y denominador visibles.</sub></td>
    <td width="50%"><img src="docs/screenshots/11-matriz-de-trazabilidad.png" alt="Matriz de trazabilidad"><br><sub><b>Matriz de trazabilidad</b> criterio → caso → ejecución → defecto.</sub></td>
  </tr>
</table>

### Importación masiva y evaluación de la IA

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/13-importacion-masiva.png" alt="Importación masiva con progreso"><br><sub><b>Importación en segundo plano</b> con resultado por fila y reintento.</sub></td>
    <td width="50%"><img src="docs/screenshots/12-evaluacion-de-la-ia.png" alt="Evaluación de la IA"><br><sub><b>Evaluación de la IA</b> contra un conjunto de referencia.</sub></td>
  </tr>
</table>

### Modo demo público (solo lectura)

Cualquiera con el enlace ve un proyecto ficticio, sin IA y sin poder modificar nada.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/01-modo-demo-proyectos.png" alt="Lista de proyectos en modo demo"></td>
    <td width="50%"><img src="docs/screenshots/02-modo-demo-historias.png" alt="Historias de la demo en solo lectura"></td>
  </tr>
</table>

## Cómo ejecutarlo

**Con Docker** (todo junto, mismo origen):

```bash
cp .env.example .env     # completa OWNER_EMAIL, OWNER_PASSWORD y SESSION_SECRET
docker compose up --build
# http://localhost:8080
```

**En desarrollo**, en dos terminales:

```bash
# Terminal 1: API en http://localhost:8000
cd backend && pip install -e ".[dev]" && uvicorn app.main:app --reload

# Terminal 2: interfaz en http://localhost:5173
cd frontend && npm install && npm run dev
```

Sin sesión se ve la demo de solo lectura. Para crear tus propios proyectos hace falta la cuenta del dueño: define `OWNER_EMAIL`, `OWNER_PASSWORD` y `SESSION_SECRET` en `backend/.env` (hay una plantilla en [`.env.example`](.env.example)). Para activar la IA añade `GEMINI_API_KEY` y `GEMINI_MODEL` (capa gratuita de Google AI Studio); sin ellas todo funciona solo con reglas.

Más detalle: [guía de desarrollo](docs/08-guia-de-desarrollo.md) · [despliegue](docs/09-despliegue.md).

## Pruebas y calidad

| Capa | Comando |
|---|---|
| Backend (pytest, ruff, mypy) | `cd backend && pytest` |
| Frontend (Vitest + Testing Library + axe) | `cd frontend && npm test` |
| Extremo a extremo (Playwright + axe, WCAG 2.1 AA) | `cd frontend && npm run test:e2e` |
| Evaluación de la IA | pantalla «Evaluación de la IA» o `python evaluation/run_eval.py [--ai]` |

Ninguna prueba llama a Gemini. La integración continua ejecuta todo lo anterior en cada cambio y busca secretos en el historial.

## Evaluación de la IA

Dos conjuntos etiquetados a mano: el de referencia (16 historias, escrito junto con las reglas) y uno **«no visto»** (13 historias de otros dominios, escrito después y etiquetado antes de correrlo).

| Detector | Conjunto | Precisión | Exhaustividad | F1 |
|---|---|---|---|---|
| Reglas automáticas | Referencia | 1,00 | 1,00 | 1,00 |
| Reglas automáticas | **No visto** | **0,67** | **0,75** | **0,71** |
| Reglas de IA (`gemini-3.5-flash-lite`, `analysis-v1`) | Referencia | 0,78 | 1,00 | 0,88 |
| Reglas de IA (`gemini-3.5-flash-lite`, `analysis-v1`) | **No visto** | **0,60** | **0,33** | **0,43** |

Cómo leerlo: el 1,00 en el conjunto de referencia mide que las reglas hacen lo que dicen; el 0,71 en historias no vistas mide cuánto generalizan. Las fallas son concretas: sinónimos vagos fuera del diccionario («ágil», «en breve»), límites sin la palabra «máximo» («tope alcanzado») y un formato de historia válido que el patrón no reconoce ([informe](evaluation/reports/2026-10-31-solo-reglas-holdout.md), [conjunto](backend/app/infrastructure/evaluation/holdout_set.yaml)). Para la IA ([referencia](evaluation/reports/2026-10-31-reglas+ia.md), [no visto](evaluation/reports/2026-10-31-reglas+ia-holdout.md)): en el conjunto de referencia encuentra todo lo esperado, pero en historias nuevas se le escapa mucho (F1 entre 0,37 y 0,46 en tres corridas), sobre todo accesibilidad y seguridad cuando la historia no las menciona. Medirla destapó un bug: el validador descartaba como alucinación los hallazgos que citaban el número del criterio («1. Dado…»); corregido y con prueba, la exhaustividad en el conjunto de referencia pasó de 0,71 a 1,00. Por eso sus hallazgos complementan a las reglas y no las reemplazan. La IA nunca bloquea nada: sus hallazgos son sugerencias que la persona acepta o descarta. Una prueba aparte comprobó que no obedece instrucciones inyectadas en el texto de una historia ([detalle](evaluation/reports/2026-10-23-fase3-4-gemini-real.md)).

## Decisiones técnicas

| Decisión | Por qué |
|---|---|
| [Motor híbrido: reglas primero, IA después](docs/adr/001-motor-hibrido-reglas-ia.md) | Resultados reproducibles y trazables a una norma; la IA solo suma, y si falla la app sigue |
| [Solo el backend habla con Gemini](docs/adr/002-backend-como-proxy-de-gemini.md) | La clave nunca llega al navegador; la CI lo comprueba sobre el bundle |
| [SQLite en local, PostgreSQL en la nube](docs/adr/003-sqlite-para-persistencia.md) | Repositorios detrás de puertos: cambiar de base no toca el dominio |
| [Una cuenta de dueño con cookie firmada](docs/adr/004-sesion-por-cookie-firmada.md) | Sin registro ni contraseñas de terceros que custodiar; la demo pública es de solo lectura |
| [Cuota de IA persistente](docs/adr/005-cuota-de-ia-persistente.md) | Topes propios más estrictos que la capa gratuita: imposible pasarse y pagar |
| [Importación en segundo plano](docs/adr/006-importacion-en-segundo-plano.md) | 500 filas sin bloquear la petición, con progreso y reintento seguro |
| [Un solo servicio en Render + Neon](docs/09-despliegue.md) | Mismo origen para la cookie de sesión, evidencias en la base porque el disco gratuito se borra |

## Seguridad y costo cero

- La clave de Gemini vive **solo en el backend**, en una variable de entorno; nunca llega al navegador (la CI lo comprueba sobre el bundle).
- Solo el dueño autenticado puede escribir o usar IA. La demo pública es de solo lectura y sin IA.
- Topes propios y persistentes de IA (5 por minuto, 50 por día): al agotarse, la IA se apaga y la app sigue con las reglas.
- Sesión por cookie firmada, bloqueo temporal ante intentos repetidos de inicio de sesión, límites de tamaño en archivos y evidencias.
- Nada pide tarjeta ni activa facturación en ningún proveedor.

## Arquitectura

Python 3.12 + FastAPI + SQLModel/Alembic por detrás; React 19 + TypeScript + Vite por delante. Arquitectura hexagonal (`domain` → `application` → `infrastructure`/`api`), con el motor de reglas y las métricas como lógica pura y testeable. Más en [`docs/03-arquitectura.md`](docs/03-arquitectura.md) y en las [decisiones de arquitectura](docs/adr/).

## Documentación

| | |
|---|---|
| [Especificación del producto](docs/00-especificacion-del-producto.md) | Visión, módulos, modelo de calidad y criterios de terminado |
| [Visión y alcance](docs/01-vision-y-alcance.md) · [Marco normativo QA](docs/02-marco-normativo-qa.md) | Por qué y con qué normas |
| [Arquitectura](docs/03-arquitectura.md) · [Modelo de datos y API](docs/04-modelo-de-datos-y-api.md) | Cómo está hecho |
| [Integración con Gemini](docs/05-integracion-gemini.md) · [Estrategia de pruebas](docs/06-estrategia-de-pruebas.md) | IA y calidad |
| [Hoja de ruta](docs/07-hoja-de-ruta.md) · [Guía de desarrollo](docs/08-guia-de-desarrollo.md) · [Despliegue](docs/09-despliegue.md) | Cómo seguir |
| [Decisiones de arquitectura (ADR)](docs/adr/) | El porqué de cada decisión importante |

La API se documenta sola: con el backend en marcha, `/docs` (Swagger) y `/openapi.json`.

## Estado

Las siete fases del plan están construidas: fundaciones, frontend, importación masiva, análisis transversal, métricas, evaluación de la IA, y pruebas de extremo a extremo con Docker. Lo que falta y se sabe:

- Desplegado gratis en Render + Neon: [storylens-qa.onrender.com](https://storylens-qa.onrender.com). La IA no está activa en producción.
- Las reglas generalizan con F1 0,71 en historias no vistas; las mejoras candidatas están en el [informe](evaluation/reports/2026-10-31-solo-reglas-holdout.md). En ese conjunto la IA da F1 ≈ 0,4: el siguiente paso es un prompt `analysis-v2` que revise siempre camino de error, accesibilidad y seguridad.
- El listado de historias se filtra y pagina en el navegador, pensado para hasta unos 500 por proyecto.

## Licencia

[MIT](LICENSE): puedes usar, copiar, modificar y distribuir el código, incluso con fines comerciales, conservando el aviso de copyright. Se ofrece tal cual, sin garantía.
