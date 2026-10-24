# ADR-002 — El backend es el único que habla con Gemini

- **Estado:** aceptada
- **Fecha:** 2026-10-23

## Contexto
Llamar a Gemini desde el navegador expondría la API key de Google AI Studio a cualquier visitante de la demo pública.

## Decisión
Toda llamada a Gemini pasa por el backend FastAPI. La key se lee de variables de entorno (Secret Manager en producción). El frontend no conoce ni la key ni el modelo.

## Alternativas consideradas
- Llamada directa desde el frontend: descartada por seguridad.
- Funciones serverless sueltas: viables, pero dispersan la lógica de dominio que ya vive en el backend.

## Consecuencias
- (+) Seguridad, *rate limiting*, caché y registro centralizados.
- (−) Un componente más que desplegar.
