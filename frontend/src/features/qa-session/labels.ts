import type {
  ChecklistItem,
  Defect,
  ExecutionResult,
  Recommendation,
} from "../../api/client";

export const RESULT_LABEL: Record<ExecutionResult, string> = {
  not_run: "Sin ejecutar",
  passed: "Pasó",
  failed: "Falló",
  blocked: "Bloqueado",
};

export const SEVERITY_LABEL: Record<Defect["severity"], string> = {
  critical: "Crítica",
  major: "Mayor",
  minor: "Menor",
  trivial: "Trivial",
};

export const PRIORITY_LABEL: Record<Defect["priority"], string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const FREQUENCY_LABEL: Record<Defect["frequency"], string> = {
  always: "Siempre",
  intermittent: "Intermitente",
};

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  accept: "Aceptar la historia",
  accept_with_minor_defects: "Aceptar con defectos menores",
  reject: "Rechazar la historia",
};

export const PHASE_LABEL: Record<ChecklistItem["phase"], string> = {
  preparation: "Preparación",
  execution: "Ejecución",
  closure: "Cierre",
};

export const PHASES: ChecklistItem["phase"][] = [
  "preparation",
  "execution",
  "closure",
];
