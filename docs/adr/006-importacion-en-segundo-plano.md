# ADR-006 — Importación masiva en segundo plano con estado persistido

- **Estado:** aceptada
- **Fecha:** 2026-10-24

## Contexto
Importar hasta 500 historias y analizar cada una no cabe en una sola petición: los hosts
gratuitos cortan las peticiones largas y duermen el proceso. Tampoco hay cola externa (costo cero).

## Decisión
- `POST /projects/{id}/import-jobs` valida el archivo con la misma vista previa de siempre,
  guarda un trabajo (`import_job`) con una fila pendiente por historia (`import_item`) y
  responde `202`. El trabajo se procesa en un hilo del mismo proceso; **el estado vive en la
  base de datos**, no en memoria.
- Se procesa fila a fila y se guarda el avance después de cada una. Los contadores se calculan
  a partir de las filas, así que no pueden descuadrarse.
- **Idempotencia:** una fila con historia ya creada solo se analiza; una cuya historia ya existe
  en el proyecto se marca `skipped` (duplicada). Reintentar nunca duplica historias.
- **Fallos parciales:** una fila que falla no detiene el trabajo (`partial`). El mensaje que ve
  el usuario es genérico; el detalle queda en el registro del servidor.
- **Reinicios:** al arrancar, los trabajos `queued`/`running` pasan a `interrupted`. No se
  reanudan solos: se reintentan con un clic (`POST /import-jobs/{id}:retry`).
- **IA:** opcional por trabajo. Solo el dueño; si la cuota se agota (ADR-005), esa fila se
  analiza con reglas y queda con `ai_status = unavailable`. El trabajo no falla por eso.
- Tope de 500 filas por archivo (422 en español si lo supera). Cancelar es
  `POST /import-jobs/{id}:cancel`; el hilo lo nota entre fila y fila.
- La interfaz consulta `GET /import-jobs/{id}` con espera creciente (1,5 s a 5 s) hasta que el
  trabajo termina; el id va en la URL, así que sobrevive a cerrar la pestaña.

## Alternativas consideradas
- Cola externa (Redis, Celery) — costo y complejidad fuera de alcance.
- Procesar dentro de la petición — se corta en hosts gratuitos.
- Reanudar solos tras un reinicio — riesgo de gastar cuota de IA sin que nadie lo vea.

## Consecuencias
- Un solo proceso por base de datos: dos procesos podrían tomar el mismo trabajo. Aceptable para
  la escala objetivo; con varios procesos haría falta un bloqueo por trabajo.
- Si el proceso muere a mitad de una fila, esa fila vuelve a procesarse en el reintento sin
  duplicar la historia.
