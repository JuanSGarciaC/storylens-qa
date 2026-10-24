# Fase B — Frontend nuevo: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el frontend actual por una aplicación React con identidad visual propia (oscuro técnico estilo Vercel, gradientes, gráficos dinámicos, texto sin cajas) que cubra los módulos 1–8 del README sobre la API de la Fase A, con modo demo de solo lectura.

**Architecture:** SPA en `frontend/` (Vite + React 19 + TypeScript). Rutas con `react-router`, datos con `@tanstack/react-query` sobre un cliente `fetch` tipado (`src/api/client.ts`), estilos con Tailwind v4 y tokens CSS propios. Una carpeta por módulo en `src/features/`, componentes compartidos en `src/shared/ui` y gráficos SVG propios en `src/shared/charts`. El estado "¿puedo escribir?" sale de `GET /auth/me` y del flag `is_demo` del proyecto.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), react-router, @tanstack/react-query, lucide-react (iconos SVG), fuentes autoalojadas `@fontsource-variable/geist` y `geist-mono`, Vitest + Testing Library + `axe-core`.

**Spec:** `docs/superpowers/specs/2026-10-24-storylens-v3-design.md` (§4 dirección visual, §5 fase B, §7 acceso, §12). Sistema de diseño: `design-system/storylens-qa/MASTER.md` (generado con UI/UX Pro Max; se ajusta en la Tarea 2). Maqueta aprobada: `.superpowers/brainstorm/240-1792849820/content/vercel-style-v3.html` (local, no versionada). API: `docs/04-modelo-de-datos-y-api.md` y el OpenAPI del backend.

## Global Constraints

- **Costo 0**: ningún servicio de pago, ninguna fuente/analítica/CDN externa en tiempo de ejecución (fuentes e iconos van en el bundle). La clave de Gemini jamás llega al frontend.
- Interfaz **en español**; datos técnicos (IDs, puntajes, versiones, rutas de API) en monoespaciada.
- Estética aprobada: fondo negro `#000`, bordes de 1px solo donde ayudan, **texto sin cajas** (separadores finos; una caja tenue solo para alertas críticas), gradientes azul/violeta en cifras grandes, gráficos y luces de fondo, rejilla tenue, **gráficos flotantes y siempre calculados con datos reales** (estado vacío claro si no hay datos; nunca cifras inventadas).
- **Espaciado generoso** en textos largos (hallazgos, Gherkin, pasos): `line-height` ≥ 1.6, ancho de lectura ≤ 70 caracteres.
- Accesibilidad **WCAG 2.2 AA**: contraste de texto ≥ 4.5:1 (el gris `#666` de la maqueta NO cumple: el texto secundario usa como mínimo `#8f8f8f`), foco visible, navegación por teclado, `prefers-reduced-motion` respetado, objetivos táctiles ≥ 44px, el color nunca es la única señal (los estados llevan texto o icono).
- Responsive: sin scroll horizontal en 375px, 768px, 1024px y 1440px.
- Rendimiento: JS inicial ≤ 200 KB gzip (código dividido por ruta); listas de hasta 500 historias paginadas en cliente (50 por página).
- Sin modo claro en esta versión (decisión de diseño; el sistema de diseño lo marca "light not recommended").
- Todo texto de usuario (historias, hallazgos, notas) se renderiza como **texto**, nunca como HTML. Los enlaces de evidencia solo se enlazan si empiezan por `http://` o `https://`.
- `npm run lint`, `npm run format:check`, `npm test` y `npm run build` pasan al final de cada tarea.
- Commits: `feat:`/`test:`/`chore:` en inglés + `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Condiciones que el spec implica pero que ninguna prueba "obvia" cubriría; cada una tiene su test en la tarea indicada:

1. La cookie de sesión caduca a mitad de uso (API responde 401 en una escritura) → se pide iniciar sesión de nuevo y se vuelve a la misma pantalla sin perder lo escrito (Tarea 4 y 5).
2. Visitante anónimo en el proyecto demo: los controles de escritura aparecen **deshabilitados con explicación** ("Demo de solo lectura"), nunca ocultos ni funcionales (Tarea 5).
3. Proyecto o lista sin datos: ningún `NaN`, división por cero ni gráfico vacío sin explicación (Tarea 3 y 6).
4. Doble clic en "Guardar/Crear" no envía dos veces; error de red muestra mensaje con "Reintentar" (Tarea 7).
5. 500 historias o títulos de 300 caracteres no rompen el layout ni congelan la pantalla (Tarea 7).
6. Evidencia con enlace `javascript:`/`data:` no se convierte en enlace activo (Tarea 10).
7. Navegador en 375px: menú lateral colapsa, sin scroll horizontal, objetivos táctiles ≥ 44px (Tarea 12).
8. Importación con archivo mal formado, duplicados o filas inválidas: el asistente explica qué pasó y no pierde la selección (Tarea 8).

---

## File Structure

| Ruta | Responsabilidad |
|---|---|
| `src/api/client.ts` | `ApiError`, `request()`, funciones tipadas por módulo (se reescribe sobre la base actual) |
| `src/api/schema.d.ts` | Tipos generados desde el OpenAPI del backend |
| `src/api/queries.ts` | Hooks de react-query (`useProjects`, `useStories`, …) y claves de caché |
| `src/app/{main,router,AppShell,providers}.tsx` | Arranque, rutas, layout con menú lateral y barra superior |
| `src/app/{CommandPalette,DemoBanner,AuthGate}.tsx` | Paleta Ctrl+K, aviso de demo, guardia de sesión |
| `src/shared/ui/*` | Button, Field, Badge/StatusText, Stat, EmptyState, Skeleton, ErrorState, ConfirmDialog, Tabs |
| `src/shared/charts/*` | `DonutChart`, `BarChart`, `HBars`, `Sparkline` y `chartData.ts` (funciones puras) |
| `src/shared/{useCanWrite,format,safeUrl}.ts` | Permisos, formato de fechas/números, validación de enlaces |
| `src/features/{auth,projects,stories,analysis,import,test-design,qa-session,reports,audit,settings}` | Pantallas por módulo |
| `src/styles/{tokens,base}.css` | Tokens del sistema de diseño y estilos base |
| `src/test/{setup,fakeApi,renderApp,axe}.ts(x)` | Utilidades de prueba |
| `design-system/storylens-qa/MASTER.md` | Fuente de verdad del sistema de diseño |

---

### Task 0: Rama, línea base y dependencias

**Files:** Modify `frontend/package.json`, `frontend/package-lock.json`

**Interfaces:** Produces: rama `fase-b-frontend`, dependencias instaladas, línea base verde.

- [ ] **Step 1:** Crear la rama `fase-b-frontend` desde `master`.
- [ ] **Step 2: Línea base.** En `frontend/`: `npm ci`, luego `npm run lint`, `npm run format:check`, `npm test`, `npm run build` → Expected: todo pasa (anotar nº de tests). Si algo falla, **avisar al dueño** antes de seguir.
- [ ] **Step 3:** Instalar (verificando en el registro la versión estable vigente de cada una): `react-router`, `@tanstack/react-query`, `lucide-react`, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`; dev: `tailwindcss`, `@tailwindcss/vite`, `axe-core`. Sin ningún otro paquete.
- [ ] **Step 4:** `npm run build` y `npm test` siguen verdes. Commit `chore: add frontend dependencies for phase B`.

---

### Task 1: Contrato de la API y cliente tipado

**Files:**
- Modify: `frontend/src/api/client.ts`, `frontend/src/api/schema.d.ts` (regenerado), `frontend/package.json` (script `gen:api`)
- Create: `frontend/src/api/queries.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces (`client.ts`): `ApiError(message: string, status: number)`; `request<T>(path, init?)` con `credentials: "same-origin"`; errores de red → `ApiError` con `status = 0` y mensaje "No se pudo conectar con el servidor". Funciones (todas `Promise<…>` tipadas con `components["schemas"][…]`):
  - auth: `login(email, password)`, `logout()`, `me()`
  - proyectos: `listProjects()`, `getProject(id)`, `createProject({name, description?, objective?})`, `updateProject(id, patch)`, `deleteProject(id)`, `listEpics(id)`, `createEpic(id, name)`, `listVersions(id)`, `createVersion(id, name)`, `listAudit(id, {limit, offset})`
  - historias: `listStories(projectId, {epicId?, versionId?})`, `createStory(projectId, input)`, `getStory(id)`, `deleteStory(id)`, `runAnalysis(storyId, {useAi})`, `getAnalysis(id)`, `decideFinding(id, {decision, dismissReason?})`
  - importación: `previewImport(projectId, file, mapping?)`, `confirmImport(projectId, file, mapping, selected)`
  - pruebas: `listCases(storyId)`, `generateCases(storyId, techniques?)`, `createCase(storyId, input)`, `updateCase(id, patch)`, `getTraceability(storyId)`, `suggestGherkin(storyId)`
  - sesiones: `listSessions(storyId)`, `createSession(storyId, input)`, `getSession(id)`, `closeSession(id, {recommendation, summary})`, `updateChecklistItem(id, patch)`, `updateExecution(id, patch)`, `addEvidenceLink(executionId, input)`, `uploadEvidenceImage(executionId, file, description)`, `draftDefect(executionId, {useAi})`, `updateDefect(id, patch)`
  - descargas: `reportUrl(kind: "analysis" | "session", id, format: "md" | "pdf") -> string` (solo construye la URL).
- Produces (`queries.ts`): claves `qk.projects()`, `qk.project(id)`, `qk.stories(projectId, filters)`, `qk.story(id)`, `qk.analysis(id)`, `qk.cases(storyId)`, `qk.sessions(storyId)`, `qk.session(id)`, `qk.audit(projectId, page)`, `qk.me()`; hooks `useMe()`, `useProjects()`, `useProject(id)`, `useStories(projectId, filters)`, `useStory(id)`, … y mutaciones que invalidan las claves afectadas.
- Un 401 en cualquier llamada emite el evento `window.dispatchEvent(new CustomEvent("storylens:unauthorized"))` (lo escucha `AuthGate`, Tarea 4).

- [ ] **Step 1:** Generar el OpenAPI sin levantar servidor: desde `backend/`, `python -c "import json; from app.main import app; print(json.dumps(app.openapi()))" > ../frontend/openapi.json`; cambiar `gen:api` para leer ese archivo (`openapi-typescript openapi.json -o src/api/schema.d.ts`), ejecutarlo y **no versionar** `openapi.json` (añadir a `.gitignore`).
- [ ] **Step 2: Write the failing test** (`client.test.ts`, `fetch` simulado): `login envía JSON y credenciales`; `un 401 emite storylens:unauthorized`; `errores con Problem Details usan detail`; `un fallo de red produce ApiError con status 0`; `listStories arma /projects/{id}/stories?epic_id=…`; `uploadEvidenceImage usa FormData sin Content-Type manual`; `reportUrl("analysis","a1","pdf") === "/api/v1/analyses/a1/report?format=pdf"`.
- [ ] **Step 3: Run** `npm test -- client` → FAIL. **Step 4:** implementar cliente y `queries.ts`. **Step 5: Run** → PASS; `npm run build` (tipos).
- [ ] **Step 6: Commit** `feat: typed API client for projects-scoped backend`. Los componentes viejos en `src/features/*` y `src/app/App*.test.tsx` **aún no se tocan**: dejarán de compilar y se eliminan en la Tarea 4; para que `build` no se rompa antes, esta tarea mantiene temporalmente exportadas las funciones antiguas que usan (marcar con `// temporal: se elimina en la Tarea 4`) o la Tarea 1 y 4 se hacen en el mismo commit si no es viable.

---

### Task 2: Sistema de diseño, tokens y componentes base

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/shared/ui/{Button,Field,StatusText,Stat,EmptyState,ErrorState,Skeleton,ConfirmDialog,Tabs,Heading}.tsx`, `src/shared/{format.ts,safeUrl.ts}`
- Modify: `vite.config.ts` (plugin de Tailwind), `src/main.tsx` (importa estilos y fuentes), `design-system/storylens-qa/MASTER.md`
- Test: `src/shared/ui/ui.test.tsx`, `src/shared/safeUrl.test.ts`, `src/shared/format.test.ts`

**Interfaces:**
- Tokens CSS (variables en `:root`, usadas por Tailwind con `@theme`): `--bg #000`, `--surface #0a0a0a`, `--line #1f1f1f`, `--line-strong #2e2e2e`, `--text #ededed`, `--muted #8f8f8f`, `--blue #0070f3`, `--blue-soft #7dd3fc`, `--violet #7928ca`, `--violet-soft #c084fc`, `--ok #50e3c2`, `--warn #f5a623`, `--danger #ff6369`; espaciado base 4px; fuentes `--font-sans: "Geist Variable"`, `--font-mono: "Geist Mono Variable"`; clase `.gradient-text` (degradado `#fff → #7dd3fc 55% → #c084fc`), `.grid-bg` (rejilla tenue con máscara), `.glow-blue/.glow-violet` (orbes de luz decorativos, `aria-hidden`).
- `Button({variant: "primary" | "ghost" | "danger", loading?, disabledReason?, …})`: con `disabledReason` queda `aria-disabled` y muestra el motivo en un tooltip accesible; `loading` bloquea doble envío.
- `StatusText({tone: "ok" | "warn" | "danger" | "info" | "neutral", children})`: punto de color **y texto** (nunca solo color).
- `Stat({label, value, hint?, tone?, gradient?})`: cifra grande sin caja, con línea inferior fina.
- `EmptyState({title, description, action?})`, `ErrorState({error, onRetry})`, `Skeleton`, `ConfirmDialog` (`<dialog>` nativo, atrapa foco, Esc cierra), `Tabs`.
- `format.ts`: `formatDate(iso)`, `formatPercent(numerator, denominator) -> string` (devuelve `"—"` si el denominador es 0), `formatScore(n)`.
- `safeUrl.ts`: `safeHttpUrl(value: string): string | null` (solo `http:`/`https:`; elimina espacios; rechaza `javascript:`, `data:`, `vbscript:`, relativas y vacías).

- [ ] **Step 1: Write the failing tests:** `safeHttpUrl` (acepta `https://a.b/x`, rechaza `javascript:alert(1)`, ` JaVaScRiPt:1`, `data:text/html,x`, `//evil.com`, `""`); `formatPercent(0, 0) === "—"` y `formatPercent(1, 3) === "33%"`; `Button con disabledReason no ejecuta onClick y expone el motivo`; `Button loading ignora el segundo clic`; `StatusText incluye el texto además del color`; `ConfirmDialog cierra con Esc y devuelve el foco`.
- [ ] **Step 2: Run** → FAIL. **Step 3:** implementar. Configurar Tailwind v4 (`@import "tailwindcss"` + `@theme` con los tokens), fuentes autoalojadas, `prefers-reduced-motion` global, `:focus-visible` con anillo visible.
- [ ] **Step 4:** Antes de codificar los componentes, invocar la skill **ui-ux-pro-max:ui-ux-pro-max** para revisar contra su lista de pre-entrega (`references/pro-rules.md`) y la skill **impeccable:impeccable** (`document`/`shape` según su guía) para fijar el lenguaje visual; reflejar el resultado en `MASTER.md` reescribiéndolo con los tokens de arriba (el borrador generado usa una paleta pizarra/verde que **no** es la aprobada) y anotar las decisiones de contraste.
- [ ] **Step 5: Run** tests + `npm run build` → PASS. **Step 6: Commit** `feat: design tokens and base UI components`.

---

### Task 3: Gráficos dinámicos

**Files:** Create `src/shared/charts/{DonutChart,BarChart,HBars,Sparkline,chartData}.tsx|ts`; Test `src/shared/charts/charts.test.tsx`, `chartData.test.ts`

**Interfaces:**
- `chartData.ts` (puro): `verdictDistribution(stories: StoryItem[]) -> {ready: number; ready_with_notes: number; not_ready: number; unanalyzed: number; total: number}`; `scoreHistogram(stories, bins = 5) -> {label: string; count: number}[]` (rangos 0–19 … 80–100); `averageScore(stories) -> number | null` (null si ninguna tiene análisis); `casesByTechnique(cases) -> {technique: string; count: number}[]`; `resultCounts(executions) -> {passed, failed, blocked, not_run}`.
- `DonutChart({slices: {label, value, tone}[], centerLabel, centerValue})`, `BarChart({bars: {label, value}[], ariaLabel})`, `HBars({rows: {label, value, max}[]})`, `Sparkline({points: number[]})`: SVG con degradados, `role="img"` + `aria-label` con los valores, **tabla oculta visualmente** (`<table class="sr-only">`) con los datos; sin datos muestran el `EmptyState` indicado por la prop `emptyMessage`. Animación de entrada solo si no hay `prefers-reduced-motion`.

- [ ] **Step 1: Write the failing tests:** `verdictDistribution cuenta cada veredicto y las sin analizar` (3 listas: vacía, mezcla, todas sin analizar); `averageScore devuelve null sin análisis y nunca NaN`; `scoreHistogram agrupa 100 en el último rango`; `DonutChart con total 0 muestra el mensaje vacío y no renderiza arcos`; `DonutChart expone aria-label con cada cifra`; `BarChart escala la barra más alta al 100% y no divide por cero`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. **Step 5: Commit** `feat: dynamic SVG charts driven by real data`.

---

### Task 4: Shell de la aplicación, rutas y paleta de comandos

**Files:**
- Create: `src/app/{main,router,AppShell,providers,AuthGate,DemoBanner,CommandPalette}.tsx`, `src/test/renderApp.tsx`
- Modify: `index.html`, `src/main.tsx`
- Delete: `src/app/App*.tsx` y `App*.test.tsx`, `src/features/{analysis,import,qa-session,reports,stories,test-design}` (código antiguo; la lógica reutilizable —`parseCriteria`, etiquetas de `labels.ts`— se mueve primero a la nueva ubicación `src/shared/` o `src/features/*` correspondiente), `src/test/fakeApi.ts` se reescribe en la Tarea 6.
- Test: `src/app/router.test.tsx`, `CommandPalette.test.tsx`

**Interfaces:**
- Rutas (carga diferida por ruta con `lazy`): `/login`, `/` (lista de proyectos), `/p/:projectId` (resumen), `/p/:projectId/historias`, `/p/:projectId/historias/:storyId`, `/p/:projectId/historias/:storyId/pruebas`, `/p/:projectId/historias/:storyId/sesiones/:sessionId`, `/p/:projectId/importar`, `/p/:projectId/auditoria`, `/p/:projectId/ajustes`, `*` (404 amigable).
- `AppShell`: menú lateral (Resumen, Historias, Importar, Auditoría, Ajustes) con enlace de salto "Saltar al contenido"; en < 1024px el menú es un panel que se abre con botón (≥ 44px); barra superior con selector de proyecto, estado de sesión y botón de ayuda de atajos. Módulos aún no implementados (Análisis transversal, Métricas, Trazabilidad avanzada, Evaluación IA) aparecen como entradas **deshabilitadas con "Próximamente"**.
- `CommandPalette`: `Ctrl/Cmd+K` abre un diálogo con búsqueda; acciones: ir a cada pantalla del proyecto actual, cambiar de proyecto, iniciar/cerrar sesión. Navegable con flechas, Enter y Esc; el foco vuelve al origen.
- `AuthGate`: escucha `storylens:unauthorized`; muestra un diálogo "Tu sesión caducó" con formulario de login **sin cambiar de ruta**, y al ingresar reintenta la acción pendiente (Review Focus 1).
- `DemoBanner`: franja visible cuando el proyecto es demo: "Demo de solo lectura con datos ficticios · la IA está desactivada".

- [ ] **Step 1: Write the failing tests:** `las rutas cargan su pantalla` (cada URL monta el encabezado esperado); `ruta desconocida muestra 404 con enlace al inicio`; `Ctrl+K abre la paleta, filtra "audit" y Enter navega a auditoría`; `Esc cierra la paleta y devuelve el foco`; `un 401 abre el diálogo de sesión caducada sin cambiar la URL` (Review Focus 1); `el menú móvil se abre con el botón y se cierra al navegar`; `DemoBanner aparece solo en proyectos demo`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar; migrar `parseCriteria` y `labels` y borrar el código antiguo en este mismo commit. **Step 4:** `npm test`, `npm run build` → PASS. **Step 5: Commit** `feat: app shell, routing and command palette`.

---

### Task 5: Inicio de sesión y permisos de escritura

**Files:** Create `src/features/auth/{LoginPage,useSession}.tsx`, `src/shared/useCanWrite.ts`; Test `src/features/auth/auth.test.tsx`, `useCanWrite.test.tsx`

**Interfaces:**
- `useSession() -> {status: "loading" | "anonymous" | "owner"; email: string | null; login(email, password): Promise<void>; logout(): Promise<void>}`.
- `useCanWrite(project?: {is_demo: boolean}) -> {canWrite: boolean; reason: string | null}`: `reason` = "Inicia sesión para hacer cambios" (anónimo), "Demo de solo lectura" (proyecto demo, incluso para el dueño) o `null`.
- `LoginPage`: formulario con etiquetas visibles, error junto al campo ("Correo o contraseña incorrectos" para 401; "Demasiados intentos, espera unos minutos" para 429), botón con `loading`, enlace "Ver la demo sin iniciar sesión".

- [ ] **Step 1: Write the failing tests:** `login correcto guarda la sesión y redirige a /`; `401 muestra el error junto al campo y conserva el correo`; `429 muestra el mensaje de espera`; `useCanWrite: anónimo → reason de sesión; dueño en demo → "Demo de solo lectura"; dueño en proyecto propio → canWrite` (Review Focus 2); `logout vuelve a anónimo y limpia la caché de react-query`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. **Step 5: Commit** `feat: login flow and write permissions`.

---

### Task 6: Proyectos y panel de resumen

**Files:** Create `src/features/projects/{ProjectsPage,ProjectForm,OverviewPage,AttentionList}.tsx`, `src/test/fakeApi.ts` (reescrito: servidor simulado de la API con datos de proyectos/historias/análisis), Test `src/features/projects/projects.test.tsx`

**Interfaces:**
- `fakeApi.ts`: `installFakeApi(overrides?)` instala un `fetch` simulado con las rutas de la Fase A (proyectos, historias, análisis, casos, sesiones, auditoría, auth) y exporta fábricas `makeProject()`, `makeStory()`, `makeAnalysis()`, `makeCase()`, `makeSession()` que respetan los tipos generados.
- `ProjectsPage`: lista de proyectos (demo marcado), creación con `ProjectForm` (nombre ≤ 120, descripción, objetivo), estado vacío con acción.
- `OverviewPage` (maqueta aprobada): puntaje medio grande con degradado (`averageScore`, "—" si no hay análisis), `DonutChart` de historias por veredicto, `BarChart` del histograma de puntajes, métricas sin caja (historias, analizadas, bloqueadas, con criterios), lista "Historias que necesitan atención" (bloqueadas primero, luego "requieren aclaración", máx. 8) con ID, título, veredicto y puntaje, y los 5 últimos eventos de auditoría. Todo calculado de `useStories` y `listAudit`.

- [ ] **Step 1: Write the failing tests:** `lista los proyectos y marca la demo`; `crear proyecto envía el formulario y navega al resumen`; `nombre vacío o de 121 caracteres muestra error junto al campo`; `el resumen calcula el promedio y el donut a partir de las historias`; `un proyecto sin historias muestra estado vacío con acción "Crear historia" y ningún NaN` (Review Focus 3); `la lista de atención ordena bloqueadas primero`; `anónimo no ve "Nuevo proyecto" activo: está deshabilitado con motivo`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. **Step 5: Commit** `feat: projects list and overview dashboard`.

---

### Task 7: Historias y análisis

**Files:** Create `src/features/stories/{StoriesPage,StoryForm,StoryRow,StoryPage}.tsx`, `src/features/analysis/{AnalysisPanel,FindingItem,ScoreHero}.tsx`; Test `src/features/stories/stories.test.tsx`, `src/features/analysis/analysis.test.tsx`

**Interfaces:**
- `StoriesPage`: búsqueda por texto, filtros por épica/versión/veredicto, paginación en cliente (50/página), orden por fecha/puntaje; fila = ID corto (monoespaciada), título (truncado con `title`), veredicto (`StatusText`), puntaje. Crear historia en un panel lateral con `StoryForm` (título, descripción, criterios un-por-línea con `parseCriteria`, notas, épica, versión); el botón se deshabilita durante el envío (Review Focus 4).
- `StoryPage`: encabezado con título completo, descripción, criterios; botón "Analizar" (con opción "Usar IA" deshabilitada con motivo si no es dueño o la IA no está disponible; el estado sale de `GET /health`: `ai_configured` y `ai_quota_remaining_today`); `ScoreHero` (puntaje con degradado + veredicto); `FindingItem`: severidad, regla (ID monoespaciada) y fuente (regla/IA), mensaje, evidencia citada, sugerencia, referencia, botones Aceptar/Descartar (descartar pide motivo ≥ 1 carácter); historial de análisis; avisos cuando `ai_status` ≠ `ok` ("La IA no estuvo disponible: se usaron solo las reglas").
- Los bloqueantes se muestran **separados y primero**, aunque el puntaje sea alto.

- [ ] **Step 1: Write the failing tests:** `filtra por veredicto y por texto`; `500 historias se paginan a 50 y navegan sin congelar` (Review Focus 5, usar 500 fábricas); `título de 300 caracteres no desborda y conserva el texto completo en title`; `doble clic en Crear envía una sola petición` y `fallo de red muestra el error con "Reintentar"` (Review Focus 4); `analizar sin IA muestra los hallazgos con bloqueantes primero`; `descartar un hallazgo sin motivo no se envía`; `aceptar un hallazgo actualiza el puntaje mostrado`; `ai_status unavailable muestra el aviso de solo reglas`; `el texto con <script> se muestra como texto`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. **Step 5: Commit** `feat: stories list, story page and analysis review`.

---

### Task 8: Importación

**Files:** Create `src/features/import/{ImportPage,MappingStep,PreviewTable}.tsx`; Test `src/features/import/import.test.tsx`

**Interfaces:** Asistente de 3 pasos (Archivo → Mapeo y vista previa → Confirmar). Subida CSV/JSON (≤ 1 MB, validado en cliente), tabla de vista previa con filas inválidas y duplicadas marcadas **con texto** (no solo color), casillas de selección (las no importables quedan deshabilitadas), selector de columna para cada campo (`title`, `description`, `acceptance_criteria`, `key`), contador "N de M seleccionadas", resultado final con enlace a las historias creadas.

- [ ] **Step 1: Write the failing tests:** `sube un CSV, muestra la vista previa y marca duplicadas e inválidas con su motivo`; `cambiar el mapeo vuelve a pedir la vista previa`; `la selección se conserva al cambiar de paso` (Review Focus 8); `archivo > 1 MB se rechaza en cliente con mensaje`; `archivo mal formado muestra el error del servidor (422) y permite elegir otro`; `confirmar envía solo las filas seleccionadas`; `anónimo ve el asistente deshabilitado con motivo`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. **Step 5: Commit** `feat: import wizard`.

---

### Task 9: Diseño de pruebas

**Files:** Create `src/features/test-design/{TestDesignPage,CaseCard,CaseEditor,TraceabilityView,GherkinPanel,GenerateDialog}.tsx`; Test `src/features/test-design/test-design.test.tsx`

**Interfaces:** Pantalla `/historias/:storyId/pruebas`: lista de casos con filtros por estado (propuesto/aceptado/rechazado) y técnica; acciones aceptar/rechazar/restaurar; editor (título, precondiciones, pasos reordenables, datos, resultado esperado, prioridad, criterio vinculado); alta manual; `GenerateDialog` con selección de técnicas (requiere IA: deshabilitado con motivo si no está disponible); `GherkinPanel` con escenarios sugeridos; `TraceabilityView`: matriz criterio × casos con **cobertura calculada del servidor** (`TraceabilityOut`) y gráfico de casos por técnica (`casesByTechnique`); criterios sin cobertura resaltados con texto. Pasos y Gherkin en bloque monoespaciado con espaciado generoso.

- [ ] **Step 1: Write the failing tests:** `lista y filtra casos por estado y técnica`; `aceptar y rechazar actualizan la cobertura mostrada`; `el editor valida título y resultado esperado obligatorios`; `crear un caso manual con criterio inexistente muestra el error del servidor`; `generar casos sin IA muestra el motivo y no llama a la API`; `generar con IA reemplaza solo las propuestas no revisadas (mensaje del servidor)`; `la matriz marca los criterios sin cobertura con texto`; `el gráfico por técnica refleja los casos`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. **Step 5: Commit** `feat: test design workspace`.

---

### Task 10: Sesiones QA

**Files:** Create `src/features/qa-session/{SessionsPanel,NewSessionDialog,SessionPage,ChecklistSection,ExecutionCard,EvidenceList,DefectEditor,CloseSessionForm,labels}.tsx`; Test `src/features/qa-session/qa-session.test.tsx`

**Interfaces:** Lista de sesiones por historia (en `StoryPage`), creación (entorno, URL, build, tester; casos aceptados), `SessionPage`: barra de progreso con `resultCounts` (gráfico de anillo + conteos), checklist por fase, tarjeta por ejecución (resultado passed/failed/blocked/not_run, resultado real, notas), evidencias (enlace, nota, imagen ≤ 1 MB; las imágenes se muestran con `<img>` desde `/evidences/{id}/file`), borrador de defecto para ejecuciones fallidas (con IA opcional, siempre editable), cierre con recomendación sugerida por el servidor y confirmación. Sesión cerrada = solo lectura. Los enlaces de evidencia se pasan por `safeHttpUrl` y si no son seguros se muestran como texto plano con la etiqueta "enlace no seguro" (Review Focus 6).

- [ ] **Step 1: Write the failing tests:** `crear una sesión con los casos aceptados`; `marcar resultados actualiza el anillo de progreso`; `no se puede cerrar con casos pendientes y se explica`; `cerrar con la recomendación sugerida muestra la sesión de solo lectura`; `subir una imagen > 1 MB muestra el error del servidor (413)`; `evidencia con enlace javascript: se muestra como texto y no es un <a>` (Review Focus 6); `el borrador de defecto solo aparece en ejecuciones fallidas y es editable`; `sesión cerrada deshabilita todos los controles con motivo`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. **Step 5: Commit** `feat: QA sessions workspace`.

---

### Task 11: Informes, auditoría y ajustes del proyecto

**Files:** Create `src/features/reports/ReportLinks.tsx`, `src/features/audit/AuditPage.tsx`, `src/features/settings/{SettingsPage,ThresholdEditor,RuleToggles,GroupsManager}.tsx`; Test `reports.test.tsx`, `audit.test.tsx`, `settings.test.tsx`

**Interfaces:**
- `ReportLinks({kind, id})`: descargas Markdown y PDF con `reportUrl` (`download` y nombre claro).
- `AuditPage`: línea de tiempo paginada (50 por página) con acción legible en español, actor, entidad (ID monoespaciada) y fecha relativa + absoluta; filtro por acción.
- `SettingsPage`: edición de nombre/objetivo; `ThresholdEditor` (dos controles numéricos enlazados: "no lista por debajo de" < "lista desde", con vista previa del efecto sobre el histograma actual), `RuleToggles` (reglas del catálogo desde `GET /rules`, con severidad y referencia), pesos por severidad, `GroupsManager` (crear épicas y versiones); validación en cliente igual a la del servidor (0 ≤ no lista < lista ≤ 100) y muestra el 422 del servidor si aun así falla. Un bloqueante siempre deja "no lista": el texto de ayuda lo dice.

- [ ] **Step 1: Write the failing tests:** `los enlaces de informe apuntan a la URL con el formato correcto`; `la auditoría pagina y traduce las acciones`; `ThresholdEditor impide umbrales incoherentes antes de enviar`; `guardar ajustes envía solo los campos cambiados`; `desactivar una regla actualiza la lista y muestra la confirmación`; `crear una épica la añade a los filtros de historias`; `anónimo/demo ve los ajustes en solo lectura con motivo`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. **Step 5: Commit** `feat: reports, audit and project settings`.

---

### Task 12: Accesibilidad, responsive y pulido visual

**Files:** Create `src/test/axe.ts`, `src/app/a11y.test.tsx`; Modify estilos/componentes según hallazgos

**Interfaces:** `expectNoAxeViolations(container)` ejecuta `axe-core` (reglas `wcag2a`, `wcag2aa`, `wcag22aa`) y falla con el listado de violaciones.

- [ ] **Step 1: Write the failing tests** (`a11y.test.tsx`, una por pantalla con datos de `fakeApi`): `login`, `proyectos`, `resumen`, `historias`, `historia con análisis`, `importar`, `pruebas`, `sesión`, `auditoría`, `ajustes` → `expectNoAxeViolations`. Más: `todas las pantallas se pueden recorrer con Tab sin trampas de foco`; `con prefers-reduced-motion no hay animaciones de entrada` (comprobar la clase/atributo que desactiva la animación).
- [ ] **Step 2:** FAIL (esperado: contrastes, nombres accesibles) → **Step 3:** corregir hasta PASS.
- [ ] **Step 4: Revisión visual real.** Levantar backend (`uvicorn app.main:app` con `OWNER_EMAIL`, `OWNER_PASSWORD`, `SESSION_SECRET` de prueba en una base temporal) y frontend (`npm run dev`); con el MCP de Playwright abrir la app, iniciar sesión y capturar pantallazos de resumen, historia, pruebas y sesión en **375, 768, 1024 y 1440 px**. Comprobar: sin scroll horizontal, objetivos ≥ 44px, el menú móvil, textos largos, contraste de las cifras con degradado (Review Focus 7). Guardar las capturas en `design-system/storylens-qa/screenshots/` (versionadas, ≤ 1 MB cada una).
- [ ] **Step 5: Pulido con Impeccable.** Ejecutar la skill **impeccable:impeccable** con `audit` y luego `polish` sobre las pantallas principales; aplicar solo los cambios que mantengan la estética aprobada (negro, texto sin cajas, gradientes, gráficos flotantes) y registrar en el ledger cada sugerencia rechazada.
- [ ] **Step 6:** `npm run lint`, `format:check`, `test`, `build` → verdes. **Commit** `feat: accessibility and responsive polish`.

---

### Task 13: Preparación para el despliegue gratuito de la demo

**Files:** Create `frontend/vercel.json`, `frontend/.env.example`, `docs/09-despliegue-gratuito.md`; Modify `.github/workflows/ci.yml`, `frontend/package.json`

**Interfaces:** El frontend llama siempre a `/api/v1` (mismo origen); en producción `vercel.json` reescribe `/api/(.*)` hacia la URL del backend (`BACKEND_URL`, **sin valor por defecto**) para que la cookie `SameSite=Lax` funcione (ADR-004). `docs/09` explica paso a paso, **sin tarjeta**, cómo publicar frontend y backend en planes gratuitos, qué variables definir (`OWNER_EMAIL`, `OWNER_PASSWORD`, `SESSION_SECRET`, `COOKIE_SECURE=true`, `GEMINI_*` opcionales, `DATABASE_URL` de Neon/Supabase con `.[postgres]`), cómo comprobarlo (`/api/v1/health`, abrir la demo anónima) y qué hacer si el backend "duerme". **Antes de escribirlo, verificar en la documentación oficial vigente de cada proveedor que el plan gratuito sigue sin pedir tarjeta**; si alguno la pide, descartarlo y proponer otro.

- [ ] **Step 1:** Ampliar el job `frontend` de CI con `npm run lint`, `format:check`, `test` y `build` (ya existen; confirmar que corren la suite nueva).
- [ ] **Step 2:** Presupuesto de bundle: añadir una comprobación (`npm run build` + script que lee `dist/assets/*.js`, comprime con gzip y falla si el chunk inicial supera 200 KB). Test del script con archivos de ejemplo.
- [ ] **Step 3:** Redactar `docs/09-despliegue-gratuito.md` y `vercel.json`. **No publicar nada**: crear cuentas, claves o subir código a un proveedor requiere al dueño; la tarea termina con la guía lista y el aviso explícito.
- [ ] **Step 4:** Suite completa verde. **Commit** `chore: free-tier deployment guide and CI checks`.

---

## Fuera de esta fase

Análisis transversal, métricas avanzadas, trazabilidad entre versiones, evaluación de IA en la app (Fases D, E y F); E2E con Playwright, Docker y despliegue efectivo (Fase G). La demo sembrada solo trae historias y análisis: sesiones, defectos y evaluaciones de ejemplo se añaden cuando esas fases existan.
