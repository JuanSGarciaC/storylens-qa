import { useCallback, useEffect, useState } from "react";
import * as api from "../../api/client";
import type { SessionDetail } from "../../api/client";

type Loaded = {
  key: string;
  detail?: SessionDetail;
  notFound?: api.ApiError;
  error?: string;
};

/**
 * Carga una sesión de `/p/:projectId/stories/:storyId/sessions/:sessionId`.
 *
 * Igual que `useStory`: si la sesión no existe (404) o pertenece a otra
 * historia, LANZA un `ApiError` 404 durante el render y el `errorElement` de
 * las rutas lo muestra como NotFound. Otros fallos vuelven en `error`.
 */
export function useSessionDetail(
  storyId: string,
  sessionId: string | undefined,
) {
  const key = `${storyId}/${sessionId}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let current = true;
    api.getSession(sessionId).then(
      (detail) => {
        if (!current) return;
        setLoaded(
          detail.story_id === storyId
            ? { key, detail }
            : {
                key,
                notFound: new api.ApiError("Sesión no encontrada", 404),
              },
        );
      },
      (error: unknown) => {
        if (!current) return;
        if (error instanceof api.ApiError && error.status === 404) {
          setLoaded({ key, notFound: error });
        } else {
          setLoaded({
            key,
            error:
              error instanceof Error
                ? error.message
                : "No se pudo cargar la sesión.",
          });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [key, storyId, sessionId, attempt]);

  const reload = useCallback(() => {
    setLoaded(null);
    setAttempt((n) => n + 1);
  }, []);
  const set = useCallback(
    (detail: SessionDetail) => setLoaded({ key, detail }),
    [key],
  );

  const fresh = loaded && loaded.key === key ? loaded : null;
  if (fresh?.notFound) throw fresh.notFound;
  return {
    detail: fresh?.detail,
    loading: !fresh,
    error: fresh?.error ?? "",
    reload,
    set,
  };
}
