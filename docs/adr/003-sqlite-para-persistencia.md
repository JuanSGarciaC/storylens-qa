# ADR-003 — SQLite como base de datos inicial

- **Estado:** aceptada
- **Fecha:** 2026-10-23

## Contexto
Proyecto de portafolio de un solo usuario; se busca cero costo y cero infraestructura.

## Decisión
SQLite con SQLModel y migraciones Alembic. El acceso a datos va detrás de puertos de repositorio, así que migrar a PostgreSQL no afecta al dominio.

## Alternativas consideradas
- PostgreSQL desde el inicio: más realista, pero añade infraestructura sin beneficio en la v1.
- localStorage en el navegador: descartado; impide reportes en el servidor y pruebas de integración reales.

## Consecuencias
- (+) Arranque inmediato y pruebas rápidas (SQLite en memoria).
- (−) En Cloud Run el disco es efímero: para la demo pública usar un volumen o migrar a PostgreSQL gestionado.
