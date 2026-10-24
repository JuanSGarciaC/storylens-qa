# ADR-001 — Motor híbrido: reglas determinísticas + IA

- **Estado:** aceptada
- **Fecha:** 2026-10-23

## Contexto
Un análisis basado solo en un LLM es lento, consume cuota, no es reproducible y es difícil de justificar ante un revisor. Un análisis basado solo en reglas no detecta problemas semánticos (criterios faltantes, riesgos implícitos).

## Decisión
El análisis corre primero un motor de reglas determinístico y después, opcionalmente, Gemini. La IA solo puede reportar contra `rule_id` de tipo `ia` del catálogo y debe citar texto literal de la historia.

## Alternativas consideradas
- Solo LLM: descartada por reproducibilidad, costo y trazabilidad.
- Solo reglas: descartada por cobertura semántica insuficiente.

## Consecuencias
- (+) La app funciona sin IA; los resultados determinísticos se pueden probar al 100 %.
- (+) Cada hallazgo es trazable a una norma.
- (−) Hay que mantener dos mecanismos y deduplicar sus resultados.
