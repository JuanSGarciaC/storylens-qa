# 07 — Hoja de ruta

Cada fase termina con algo demostrable. No avances a la siguiente sin cumplir su criterio de terminado.

## Fase 0 — Cimientos
- Repositorio en GitHub, `.gitignore`, `.env.example`, licencia (MIT).
- Proyecto backend (FastAPI, `GET /health`) y frontend (Vite + React + TS) vacíos.
- pre-commit (ruff, mypy, ESLint, Prettier, gitleaks).
- CI en GitHub Actions: lint + pruebas + build.
- `docker-compose.yml` para levantar todo con un comando.

**Terminado cuando:** `docker compose up` muestra el frontend consultando `/health`, y la CI está en verde.

## Fase 1 — Motor de reglas (MVP sin IA)
- Entidades del dominio, catálogo YAML con las reglas determinísticas del doc 02.
- Motor de reglas + puntaje + veredicto con pruebas unitarias por regla.
- Persistencia (SQLModel + Alembic) y endpoints de historias y análisis (`use_ai=false`).
- UI: nueva historia, vista de análisis, aceptar/descartar hallazgos.

**Terminado cuando:** se pega una historia y se obtiene puntaje, veredicto y hallazgos trazables; cobertura del dominio ≥ 85 %.

## Fase 2 — Integración con Gemini
- `LLMPort`, `GeminiAdapter`, `FakeLLMAdapter`.
- Prompt `analysis-v1` con salida estructurada; verificación de `evidence_text`; caché; reintentos; degradación.
- Reglas de tipo `ia` activas.
- Primer *golden set* (≥ 15 historias) y script de evaluación.

**Terminado cuando:** el análisis combina reglas e IA, sobrevive a fallos de Gemini sin errores 500 y hay un primer reporte de evaluación.

## Fase 3 — Diseño de pruebas
- Sugerencia de criterios en Gherkin.
- Generación de casos por técnica ISTQB; edición; matriz de trazabilidad.

**Terminado cuando:** a partir de una historia se obtienen casos aceptados y trazados a sus criterios.

## Fase 4 — Sesión en ambiente QA
- Crear sesión, checklist por fases, registro de ejecuciones, subida de evidencias.
- Borrador de defecto (plantilla 29119-3, redacción asistida por IA).
- Cierre con recomendación.

**Terminado cuando:** se completa una sesión de punta a punta con al menos un defecto documentado.

## Fase 5 — Reportes e importación
- Exportación Markdown y PDF de análisis y sesiones.
- Importación CSV/JSON de Jira con vista previa del mapeo.

## Fase 6 — Pulido para portafolio
- E2E con Playwright + axe en CI.
- Despliegue (Cloud Run + Vercel) con modo demo y *rate limit*.
- README con capturas/GIF, diagrama de arquitectura, métricas de evaluación de la IA y sección "Decisiones técnicas" que enlace a los ADR.
- Video corto (2–3 min) mostrando el flujo completo.

**Terminado cuando:** hay una URL pública funcionando y un README que cuente la historia del proyecto en 2 minutos de lectura.

## Ideas para después (v2)
- Integración directa con la API de Jira/Azure DevOps.
- Análisis en segundo plano con cola de tareas.
- Comparación entre modelos (Flash vs. Pro) en la UI.
- Exportación de casos de prueba a formato de herramientas de gestión (CSV de Xray/Zephyr).
- Generación de esqueletos de pruebas automatizadas (Playwright) a partir de los Gherkin aceptados.
