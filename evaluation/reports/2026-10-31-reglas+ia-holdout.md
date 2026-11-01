# Informe de evaluación — reglas+ia-holdout — 2026-10-31

- Historias: 13 · Catálogo de reglas v1.0.0
- Estado de la IA por historia: {'ok': 13}
- Historias medidas para la IA: 13 de 13

| Tipo | Precisión | Recall | F1 | TP | FP | FN |
|---|---|---|---|---|---|---|
| Reglas automáticas | 0.67 | 0.75 | 0.71 | 6 | 3 | 2 |
| Reglas de IA | 0.75 | 0.33 | 0.46 | 6 | 2 | 12 |

## Detalle

| Historia | Faltan | Sobran |
|---|---|---|
| h-control-plazo-como-estado | — | US-AC-006 |
| h-formato-en-mi-rol | US-NFR-001 | US-FMT-001 |
| h-vagos-sinonimos | US-AC-004, US-AMB-001, US-NFR-003 | US-FMT-002 |
| h-limite-sin-palabra | US-AC-006, US-NFR-001 | — |
| h-sin-criterios | US-EST-001 | — |
| h-prosa-con-datos-personales | US-AC-004, US-AC-005, US-NFR-002 | — |
| h-referencias-sin-antecedente | US-AC-004 | — |
| h-sin-beneficio | US-NFR-002 | US-FMT-002 |
| h-pago-tercero-solo-feliz | US-NFR-001, US-NFR-002 | — |
| h-demasiado-grande | — | US-AC-006 |

## Lectura (añadida a mano)

- Modelo `gemini-3.5-flash-lite`, prompt `analysis-v1`, capa gratuita, `--pause 13` (una primera
  corrida con 10 s chocó con el tope propio de 5 peticiones/min en 2 historias: se repitió completa).
- **La IA es prudente:** precisión 0,75 (6 de 8 hallazgos correctos) pero exhaustividad 0,33
  (encontró 6 de 18). En el conjunto de referencia fue 0,56 / 0,71: en historias nuevas reporta menos
  y se le escapa más.
- **Fallo que se repite:** `US-AC-004` (solo camino feliz) faltó en 4 historias, igual que en el
  conjunto de referencia. Es el candidato más claro para `analysis-v2`.
- **También faltaron** accesibilidad (`US-NFR-001`, 3 veces) y seguridad con datos personales o pagos
  (`US-NFR-002`, 3 veces): la IA no infiere requisitos no funcionales que la historia no menciona.
- **Sobrantes (2):** `US-FMT-002` («el para qué no aporta valor») en «sin estrés» y en una historia
  sin beneficio. Ambos son defendibles; las etiquetas no se ajustaron.
- **Aciertos útiles:** encontró la referencia sin antecedente (`US-AMB-002`), el criterio no
  observable (`US-AC-002`), la integración sin plan de fallo (`US-NFR-004`) y la seguridad en el
  registro de pacientes; ninguna regla automática cubre eso.
- Las reglas automáticas dan lo mismo que en la corrida solo reglas (F1 0,71): son deterministas.
