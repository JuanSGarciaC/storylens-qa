import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../../api/client";
import { useProject } from "../../app/ProjectContext";
import { useSession } from "../../app/session";
import { useLoad } from "../../shared/useLoad";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Field } from "../../shared/ui/Field";
import { Spinner } from "../../shared/ui/Spinner";

function CreateProject() {
  const navigate = useNavigate();
  const { refreshProjects } = useProject();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Escribe el nombre del proyecto.");
      return;
    }
    setNameError("");
    setError("");
    setBusy(true);
    try {
      const created = await api.createProject({
        name: name.trim(),
        description,
        objective,
      });
      refreshProjects();
      navigate(`/p/${created.id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo crear el proyecto.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Nuevo proyecto</h2>
      <div className="form-grid">
        <Field label="Nombre" error={nameError}>
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
        <Field
          label="Objetivo"
          hint="Qué busca lograr el equipo con este proyecto."
        >
          <textarea
            rows={3}
            maxLength={2000}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
        </Field>
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      <div>
        <Button type="submit" loading={busy}>
          Crear proyecto
        </Button>
      </div>
    </form>
  );
}

export function ProjectsPage() {
  const authenticated = useSession().me?.authenticated ?? false;
  const list = useLoad(() => api.listProjects(), "projects");

  let body;
  if (list.loading) body = <Spinner label="Cargando proyectos…" />;
  else if (list.error) {
    body = <ErrorNotice message={list.error} onRetry={list.reload} />;
  } else if (!list.data?.length) {
    body = (
      <>
        <h2 className="visually-hidden">Lista de proyectos</h2>
        <EmptyState
          title="Sin proyectos"
          body="Todavía no hay proyectos visibles."
        />
      </>
    );
  } else {
    body = (
      <ul className="project-list">
        {list.data.map((project) => (
          <li key={project.id}>
            <span className="project-list__name">
              <Link to={`/p/${project.id}`}>{project.name}</Link>
              {project.is_demo ? <Badge tone="info">Demostración</Badge> : null}
            </span>
            {project.description ? <p>{project.description}</p> : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Proyectos</h1>
        <p className="page__lead">
          Cada proyecto agrupa sus historias, análisis, pruebas e informes.
        </p>
      </header>
      {body}
      {authenticated ? (
        <CreateProject />
      ) : (
        <p className="hint">
          Inicia sesión para crear proyectos propios; el proyecto de
          demostración es de solo lectura.{" "}
          <Link to="/login">Iniciar sesión</Link>
        </p>
      )}
    </div>
  );
}
