# StoryLens QA v3 — Diseño de la evolución

Fecha: 2026-10-24 · Estado: borrador para aprobación · Fuente de requisitos: `README.md` (v2.0, 10 módulos).

## 1. Intención y por qué

El dueño quiere que StoryLens QA sea una plataforma **usable de punta a punta con todas las ideas del README**, a un nivel que *podría* usarse en un equipo real (no se exige producción). Es un proyecto de portafolio: debe poder **mostrarse en internet** y verse atractivo ("presumir" de programación).

## 2. Objetivos

1. Implementar los módulos 1–10 del README que hoy faltan (ver §5).
2. Frontend nuevo, con identidad visual propia (§4).
3. Publicable en internet con **costo 0** y sin comprar dominio (§6).
4. Mantener la calidad actual: pruebas, CI, trazabilidad, honestidad sobre las limitaciones de la IA.

## 3. No-objetivos y anti-objetivos

- **No** reescribir el backend: se conserva y se amplía (decisión del dueño).
- **No** integración real con Jira en esta versión (el README la menciona como posible ampliación).
- **No** multiusuario con equipos/roles complejos: cuentas simples y permisos por proyecto básicos.
- **Anti-objetivo (duro): costo > 0.** Nunca se pagan ni se piden pagos por APIs, IA, hosting ni dominio. Si un servicio gratuito se agota o bloquea, el sistema **se cierra de forma controlada** (la función de IA se desactiva) y todo sigue funcionando con las **reglas determinísticas**. Nunca se activa facturación en ningún proveedor.
- Anti-objetivo: gráficos o cifras inventadas. Todo gráfico se calcula con datos reales; sin datos, estado vacío claro.
- Anti-objetivo: una puntuación alta que oculte un bloqueante (regla ya existente en docs/00-especificacion-del-producto.md §4).

## 4. Dirección visual (decidida con el dueño mediante maquetas)

- **Estética:** oscuro técnico inspirado en Vercel/Geist: negro puro, bordes de 1px solo donde ayudan, brillo azul/violeta de fondo, rejilla tenue.
- **Texto sin cajas:** métricas y listas directamente sobre el fondo, separadas por líneas finas. Una caja (borde tenue) solo para alertas críticas.
- **Gradientes** en cifras grandes, gráficos y luces de fondo.
- **Gráficos flotantes y dinámicos**: anillo de historias por estado, barras de cobertura por técnica, línea de evolución entre versiones, matriz de trazabilidad. Siempre generados desde los datos del proyecto; con etiquetas legibles sin depender solo del color.
- **Espaciado generoso en textos largos** (hallazgos, Gherkin, pasos): interlineado amplio, ~70 caracteres por línea.
- Datos técnicos (IDs, puntajes, versiones, rutas de API) en monoespaciada.
- Navegación lateral con los módulos; paleta de comandos `Ctrl+K` (propuesta del asistente).
- Interfaz en **español**. Accesibilidad: contraste WCAG AA, foco visible, `prefers-reduced-motion` respetado, axe-core en pruebas. (Propuestas del asistente.)
- Las maquetas de referencia están en `.superpowers/brainstorm/` (`vercel-style-v3.html` es la aprobada).
- **Skills a aplicar:** UI/UX Pro Max para definir el sistema de diseño (tokens, tipografía, paleta) antes de codificar; Impeccable (`/impeccable audit` y `polish`) para revisar cada pantalla; el detector de Impeccable como control anti-"AI slop".

## 5. Alcance funcional: estado actual y trabajo pendiente

**Ya existe (se conserva):** historias, motor de reglas YAML, puntuación, Gemini + fake, importación CSV/JSON, casos de prueba, sesiones QA con evidencias y borradores de defecto, informes PDF/Markdown, golden-set y `evaluation/run_eval.py`.

**Se construye (por orden de dependencia):**

| Fase | Contenido |
|---|---|
| A. Fundaciones | Entidad `Project` (+ épica/versión) con aislamiento de datos; Alembic; `AuditEvent`; cuentas simples y sesión; configuración de reglas por proyecto |
| B. Frontend nuevo | Sistema de diseño, shell con navegación, router, pantallas de los módulos 1, 2, 3/4 (análisis), 6, 7, 8 sobre la API existente; modo demo |
| C. Importación masiva | Trabajos asíncronos con progreso, resultados parciales y reintentos seguros (sin cola externa en esta versión: tareas en proceso + estado persistido) |
| D. Análisis transversal | Duplicados, dependencias, contradicciones (hipótesis marcadas como tales), riesgo por módulo/épica, historias sin casos |
| E. Métricas y trazabilidad | Panel de métricas con definiciones y denominadores visibles; matriz requisito–criterio–caso–ejecución–defecto; comparación de versiones de historias; efecto de mejoras aceptadas |
| F. Evaluación de IA en la app | `EvaluationRun`: golden-set, comparación de prompts/modelos, modo reglas vs reglas+IA, pruebas de inyección, historial |
| G. Calidad y despliegue | E2E con Playwright, axe-core, Docker/compose, despliegue gratuito, README final y documentación de API |

Los criterios de "terminado" son los del docs/00-especificacion-del-producto.md §9.

## 6. Despliegue con costo 0

Decisión de arquitectura (propuesta del asistente, **sujeta a verificar los planes gratuitos vigentes antes de elegir**; estos planes cambian):

- Frontend estático en Vercel o Cloudflare Pages (subdominio gratuito `*.vercel.app` / `*.pages.dev`).
- Backend FastAPI en un host con plan gratuito sin tarjeta obligatoria (Render, Fly.io u otro; se acepta que se "duerma").
- PostgreSQL gratuito (Neon o Supabase) en la nube; SQLite en local.
- **Gemini:** solo clave de capa gratuita, sin facturación habilitada, solo en el backend. Límites propios más estrictos que los del proveedor (peticiones/día y por minuto). Al recibir 429, error de cuota o agotar el contador propio → circuito abierto: se desactiva la IA, se informa en la UI y se usa solo el motor determinístico. Los datos enviados a la capa gratuita pueden ser usados por el proveedor para mejora de modelos: **la IA en la demo pública solo procesa datos ficticios**, y la UI lo avisa.
- Control de abuso en la demo: IA desactivada para visitantes anónimos; solo el dueño autenticado puede usarla.
- Sin ningún requisito de tarjeta: si un proveedor la exige, se descarta.

## 7. Acceso (decidido)

- **Modo demo público:** cualquiera con el enlace ve un proyecto ficticio precargado, de solo lectura, sin IA.
- **Cuentas:** el dueño inicia sesión para crear proyectos reales, importar y usar Gemini. Ver §9 sobre registro.

## 8. Seguridad y confiabilidad

Se mantienen las reglas del docs/00-especificacion-del-producto.md §6 (clave solo en backend, entradas no confiables, límites, auditoría). Adicional: secretos solo en variables del host; `gitleaks` y pre-commit ya existentes; CORS restringido al dominio del frontend; el modo demo no acepta escrituras.

## 9. Decisiones dejadas al constructor

- Librería de gráficos (preferir SVG propio o una ligera; sin servicios de pago).
- Tailwind v4 y librería de componentes (p. ej. Radix) para accesibilidad.
- Mecanismo de autenticación concreto (sesión por cookie firmada o JWT) y si el registro es abierto o solo para el dueño (**propuesta: solo el dueño, sin registro abierto**, para evitar abuso y costo).
- Estrategia de tareas en segundo plano, mientras sea sin servicios de pago.
- Proveedor concreto de hosting/BD tras verificar planes gratuitos.
- Orden fino de pantallas dentro de las fases.

## 10. Estrategia de pruebas

Se conserva la del docs/00-especificacion-del-producto.md §7 (pytest, Vitest, Testing Library, Playwright, axe-core, evaluación de IA). Ningún test llama a Gemini real (ya hay un test que lo impide). Cada fase termina con sus pruebas verdes y una revisión visual con Impeccable.

## 11. Riesgos

- Los planes gratuitos pueden cambiar o limitar el backend (arranques en frío): se documenta y se verifica antes de desplegar.
- Alcance grande: se entrega por fases, cada una utilizable y con pruebas.
- El repositorio no tiene commits todavía: se hará un commit base antes de empezar (requiere aprobación del dueño).

## 12. Decisiones tomadas por el asistente tras la revisión (el dueño puede cambiarlas)

1. **API y migración:** las rutas pasan a estar bajo el proyecto (`/projects/{id}/stories`, etc.). Se parte limpio (confirmado por el dueño: no hay datos que conservar): Alembic arranca con una migración inicial del esquema nuevo, sin migración de datos antiguos. El frontend nuevo se construye solo contra la API con proyectos.
2. **Demo:** proyecto ficticio sembrado en la misma base de datos con un indicador `is_demo`, lectura pública y sin escrituras. Incluye historias, análisis, casos, una sesión con evidencias y defectos, y una evaluación de IA de ejemplo. La siembra es idempotente y se repite al arrancar, así que sobrevive a un reinicio de la base gratuita.
3. **Alcance de pantallas:** hay pantalla para los 10 módulos (incluidos transversal, métricas, trazabilidad y evaluación de IA). La fase B entrega el esqueleto y los módulos 1–8; D, E y F añaden sus pantallas al terminar cada fase.
4. **Despliegue temprano:** se despliega una demo mínima al terminar la fase B para reducir el riesgo del hosting gratuito. La fase G lo pule.
5. **Cuentas:** una sola cuenta de dueño, creada por un script/variable de entorno al desplegar. No hay registro abierto. "Permisos por proyecto" queda como diseño de datos (`owner_id`), sin interfaz multiusuario.
6. **Trabajos en segundo plano:** el estado vive en la base de datos. Al arrancar, los trabajos interrumpidos se marcan como "interrumpido" y se pueden reintentar con un clic (no se reanudan solos).
7. **Evidencias:** enlaces más imágenes pequeñas (máx. 1 MB) guardadas en la base de datos, porque el disco de los hosts gratuitos es efímero.
8. **Límite de IA:** el contador vive en la base de datos (no en memoria), es global, configurable por variable de entorno y por defecto es más estricto que la capa gratuita de Gemini (valor inicial: 50 peticiones/día y 5/minuto).
9. **Escala objetivo:** hasta 500 historias por importación; paginación en el servidor y listas virtualizadas en la UI.
10. **Skills de diseño:** están instaladas como plugins del proyecto (impeccable, ui-ux-pro-max). Si un entorno no las tiene, se aplican sus principios con el sistema de diseño documentado en `docs/`.
11. **Idioma:** la interfaz, los mensajes de error de la API y los informes van en español.
