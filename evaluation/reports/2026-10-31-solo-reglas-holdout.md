# Informe de evaluación — solo-reglas-holdout — 2026-10-31

- Historias: 13 · Catálogo de reglas v1.0.0

| Tipo | Precisión | Recall | F1 | TP | FP | FN |
|---|---|---|---|---|---|---|
| Reglas automáticas | 0.67 | 0.75 | 0.71 | 6 | 3 | 2 |

## Detalle

| Historia | Faltan | Sobran |
|---|---|---|
| h-control-plazo-como-estado | — | US-AC-006 |
| h-formato-en-mi-rol | — | US-FMT-001 |
| h-vagos-sinonimos | US-AMB-001 | — |
| h-limite-sin-palabra | US-AC-006 | — |
| h-demasiado-grande | — | US-AC-006 |

## Lectura (añadida a mano)

- Mismo motor y catálogo v1.0.0 que obtienen F1 1,00 en el conjunto de referencia: sobre 13 historias
  escritas después de las reglas, en otros dominios, el F1 cae a **0,71**. Esa diferencia es la medida
  honesta de cuánto generalizan las reglas; el 1,00 anterior medía que hacen lo que dicen.
- **Falsos positivos (3):**
  - `US-AC-006` en «Dado una factura cuyo plazo de pago ya pasó…»: «plazo» nombra un estado, no un
    límite a cuantificar.
  - `US-AC-006` en «Dado un salario menor al mínimo legal…»: el valor existe aunque no sea un número
    escrito; discutible, se dejó la etiqueta como estaba.
  - `US-FMT-001` en «En mi rol de… necesito… con el fin de…»: formato válido que el patrón no reconoce.
- **Faltantes (2):**
  - `US-AMB-001` con «ágil», «sencilla» y «en breve»: sinónimos fuera del diccionario de términos vagos.
  - `US-AC-006` con «carrito lleno» y «tope alcanzado»: el límite se nombra sin las palabras de la lista.
- Candidatos para el catálogo v1.1: ampliar el diccionario de vaguedad y las palabras de límite, y
  aceptar variantes de rol/beneficio («En mi rol de», «con el fin de»). **Si se aplican, este conjunto
  deja de ser «no visto»**: habrá que escribir otro para medir la v1.1.
- Las etiquetas de IA (`US-AC-002`, `US-AC-004`, `US-NFR-*`…) están puestas pero sin medir: falta
  correr `--set holdout --ai` con una clave gratuita de Gemini.
