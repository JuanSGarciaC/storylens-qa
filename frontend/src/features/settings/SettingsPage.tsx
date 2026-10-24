import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api/client";
import type { Named, Project } from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useAccess } from "../../shared/useAccess";
import type { Access } from "../../shared/useAccess";
import { useLoad } from "../../shared/useLoad";
import { Button } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Field } from "../../shared/ui/Field";
import { Spinner } from "../../shared/ui/Spinner";

const REASON_ID = "settings-reason";

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** Atributos de un botón de escritura: deshabilitado y con el motivo asociado. */
function writeProps(access: Access) {
  return access.canWrite
    ? {}
    : { disabled: true, "aria-describedby": REASON_ID };
}

function Status({ error, saved }: { error: string; saved: string }) {
  if (error) return <ErrorNotice message={error} />;
  return saved ? (
    <p className="hint" role="status">
      {saved}
    </p>
  ) : null;
}

function ProjectData({
  project,
  access,
}: {
  project: Project;
  access: Access;
}) {
  const { reload, refreshProjects } = useProject();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [objective, setObjective] = useState(project.objective);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("El nombre no puede estar vacío.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await api.updateProject(project.id, {
        name: name.trim(),
        description,
        objective,
      });
      setSaved("Datos guardados.");
      refreshProjects();
      reload();
    } catch (e) {
      setError(message(e, "No se pudieron guardar los datos."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Datos del proyecto</h2>
      <fieldset className="form-grid" disabled={!access.canWrite}>
        <Field label="Nombre del proyecto">
          <input
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Descripción">
          <textarea
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Objetivo">
          <textarea
            rows={3}
            maxLength={2000}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
        </Field>
      </fieldset>
      <Status error={error} saved={saved} />
      <div>
        <Button type="submit" loading={busy} {...writeProps(access)}>
          Guardar datos
        </Button>
      </div>
    </form>
  );
}

function RulesForm({ project, access }: { project: Project; access: Access }) {
  const { reload } = useProject();
  const rules = useLoad(() => api.listRules(), "rules");
  const settings = project.settings;
  const [disabled, setDisabled] = useState<string[]>(
    settings.disabled_rules ?? [],
  );
  const [low, setLow] = useState(String(settings.not_ready_below ?? 60));
  const [high, setHigh] = useState(String(settings.ready_from ?? 85));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const toggle = (id: string, enabled: boolean) =>
    setDisabled((current) =>
      enabled ? current.filter((r) => r !== id) : [...current, id],
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved("");
    const notReady = Number(low);
    const ready = Number(high);
    const valid =
      Number.isInteger(notReady) &&
      Number.isInteger(ready) &&
      notReady >= 0 &&
      notReady < ready &&
      ready <= 100;
    if (!valid) {
      setError(
        "El umbral «no lista» debe ser menor que el umbral «lista», ambos enteros entre 0 y 100.",
      );
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api.updateProject(project.id, {
        settings: {
          disabled_rules: disabled,
          penalties: settings.penalties ?? null,
          not_ready_below: notReady,
          ready_from: ready,
        },
      });
      setSaved("Reglas y umbrales guardados.");
      reload();
    } catch (e) {
      setError(message(e, "No se pudo guardar la configuración."));
    } finally {
      setBusy(false);
    }
  }

  let list;
  if (rules.loading) list = <Spinner label="Cargando reglas…" />;
  else if (rules.error || !rules.data) {
    list = <ErrorNotice message={rules.error} onRetry={rules.reload} />;
  } else {
    list = (
      <ul className="rule-list">
        {rules.data.map((rule) => (
          <li key={rule.id}>
            <label>
              <input
                type="checkbox"
                checked={!disabled.includes(rule.id)}
                onChange={(e) => toggle(rule.id, e.target.checked)}
              />
              <span className="rule-list__text">
                <span>
                  {rule.name} <span className="mono">{rule.id}</span>
                </span>
                <span className="hint">{rule.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Reglas y umbrales</h2>
      <p className="hint">
        Una regla desmarcada deja de evaluarse en los próximos análisis.
      </p>
      <fieldset
        className="form-grid"
        disabled={!access.canWrite}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <legend className="visually-hidden">Reglas activas</legend>
        {list}
        <div className="thresholds">
          <Field label="No lista por debajo de">
            <input
              type="number"
              min={0}
              max={100}
              value={low}
              onChange={(e) => setLow(e.target.value)}
            />
          </Field>
          <Field label="Lista desde">
            <input
              type="number"
              min={0}
              max={100}
              value={high}
              onChange={(e) => setHigh(e.target.value)}
            />
          </Field>
        </div>
      </fieldset>
      <Status error={error} saved={saved} />
      <div>
        <Button type="submit" loading={busy} {...writeProps(access)}>
          Guardar reglas
        </Button>
      </div>
    </form>
  );
}

function NamedList({
  project,
  access,
  title,
  label,
  addLabel,
  load,
  create,
}: {
  project: Project;
  access: Access;
  title: string;
  label: string;
  addLabel: string;
  load: (projectId: string) => Promise<Named[]>;
  create: (projectId: string, name: string) => Promise<Named>;
}) {
  const items = useLoad(() => load(project.id), `${title}-${project.id}`);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Escribe un nombre.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await create(project.id, name.trim());
      items.set([...(items.data ?? []), created]);
      setName("");
    } catch (e) {
      setError(message(e, "No se pudo crear."));
    } finally {
      setBusy(false);
    }
  }

  let list;
  if (items.loading) list = <Spinner label="Cargando…" />;
  else if (items.error || !items.data) {
    list = <ErrorNotice message={items.error} onRetry={items.reload} />;
  } else if (items.data.length === 0) {
    list = <p className="hint">Todavía no hay elementos.</p>;
  } else {
    list = (
      <ul className="name-list">
        {items.data.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    );
  }

  return (
    <section className="panel" aria-label={title}>
      <h2>{title}</h2>
      {list}
      <form className="inline-form" onSubmit={submit} noValidate>
        <Field label={label}>
          <input
            value={name}
            maxLength={120}
            disabled={!access.canWrite}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Button type="submit" loading={busy} {...writeProps(access)}>
          {addLabel}
        </Button>
      </form>
      {error ? <ErrorNotice message={error} /> : null}
    </section>
  );
}

function DangerZone({ project, access }: { project: Project; access: Access }) {
  const navigate = useNavigate();
  const { refreshProjects } = useProject();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = typed === project.name;

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api.deleteProject(project.id);
      refreshProjects();
      navigate("/");
    } catch (e) {
      setError(message(e, "No se pudo eliminar el proyecto."));
      setBusy(false);
    }
  }

  return (
    <section className="panel panel--danger" aria-label="Eliminar proyecto">
      <h2>Eliminar proyecto</h2>
      <p className="hint">
        Se borran también sus historias, análisis, casos de prueba y sesiones.
        No se puede deshacer.
      </p>
      <div className="form-grid">
        <Field label={`Escribe «${project.name}» para confirmar`}>
          <input
            value={typed}
            disabled={!access.canWrite}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </Field>
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      <div>
        <Button
          variant="danger"
          loading={busy}
          onClick={remove}
          {...writeProps(access)}
          disabled={!access.canWrite || !matches}
        >
          Eliminar proyecto
        </Button>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const { project } = useProject();
  const access = useAccess(project);
  if (!project) return <Spinner label="Cargando proyecto…" />;

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Configuración</h1>
        <p className="page__lead">{project.name}</p>
        {!access.canWrite && access.reason ? (
          <p id={REASON_ID} className="hint">
            {access.reason}
          </p>
        ) : null}
      </header>
      <ProjectData project={project} access={access} />
      <RulesForm project={project} access={access} />
      <NamedList
        project={project}
        access={access}
        title="Épicas"
        label="Nueva épica"
        addLabel="Agregar épica"
        load={api.listEpics}
        create={api.createEpic}
      />
      <NamedList
        project={project}
        access={access}
        title="Versiones"
        label="Nueva versión"
        addLabel="Agregar versión"
        load={api.listVersions}
        create={api.createVersion}
      />
      <DangerZone project={project} access={access} />
    </div>
  );
}
