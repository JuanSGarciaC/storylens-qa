import type { Tone } from "../../shared/ui/Badge";

export const STATUS_LABEL: Record<string, string> = {
  queued: "En cola",
  running: "En curso",
  succeeded: "Terminada",
  partial: "Terminada con errores",
  failed: "Fallida",
  cancelled: "Cancelada",
  interrupted: "Interrumpida",
};

export const STATUS_TONE: Record<string, Tone> = {
  queued: "info",
  running: "info",
  succeeded: "ok",
  partial: "warn",
  failed: "danger",
  cancelled: "neutral",
  interrupted: "warn",
};

export const ITEM_LABEL: Record<string, string> = {
  pending: "Pendiente",
  done: "Importada",
  skipped: "Omitida",
  failed: "Con error",
};

export const AI_LABEL: Record<string, string> = {
  ok: "Reglas e IA",
  not_requested: "Solo reglas",
  unavailable: "Solo reglas (IA no disponible)",
  invalid_response: "Solo reglas (respuesta de IA no válida)",
};

/** Mientras el trabajo está activo hay que seguir consultando su avance. */
export const isActive = (status: string) =>
  status === "queued" || status === "running";
