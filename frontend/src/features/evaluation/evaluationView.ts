import type { EvaluationRun } from "../../api/client";
import type { Tone } from "../../shared/ui/Badge";

export const MODE_LABEL: Record<string, string> = {
  rules: "Solo reglas",
  rules_ai: "Reglas e IA",
  injection: "Inyección de instrucciones",
};

export const STATUS_LABEL: Record<string, string> = {
  running: "En curso",
  succeeded: "Terminada",
  incomplete: "Incompleta",
  failed: "Fallida",
  interrupted: "Interrumpida",
};

export const STATUS_TONE: Record<string, Tone> = {
  running: "info",
  succeeded: "ok",
  incomplete: "warn",
  failed: "danger",
  interrupted: "warn",
};

export interface KindMetrics {
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
}

/** Métricas de reglas automáticas ("det") o de IA ("ai"); null si la corrida no las tiene. */
export function kindMetrics(
  run: EvaluationRun,
  kind: "det" | "ai",
): KindMetrics | null {
  const value = (run.metrics as Record<string, unknown>)[kind];
  if (!value || typeof value !== "object") return null;
  return value as KindMetrics;
}

export interface InjectionSummary {
  passed: number;
  failed: number;
  not_evaluable: number;
  total: number;
  results: { id: string; status: string; reason: string }[];
}

export function injectionSummary(run: EvaluationRun): InjectionSummary | null {
  const counts = (run.metrics as Record<string, unknown>).injection;
  if (!counts || typeof counts !== "object") return null;
  const results = run.details.injection;
  return {
    ...(counts as Omit<InjectionSummary, "results">),
    results: Array.isArray(results)
      ? (results as InjectionSummary["results"])
      : [],
  };
}

/** Cambio de cada métrica compartida entre dos corridas (valores entre 0 y 1). */
export function compareRuns(
  base: EvaluationRun,
  other: EvaluationRun,
): { label: string; base: number; other: number }[] {
  const rows: { label: string; base: number; other: number }[] = [];
  for (const [kind, name] of [
    ["det", "reglas automáticas"],
    ["ai", "reglas de IA"],
  ] as const) {
    const a = kindMetrics(base, kind);
    const b = kindMetrics(other, kind);
    if (!a || !b) continue;
    for (const [field, label] of [
      ["precision", "Precisión"],
      ["recall", "Exhaustividad"],
      ["f1", "F1"],
    ] as const) {
      rows.push({
        label: `${label} (${name})`,
        base: a[field],
        other: b[field],
      });
    }
  }
  return rows;
}
