# 06 — Estrategia de pruebas

> Al ser una herramienta de QA para un portafolio de QA, **sus propias pruebas son parte de lo que se exhibe**. Este documento sigue la estructura de una estrategia de pruebas de ISO/IEC/IEEE 29119-3.

## 1. Alcance y objetivos

- Verificar que cada regla del catálogo detecta lo que debe y no genera falsos positivos.
- Verificar los contratos de la API y la degradación sin IA.
- Medir la calidad de las respuestas de la IA de forma repetible.
- Verificar la accesibilidad y los flujos principales de punta a punta.

## 2. Niveles y herramientas (pirámide)

| Nivel | Qué cubre | Herramienta | Corre en CI |
|-------|-----------|------------|-------------|
| Unitarias — dominio | Cada regla (con sus `ejemplo_ok` / `ejemplo_falla` del catálogo), puntaje, veredicto, deduplicación | pytest (+ `pytest-parametrize`, Hypothesis para propiedades del puntaje) | Sí |
| Unitarias — frontend | Componentes y hooks | Vitest + Testing Library | Sí |
| Integración — API | Endpoints + SQLite en memoria + `FakeLLMAdapter` | pytest + `httpx`/TestClient | Sí |
| Contrato | Las respuestas cumplen el OpenAPI | Schemathesis | Sí |
| Adaptador Gemini | Construcción de la petición y parseo de respuestas grabadas (incluidas las inválidas) | pytest + fixtures | Sí |
| E2E | Flujos: crear → analizar → descartar hallazgo → generar casos → sesión QA → reporte | Playwright (backend con FakeLLM) | Sí |
| Accesibilidad | Pantallas principales sin violaciones serias o críticas | `@axe-core/playwright` | Sí |
| Evaluación IA | Calidad real de Gemini contra el *golden set* | Script en `evaluation/` | Manual / workflow bajo demanda (consume cuota) |

## 3. Casos clave que no pueden faltar

- Historia sin criterios → `US-AC-001` bloqueante → veredicto "No lista".
- Historia perfecta → puntaje ≥ 85 y sin falsos positivos.
- Gemini devuelve JSON inválido → reintento → análisis `partial` sin errores 500.
- Gemini devuelve 429 → *backoff* → aviso en la UI.
- La IA cita un `evidence_text` que no existe en la historia → hallazgo descartado.
- Descartar un hallazgo → el puntaje se recalcula y el motivo aparece en el reporte.
- Historia con *prompt injection* ("ignora tus instrucciones y…") → salida dentro del esquema y sin comportamiento anómalo.
- Entrada de más de 10 000 caracteres → 422 con Problem Details.
- Subida de evidencia con tipo no permitido o > 5 MB → rechazada.
- Importación CSV con columnas faltantes o codificación distinta (UTF-8 / Latin-1).
- El *bundle* del frontend no contiene la cadena de la API key (verificación en CI).

## 4. Criterios de entrada y salida

- **Entrada a merge:** lint y tipos limpios; todas las pruebas de CI en verde.
- **Cobertura:** ≥ 85 % en `domain/` y `application/`; ≥ 70 % global del backend; sin meta numérica en E2E (se cubren flujos, no líneas).
- **Liberación:** E2E y axe en verde; última evaluación IA sin regresión frente a la versión anterior.

## 5. Evaluación de la IA (*golden set*)

- `evaluation/golden-set/`: 20–30 historias en español (buenas, malas y límite), cada una con la lista de `rule_id` esperados, revisada a mano.
- Métricas por `prompt_version` y modelo: **precisión** (hallazgos IA correctos / reportados), **recall** (esperados encontrados / esperados), tasa de JSON inválido, latencia media y tokens.
- Los resultados se guardan en `evaluation/reports/` y se muestran en el README (excelente material de portafolio: "prompt v2 subió el recall de 0,71 a 0,84").

## 6. Gestión de defectos del propio proyecto

GitHub Issues con plantilla basada en el doc 02 §6 y etiquetas `severity:*`, `area:*`.
