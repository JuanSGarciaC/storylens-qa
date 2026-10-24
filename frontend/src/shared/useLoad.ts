import { useCallback, useEffect, useState } from "react";

export type Loaded<T> = {
  data: T | undefined;
  error: string;
  loading: boolean;
  reload(): void;
  /** Sustituye el dato local (p. ej. tras crear un elemento) sin volver a pedirlo. */
  set(next: T): void;
};

/** Carga un recurso al montar (y al cambiar `key`); ignora respuestas obsoletas. */
export function useLoad<T>(load: () => Promise<T>, key: string): Loaded<T> {
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    load().then(
      (data) => current && setState({ key, data, error: "" }),
      (error: unknown) =>
        current &&
        setState({
          key,
          error: error instanceof Error ? error.message : "No se pudo cargar.",
        }),
    );
    return () => {
      current = false;
    };
    // `load` cambia en cada render; `key` y `attempt` identifican la petición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => {
    setState(null);
    setAttempt((n) => n + 1);
  }, []);
  const set = useCallback(
    (data: T) => setState({ key, data, error: "" }),
    [key],
  );

  const fresh = state && state.key === key ? state : null;
  return {
    data: fresh?.data,
    error: fresh?.error ?? "",
    loading: !fresh,
    reload,
    set,
  };
}
