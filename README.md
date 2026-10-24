# StoryLens QA
## Plataforma inteligente de análisis de requisitos, diseño de pruebas y gestión de calidad de software

**Versión del documento:** 2.0 — Propuesta de evolución del proyecto  
**Tipo:** Proyecto de portafolio de Software Quality Engineering  
**Enfoque:** QA, Requirements Engineering, Test Design, Quality Analytics e IA generativa.

---

## 1. Visión del producto

StoryLens QA es una plataforma web que permite a analistas QA, analistas de negocio y equipos de desarrollo evaluar la calidad de múltiples historias de usuario, identificar riesgos antes de iniciar las pruebas, diseñar casos de prueba trazables, gestionar sesiones de ejecución y generar informes de calidad a nivel individual y de proyecto.

La plataforma combina un motor de reglas determinístico con inteligencia artificial para detectar deficiencias en los requisitos, proponer mejoras, generar criterios de aceptación y diseñar pruebas basadas en técnicas reconocidas de testing.

Su objetivo es transformar información funcional dispersa en un proceso de calidad estructurado, medible, reproducible y auditable.

StoryLens QA no se limita a generar recomendaciones. Mantiene la trazabilidad entre requisitos, hallazgos, criterios de aceptación, casos de prueba, ejecuciones, evidencias, defectos e informes.

### Propuesta de valor

- Detectar problemas de requisitos antes de que se conviertan en defectos durante el desarrollo o la ejecución de pruebas.
- Analizar historias de manera individual y colectiva.
- Reducir el trabajo manual de diseño y documentación de pruebas.
- Identificar riesgos y vacíos de cobertura.
- Proporcionar evidencia cuantificable sobre la calidad del proyecto.
- Recomendar mejoras concretas y permitir evaluar su efecto.
- Mantener la supervisión humana sobre las decisiones importantes.

## 2. Objetivos

### Objetivo general

Construir una plataforma de Quality Engineering asistida por IA que permita gestionar el ciclo de calidad desde la revisión de requisitos hasta la ejecución de pruebas y la generación de informes consolidados.

### Objetivos específicos

1. Importar y organizar historias de usuario de distintas fuentes.
2. Evaluar su calidad mediante reglas configurables y análisis semántico.
3. Identificar ambigüedades, omisiones, contradicciones, dependencias y riesgos.
4. Proponer versiones mejoradas de las historias y sus criterios de aceptación.
5. Generar casos de prueba con técnicas de diseño apropiadas.
6. Medir la cobertura y la trazabilidad de las pruebas.
7. Gestionar sesiones QA, evidencias y borradores de defectos.
8. Consolidar métricas y generar informes ejecutivos y técnicos.
9. Evaluar la calidad y consistencia de las respuestas de la IA.
10. Mantener un historial de cambios y decisiones para facilitar auditorías y comparaciones.

## 3. Alcance funcional

### Módulo 1. Gestión de proyectos

Cada proyecto tendrá un espacio de trabajo independiente con:

- Nombre, descripción y objetivo.
- Producto, módulo, épica, sprint o versión.
- Historias importadas y estado de revisión.
- Resultados de análisis y recomendaciones.
- Casos de prueba y sesiones de ejecución.
- Defectos registrados.
- Informes históricos y métricas.
- Configuración de reglas y parámetros de análisis.

Los datos de distintos proyectos deberán mantenerse aislados.

### Módulo 2. Importación y gestión de historias

La plataforma permitirá crear historias manualmente e importarlas desde CSV y JSON, con posibilidad de ampliar la integración con Jira mediante API.

Funciones:

- Vista previa antes de importar.
- Mapeo de columnas y validación de campos.
- Identificadores externos para conservar la trazabilidad.
- Detección de duplicados.
- Identificación de filas inválidas.
- Selección de registros que se desea importar.
- Clasificación por épica, módulo, prioridad y etiquetas.
- Actualización controlada de historias existentes.
- Seguimiento del estado de procesamiento de cada historia.

Las importaciones masivas deberán ejecutarse mediante trabajos por lotes, con progreso, resultados parciales, manejo de errores y reintentos seguros.

### Módulo 3. Motor de calidad de requisitos

El motor determinístico evaluará aspectos verificables de la historia sin depender de un modelo generativo.

Áreas de evaluación:

- Estructura y completitud.
- Claridad del rol, necesidad y beneficio.
- Independencia, negociabilidad, valor, estimabilidad, tamaño y verificabilidad de INVEST.
- Presencia y calidad estructural de los criterios de aceptación.
- Ambigüedades y términos subjetivos.
- Condiciones límite y escenarios de error.
- Consistencia entre historia y criterios.
- Dependencias y posibles contradicciones.
- Trazabilidad y referencias a requisitos relacionados.

Cada regla tendrá un identificador estable, una descripción, una categoría, una severidad, una explicación, una recomendación y una referencia normativa cuando exista justificación documental.

La evaluación normativa no afirmará conformidad certificada con una norma. Distinguirá entre requisitos explícitos, buenas prácticas derivadas y heurísticas propias de la herramienta.

### Módulo 4. Análisis asistido por IA

Gemini complementará las reglas determinísticas mediante análisis semántico y generación controlada de propuestas.

Capacidades:

- Detectar vacíos funcionales.
- Señalar ambigüedades difíciles de evaluar mediante reglas simples.
- Proponer preguntas de aclaración para negocio.
- Recomendar una redacción mejorada de la historia.
- Proponer criterios de aceptación en Gherkin.
- Sugerir escenarios positivos, negativos y alternativos.
- Detectar posibles contradicciones entre historias relacionadas.
- Explicar los riesgos y justificar las recomendaciones.

Cada hallazgo incluirá su origen —regla, IA o ambos—, la evidencia textual, la explicación, la severidad sugerida, la acción recomendada y su estado de revisión humana.

Las sugerencias generadas por IA no se incorporarán automáticamente al requisito original.

### Módulo 5. Análisis transversal del conjunto de historias

Además del análisis individual, la plataforma evaluará el conjunto de requisitos.

Funciones:

- Identificar historias duplicadas o muy similares.
- Detectar dependencias explícitas e implícitas.
- Encontrar criterios contradictorios.
- Identificar flujos funcionales incompletos.
- Detectar historias sin criterios de aceptación.
- Encontrar requisitos sin casos de prueba.
- Identificar riesgos concentrados en módulos o épicas.
- Señalar posibles duplicidades en los casos de prueba.
- Identificar elementos que requieren aclaración antes de planificar la ejecución.

Las relaciones inferidas por IA se mostrarán como hipótesis que deben validarse, no como hechos confirmados.

### Módulo 6. Diseño y gestión de casos de prueba

La plataforma generará propuestas de casos de prueba a partir de las historias y sus criterios aceptados.

Técnicas contempladas:

- Partición de equivalencia.
- Análisis de valores límite.
- Tablas de decisión.
- Transición de estados.
- Pruebas positivas y negativas.
- Pruebas basadas en escenarios y flujos alternativos.
- Pruebas exploratorias sugeridas cuando sean apropiadas.

Cada caso contendrá identificador, objetivo, precondiciones, datos de prueba, pasos, resultado esperado, prioridad, técnica aplicada y vínculos con los criterios de aceptación que cubre.

Funciones adicionales:

- Aceptar, rechazar y editar casos sugeridos.
- Detectar casos redundantes.
- Identificar criterios sin cobertura.
- Calcular cobertura de criterios.
- Priorizar casos según riesgo.
- Exportar casos en formatos documentales o estructurados.

La cobertura se calculará mediante relaciones explícitas y verificables entre criterios y casos, no mediante estimaciones libres del modelo.

### Módulo 7. Sesiones de ejecución QA

Las sesiones agruparán los casos de prueba seleccionados para una ronda de validación.

Funciones:

- Crear sesiones por proyecto, versión o conjunto de historias.
- Preparar el entorno mediante checklist.
- Registrar estados: pendiente, aprobado, fallido, bloqueado y no ejecutado.
- Registrar resultados reales y compararlos con los esperados.
- Adjuntar notas, enlaces e imágenes como evidencias.
- Mantener la relación entre ejecución, caso, criterio e historia.
- Generar borradores de defectos para los casos fallidos.
- Registrar severidad, prioridad, pasos para reproducir y comportamiento observado.
- Cerrar sesiones conservando su historial.

La severidad y prioridad podrán derivarse de reglas configuradas y decisiones humanas. La IA podrá mejorar la redacción de un defecto, pero no sustituirá la evidencia ni modificará silenciosamente los resultados registrados.

### Módulo 8. Informes de calidad

StoryLens QA generará informes individuales, por grupo de historias y a nivel de proyecto.

**Informe de análisis de requisitos**

- Puntuación de calidad por historia.
- Hallazgos agrupados por categoría y severidad.
- Historias que requieren aclaración.
- Principales ambigüedades y omisiones.
- Recomendaciones de mejora.
- Comparación entre redacción original y propuesta.
- Referencias a reglas y criterios de evaluación.

**Informe de diseño de pruebas**

- Casos generados, aceptados y rechazados.
- Distribución por técnica.
- Cobertura de criterios de aceptación.
- Criterios sin pruebas.
- Riesgos no cubiertos.
- Casos potencialmente redundantes.

**Informe de ejecución QA**

- Casos aprobados, fallidos, bloqueados y pendientes.
- Evidencias asociadas.
- Defectos registrados y su estado.
- Resultados por historia, módulo y versión.
- Riesgos pendientes de resolución.

**Informe ejecutivo del proyecto**

- Estado general de la calidad.
- Historias listas, condicionadas y bloqueadas.
- Distribución de riesgos.
- Cobertura de requisitos y pruebas.
- Principales problemas recurrentes.
- Recomendaciones priorizadas.
- Limitaciones de los datos y aspectos que necesitan validación.

Los informes estarán disponibles en Markdown y PDF, con exportación estructurada para facilitar análisis posteriores.

### Módulo 9. Métricas y mejora continua

La plataforma mantendrá indicadores con definiciones explícitas y denominadores visibles.

Indicadores iniciales:

- Porcentaje de historias con criterios de aceptación.
- Porcentaje de historias sin bloqueantes conocidos.
- Hallazgos por historia y por categoría.
- Distribución de historias según su nivel de preparación.
- Cobertura de criterios de aceptación por casos de prueba.
- Porcentaje de casos ejecutados.
- Tasa de aprobación de casos ejecutados.
- Defectos por módulo y severidad.
- Porcentaje de hallazgos resueltos o rechazados.
- Evolución de la calidad entre versiones.
- Diferencia de puntuación antes y después de aceptar mejoras.

La plataforma distinguirá entre métricas de calidad de requisitos, diseño de pruebas y ejecución. Una historia con una puntuación alta no implica que el software esté libre de defectos.

### Módulo 10. Evaluación de la IA

Se incorporará un subsistema de evaluación que permita comprobar la utilidad de los resultados generados.

Funciones:

- Conjunto de historias de referencia con evaluaciones esperadas.
- Comparación entre respuestas de distintas versiones de prompts.
- Validación de esquemas y consistencia de datos.
- Medición de hallazgos correctos, incorrectos y omitidos cuando exista una referencia de evaluación.
- Evaluación de la validez de los casos de prueba.
- Pruebas de inyección de prompts y contenido malicioso.
- Registro de modelo, configuración, prompt y fecha.
- Informe de calidad y regresión de resultados.
- Comparación del modo determinístico con el modo asistido por IA.

Los resultados de evaluación deberán interpretarse con criterios documentados y revisión humana. La fluidez de una respuesta no se considerará evidencia de exactitud.

## 4. Modelo de calidad y puntuación

Cada historia tendrá una puntuación de calidad de 0 a 100 basada en dimensiones configurables, por ejemplo:

- Completitud.
- Claridad y ausencia de ambigüedad.
- Verificabilidad.
- Calidad de los criterios de aceptación.
- Consistencia y trazabilidad.

La ponderación y los umbrales serán configurables y estarán documentados. Las penalizaciones por hallazgos deberán evitar contabilizar varias veces el mismo problema.

Los bloqueantes conocidos se mostrarán por separado: una puntuación agregada no podrá ocultar un problema crítico.

Los resultados distinguirán entre:

- **Preparada:** cumple los controles definidos y no presenta bloqueantes conocidos.
- **Preparada con observaciones:** tiene riesgos o mejoras pendientes que no impiden necesariamente comenzar.
- **Requiere aclaración:** faltan decisiones o información necesaria.
- **Bloqueada:** existe una condición impeditiva identificada.
- **Sin evaluar:** no se dispone de resultados suficientes.

Estas categorías representan el criterio de la herramienta y deberán poder ajustarse a las políticas del equipo.

## 5. Arquitectura técnica

### Frontend

- React.
- Vite.
- TypeScript.
- Tailwind CSS.
- Vitest.
- Testing Library.
- Playwright.
- axe-core.

Interfaz organizada en proyectos, historias, análisis, casos de prueba, sesiones QA, defectos e informes.

### Backend

- Python 3.12 o superior.
- FastAPI.
- Pydantic v2.
- SQLModel.
- SQLite para desarrollo.
- PostgreSQL como opción para despliegues con múltiples usuarios.
- Alembic para migraciones.
- pytest.
- Ruff y mypy.

### Inteligencia artificial

- Gemini API mediante el SDK `google-genai`.
- Adaptador desacoplado del proveedor.
- Salidas estructuradas y validadas.
- Prompts versionados por tarea.
- Límites de consumo, tiempos de espera y reintentos.
- Degradación controlada al motor determinístico.
- Evaluaciones automatizadas con datos de referencia.

### Procesamiento masivo

Para cargas grandes, el análisis se ejecutará mediante trabajos asíncronos o una cola de tareas cuando el volumen lo justifique.

Cada trabajo tendrá identificador, estado, progreso, resultados parciales y errores recuperables. Se evitará mantener una petición HTTP abierta durante análisis prolongados.

### Persistencia

Entidades principales:

- Project
- Epic o agrupación funcional
- UserStory
- AcceptanceCriterion
- AnalysisRun
- Finding
- ImprovementProposal
- TestCase
- TestCaseCriterionLink
- QASession
- TestExecution
- Evidence
- DefectDraft
- Report
- EvaluationRun
- AuditEvent

Las relaciones y restricciones garantizarán la trazabilidad y evitarán que una modificación posterior altere silenciosamente los resultados históricos.

## 6. Seguridad, confiabilidad y costos

- La clave de Gemini permanecerá exclusivamente en el backend.
- Los secretos no se incluirán en el repositorio.
- Las entradas importadas se tratarán como datos no confiables.
- Las instrucciones incluidas dentro de una historia no podrán modificar las políticas del sistema.
- Se validarán los tipos, tamaños y formatos de las entradas.
- Las evidencias y enlaces se validarán según políticas de seguridad.
- Se establecerán límites de peticiones, concurrencia y consumo.
- Se aplicarán permisos por proyecto si se habilita acceso multiusuario.
- Se registrarán las operaciones relevantes sin exponer secretos.
- Se permitirá ejecutar análisis determinísticos cuando la IA no esté disponible.
- Los cambios de reglas, prompts o modelos quedarán versionados para interpretar correctamente los resultados históricos.

## 7. Estrategia de pruebas

**Backend**

- Pruebas unitarias del motor de reglas y de puntuación.
- Pruebas de contratos y validación de datos.
- Pruebas de persistencia y migraciones.
- Pruebas de importación, duplicados y procesamiento masivo.
- Pruebas de trazabilidad y permisos.
- Pruebas de integración con el adaptador de IA.
- Pruebas de recuperación ante errores y límites de consumo.

**Frontend**

- Pruebas de componentes.
- Pruebas de formularios, tablas y filtros.
- Pruebas de revisión humana de hallazgos.
- Pruebas de progreso y errores en importaciones.
- Pruebas de visualización y exportación de informes.
- Pruebas de accesibilidad.

**End-to-end**

- Importar un conjunto de historias.
- Ejecutar un análisis completo.
- Revisar y aceptar recomendaciones.
- Generar y aprobar casos de prueba.
- Ejecutar casos y registrar evidencias.
- Crear un borrador de defecto.
- Generar el informe consolidado.

**Evaluación de IA**

- Exactitud y utilidad de los hallazgos.
- Calidad y verificabilidad de los casos generados.
- Consistencia entre ejecuciones.
- Resistencia a inyección de prompts.
- Regresión entre versiones de prompts y modelos.

## 8. Roadmap de evolución

### Fase 6 — Consolidación del producto

- Completar las pruebas E2E.
- Validar CI y configuración de contenedores.
- Completar la integración real con Gemini.
- Verificar la experiencia de usuario.
- Añadir un modo demo con datos ficticios.

### Fase 7 — Gestión de proyectos e importación masiva

- Crear espacios de trabajo.
- Agrupar historias por épica y versión.
- Gestionar lotes de importación.
- Añadir procesamiento asíncrono, progreso y reintentos.
- Consolidar los resultados de múltiples historias.

### Fase 8 — Análisis transversal e inteligencia de calidad

- Detectar duplicidades y dependencias.
- Identificar contradicciones entre historias.
- Añadir panel de métricas por proyecto.
- Incorporar riesgos agregados y recomendaciones priorizadas.

### Fase 9 — Trazabilidad avanzada y mejora continua

- Ampliar la matriz requisito–criterio–caso–ejecución–defecto.
- Comparar versiones de historias.
- Medir el efecto de las mejoras aceptadas.
- Conservar historial de análisis e informes.

### Fase 10 — Evaluación avanzada de IA

- Crear un conjunto de referencia.
- Comparar prompts y modelos.
- Medir precisión, omisiones y falsos positivos.
- Automatizar pruebas de regresión y seguridad.

### Fase 11 — Despliegue y presentación profesional

- Desplegar el backend y frontend.
- Migrar a PostgreSQL cuando sea necesario.
- Configurar observabilidad y gestión de secretos.
- Documentar API y arquitectura.
- Preparar un proyecto de demostración completo.
- Publicar ejemplos de informes y métricas de evaluación.

## 9. Criterios generales de terminado

El producto se considerará listo para una demostración integral cuando pueda:

1. Importar múltiples historias de forma fiable.
2. Analizarlas con reglas determinísticas e IA opcional.
3. Identificar y priorizar problemas individuales y transversales.
4. Proponer mejoras y conservar las decisiones humanas.
5. Generar casos de prueba trazables.
6. Ejecutar casos y asociar evidencias y defectos.
7. Calcular métricas con definiciones documentadas.
8. Generar informes individuales y consolidados.
9. Recuperarse de fallos de IA sin perder los resultados ya guardados.
10. Superar las pruebas automatizadas y ejecutarse en un entorno desplegado.
11. Demostrar la calidad de sus resultados mediante un conjunto de evaluación reproducible.
12. Explicar el origen de los hallazgos y las limitaciones de sus conclusiones.

## 10. Resultado esperado

StoryLens QA será una plataforma demostrable de ingeniería de calidad que integra análisis de requisitos, generación de pruebas, gestión de ejecución y analítica de calidad en un mismo flujo.

Su principal diferenciador será combinar automatización determinística, IA supervisada por humanos, trazabilidad integral y métricas verificables para ayudar a los equipos a decidir qué revisar, qué probar, qué riesgos resolver y dónde invertir el esfuerzo de QA.
