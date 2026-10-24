import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useMatch,
  useNavigate,
  useParams,
} from "react-router-dom";
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

type NavItem = {
  label: string;
  icon: IconName;
  /** Ruta relativa al proyecto (o a la historia, en el grupo de la historia). */
  path: string;
};

// Tres grupos con un solo criterio cada uno: lo del proyecto, lo que mira todo el proyecto
// y lo que se hace dentro de una historia (este último solo aparece al abrir una).
const PROJECT_ITEMS: NavItem[] = [
  { label: "Historias", icon: "list", path: "/stories" },
  { label: "Configuración", icon: "settings", path: "/settings" },
];

const QUALITY_ITEMS: NavItem[] = [
  { label: "Análisis transversal", icon: "alert", path: "/transversal" },
  { label: "Métricas y mejora", icon: "chart", path: "/metricas" },
  { label: "Informes", icon: "download", path: "/reports" },
  { label: "Evaluación de la IA", icon: "search", path: "/evaluacion" },
];

const STORY_ITEMS: NavItem[] = [
  { label: "Análisis de calidad", icon: "check", path: "/analysis" },
  { label: "Casos de prueba", icon: "check", path: "/tests" },
  { label: "Sesiones QA", icon: "bug", path: "/sessions" },
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
  const story = useMatch("/p/:projectId/stories/:storyId/*");
  const storyBase =
    base && story?.params.storyId
      ? `${base}/stories/${story.params.storyId}`
      : null;

  function link(item: NavItem, prefix: string, key = item.path): ReactNode {
    const to = prefix + item.path;
    const current = pathname === to || pathname.startsWith(`${to}/`);
    return (
      <li key={key}>
        <Link
          to={to}
          className="nav__item"
          aria-current={current ? "page" : undefined}
          onClick={onNavigate}
        >
          <Icon name={item.icon} />
          <span className="nav__label">{item.label}</span>
        </Link>
      </li>
    );
  }

  function group(title: string, items: ReactNode, id: string): ReactNode {
    return (
      <section className="nav__group" aria-labelledby={id}>
        <h2 id={id} className="nav__title">
          {title}
        </h2>
        <ul className="nav__list">{items}</ul>
      </section>
    );
  }

  return (
    <nav aria-label="Módulos" className="nav">
      <Link
        to="/"
        className="nav__item"
        aria-current={pathname === "/" ? "page" : undefined}
        onClick={onNavigate}
      >
        <Icon name="home" />
        <span className="nav__label">Todos los proyectos</span>
      </Link>
      {base ? (
        <>
          {group(
            "Proyecto",
            <>
              <li>
                <Link
                  to={base}
                  className="nav__item"
                  aria-current={pathname === base ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <Icon name="chart" />
                  <span className="nav__label">Resumen</span>
                </Link>
              </li>
              {PROJECT_ITEMS.map((item) => link(item, base))}
            </>,
            "nav-project",
          )}
          {storyBase
            ? group(
                "Historia abierta",
                STORY_ITEMS.map((item) => link(item, storyBase)),
                "nav-story",
              )
            : null}
          {group(
            "Calidad del proyecto",
            QUALITY_ITEMS.map((item) => link(item, base)),
            "nav-quality",
          )}
        </>
      ) : (
        <p className="nav__note">Elige un proyecto para ver su menú.</p>
      )}
    </nav>
  );
}

function StatusBadges() {
  const { me, aiConfigured, aiQuotaRemaining, logout } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState(false);
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
          <Button
            variant="ghost"
            onClick={() => {
              setLogoutError(false);
              logout().then(
                () => navigate("/", { replace: true }),
                () => setLogoutError(true),
              );
            }}
          >
            Cerrar sesión
          </Button>
          {logoutError ? (
            <span role="alert" className="nav__note">
              No se pudo cerrar la sesión. Inténtalo de nuevo.
            </span>
          ) : null}
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

const TITLES: [RegExp, string][] = [
  [/\/login$/, "Iniciar sesión"],
  [/\/stories\/[^/]+\/analysis$/, "Análisis"],
  [/\/stories\/[^/]+\/tests$/, "Casos de prueba"],
  [/\/stories\/[^/]+\/sessions(\/[^/]+)?$/, "Sesiones QA"],
  [/\/stories$/, "Historias"],
  [/\/reports$/, "Informes"],
  [/\/transversal$/, "Análisis transversal"],
  [/\/metricas$/, "Métricas y mejora"],
  [/\/evaluacion$/, "Evaluación de la IA"],
  [/\/settings$/, "Configuración"],
  [/^\/p\/[^/]+$/, "Resumen"],
  [/^\/$/, "Proyectos"],
];

function pageTitle(pathname: string) {
  return TITLES.find(([pattern]) => pattern.test(pathname))?.[1];
}

function ShellFrame() {
  const { projectId, project, status, error, reload, projects } = useProject();
  const narrow = useIsNarrow();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  // Sin proyecto válido no se ofrecen enlaces específicos de proyecto.
  const scopedId = status === "notfound" ? undefined : projectId;
  const [lastPath, setLastPath] = useState(pathname);

  // Cerrar el menú móvil al navegar (ajuste durante el render, sin efecto).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

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
    if (scopedId) {
      const base = `/p/${scopedId}`;
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
  }, [scopedId, projects]);

  const section = pageTitle(pathname);
  const projectName = status === "ready" ? project?.name : undefined;
  useEffect(() => {
    document.title = [section, projectName, "StoryLens"]
      .filter(Boolean)
      .join(" · ");
  }, [section, projectName]);

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
          <button
            ref={menuButtonRef}
            type="button"
            className="btn btn--ghost"
            aria-expanded={menuOpen}
            aria-controls="barra-lateral"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menú
          </button>
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
      <div
        id="barra-lateral"
        className="shell__side"
        onKeyDown={(event) => {
          if (event.key === "Escape" && narrow && menuOpen) {
            event.preventDefault();
            setMenuOpen(false);
            menuButtonRef.current?.focus();
          }
        }}
      >
        {narrow && !menuOpen ? null : (
          <aside className="sidebar">
            <ProjectSelect projects={projects} projectId={scopedId} />
            <ModuleNav
              projectId={scopedId}
              onNavigate={() => {
                // Desde el menú móvil, el foco pasa al contenido de la nueva pantalla.
                if (narrow) {
                  setMenuOpen(false);
                  mainRef.current?.focus();
                }
              }}
            />
            <StatusBadges />
          </aside>
        )}
      </div>
      <main id="contenido" ref={mainRef} className="content" tabIndex={-1}>
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
  const authenticated = useSession().me?.authenticated ?? false;
  // Al cambiar la sesión se descarta todo el estado de proyectos y pantallas,
  // para que no queden datos privados en pantalla tras cerrar sesión.
  return (
    <ProjectProvider key={String(authenticated)} projectId={projectId}>
      <ShellFrame />
    </ProjectProvider>
  );
}
