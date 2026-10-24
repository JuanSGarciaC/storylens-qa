import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createSession,
  listSessions,
  type SessionSummary,
} from "../../api/client";
import { SessionView } from "./SessionView";

interface Props {
  storyId: string;
  aiAvailable: boolean;
}

export function QASessionPanel({ storyId, aiAvailable }: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [build, setBuild] = useState("");
  const [tester, setTester] = useState("");

  useEffect(() => {
    let cancelled = false;
    listSessions(storyId)
      .then((loaded) => {
        if (!cancelled) setSessions(loaded);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Error inesperado.");
      });
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  const refresh = useCallback(async () => {
    try {
      setSessions(await listSessions(storyId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    }
  }, [storyId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createSession(storyId, {
        environment_name: name.trim(),
        environment_url: url.trim(),
        build_version: build.trim(),
        tester_name: tester.trim(),
      });
      setSelectedId(created.id);
      setName("");
      setUrl("");
      setBuild("");
      setTester("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="qa-title">
      <h2 id="qa-title">Revisión en el ambiente QA</h2>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="form" aria-label="Nueva sesión">
        <h3>Nueva sesión</h3>
        <p className="hint">
          La sesión incluye los casos de prueba <strong>aceptados</strong> de
          esta historia.
        </p>
        <div className="row">
          <label>
            Ambiente
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            URL del ambiente
            <input
              type="url"
              value={url}
              placeholder="https://"
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="row">
          <label>
            Build / versión
            <input value={build} onChange={(e) => setBuild(e.target.value)} />
          </label>
          <label>
            Responsable
            <input value={tester} onChange={(e) => setTester(e.target.value)} />
          </label>
        </div>
        <button type="submit" disabled={busy || !name.trim() || !url.trim()}>
          Iniciar sesión
        </button>
      </form>

      {sessions.length > 0 && (
        <>
          <h3>Sesiones de esta historia</h3>
          <ul className="history">
            {sessions.map((session) => (
              <li
                key={session.id}
                className={session.id === selectedId ? "selected" : undefined}
              >
                <button
                  type="button"
                  className="link"
                  aria-current={session.id === selectedId ? "true" : undefined}
                  onClick={() => setSelectedId(session.id)}
                >
                  {session.environment_name} ·{" "}
                  {new Date(session.started_at).toLocaleDateString("es")}
                </button>
                <span className="meta">
                  {session.closed_at ? "Cerrada" : "En curso"}
                </span>
                <span />
              </li>
            ))}
          </ul>
        </>
      )}

      {selectedId && (
        <SessionView
          key={selectedId}
          sessionId={selectedId}
          aiAvailable={aiAvailable}
          onClosed={() => void refresh()}
        />
      )}
    </section>
  );
}
