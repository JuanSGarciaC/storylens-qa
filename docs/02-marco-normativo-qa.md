# 02 — Marco normativo QA

Este documento define **qué normas usa la herramienta** y **cómo se traducen en reglas verificables**. Es el corazón del producto: cada hallazgo debe apuntar a una entrada de este catálogo.

> Las normas ISO/IEEE tienen derechos de autor: cita la norma y la cláusula, pero redacta los mensajes con tus propias palabras. No copies el texto de las normas en el repositorio.

## 1. Normas y referencias vigentes

| Referencia | Versión | Para qué se usa en la herramienta |
|-----------|---------|-----------------------------------|
| **ISTQB CTFL Syllabus** | v4.0 (2023) | Técnicas de diseño de pruebas, ATDD/BDD, *shift-left*, revisiones, gestión de defectos |
| **ISO/IEC/IEEE 29119** (partes 1–5) | 29119-1:2022, -2:2021, -3:2021, -4:2021 | Proceso de pruebas, plantillas de documentación (reporte de incidentes, reporte de finalización) y técnicas |
| **ISO/IEC 25010** | 2023 | Modelo de calidad de producto: 9 características para detectar requisitos no funcionales faltantes |
| **ISO/IEC/IEEE 29148** | 2018 | Características de un buen requisito (necesario, no ambiguo, completo, singular, factible, verificable, correcto, conforme) |
| **INVEST** (Bill Wake) | — | Calidad de la historia: Independiente, Negociable, Valiosa, Estimable, Pequeña (*Small*), Testeable |
| **3C** (Ron Jeffries) | — | Tarjeta, Conversación, Confirmación (criterios de aceptación) |
| **Gherkin / BDD** | — | Formato de los criterios de aceptación |
| **Definition of Ready / Done** (Scrum Guide 2020 + práctica ágil) | — | Checklist de preparación y de cierre |
| **WCAG** | 2.2 (2023) | Criterios de accesibilidad cuando la historia afecta la interfaz |
| **OWASP ASVS** | 5.0 (2025) | Requisitos de seguridad cuando la historia toca autenticación, datos sensibles o entradas |

### ISO/IEC 25010:2023 — características que revisa la IA

Adecuación funcional · Eficiencia de desempeño · Compatibilidad · Capacidad de interacción (antes "usabilidad") · Fiabilidad · Seguridad (*security*) · Mantenibilidad · Flexibilidad (antes "portabilidad") · Seguridad física (*safety*, nueva en 2023).

## 2. Estructura de una regla

Cada regla vive en el catálogo con estos campos:

| Campo | Descripción |
|-------|-------------|
| `id` | Identificador estable, p. ej. `US-AC-002` |
| `nombre` | Nombre corto |
| `referencia` | Norma y cláusula/principio de origen |
| `tipo` | `deterministica` (código) o `ia` (Gemini) |
| `severidad` | `bloqueante`, `mayor`, `menor`, `info` |
| `aplica_si` | Condición de activación (p. ej. "la historia menciona formularios") |
| `descripcion` | Qué se verifica |
| `mensaje` | Texto que verá el usuario |
| `sugerencia` | Cómo corregirlo |
| `ejemplo_ok` / `ejemplo_falla` | Usados también como casos de prueba de la regla |

**Recomendación:** guarda el catálogo como datos (YAML/JSON en `backend/app/domain/rules/catalog/`), no como texto dentro del código. Así el catálogo se documenta, se versiona y se prueba solo.

## 3. Catálogo inicial de reglas (v1)

### Formato y estructura
| ID | Regla | Referencia | Tipo | Severidad |
|----|-------|-----------|------|-----------|
| US-FMT-001 | Tiene rol, acción y beneficio ("Como… quiero… para…") | Formato Connextra / 3C | det. | mayor |
| US-FMT-002 | El beneficio ("para…") expresa valor de negocio, no repite la acción | INVEST — Valiosa | IA | menor |
| US-FMT-003 | Título presente y < 100 caracteres | Buena práctica | det. | info |

### Criterios de aceptación
| ID | Regla | Referencia | Tipo | Severidad |
|----|-------|-----------|------|-----------|
| US-AC-001 | Existe al menos un criterio de aceptación | 3C — Confirmación; DoR | det. | bloqueante |
| US-AC-002 | Los criterios son verificables (resultado observable, sin "debería funcionar bien") | IEEE 29148 — Verificable; INVEST — Testeable | det. + IA | mayor |
| US-AC-003 | Los criterios usan o pueden convertirse a Gherkin | ISTQB v4.0 — ATDD/BDD | det. | menor |
| US-AC-004 | Hay criterios para el camino alterno y de error, no solo el feliz | ISTQB v4.0 — técnicas de caja negra | IA | mayor |
| US-AC-005 | Cada criterio verifica una sola cosa | IEEE 29148 — Singular | IA | menor |
| US-AC-006 | Los valores numéricos o límites están explícitos (montos, longitudes, tiempos) | ISTQB — valores límite | det. + IA | mayor |

### Ambigüedad y lenguaje
| ID | Regla | Referencia | Tipo | Severidad |
|----|-------|-----------|------|-----------|
| US-AMB-001 | Sin términos vagos: "rápido", "fácil", "amigable", "adecuado", "etc.", "y/o", "normalmente", "algunos" | IEEE 29148 — No ambiguo | det. | mayor |
| US-AMB-002 | Sin pronombres o referencias sin antecedente ("eso", "lo anterior") | IEEE 29148 — No ambiguo | IA | menor |
| US-AMB-003 | Términos de dominio definidos o consistentes | IEEE 29148 — Conforme | IA | info |

> El diccionario de términos vagos (US-AMB-001) es un archivo de datos en español e inglés, ampliable.

### Tamaño y dependencias
| ID | Regla | Referencia | Tipo | Severidad |
|----|-------|-----------|------|-----------|
| US-SIZE-001 | Más de 8 criterios o varias acciones en el "quiero" → posible historia demasiado grande | INVEST — Pequeña | det. | menor |
| US-DEP-001 | Menciona dependencias de otras historias o sistemas sin identificarlas | INVEST — Independiente | IA | menor |
| US-EST-001 | Información suficiente para estimar | INVEST — Estimable | IA | info |

### Requisitos no funcionales (ISO/IEC 25010:2023)
| ID | Regla | Referencia | Tipo | Severidad |
|----|-------|-----------|------|-----------|
| US-NFR-001 | Si hay interacción con la UI: ¿se consideró la accesibilidad? | ISO 25010 — Capacidad de interacción; WCAG 2.2 AA | IA | menor |
| US-NFR-002 | Si hay datos personales, autenticación o entradas libres: ¿hay criterios de seguridad? | ISO 25010 — Seguridad; OWASP ASVS 5.0 | IA | mayor |
| US-NFR-003 | Si hay operaciones masivas o tiempos críticos: ¿hay criterio de desempeño medible? | ISO 25010 — Eficiencia de desempeño | IA | menor |
| US-NFR-004 | Si integra con terceros: ¿se definió el comportamiento ante fallas? | ISO 25010 — Fiabilidad | IA | menor |

### Definition of Ready (checklist, no puntúa por sí sola)
- Historia entendida por el equipo y priorizada.
- Criterios de aceptación acordados.
- Dependencias identificadas.
- Datos de prueba conocidos o solicitables.
- Ambiente QA identificado.
- Diseño/mockup disponible si aplica.

## 4. Puntaje de preparación

Fórmula transparente (la explicación aparece en la UI):

```
puntaje = 100 − Σ penalización(hallazgo aceptado o pendiente)
  bloqueante = 30 · mayor = 10 · menor = 4 · info = 0
mínimo 0
```

| Veredicto | Condición |
|-----------|-----------|
| **No lista** | Algún hallazgo bloqueante, o puntaje < 60 |
| **Lista con observaciones** | 60–84 |
| **Lista** | ≥ 85 y sin bloqueantes |

Los hallazgos **descartados** por el usuario no penalizan, pero quedan en el reporte con su motivo (trazabilidad).

## 5. Técnicas de diseño de pruebas (ISTQB v4.0) que usa el Módulo C

| Técnica | Cuándo la propone la herramienta |
|---------|-----------------------------------|
| Partición de equivalencia | Hay entradas con rangos o categorías |
| Análisis de valores límite | Hay números, longitudes, fechas, montos (2 o 3 valores por límite) |
| Tabla de decisión | Hay reglas de negocio con combinaciones de condiciones |
| Transición de estados | Hay estados (pedido creado → pagado → enviado) |
| Prueba basada en casos de uso / escenarios | Siempre: camino feliz + alternos |
| Predicción de errores (*error guessing*) | Siempre: campos vacíos, caracteres especiales, sesión expirada, doble clic |

## 6. Plantilla de defecto (basada en ISO/IEC/IEEE 29119-3, reporte de incidentes)

Identificador · Título · Fecha · Autor · Ambiente y versión/build · Historia y caso de prueba relacionados · Precondiciones · Pasos para reproducir · Resultado esperado · Resultado obtenido · Severidad · Prioridad · Frecuencia (siempre / intermitente) · Evidencias · Estado.

## 7. Checklist de la sesión en ambiente QA

**Preparación:** ambiente disponible · versión/build desplegada coincide con la esperada · datos de prueba cargados · usuarios y permisos disponibles · servicios dependientes activos · navegadores/dispositivos definidos.
**Ejecución:** cada caso con resultado y evidencia · defectos registrados con reproducción · re-prueba de defectos corregidos · prueba de regresión del área afectada.
**Cierre:** todos los criterios de aceptación verificados · defectos abiertos clasificados · recomendación final (aceptar / aceptar con defectos menores / rechazar) · reporte generado.
