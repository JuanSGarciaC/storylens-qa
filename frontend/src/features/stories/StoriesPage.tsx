import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../app/session";
import * as api from "../../api/client";
import type { Named, StoryInput, StoryItem } from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useAccess } from "../../shared/useAccess";
import { useLoad } from "../../shared/useLoad";
import { Badge, type Tone } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Spinner } from "../../shared/ui/Spinner";
import { classifyStory, type StoryState } from "../projects/classifyStory";
import { ImportPanel } from "./ImportPanel";
import { RecentImports } from "./RecentImports";
import { StoryCreateForm } from "./StoryCreateForm";

const PAGE_SIZE = 50;

const STATE_LABEL: Record<StoryState, string> = {
  unanalyzed: "Sin analizar",
  notReady: "No lista",
  notes: "Con observaciones",
  ready: "Lista",
};
const STATE_TONE: Record<StoryState, Tone> = {
  unanalyzed: "neutral",
  notReady: "danger",
  notes: "warn",
  ready: "ok",
};

type Filters = {
  text: string;
  epic: string;
  version: string;
  state: string;
  order: string;
};
const NO_FILTERS: Filters = {
  text: "",
  epic: "",
  version: "",
  state: "",
  order: "",
};

const displayTitle = (s: StoryItem) =>
  s.title || s.description.slice(0, 60) || "Sin título";

function Select(props: {
  id: string;
  label: string;
  value: string;
  all: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={props.id}>
        {props.label}
      </label>
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">{props.all}</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const named = (list: Named[]) =>
  list.map((n) => ({ value: n.id, label: n.name }));

export function StoriesPage() {
  const { project, projectId } = useProject();
  const access = useAccess(project);
  const authenticated = useSession().me?.authenticated ?? false;
  const pid = projectId ?? "";
  const data = useLoad(
    () =>
      Promise.all([
        api.listStories(pid),
        api.listEpics(pid),
        api.listVersions(pid),
      ]),
    `stories-page-${pid}`,
  );
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const rawStories = data.data?.[0];
  const settings = project?.settings;
  const filtered = useMemo(() => {
    if (!rawStories || !settings) return [];
    const needle = filters.text.trim().toLowerCase();
    const rows = rawStories
      .map((story) => ({
        story,
        state: classifyStory(story, settings),
        haystack:
          `${story.id} ${story.title} ${story.description}`.toLowerCase(),
      }))
      .filter(
        (r) =>
          (!needle || r.haystack.includes(needle)) &&
          (!filters.epic || r.story.epic_id === filters.epic) &&
          (!filters.version || r.story.version_id === filters.version) &&
          (!filters.state || r.state === filters.state),
      );
    if (filters.order) {
      const sign = filters.order === "score-asc" ? 1 : -1;
      const score = (s: StoryItem) => s.latest_analysis?.score ?? null;
      rows.sort((a, b) => {
        const x = score(a.story);
        const y = score(b.story);
        if (x === null || y === null) {
          return x === y ? 0 : x === null ? 1 : -1;
        }
        return (x - y) * sign;
      });
    }
    return rows;
  }, [rawStories, settings, filters]);

  // Tras «Mostrar más», el foco pasa a la primera fila nueva (el botón puede desaparecer).
  const focusFrom = useRef<number | null>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);
  useEffect(() => {
    if (focusFrom.current === null) return;
    const link = tableRef.current?.rows[focusFrom.current]?.querySelector("a");
    focusFrom.current = null;
    link?.focus();
  }, [limit]);

  // Sin proyecto, el Shell ya muestra carga, «no encontrado» o error.
  if (!project) return <Spinner label="Cargando proyecto…" />;
  if (data.loading) return <Spinner label="Cargando historias…" />;
  if (data.error || !data.data) {
    return <ErrorNotice message={data.error} onRetry={data.reload} />;
  }
  const [stories, epics, versions] = data.data;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setBusy(false);
    }
  }

  function handleCreate(input: StoryInput) {
    void run(async () => {
      const created = await api.createStory(pid, input);
      data.set([[created, ...stories], epics, versions]);
      setCreating(false);
      setNotice("Historia creada.");
    });
  }

  function change(patch: Partial<Filters>) {
    setFilters({ ...filters, ...patch });
    setLimit(PAGE_SIZE);
  }

  const visible = filtered.slice(0, limit);
  const nameOf = (list: Named[], id?: string | null) =>
    list.find((n) => n.id === id)?.name ?? "—";

  const tools = access.canWrite ? (
    <>
      {creating ? (
        <StoryCreateForm
          epics={epics}
          versions={versions}
          busy={busy}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      ) : null}
      <ImportPanel
        projectId={pid}
        busy={busy}
        run={run}
        canUseAi={access.canUseAi}
      />
      <RecentImports projectId={pid} />
    </>
  ) : (
    <div className="panel">
      <p>{access.reason}</p>
      <p className="hint">
        Para analizar tus propias historias,{" "}
        {authenticated ? (
          <>
            abre o crea un proyecto tuyo en{" "}
            <Link to="/">Todos los proyectos</Link>
          </>
        ) : (
          <>
            <Link to="/login">inicia sesión</Link> y crea un proyecto
          </>
        )}
        : ahí podrás escribir tus historias o cargar un archivo de Jira (CSV o
        JSON).
      </p>
    </div>
  );

  const createButton =
    access.canWrite && !creating ? (
      <Button onClick={() => setCreating(true)}>Crear historia</Button>
    ) : null;

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Historias</h1>
        <p className="page__lead">
          {stories.length} {stories.length === 1 ? "historia" : "historias"} en{" "}
          {project.name}.
        </p>
      </header>
      <div aria-live="polite">
        {notice ? (
          <p role="status" className="hint">
            {notice}
          </p>
        ) : null}
      </div>
      {error ? <ErrorNotice message={error} /> : null}

      {stories.length === 0 ? (
        <>
          <EmptyState
            title="Aún no hay historias"
            body="Importa historias desde Jira o crea la primera para empezar a analizarlas."
            action={createButton}
          />
          {tools}
        </>
      ) : (
        <>
          {createButton}
          {tools}
          <div className="filters" role="search">
            <div className="field">
              <label className="field__label" htmlFor="f-text">
                Buscar
              </label>
              <input
                id="f-text"
                type="search"
                value={filters.text}
                placeholder="Título, descripción o ID"
                onChange={(e) => change({ text: e.target.value })}
              />
            </div>
            <Select
              id="f-epic"
              label="Épica"
              all="Todas"
              value={filters.epic}
              options={named(epics)}
              onChange={(epic) => change({ epic })}
            />
            <Select
              id="f-version"
              label="Versión"
              all="Todas"
              value={filters.version}
              options={named(versions)}
              onChange={(version) => change({ version })}
            />
            <Select
              id="f-state"
              label="Estado"
              all="Todos"
              value={filters.state}
              options={(Object.keys(STATE_LABEL) as StoryState[]).map((k) => ({
                value: k,
                label: STATE_LABEL[k],
              }))}
              onChange={(state) => change({ state })}
            />
            <Select
              id="f-order"
              label="Orden"
              all="Más recientes"
              value={filters.order}
              options={[
                { value: "score-desc", label: "Puntaje: mayor a menor" },
                { value: "score-asc", label: "Puntaje: menor a mayor" },
              ]}
              onChange={(order) => change({ order })}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Ninguna historia coincide"
              body="Prueba con otra búsqueda o quita algún filtro."
              action={
                <Button variant="ghost" onClick={() => change(NO_FILTERS)}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <caption className="visually-hidden">
                    Historias del proyecto
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Título</th>
                      <th scope="col">Épica</th>
                      <th scope="col">Versión</th>
                      <th scope="col" className="table__num">
                        Puntaje
                      </th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody ref={tableRef}>
                    {visible.map(({ story: s, state }) => {
                      return (
                        <tr key={s.id}>
                          <td className="mono table__id" title={s.id}>
                            {s.id}
                          </td>
                          <td className="table__title">
                            <Link
                              to={`/p/${project.id}/stories/${s.id}/analysis`}
                            >
                              {displayTitle(s)}
                            </Link>
                          </td>
                          <td>{nameOf(epics, s.epic_id)}</td>
                          <td>{nameOf(versions, s.version_id)}</td>
                          <td className="mono table__num">
                            {s.latest_analysis
                              ? `${s.latest_analysis.score}/100`
                              : "—"}
                          </td>
                          <td>
                            <Badge tone={STATE_TONE[state]}>
                              {STATE_LABEL[state]}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="hint" aria-live="polite">
                Mostrando {visible.length} de {filtered.length}.
              </p>
              {filtered.length > visible.length ? (
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      focusFrom.current = visible.length;
                      setLimit(limit + PAGE_SIZE);
                    }}
                  >
                    Mostrar más
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
