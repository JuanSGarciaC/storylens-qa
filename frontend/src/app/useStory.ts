import { useEffect, useState } from "react";
import * as api from "../api/client";
import type { StoryItem } from "../api/client";

type Loaded = {
  key: string;
  story?: StoryItem;
  notFound?: api.ApiError;
  error?: string;
};

/**
 * Carga la historia de una pantalla `/p/:projectId/stories/:storyId/...`.
 *
 * Si la historia no existe, o existe pero pertenece a otro proyecto, LANZA un
 * `ApiError` 404 durante el render: el `errorElement` de las rutas (`RouteError`)
 * lo muestra como NotFound, sin revelar si la historia existe en otro proyecto.
 * Cualquier otro fallo se devuelve en `error` y la pantalla decide cómo mostrarlo.
 */
export function useStory(
  projectId: string | undefined,
  storyId: string | undefined,
): { story: StoryItem | undefined; loading: boolean; error: string | null } {
  const key = `${projectId}/${storyId}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!projectId || !storyId) return;
    let current = true;
    const missing = () => new api.ApiError("Historia no encontrada", 404);
    api.getStory(storyId).then(
      (story) => {
        if (!current) return;
        setLoaded(
          story.project_id === projectId
            ? { key, story }
            : { key, notFound: missing() },
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
                : "No se pudo cargar la historia.",
          });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [key, projectId, storyId]);

  const fresh = loaded && loaded.key === key ? loaded : null;
  if (fresh?.notFound) throw fresh.notFound;
  return {
    story: fresh?.story,
    loading: !fresh,
    error: fresh?.error ?? null,
  };
}
