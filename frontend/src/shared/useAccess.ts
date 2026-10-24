import type { Project } from "../api/client";
import { useSession } from "../app/session";

export type Access = {
  canWrite: boolean;
  canUseAi: boolean;
  /** Por qué no se puede, en español; null si se puede todo. */
  reason: string | null;
};

export function useAccess(project: Project | undefined): Access {
  const { me, aiConfigured } = useSession();
  const authenticated = me?.authenticated ?? false;
  const isDemo = project?.is_demo ?? false;
  const canWrite = authenticated && !isDemo;
  const canUseAi = canWrite && aiConfigured;

  let reason: string | null = null;
  if (isDemo) {
    reason = "Estás viendo el proyecto de demostración: es de solo lectura.";
  } else if (!authenticated) {
    reason = "Inicia sesión para editar.";
  } else if (!aiConfigured) {
    reason = "La IA no está configurada.";
  }
  return { canWrite, canUseAi, reason };
}
