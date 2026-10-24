import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as api from "../api/client";
import type { Me } from "../api/client";
import { Spinner } from "../shared/ui/Spinner";
import { ErrorNotice } from "../shared/ui/ErrorNotice";
import { ServerWaking } from "./ServerWaking";

export type SessionStatus = "loading" | "waking" | "ready" | "error";

export type SessionValue = {
  me: Me | null;
  status: SessionStatus;
  /** Valor de /health: la IA tiene credenciales en el servidor. */
  aiConfigured: boolean;
  /** Cuota de IA restante hoy según /health; null si no se informa. */
  aiQuotaRemaining: number | null;
  /** Vuelve a pedir /health (p. ej. tras gastar una consulta de IA); true si respondió. */
  refreshHealth(): Promise<boolean>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  retry(): void;
};

const WAKING_AFTER_MS = 4000;
/** Una petición inicial sin respuesta tras este tiempo se aborta y se reintenta. */
export const ATTEMPT_TIMEOUT_MS = 15000;
const BACKOFF_MS = [1000, 2000, 4000];

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession requiere un SessionProvider");
  return value;
}

function isConnectionProblem(error: unknown) {
  // Sin red, abortada por tiempo, o 5xx (el proxy de un host dormido responde 502/503).
  return (
    error instanceof api.ApiError && (error.status === 0 || error.status >= 500)
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiQuotaRemaining, setAiQuotaRemaining] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const attemptRef = useRef<object | null>(null); // invalida intentos anteriores
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const whereRef = useRef("/");
  const where = location.pathname + location.search;
  useEffect(() => {
    whereRef.current = where;
  }, [where]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const connect = useCallback(
    (first: number) => {
      function run(autoRetries: number) {
        clearTimers();
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const attempt = {};
        attemptRef.current = attempt;
        const current = () => attempt === attemptRef.current;
        timersRef.current.push(
          setTimeout(() => {
            if (current()) setStatus("waking");
          }, WAKING_AFTER_MS),
        );
        timersRef.current.push(
          setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS),
        );
        // /health es opcional: si falla, la IA se da por no configurada.
        Promise.all([
          api.getMe(controller.signal),
          api.getHealth(controller.signal).catch(() => null),
        ]).then(
          ([user, health]) => {
            if (!current()) return;
            clearTimers();
            setMe(user);
            setAiConfigured(health?.ai_configured ?? false);
            setAiQuotaRemaining(health?.ai_quota_remaining_today ?? null);
            setStatus("ready");
          },
          (error: unknown) => {
            if (!current()) return;
            clearTimers();
            if (!isConnectionProblem(error)) {
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : "No se pudo iniciar la sesión.",
              );
              setStatus("error");
              return;
            }
            setStatus("waking");
            if (autoRetries < BACKOFF_MS.length) {
              timersRef.current.push(
                setTimeout(() => {
                  if (current()) run(autoRetries + 1);
                }, BACKOFF_MS[autoRetries]),
              );
            }
          },
        );
      }
      run(first);
    },
    [clearTimers],
  );

  useEffect(() => {
    connect(0);
    return () => {
      attemptRef.current = null;
      abortRef.current?.abort();
      clearTimers();
    };
  }, [connect, clearTimers]);

  // Un 401 con la sesión ya establecida: volver al login y recordar dónde estaba.
  useEffect(() => {
    api.setUnauthorizedHandler(() => {
      if (statusRef.current !== "ready") return;
      const current = whereRef.current;
      setMe({ authenticated: false });
      if (current.startsWith("/login")) return;
      navigate(`/login?next=${encodeURIComponent(current)}`, { replace: true });
    });
    return () => api.setUnauthorizedHandler(null);
  }, [navigate]);

  const refreshHealth = useCallback(async () => {
    try {
      const health = await api.getHealth();
      setAiConfigured(health.ai_configured);
      setAiQuotaRemaining(health.ai_quota_remaining_today ?? null);
      return true;
    } catch {
      return false; // no es fatal: se conserva el último valor conocido
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setMe(await api.login(email, password));
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setMe({ authenticated: false });
  }, []);

  const retry = useCallback(() => {
    setStatus("loading");
    connect(0);
  }, [connect]);

  const value = useMemo<SessionValue>(
    () => ({
      me,
      status,
      aiConfigured,
      aiQuotaRemaining,
      refreshHealth,
      login,
      logout,
      retry,
    }),
    [
      me,
      status,
      aiConfigured,
      aiQuotaRemaining,
      refreshHealth,
      login,
      logout,
      retry,
    ],
  );

  let content: ReactNode = children;
  if (status === "loading") content = <Spinner label="Conectando…" />;
  else if (status === "waking") content = <ServerWaking onRetry={retry} />;
  else if (status === "error") {
    content = <ErrorNotice message={errorMessage} onRetry={retry} />;
  }

  return (
    <SessionContext.Provider value={value}>{content}</SessionContext.Provider>
  );
}
