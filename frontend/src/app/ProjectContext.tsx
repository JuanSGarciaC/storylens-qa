import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import * as api from "../api/client";
import type { Project } from "../api/client";
import { useSession } from "./session";

export type ProjectStatus = "none" | "loading" | "ready" | "notfound" | "error";

export type ProjectValue = {
  projectId: string | undefined;
  project: Project | undefined;
  status: ProjectStatus;
  error: string;
  reload(): void;
  /** Sustituye el proyecto actual sin pasar por «cargando» (p. ej. con la respuesta de un PATCH). */
  setProject(project: Project): void;
  /** Proyectos visibles para el selector y la paleta. */
  projects: Project[];
  /** Vuelve a pedir la lista (p. ej. tras crear o borrar un proyecto). */
  refreshProjects(): void;
};

const ProjectContext = createContext<ProjectValue | null>(null);

/** Proyecto de la ruta actual (`/p/:projectId`); `project` es undefined fuera de ella. */
export function useProject(): ProjectValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useProject requiere un ProjectProvider");
  return value;
}

type Loaded = {
  id: string;
  project?: Project;
  status: "ready" | "notfound" | "error";
  error: string;
};

export function ProjectProvider({
  projectId,
  children,
}: {
  projectId: string | undefined;
  children: ReactNode;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [listAttempt, setListAttempt] = useState(0);
  const authenticated = useSession().me?.authenticated ?? false;

  useEffect(() => {
    let current = true;
    api.listProjects().then(
      (list) => current && setProjects(list),
      () => current && setProjects([]),
    );
    return () => {
      current = false;
    };
  }, [authenticated, listAttempt]);

  const refreshProjects = useCallback(() => setListAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!projectId) return;
    let current = true;
    api.getProject(projectId).then(
      (project) => {
        if (current)
          setLoaded({ id: projectId, project, status: "ready", error: "" });
      },
      (error: unknown) => {
        if (!current) return;
        const notFound = error instanceof api.ApiError && error.status === 404;
        setLoaded({
          id: projectId,
          status: notFound ? "notfound" : "error",
          error:
            error instanceof Error
              ? error.message
              : "No se pudo cargar el proyecto.",
        });
      },
    );
    return () => {
      current = false;
    };
  }, [projectId, attempt]);

  const reload = useCallback(() => {
    setLoaded(null);
    setAttempt((n) => n + 1);
  }, []);

  // Ref para que `setProject` sea estable y descarte respuestas de otro proyecto.
  const currentId = useRef(projectId);
  currentId.current = projectId;
  const setProject = useCallback((project: Project) => {
    if (project.id !== currentId.current) return;
    setLoaded({ id: project.id, project, status: "ready", error: "" });
  }, []);

  const fresh = loaded && loaded.id === projectId ? loaded : null;
  const value: ProjectValue = {
    projectId,
    project: fresh?.project,
    status: !projectId ? "none" : (fresh?.status ?? "loading"),
    error: fresh?.error ?? "",
    reload,
    setProject,
    projects,
    refreshProjects,
  };
  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}
