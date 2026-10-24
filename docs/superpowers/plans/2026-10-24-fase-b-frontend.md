# Fase B — Frontend nuevo: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el frontend de una sola página por una aplicación con sistema de diseño, shell de navegación, router y pantallas de los módulos 1, 2, 3/4, 6, 7 y 8 sobre la API con proyectos de la fase A, incluyendo inicio de sesión del dueño y modo demo de solo lectura.

**Architecture:** SPA React 19 + Vite. `react-router-dom` para rutas anidadas bajo `/p/:projectId/...`. Un `SessionProvider` expone quién es el usuario (`owner` | `anonymous`) y el proyecto actual (`readOnly` = `is_demo` o anónimo); todos los controles de escritura leen `useAccess().canWrite`. La capa `src/api/client.ts` se reescribe a rutas con proyecto y `credentials: "same-origin"` (cookie de sesión). Los componentes de pantallas existentes (`features/*`) se migran, no se reescriben desde cero: se conserva su lógica y sus tests, y se cambian rutas, estilos y contenedores.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Vitest + Testing Library, `react-router-dom` (única dependencia nueva de runtime), `vitest-axe` (dev), CSS plano con variables (sin Tailwind ni librerías de gráficos: el anillo/SVG se escribe a mano).

**Spec:** `docs/superpowers/specs/2026-10-24-storylens-v3-design.md` (§4, §5 fase B, §7, §8, §12.3–12.4, 12.11). Sistema de diseño de partida: `design-system/storylens-qa/MASTER.md`. Backend: `docs/superpowers/plans/2026-10-24-fase-a-fundaciones.md`.

## Global Constraints

- **Costo 0**: ninguna dependencia ni servicio de pago; fuentes por Google Fonts (permitido) o del sistema; sin telemetría.
- Interfaz **en español**, con tildes y ñ correctas; los mensajes de error de la API se muestran tal cual (ya vienen en español, Problem Details `detail`).
- Estética de la spec §4: negro puro, bordes de 1px solo donde ayudan, brillo azul/violeta de fondo, rejilla tenue, texto sin cajas (caja solo para alertas críticas), gradientes en cifras grandes, datos técnicos (IDs, puntajes, versiones, rutas) en monoespaciada, ~70 caracteres por línea en textos largos. **`MASTER.md` fue generado con otra paleta (slate + verde) y NO manda sobre la spec**: la Tarea 1 lo corrige.
- Accesibilidad: contraste WCAG AA, foco visible, `prefers-reduced-motion` respetado, ningún dato solo por color, `axe` sin violaciones en cada pantalla.
- Demo pública: solo lectura; ningún botón de escritura ni de IA debe ser accionable para anónimos ni sobre el proyecto `is_demo` (aunque el dueño esté autenticado). El servidor sigue siendo la autoridad (403): la UI además muestra su mensaje.
- IA: usar siempre `ai_status` del análisis y `ai_configured`/`ai_quota_remaining_today` de `/api/v1/health`; si la IA no está disponible, el flujo sigue con reglas y se explica por qué. Ningún test llama a Gemini real.
- Escala: hasta 500 historias por proyecto; listas con búsqueda/filtro en cliente y renderizado por tramos (sin dependencias de virtualización).
- `npm run lint`, `npm run format:check`, `npm run build` (incluye `tsc`) y `npm test` deben pasar al final de cada tarea.
- Commits: mensaje corto en inglés (`feat:`/`test:`/`chore:`) y la línea final `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Sesión expirada o cookie inválida a mitad de uso (cualquier petición devuelve 401) → se vuelve a pantalla de login conservando la ruta de destino; nunca pantalla en blanco (Tarea 3).
2. Backend gratuito "dormido": la primera petición tarda decenas de segundos o falla → estado de carga explícito ("El servidor está despertando…") con reintento; nunca spinner infinito mudo (Tarea 3).
3. Enlace directo a un proyecto/historia inexistente o de otro proyecto → pantalla 404 en español con salida a la lista; sin filtrar existencia (Tarea 4).
4. Proyecto vacío (0 historias, 0 casos, sin sesiones) y proyecto con 500 historias → estados vacíos claros en el primero; filtro y desplazamiento fluidos en el segundo (Tareas 6 y 5).
5. IA desactivada, cuota agotada a mitad de análisis o visitante anónimo → botón de IA deshabilitado con motivo visible, y el análisis por reglas funciona igual (Tarea 7).
6. Dueño autenticado dentro del proyecto demo → controles de escritura ocultos/deshabilitados y 403 del servidor mostrado como mensaje, no como error genérico (Tarea 3 y 5).
7. Textos de historia muy largos o con HTML/`<script>` → se renderizan como texto, sin desbordar el layout ni ejecutar nada (Tarea 7).

---

## File Structure

```
frontend/src/
  styles/tokens.css      variables (color, espacio, tipografía, movimiento)
  styles/base.css        reset, fondo con luz + rejilla, foco, reduced-motion
  styles/components.css  botones, campos, tablas/listas, alerta crítica, etiquetas
  shared/ui/             Button, Field, Badge, EmptyState, Spinner, ErrorNotice, Ring, Icon
  shared/useAccess.ts    canWrite / canUseAi según sesión + proyecto
  app/session.tsx        SessionProvider, useSession (me, login, logout, 401 handling)
  app/routes.tsx         tabla de rutas
  app/Shell.tsx          barra lateral + cabecera + <Outlet/>
  app/CommandPalette.tsx Ctrl+K
  app/NotFound.tsx
  features/auth/LoginPage.tsx
  features/projects/     ProjectsPage, ProjectOverview, ProjectSettings
  features/stories/      StoriesPage (lista+filtros+alta), ImportPanel (migrado)
  features/analysis/     AnalysisPage (migrado)
  features/test-design/  TestDesignPage (migrado)
  features/qa-session/   SessionsPage (migrado)
  features/reports/      ReportsPage (informes + auditoría)
```

`App.tsx` y `styles.css` heredados se eliminan en la Tarea 12.

---

### Task 1: Sistema de diseño (tokens, base y componentes UI)

**Files:**
- Modify: `design-system/storylens-qa/MASTER.md` (añadir sección «Overrides de la spec» al inicio)
- Create: `frontend/src/styles/{tokens,base,components}.css`, `frontend/src/shared/ui/{Button,Field,Badge,EmptyState,Spinner,ErrorNotice,Ring,Icon}.tsx`, `frontend/src/shared/ui/ui.test.tsx`
- Modify: `frontend/index.html` (fuentes), `frontend/src/main.tsx` (importar CSS nuevo, conviviendo con `styles.css` hasta la Tarea 12)
- Modify: `frontend/package.json` (`vitest-axe` en devDependencies)

**Interfaces:**
- Produces: tokens `--bg #000`, `--fg`, `--muted`, `--line` (borde 1px tenue), `--accent` (azul), `--accent-2` (violeta), `--ok/--warn/--danger`, `--font-sans: "Geist"`, `--font-mono: "Geist Mono"`; componentes `Button({variant:"primary"|"ghost"|"danger", loading?, ...button props})`, `Field({label, hint?, error?, children})` (asocia `label` por `htmlFor`/`aria-describedby`), `Badge({tone:"ok"|"warn"|"danger"|"info"|"neutral", children})` (siempre con texto, nunca solo color), `EmptyState({title, body, action?})`, `Spinner({label})` (`role="status"`), `ErrorNotice({message, onRetry?})` (`role="alert"`, única «caja» permitida), `Ring({segments:{label,value,tone}[]})` (SVG con leyenda textual), `Icon({name})` con ≤12 iconos SVG propios (sin emojis).

- [ ] **Step 1: Test** en `ui.test.tsx`: `Button` con `loading` queda `aria-busy` y deshabilitado; `Field` enlaza etiqueta y mensaje de error; `ErrorNotice` tiene `role="alert"` y llama `onRetry`; `Ring` con segmentos `[{Aprobadas,3},{Fallidas,1}]` muestra «Aprobadas 3» y «Fallidas 1» como texto y su `<svg>` tiene `role="img"` con `aria-label`; `Ring` con todos los valores 0 muestra `EmptyState`; cada componente pasa `axe` (`expect(await axe(container)).toHaveNoViolations()`).
- [ ] **Step 2:** `npx vitest run src/shared/ui` → FAIL (módulos inexistentes).
- [ ] **Step 3:** Implementar tokens/base/componentes. `base.css`: fondo negro con dos gradientes radiales azul/violeta tenues y rejilla de 1px de baja opacidad, `:focus-visible` con anillo de 2px, `@media (prefers-reduced-motion: reduce)` anula transiciones/animaciones, transiciones 150–200 ms, `cursor:pointer` en elementos clicables, `.prose { max-width: 70ch; line-height: 1.7 }`, `.mono { font-family: var(--font-mono) }`. Verificar a mano con un script que cada par texto/fondo usado cumple 4.5:1 (anotar los pares en `MASTER.md`).
- [ ] **Step 4:** Añadir en `MASTER.md` la sección «Overrides de la spec» (paleta negra, Geist/Geist Mono, texto sin cajas, anti-patrones) y marcar la paleta slate/verde como obsoleta.
- [ ] **Step 5:** `npm run lint && npm run format:check && npm test && npm run build` → todo en verde.
- [ ] **Step 6: Commit** `feat(frontend): design system tokens and ui primitives`

### Task 2: Cliente de API con proyectos

**Files:**
- Modify: `frontend/src/api/client.ts`, `frontend/src/api/schema.d.ts` (regenerado con `npm run gen:api` contra el backend local), `frontend/src/test/fakeApi.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Consumes: rutas de fase A (`/auth/login|logout|me`, `/projects`, `/projects/{id}`, `/projects/{id}/epics|versions|stories|stories/import|audit`, `/stories/{id}`…).
- Produces (todas `Promise`): `login(email, password): MeOut`, `logout(): void`, `getMe(): MeOut`, `listProjects(): Project[]`, `createProject(input)`, `getProject(id)`, `updateProject(id, patch)`, `deleteProject(id)`, `listEpics(pid)`, `createEpic(pid, name)`, `listVersions(pid)`, `createVersion(pid, name)`, `listStories(pid)`, `createStory(pid, input)`, `previewImport(pid, file, mapping)`, `confirmImport(pid, …)`, `listAudit(pid)`; el resto de funciones existentes (`createAnalysis`, `getAnalysis`, `decideFinding`, casos, sesiones, evidencias, defectos) conservan firma. Tipos nuevos exportados: `Project`, `Me`, `Named`, `AuditEvent`. `ApiError` gana `status` público y `isUnauthorized`. Un hook global `setUnauthorizedHandler(fn)` se invoca ante 401 en cualquier petición salvo `/auth/*`.

- [ ] **Step 1: Test** con `fetch` simulado: `listStories("p1")` pide `GET /api/v1/projects/p1/stories`; un 401 en `listStories` llama al handler y lanza `ApiError` con `isUnauthorized`; un 401 en `login` NO llama al handler y su mensaje es el `detail` del servidor; un 403 conserva el `detail` en español; `fetch` rechazado → `ApiError("No se pudo conectar con el servidor.", 0)`.
- [ ] **Step 2:** `npx vitest run src/api` → FAIL.
- [ ] **Step 3:** Reescribir `client.ts` conforme a Interfaces; arrancar el backend (`uvicorn`) y regenerar `schema.d.ts`; actualizar `fakeApi.ts` para que sus factorías devuelvan los tipos nuevos (`makeProject`, `makeMe`).
- [ ] **Step 4:** `npx vitest run src/api` → PASS. Los tests de `App.*.test.tsx` fallarán hasta migrar pantallas: marcarlos con `describe.skip` temporal **solo** en esta tarea y reactivarlos en las Tareas 7–10 (anotar en el commit).
- [ ] **Step 5: Commit** `feat(frontend): project-scoped api client`

### Task 3: Sesión, acceso y estados de conexión

**Files:**
- Create: `frontend/src/app/session.tsx`, `frontend/src/shared/useAccess.ts`, `frontend/src/features/auth/LoginPage.tsx`, `frontend/src/app/ServerWaking.tsx`
- Test: `frontend/src/app/session.test.tsx`, `frontend/src/features/auth/LoginPage.test.tsx`

**Interfaces:**
- Produces: `SessionProvider`; `useSession(): { me: Me | null; status: "loading"|"waking"|"ready"|"error"; login(email,pw): Promise<void>; logout(): Promise<void>; retry(): void }`; `useAccess(project: Project | undefined): { canWrite: boolean; canUseAi: boolean; reason: string | null }` donde `canWrite = me.authenticated && !project?.is_demo` y `canUseAi = canWrite && health.ai_configured`; `reason` es el texto en español que explica por qué no (p. ej. «Estás viendo el proyecto de demostración: es de solo lectura.», «Inicia sesión para editar.», «La IA no está configurada.»). `LoginPage` en `/login` con `?next=`.

- [ ] **Step 1: Tests:** (a) `getMe` falla con timeout >4 s simulado → `status "waking"` y se muestra «El servidor está despertando…» con botón «Reintentar»; (b) una petición con 401 tras estar `ready` redirige a `/login?next=<ruta actual>`; (c) login correcto navega a `next` (solo rutas internas que empiezan por `/`; `next=https://evil.test` se ignora); (d) login con clave errónea muestra el mensaje genérico del servidor y no revela si el email existe; 429/bloqueo temporal muestra el `detail`; (e) `useAccess` cubre las 4 combinaciones anónimo/dueño × demo/real con su `reason`.
- [ ] **Step 2:** `npx vitest run src/app/session src/features/auth` → FAIL.
- [ ] **Step 3:** Implementar. `waking` se activa si `getMe`/`health` no responde en 4 s o falla de red; reintento con espera creciente (1 s, 2 s, 4 s, máx. 3 automáticos) y botón manual.
- [ ] **Step 4:** Tests → PASS; `axe` sin violaciones en `LoginPage`.
- [ ] **Step 5: Commit** `feat(frontend): session, access rules and login page`

### Task 4: Router y shell de navegación

**Files:**
- Create: `frontend/src/app/{routes.tsx,Shell.tsx,CommandPalette.tsx,NotFound.tsx}`; Modify: `frontend/src/main.tsx`, `frontend/package.json` (`react-router-dom`)
- Test: `frontend/src/app/Shell.test.tsx`

**Interfaces:**
- Rutas: `/login`; `/` (lista de proyectos); `/p/:projectId` (resumen); `/p/:projectId/stories`; `/p/:projectId/stories/:storyId/analysis`; `/p/:projectId/stories/:storyId/tests`; `/p/:projectId/stories/:storyId/sessions`; `/p/:projectId/reports`; `/p/:projectId/settings`; `*` → `NotFound`. Barra lateral con módulos 1–8 (los de D–F aparecen deshabilitados con la etiqueta «Próximamente», sin enlaces), selector de proyecto, estado de sesión y de IA (`Badge` con cuota restante). `CommandPalette`: `Ctrl+K`/`⌘K` abre un diálogo (`role="dialog"`, foco atrapado, `Esc` cierra) que filtra rutas del proyecto y proyectos; navegación por flechas/Enter.
- Consumes: `useSession`, `getProject` (carga del proyecto actual en un `ProjectContext` con `useProject()`).

- [ ] **Step 1: Tests:** ruta de proyecto inexistente (API 404) → `NotFound` con enlace a «Volver a proyectos»; historia que no pertenece al proyecto (404) igual; `Ctrl+K` abre la paleta, escribir «informes» y Enter navega a `/p/x/reports`, `Esc` devuelve el foco al elemento previo; en viewport <768 px la barra lateral se colapsa a un botón «Menú»; `axe` limpio.
- [ ] **Step 2:** `npx vitest run src/app/Shell` → FAIL.
- [ ] **Step 3:** Implementar con `createBrowserRouter`; `Shell` usa `<Outlet/>`; carga perezosa (`React.lazy`) por pantalla para mantener liviano el bundle inicial.
- [ ] **Step 4:** Tests → PASS; `npm run build` OK.
- [ ] **Step 5: Commit** `feat(frontend): router, shell and command palette`

### Task 5: Módulo 1 — Proyectos, resumen y ajustes

**Files:**
- Create: `frontend/src/features/projects/{ProjectsPage,ProjectOverview,ProjectSettings}.tsx` + tests
- Consumes: `listProjects`, `createProject`, `updateProject`, `deleteProject`, `listEpics/Versions`, `createEpic/Version`, `listStories` (para el resumen), `useAccess`.

**Interfaces:**
- `ProjectsPage`: lista con el demo siempre visible y etiquetado «Demostración»; alta de proyecto (nombre, descripción, objetivo) solo si `canWrite`-global (autenticado).
- `ProjectOverview`: cifras grandes con gradiente (historias, % con bloqueantes, puntaje medio) calculadas de `listStories`; `Ring` de historias por estado (sin analizar / con bloqueantes / aprobadas con observaciones / listas) con valores reales; estado vacío con acción «Importar historias» si hay 0.
- `ProjectSettings`: activar/desactivar reglas y umbrales (`settings` de `ProjectPatch`), épicas y versiones, borrado del proyecto con confirmación escrita del nombre; en demo todo en solo lectura con el `reason`.

- [ ] **Step 1: Tests:** el resumen de un proyecto con 3 historias de puntajes conocidos muestra el promedio exacto y los totales del `Ring` suman 3; proyecto sin historias muestra `EmptyState`, nunca «NaN» ni «0 %» engañoso; en proyecto demo los botones de crear/borrar/guardar no existen o están `disabled` con el motivo accesible; borrar proyecto exige escribir su nombre; un 403 del servidor al guardar se muestra con su `detail`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS + `axe` limpio.
- [ ] **Step 5: Commit** `feat(frontend): projects overview and settings`

### Task 6: Módulo 2 — Historias e importación

**Files:**
- Create: `frontend/src/features/stories/StoriesPage.tsx`; Modify (migrar): `features/import/ImportPanel.tsx` → `features/stories/ImportPanel.tsx`, `features/stories/StoryHistory.tsx`; tests migrados desde `App.import.test.tsx`.

**Interfaces:**
- `StoriesPage`: tabla densa sin cajas (ID mono, título, épica, versión, puntaje, estado) con búsqueda por texto, filtros por épica/versión/estado, orden por puntaje; renderizado por tramos de 50 filas con «Mostrar más» (sin virtualización externa); alta de historia (formulario) y `ImportPanel` solo si `canWrite`; fila → ruta de análisis. Al importar, el resumen informa filas válidas/ inválidas con el motivo por fila.

- [ ] **Step 1: Tests:** con 500 historias simuladas la primera pintura contiene ≤50 filas y el filtro por texto encuentra una historia del final; filtrar sin resultados muestra «Ninguna historia coincide» con botón «Limpiar filtros»; importar un CSV con una fila inválida muestra el motivo y permite confirmar solo las válidas (test migrado); anónimo no ve el alta ni la importación; el título `<script>alert(1)</script>` aparece como texto literal.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar/migrar. **Step 4:** PASS + `axe`.
- [ ] **Step 5: Commit** `feat(frontend): stories list and import screens`

### Task 7: Módulos 3/4 — Análisis de calidad y asistente de IA

**Files:**
- Modify (migrar): `features/analysis/{AnalysisResult,StoryForm}.tsx` → nueva `features/analysis/AnalysisPage.tsx`; reactivar `App.ai.test.tsx` y `App.test.tsx` como `AnalysisPage.test.tsx`/`AnalysisPage.ai.test.tsx`.

**Interfaces:**
- `AnalysisPage` en `/p/:pid/stories/:sid/analysis`: puntaje grande con gradiente, hallazgos agrupados por severidad con etiqueta textual (Bloqueante/Mayor/Menor/Info), referencia normativa en mono, decisión aceptar/descartar (con motivo obligatorio al descartar), botón «Analizar» y «Analizar con IA». La regla «una puntuación alta no oculta un bloqueante» se refleja: si hay bloqueantes, se muestra la alerta crítica (única caja) encima del puntaje. Texto largo en `.prose`.

- [ ] **Step 1: Tests (los migrados más estos):** `canUseAi=false` → «Analizar con IA» deshabilitado y el `reason` visible, «Analizar» sigue funcionando; análisis con `ai_status` ≠ `ok` muestra un aviso «La IA no pudo participar (motivo)» y los hallazgos por reglas; puntaje 95 con un bloqueante muestra la alerta crítica; descartar sin motivo no envía la petición; historia de 20 000 caracteres no rompe el layout (`overflow-wrap:anywhere` verificado por clase); contenido HTML se muestra como texto.
- [ ] **Step 2:** FAIL. **Step 3:** Migrar/implementar. **Step 4:** PASS + `axe`.
- [ ] **Step 5: Commit** `feat(frontend): analysis screen with ai fallback states`

### Task 8: Módulo 6 — Casos de prueba, Gherkin y trazabilidad

**Files:**
- Modify (migrar): `features/test-design/TestDesignPanel.tsx` → `TestDesignPage.tsx`; migrar sus tests.

**Interfaces:**
- Casos agrupados por técnica con estado (borrador/aprobado/…); botón «Generar casos» y «Sugerir Gherkin» (IA-dependiente → `canUseAi`, con alternativa determinística si existe); tabla de trazabilidad criterio → casos con criterios sin cobertura resaltados con texto «Sin cobertura»; Gherkin en mono con interlineado amplio.

- [ ] **Step 1: Tests:** criterio sin casos aparece como «Sin cobertura»; cambio de estado de un caso llama `updateCaseStatus` y refleja el nuevo valor; anónimo ve casos pero no controles; historia sin casos → `EmptyState` con acción «Generar casos».
- [ ] **Step 2:** FAIL. **Step 3:** Migrar. **Step 4:** PASS + `axe`.
- [ ] **Step 5: Commit** `feat(frontend): test design and traceability screen`

### Task 9: Módulo 7 — Sesiones de ejecución QA, evidencias y defectos

**Files:**
- Modify (migrar): `features/qa-session/*` → rutas `/p/:pid/stories/:sid/sessions` y `/…/sessions/:sessionId`; migrar `App.session.test.tsx`.

**Interfaces:**
- Lista de sesiones por historia + detalle (checklist, ejecuciones, evidencias nota/enlace/imagen ≤1 MB, borrador de defecto con/sin IA, cierre con recomendación). La recomendación se muestra con texto y `Badge`. Imagen >1 MB se rechaza en cliente con mensaje en español antes de subir.

- [ ] **Step 1: Tests:** (migrados) + imagen de 1,5 MB no llama a `uploadImageEvidence` y muestra el límite; enlace con `javascript:` se rechaza; sesión cerrada queda solo lectura; la URL de la sesión es recargable (deep link) y devuelve 404 amigable si no existe.
- [ ] **Step 2:** FAIL. **Step 3:** Migrar. **Step 4:** PASS + `axe`.
- [ ] **Step 5: Commit** `feat(frontend): qa session screens`

### Task 10: Módulo 8 — Informes y auditoría

**Files:**
- Create: `features/reports/ReportsPage.tsx` (+ test); Modify: `ReportLinks.tsx`

**Interfaces:**
- Informe por análisis y por sesión (enlaces PDF/Markdown a `…/report?format=`), listado de eventos de auditoría (`listAudit`: fecha, actor, acción, entidad en mono) visible solo para el dueño; anónimo ve solo informes del demo.

- [ ] **Step 1: Tests:** enlaces de descarga apuntan a las URLs correctas; auditoría vacía → `EmptyState`; anónimo no ve la auditoría (y un 401/403 del endpoint no rompe la pantalla).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS + `axe`.
- [ ] **Step 5: Commit** `feat(frontend): reports and audit screen`

### Task 11: Responsive, movimiento y detalles de interfaz

**Files:**
- Modify: `styles/*.css`, pantallas según hallazgos; Create: `frontend/src/shared/ui/motion.ts` (entrada escalonada de listas con CSS, sin GSAP).

- [ ] **Step 1:** Prueba visual manual con el navegador (Playwright MCP) a 375, 768, 1024 y 1440 px en cada ruta con el demo sembrado: sin scroll horizontal, sin contenido tapado, tablas con desplazamiento propio en móvil. Guardar capturas en el scratchpad (no en el repo).
- [ ] **Step 2:** Test de `motion.ts`: con `matchMedia('(prefers-reduced-motion: reduce)')` activo no se aplica ninguna clase de animación.
- [ ] **Step 3:** Corregir hallazgos. **Step 4:** suite completa en verde.
- [ ] **Step 5: Commit** `feat(frontend): responsive and motion polish`

### Task 12: Retirada de lo heredado, revisión Impeccable y listo para demo

**Files:**
- Delete: `frontend/src/app/App*.tsx` y tests asociados ya migrados, `frontend/src/styles.css`, carpetas `.gitkeep` sobrantes; Modify: `README.md` y `docs/08-guia-de-desarrollo.md` (rutas, scripts, cómo ver el demo); Modify: `frontend/vite.config.ts`/`client.ts` (`VITE_API_BASE` opcional para hosting estático, por defecto `/api/v1`).

- [ ] **Step 1:** Eliminar lo heredado; `grep -r "styles.css\|from \"./App\"" frontend/src` sin resultados.
- [ ] **Step 2:** Ejecutar `/impeccable audit` y `/impeccable polish` sobre las pantallas y el detector anti-«AI slop»; aplicar solo correcciones materiales.
- [ ] **Step 3:** Suite completa: `npm run lint && npm run format:check && npm run build && npm test`; backend `pytest` sin cambios. Arrancar backend + `npm run dev` y recorrer el demo anónimo y el flujo del dueño de extremo a extremo (login → crear proyecto → importar → analizar → casos → sesión → informe).
- [ ] **Step 4: Commit** `chore(frontend): remove legacy single page and finish phase B`
- [ ] **Step 5:** El **despliegue de la demo** (spec §12.4) NO forma parte de esta tarea: requiere verificar los planes gratuitos vigentes y la aprobación del dueño; se propone como paso siguiente.

---

## Self-Review

- **Cobertura de la spec §5 fase B:** sistema de diseño (T1), shell/router (T4), módulos 1 (T5), 2 (T6), 3/4 (T7), 6 (T8), 7 (T9), 8 (T10), modo demo/solo lectura y sesión (T3 y todas), accesibilidad/responsive (T1, T11), Ctrl+K (T4). Módulos 5, 9, 10 quedan para D–F, con entradas deshabilitadas en la barra lateral.
- **Consistencia de tipos:** `Project`, `Me`, `useAccess`, `useProject`, `useSession` se definen en T2–T4 y solo se consumen después con esas firmas.
- **Riesgo conocido:** el frontend actual usa rutas sin proyecto y ya no funciona contra el backend de la fase A; T2 deja los tests de `App.*` en `skip` hasta migrarlos (T7–T9). T12 verifica que no quede ninguno omitido (`grep -rn "describe.skip\|it.skip" frontend/src` vacío).
