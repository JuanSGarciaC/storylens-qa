# 01 — Visión y alcance

## Problema

Las historias de usuario llegan a QA con criterios de aceptación vagos, incompletos o imposibles de verificar. El analista descubre el problema **durante** la prueba en el ambiente QA, cuando corregirlo ya es caro. Además, la revisión en el ambiente (preparación, evidencias, reporte de defectos) suele hacerse de forma manual e inconsistente.

## Usuario objetivo

- **Analista QA / tester** (principal): revisa historias antes de probar y ejecuta la revisión en el ambiente QA.
- **Secundario**: PO o desarrollador que quiere saber si su historia está lista (*Definition of Ready*).

## Propuesta de valor

"Pega una historia de usuario y en segundos sabes si es testeable, qué le falta, qué casos de prueba aplicar y cómo documentar la revisión en el ambiente QA, con cada hallazgo vinculado a la norma que lo justifica."

## Objetivos

1. Detectar problemas de calidad de la historia **antes** de la ejecución (*shift-left*).
2. Explicar cada hallazgo y vincularlo a una norma o buena práctica concreta.
3. Proponer criterios de aceptación en Gherkin y casos de prueba con técnicas formales.
4. Estandarizar la revisión en el ambiente QA (checklist, evidencias, defectos).
5. Como portafolio: demostrar arquitectura limpia, uso responsable de IA y una estrategia de pruebas sólida.

## No-objetivos (fuera del alcance de la v1)

- Ejecutar pruebas automatizadas contra la aplicación bajo prueba.
- Integración bidireccional con Jira/Azure DevOps (solo importación por CSV/JSON).
- Multiusuario, roles y autenticación corporativa (SSO).
- Reemplazar el criterio del QA: la IA **sugiere**, el usuario **decide**.

## Antiobjetivos (lo que haría fracasar el proyecto aunque funcione)

- Hallazgos de IA presentados como verdad sin explicación ni opción de descartarlos.
- Exponer la API key de Gemini en el navegador.
- Un puntaje "mágico" sin trazabilidad a reglas.
- Depender por completo de la IA: sin conexión o sin cuota, el motor de reglas debe seguir funcionando.

## Funcionalidades

### Módulo A — Ingreso de historias
- A1. Formulario: título, descripción ("Como… quiero… para…"), criterios de aceptación, notas, prioridad.
- A2. Importación desde CSV/JSON exportado de Jira (mapeo de columnas).
- A3. Historial de historias analizadas.

### Módulo B — Análisis de calidad de la historia
- B1. Motor de reglas determinístico (ver catálogo en doc 02).
- B2. Análisis con IA: ambigüedades semánticas, criterios faltantes, riesgos, requisitos no funcionales implícitos (ISO/IEC 25010).
- B3. Puntaje de preparación (0–100) y veredicto: *Lista*, *Lista con observaciones*, *No lista*.
- B4. Cada hallazgo: severidad, regla/norma de origen, evidencia (fragmento del texto), sugerencia; el usuario puede aceptarlo o descartarlo con un motivo.

### Módulo C — Diseño de pruebas
- C1. Reescritura sugerida de criterios en Gherkin (Dado/Cuando/Entonces).
- C2. Casos de prueba sugeridos por técnica ISTQB: partición de equivalencia, valores límite, tabla de decisión, transición de estados, casos de error.
- C3. Matriz de trazabilidad criterio ↔ caso de prueba.
- C4. Edición manual y exportación de casos.

### Módulo D — Sesión de revisión en ambiente QA
- D1. Crear una sesión: ambiente, URL, versión/build, fecha, datos de prueba.
- D2. Checklist de preparación (ambiente disponible, versión desplegada correcta, datos cargados, accesos, dependencias).
- D3. Ejecución: marcar cada caso como Pasó / Falló / Bloqueado / No ejecutado y adjuntar evidencia (captura, nota, enlace).
- D4. Borrador de defecto a partir de un caso fallido (estructura ISO/IEC/IEEE 29119-3), con la IA ayudando a redactar pasos y resultado esperado/obtenido.

### Módulo E — Reportes
- E1. Reporte de análisis de la historia (Markdown/PDF).
- E2. Reporte de sesión QA: resumen de ejecución, defectos y recomendación (aceptar / rechazar la historia).

## Métricas de éxito (para el portafolio)

- El motor de reglas detecta ≥ 90 % de los hallazgos esperados del conjunto de referencia (doc 06).
- Respuesta del análisis completo (reglas + IA) en < 10 s (p95).
- 0 claves expuestas en el frontend (verificado en CI).
- Cobertura ≥ 85 % en la capa de dominio del backend.
- Accesibilidad WCAG 2.2 AA sin violaciones críticas (axe).
