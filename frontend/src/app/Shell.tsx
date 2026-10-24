import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import * as api from "../api/client";
import type { Project } from "../api/client";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { ErrorNotice } from "../shared/ui/ErrorNotice";
import { Icon } from "../shared/ui/Icon";
import type { IconName } from "../shared/ui/Icon";
import { Spinner } from "../shared/ui/Spinner";
import { CommandPalette } from "./CommandPalette";
import type { PaletteItem } from "./CommandPalette";
import { NotFound } from "./NotFound";
import { ProjectProvider, useProject } from "./ProjectContext";
import { useSession } from "./session";

const NARROW_QUERY = "(max-width: 767px)";

function subscribeNarrow(callback: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useIsNarrow() {
  return useSyncExternalStore(
    subscribeNarrow,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

type Module = {
  n: string;
  label: string;
  icon: IconName;
  /** Ruta relativa al proyecto; undefined si el módulo aún no existe. */
  path?: string;
  global?: boolean;
  /** Se abre desde una historia: el enlace lleva al listado. */
  hint?: string;
};

// Módulos del README (1–10). Los de las fases D–F aparecen deshabilitados.
const FROM_STORY = "Desde una historia";
const MODULES: Module[] = [
  { n: "1", label: "Proyectos", icon: "home", global: true },
  { n: "2", label: "Historias", icon: "list", path: "/stories" },
  {
    n: "3-4",
    label: "Análisis de calidad e IA",
    icon: "check",
    path: "/stories",
    hint: FROM_STORY,
  },
  { n: "5", label: "Análisis transversal", icon: "alert" },
  {
    n: "6",
    label: "Casos de prueba",
    icon: "check",
    path: "/stories",
    hint: FROM_STORY,
  },
  {
    n: "7",
    label: "Sesiones QA",
    icon: "bug",
    path: "/stories",
    hint: FROM_STORY,
  },
  { n: "8", label: "Informes", icon: "download", path: "/reports" },
  { n: "9", label: "Métricas y mejora", icon: "chart" },
  { n: "10", label: "Evaluación de la IA", icon: "search" },
];

function ModuleNav({
  projectId,
  onNavigate,
}: {
  projectId?: string;
  onNavigate: () => void;
}) {
  const { pathname } = useLocation();
  const base = projectId ? `/p/${projectId}` : null;

  function isCurrent(module: Module) {
    if (module.global) return pathname === "/";
    if (!base || module.hint || module.path === undefined) return false;
    return (
      pathname === base + module.path ||
      pathname.startsWith(`${base}${module.path}/`)
    );
  }

  function row(module: Module): ReactNode {
    const content = (
      <>
        <Icon name={module.icon} />
        <span className="nav__num mono">{module.n}</span>
        <span className="nav__label">{module.label}</span>
      </>
    );
    if (module.path === undefined && !module.global) {
      return (
        <span className="nav__item is-disabled" aria-disabled="true">
          {content}
          <Badge tone="neutral">Próximamente</Badge>
        </span>
      );
    }
    const to = module.global ? "/" : base ? base + module.path : null;
    if (to === null) {
      return (
        <span className="nav__item is-disabled" aria-disabled="true">
          {content}
          <span className="nav__note">Elige un proyecto</span>
        </span>
      );
    }
    return (
      <Link
        to={to}
        className="nav__item"
        aria-current={isCurrent(module) ? "page" : undefined}
        onClick={onNavigate}
      >
        {content}
        {module.hint ? <span className="nav__note">{module.hint}</span> : null}
      </Link>
    );
  }

  return (
    <nav aria-label="Módulos" className="nav">
      {base ? (
        <Link
          to={base}
          className="nav__item"
          aria-current={pathname === base ? "page" : undefined}
          onClick={onNavigate}
        >
          <Icon name="chart" />
          <span className="nav__label">Resumen del proyecto</span>
        </Link>
      ) : null}
      <ul className="nav__list">
        {MODULES.map((module) => (
          <li key={module.n}>{row(module)}</li>
        ))}
      </ul>
      {base ? (
        <Link
          to={`${base}/settings`}
          className="nav__item"
          aria-current={pathname === `${base}/settings` ? "page" : undefined}
          onClick={onNavigate}
        >
          <Icon name="settings" />
          <span className="nav__label">Configuración</span>
        </Link>
      ) : null}
    </nav>
  );
}

function StatusBadges() {
  const { me, aiConfigured, aiQuotaRemaining, logout } = useSession();
  const location = useLocation();
  let ai: ReactNode;
  if (!aiConfigured) {
    ai = <Badge tone="neutral">IA no configurada: solo reglas</Badge>;
  } else if (aiQuotaRemaining === 0) {
    ai = <Badge tone="warn">Cuota de IA agotada hoy</Badge>;
  } else if (aiQuotaRemaining !== null) {
    ai = (
      <Badge tone="ok">
        IA activa · {aiQuotaRemaining}{" "}
        {aiQuotaRemaining === 1 ? "consulta" : "consultas"} de IA hoy
      </Badge>
    );
  } else {
    ai = <Badge tone="ok">IA activa</Badge>;
  }
  return (
    <div className="status">
      {me?.authenticated ? (
        <>
          <Badge tone="info">Sesión: {me.email ?? "iniciada"}</Badge>
          <Button variant="ghost" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </>
      ) : (
        <>
          <Badge tone="neutral">Sin sesión: solo lectura</Badge>
          <Link
            to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
          >
            Iniciar sesión
          </Link>
        </>
      )}
      {ai}
    </div>
  );
}

function ProjectSelect({
  projects,
  projectId,
}: {
  projects: Project[];
  projectId?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="project-select">
      <label htmlFor="project-select" className="project-select__label">
        Proyecto
      </label>
      <select
        id="project-select"
        value={
          projectId && projects.some((p) => p.id === projectId) ? projectId : ""
        }
        onChange={(event) =>
          navigate(event.target.value ? `/p/${event.target.value}` : "/")
        }
      >
        <option value="">Todos los proyectos</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ShellFrame() {
  const { projectId, status, error, reload } = useProject();
  const { me } = useSession();
  const narrow = useIsNarrow();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastPath, setLastPath] = useState(pathname);

  // Cerrar el menú móvil al navegar (ajuste durante el render, sin efecto).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  const authenticated = me?.authenticated ?? false;
  useEffect(() => {
    let current = true;
    api.listProjects().then(
      (list) => current && setProjects(list),
      () => current && setProjects([]),
    );
    return () => {
      current = false;
    };
  }, [authenticated]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];
    if (projectId) {
      const base = `/p/${projectId}`;
      list.push(
        {
          id: "overview",
          label: "Resumen del proyecto",
          hint: "Proyecto actual",
          to: base,
        },
        {
          id: "stories",
          label: "Historias",
          hint: "Módulo 2",
          to: `${base}/stories`,
        },
        {
          id: "reports",
          label: "Informes",
          hint: "Módulo 8",
          to: `${base}/reports`,
        },
        {
          id: "settings",
          label: "Configuración",
          hint: "Reglas del proyecto",
          to: `${base}/settings`,
        },
      );
    }
    list.push({
      id: "projects",
      label: "Proyectos",
      hint: "Módulo 1",
      to: "/",
    });
    for (const project of projects) {
      list.push({
        id: `project-${project.id}`,
        label: project.name,
        hint: "Ir al proyecto",
        to: `/p/${project.id}`,
      });
    }
    return list;
  }, [projectId, projects]);

  let main: ReactNode;
  if (status === "loading") main = <Spinner label="Cargando proyecto…" />;
  else if (status === "notfound") {
    main = <NotFound title="Proyecto no encontrado" />;
  } else if (status === "error") {
    main = <ErrorNotice message={error} onRetry={reload} />;
  } else main = <Outlet />;

  return (
    <div className={`shell${narrow ? " shell--narrow" : ""}`}>
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <header className="topbar">
        {narrow ? (
          <Button
            variant="ghost"
            aria-expanded={menuOpen}
            aria-controls="barra-lateral"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menú
          </Button>
        ) : null}
        <Link to="/" className="brand">
          StoryLens
        </Link>
        <Button
          variant="ghost"
          className="topbar__search"
          onClick={() => setPaletteOpen(true)}
        >
          <Icon name="search" />
          Buscar <kbd className="mono">Ctrl K</kbd>
        </Button>
      </header>
      <div id="barra-lateral" className="shell__side">
        {narrow && !menuOpen ? null : (
          <aside className="sidebar">
            <ProjectSelect projects={projects} projectId={projectId} />
            <ModuleNav
              projectId={projectId}
              onNavigate={() => setMenuOpen(false)}
            />
            <StatusBadges />
          </aside>
        )}
      </div>
      <main id="contenido" className="content" tabIndex={-1}>
        {main}
      </main>
      {paletteOpen ? (
        <CommandPalette items={items} onClose={() => setPaletteOpen(false)} />
      ) : null}
    </div>
  );
}

export function Shell() {
  const { projectId } = useParams();
  return (
    <ProjectProvider projectId={projectId}>
      <ShellFrame />
    </ProjectProvider>
  );
}
