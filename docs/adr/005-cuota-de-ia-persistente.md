# ADR-005 — Cuota de IA persistente y degradación a reglas

- **Estado:** aceptada
- **Fecha:** 2026-10-24

## Contexto
Regla del proyecto: **costo cero, siempre**. Nunca se paga ni se pide pago por APIs de IA. Si la
cuota gratuita se agota o el servicio se bloquea, la IA debe apagarse sin romper la app.
Un contador en memoria se reinicia en cada arranque (los hosts gratuitos duermen el proceso), así
que no protege la cuota.

## Decisión
- Cada llamada permitida se registra en la tabla `ai_usage` (`key` = modelo, `at`). Los topes
  son por modelo, porque la cuota de Gemini lo es: `AI_REQUESTS_PER_MINUTE` (5) y
  `AI_DAILY_LIMIT` (50), más estrictos que la capa gratuita.
- `SqlQuota.try_acquire(key)` cuenta, decide e inserta con un candado de proceso; limpia lo
  anterior a 24 horas.
- Sin cuota, el adaptador lanza `LLMUnavailableError`, el análisis termina con reglas
  determinísticas y `ai_status = unavailable`. Nunca un 500.
- Solo el dueño autenticado puede usar IA (`get_llm` devuelve `None` para los demás).
- `GET /health` muestra `ai_quota_remaining_today`.
- La clave de Gemini es de la capa gratuita, sin facturación habilitada, y vive solo en el backend.

## Alternativas consideradas
- Contador en memoria — se pierde al reiniciar, no protege.
- Redis u otro servicio — complejidad y posible costo.
- Confiar solo en el 429 del proveedor — gasta peticiones y no cubre el tope propio.

## Consecuencias
- La cuota sobrevive a reinicios y es auditable.
- El candado es por proceso: con varios workers habría que bloquear en la base de datos.
- Los datos enviados a la capa gratuita pueden usarse para mejorar modelos: la demo pública solo
  usa datos ficticios.
