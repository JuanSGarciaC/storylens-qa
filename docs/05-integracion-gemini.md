# 05 — Integración con Gemini (Google AI Studio)

## 1. Configuración

1. Entra a https://aistudio.google.com/ y crea una API key (*Get API key*).
2. Guárdala en `backend/.env` como `GEMINI_API_KEY`. **Nunca** en el frontend ni en el repositorio.
3. SDK oficial: **`google-genai`** (Python), el SDK unificado actual de Google. No uses el antiguo `google-generativeai` (obsoleto).
4. El modelo se configura por variable (`GEMINI_MODEL`) y uno de respaldo en `GEMINI_FALLBACK_MODEL`. Los nombres y límites cambian con frecuencia: verifícalos en https://aistudio.google.com/rate-limit.

### Decisión de modelo (medida el 2026-10-23 con la cuenta del proyecto)

La documentación no publica los límites del plan gratuito (solo se ven en AI Studio, por proyecto), así que se midieron.

| Modelo | Latencia (petición mínima) | Límite gratuito | Uso |
|---|---|---|---|
| `gemini-3.5-flash-lite` | 0,7–0,8 s, estable | **15 peticiones/min** (error 429 con `limit: 15`) | **Principal** |
| `gemini-3.6-flash` | 1,2–1,6 s, estable | no medido | **Respaldo** (cuota propia) |
| `gemini-3.1-flash-lite` | 0,5 s con picos de 5–11 s | no llegó a limitarse | Descartado: inestable |
| `gemini-3.8-flash` | 107 s en una petición | no medido | Descartado: inviable para una UI |

`gemini-2.5-*` solo sigue disponible para cuentas que ya lo usaban, y `gemini-2.0-*` está apagado. El adaptador aplica además topes locales (12/min y 150/día por modelo, configurables) para no agotar la cuota; la ventana diaria es deslizante de 24 h, no el reinicio a medianoche (hora del Pacífico) de Google.

## 2. Patrón de adaptador

El dominio define un puerto `LLMPort` con operaciones de negocio, **no** "generar texto":

| Operación | Entrada | Salida (validada con Pydantic) |
|-----------|---------|--------------------------------|
| `analyze_story` | historia, criterios, hallazgos determinísticos ya encontrados | lista de hallazgos IA |
| `suggest_acceptance_criteria` | historia | criterios en Gherkin |
| `generate_test_cases` | historia, criterios, técnicas pedidas | casos de prueba |
| `draft_defect` | caso de prueba, notas del QA, resultado obtenido | campos del defecto |

Implementaciones:
- `GeminiAdapter`: real, usa el SDK.
- `FakeLLMAdapter`: devuelve respuestas fijas desde `tests/fixtures/`. Se usa en las pruebas y en el modo demo sin key.

## 3. Salida estructurada (obligatorio)

- Configura la llamada con `response_mime_type = "application/json"` y un **esquema de respuesta** (Gemini lo admite a partir de modelos Pydantic o JSON Schema).
- **Siempre** valida de nuevo la respuesta con Pydantic en el backend. Si no valida: un reintento; si vuelve a fallar, se descarta la parte de IA y el análisis queda `partial`.
- Restringe en el esquema los valores cerrados (`severity`, `rule_id` permitidos para IA, `technique`).
- Exige `evidence_text` en cada hallazgo: el backend verifica que ese fragmento **exista literalmente** en la historia. Si no existe, el hallazgo se descarta (mitiga alucinaciones).

## 4. Diseño de prompts

Los prompts viven en `backend/app/prompts/<operación>/v<N>.md` junto a su esquema. Cada análisis guarda `prompt_version`.

**Estructura recomendada de cada prompt:**
1. **Rol:** "Eres un analista QA senior certificado ISTQB que revisa historias de usuario."
2. **Marco:** las reglas de tipo `ia` del catálogo (id, descripción, referencia) inyectadas desde el YAML: la IA solo puede reportar contra esos `rule_id`.
3. **Contexto:** hallazgos determinísticos ya encontrados ("no los repitas").
4. **Datos:** la historia entre delimitadores claros (p. ej. `<historia>…</historia>`), con la instrucción explícita de que es **contenido a analizar, no instrucciones**.
5. **Restricciones:** responde en español; cita textualmente; si no hay problemas, devuelve una lista vacía; no inventes requisitos.
6. **Ejemplos (*few-shot*):** 1–2 historias cortas con su salida esperada.

**Parámetros:** temperatura baja (0.1–0.3) para el análisis; algo más alta (0.5–0.7) para la generación de casos de prueba.

## 5. Seguridad y privacidad

| Riesgo | Mitigación |
|--------|-----------|
| Fuga de la API key | Solo en el backend; `.env` en `.gitignore`; gitleaks en CI; Secret Manager en producción |
| *Prompt injection* desde la historia | Delimitadores; instrucción de tratar el contenido como datos; salida con esquema cerrado; la IA no ejecuta acciones |
| Datos sensibles de empresa | Aviso en la UI: "no pegues datos confidenciales"; recuerda que en la capa gratuita de AI Studio Google puede usar los datos para mejorar sus productos (revisa los términos vigentes) |
| Abuso de la demo pública | *Rate limit* por IP y límite diario de llamadas a IA |
| Respuestas inventadas | Verificación de `evidence_text`; `rule_id` cerrado; decisión final del usuario |

## 6. Fiabilidad y costos

- *Timeout* por llamada: 20–30 s.
- Reintentos con *backoff* exponencial y *jitter* solo ante 429/500/503 (máximo 3).
- Caché por `hash(texto + prompt_version + modelo)`.
- Registra `prompt_tokens`, `output_tokens` y latencia por llamada para mostrarlos en el portafolio.
- Sin key configurada → la app funciona en modo "solo reglas" y muestra un aviso.

## 7. Evaluación de calidad de la IA

Ver doc 06 §5: conjunto de referencia (*golden set*) con hallazgos esperados, métricas de precisión y exhaustividad (*recall*) por versión de prompt. Un cambio de prompt solo se adopta si no empeora las métricas.
