import type { TestCase } from "../../api/client";

/** Nombre en español de cada técnica de diseño de pruebas (ISTQB CTFL v4.0). */
export const TECHNIQUE_LABEL: Record<TestCase["technique"], string> = {
  equivalence_partitioning: "Partición de equivalencia",
  boundary_value: "Valores límite",
  decision_table: "Tabla de decisión",
  state_transition: "Transición de estados",
  scenario: "Escenario",
  error_guessing: "Predicción de errores",
};
