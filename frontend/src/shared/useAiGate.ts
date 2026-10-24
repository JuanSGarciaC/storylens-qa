import { useCallback, useEffect, useState } from "react";
import { useSession } from "../app/session";
import type { Access } from "./useAccess";

/**
 * Decide si las acciones de IA están habilitadas y por qué no, con el mismo
 * patrón que el análisis: tras cada consulta se refresca /health (la cuota
 * pudo gastarse) y, si la IA quedó caída y /health no lo desmiente, se
 * bloquea hasta «Comprobar de nuevo» o hasta volver a la pestaña.
 */
export function useAiGate(access: Access) {
  const { aiQuotaRemaining, refreshHealth } = useSession();
  const [aiDown, setAiDown] = useState(false);

  useEffect(() => {
    if (!aiDown) return;
    const recheck = () => {
      if (document.visibilityState !== "visible") return;
      void refreshHealth().then((ok) => ok && setAiDown(false));
    };
    document.addEventListener("visibilitychange", recheck);
    return () => document.removeEventListener("visibilitychange", recheck);
  }, [aiDown, refreshHealth]);

  /** Llamar tras cada consulta de IA; `failed` si la petición falló. */
  const afterAiCall = useCallback(
    async (failed: boolean) => {
      const refreshed = await refreshHealth();
      setAiDown(failed && !refreshed);
    },
    [refreshHealth],
  );

  const recheck = useCallback(
    () => void refreshHealth().then((ok) => ok && setAiDown(false)),
    [refreshHealth],
  );

  const outOfQuota = aiQuotaRemaining === 0;
  const enabled = access.canUseAi && !outOfQuota && !aiDown;
  const quotaText =
    access.canUseAi && aiQuotaRemaining !== null
      ? aiQuotaRemaining === 0
        ? "Sin consultas de IA hoy."
        : `${aiQuotaRemaining === 1 ? "Queda 1 consulta" : `Quedan ${aiQuotaRemaining} consultas`} de IA hoy.`
      : null;
  const reason =
    access.reason ??
    (aiDown && !outOfQuota
      ? "La IA no está disponible ahora (límite alcanzado o servicio caído)."
      : quotaText);

  return { enabled, reason, aiDown, afterAiCall, recheck };
}
