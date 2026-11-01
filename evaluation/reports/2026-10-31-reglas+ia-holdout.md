# Informe de evaluación — reglas+ia-holdout — 2026-10-31

- Historias: 13 · Catálogo de reglas v1.0.0
- Estado de la IA por historia: {'ok': 13}
- Historias medidas para la IA: 13 de 13

| Tipo | Precisión | Recall | F1 | TP | FP | FN |
|---|---|---|---|---|---|---|
| Reglas automáticas | 0.67 | 0.75 | 0.71 | 6 | 3 | 2 |
| Reglas de IA | 0.60 | 0.33 | 0.43 | 6 | 4 | 12 |

## Detalle

| Historia | Faltan | Sobran |
|---|---|---|
| h-control-plazo-como-estado | — | US-AC-006 |
| h-formato-en-mi-rol | US-NFR-001 | US-FMT-001 |
| h-vagos-sinonimos | US-AMB-001, US-NFR-003 | US-FMT-002 |
| h-limite-sin-palabra | US-AC-006, US-NFR-001 | — |
| h-sin-criterios | US-EST-001, US-NFR-004 | US-DEP-001 |
| h-prosa-con-datos-personales | US-AC-004, US-AC-005 | US-AC-002 |
| h-referencias-sin-antecedente | US-AC-002, US-AC-004 | — |
| h-sin-beneficio | US-NFR-002 | US-FMT-002 |
| h-pago-tercero-solo-feliz | US-NFR-001, US-NFR-002 | — |
| h-demasiado-grande | — | US-AC-006 |

## Lectura (añadida a mano)

- Corrida con el validador corregido (ver `2026-10-31-reglas+ia.md`). En este conjunto el arreglo
  no cambia nada: la IA no tuvo hallazgos descartados por la cita.
- **Variación entre corridas:** tres corridas dieron F1 0,46, 0,37 y 0,43 (esta). Con 13 historias
  y 18 hallazgos esperados, un acierto mueve la exhaustividad más de 5 puntos: la cifra útil es
  «alrededor de 0,4».
- **La IA es mucho peor en historias nuevas** que en el conjunto de referencia (F1 0,88): sigue
  sin inferir accesibilidad (`US-NFR-001`) ni seguridad (`US-NFR-002`) cuando la historia no las
  menciona, y en varias historias no marca el «solo camino feliz» (`US-AC-004`).
- Candidato para `analysis-v2`: pedir explícitamente revisar camino de error, accesibilidad y
  seguridad en cada historia. Ajustarlo con el conjunto de referencia y medirlo una vez aquí.
