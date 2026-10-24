import { useCallback, useEffect, useState } from "react";
import {
  createAnalysis,
  createStory,
  decideFinding,
  deleteStory,
  getAnalysis,
  getHealth,
  listStories,
  type Analysis,
  type Decision,
  type Finding,
  type StoryInput,
  type StoryItem,
} from "../api/client";
import { AnalysisResult } from "../features/analysis/AnalysisResult";
import { StoryForm } from "../features/analysis/StoryForm";
import { ImportPanel } from "../features/import/ImportPanel";
import { QASessionPanel } from "../features/qa-session/QASessionPanel";
import { TestDesignPanel } from "../features/test-design/TestDesignPanel";
import { StoryHistory } from "../features/stories/StoryHistory";

const LEGACY_PROJECT_ID = "p1"; // TODO fase B: se elimina con App.tsx (tarea 12)

export function App() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  /** Ejecuta una acción mostrando el estado de carga y cualquier error de la API. */
  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshStories = useCallback(
    async () => setStories(await listStories(LEGACY_PROJECT_ID)),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    listStories(LEGACY_PROJECT_ID)
      .then((items) => {
        if (!cancelled) setStories(items);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Error inesperado.");
      });
    getHealth()
      .then((health) => {
        if (!cancelled) setAiAvailable(health.ai_configured);
      })
      .catch(() => {
        // sin conexión: el aviso de error ya lo muestra la carga del historial
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (input: StoryInput, useAi: boolean) =>
    run(async () => {
      const story = await createStory(LEGACY_PROJECT_ID, input);
      setAnalysis(await createAnalysis(story.id, useAi));
      setSelectedId(story.id);
      await refreshStories();
    });

  const handleSelect = (story: StoryItem) =>
    run(async () => {
      if (!story.latest_analysis) return;
      setAnalysis(await getAnalysis(story.latest_analysis.id));
      setSelectedId(story.id);
    });

  const handleAnalyze = (story: StoryItem) =>
    run(async () => {
      setAnalysis(await createAnalysis(story.id, aiAvailable));
      setSelectedId(story.id);
      await refreshStories();
    });

  const handleImported = async (count: number) => {
    setImportedCount(count);
    await refreshStories();
  };

  const handleDelete = (story: StoryItem) => {
    if (!window.confirm("¿Eliminar esta historia y sus análisis?")) return;
    return run(async () => {
      await deleteStory(story.id);
      if (story.id === selectedId) {
        setAnalysis(null);
        setSelectedId(null);
      }
      await refreshStories();
    });
  };

  const handleDecide = (
    finding: Finding,
    decision: Decision,
    reason?: string,
  ) => {
    if (!finding.id) return;
    const findingId = finding.id;
    return run(async () => {
      setAnalysis(await decideFinding(findingId, decision, reason));
      await refreshStories();
    });
  };

  return (
    <>
      <header className="app-header">
        <div className="hero">
          <svg
            className="logo"
            viewBox="0 0 48 48"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="21" cy="21" r="12" />
            <path d="M16 21l4 4 8-9" />
            <path d="M30 30l11 11" />
          </svg>
          <div>
            <h1>StoryLens QA</h1>
            <p>Revisa si una historia de usuario está lista para probarse.</p>
          </div>
        </div>
        <ul className="pillars" aria-label="Qué hace">
          <li>Reglas ISTQB / INVEST</li>
          <li>Casos de prueba y Gherkin</li>
          <li>Sesión QA y reportes PDF</li>
        </ul>
      </header>

      <main>
        <StoryForm
          loading={busy}
          aiAvailable={aiAvailable}
          onSubmit={handleSubmit}
        />

        <ImportPanel
          projectId={LEGACY_PROJECT_ID}
          busy={busy}
          run={run}
          onImported={handleImported}
        />

        <div aria-live="polite">
          {importedCount !== null && (
            <p role="status" className="card notice">
              Se importaron {importedCount}{" "}
              {importedCount === 1 ? "historia" : "historias"}. Pulsa «Analizar»
              en el historial para revisarlas.
            </p>
          )}
          {error && (
            <p role="alert" className="card error">
              {error}
            </p>
          )}
          {analysis && (
            <AnalysisResult
              analysis={analysis}
              busy={busy}
              onDecide={handleDecide}
            />
          )}
        </div>

        {selectedId && (
          <TestDesignPanel
            key={selectedId}
            storyId={selectedId}
            aiAvailable={aiAvailable}
          />
        )}

        {selectedId && (
          <QASessionPanel
            key={`qa-${selectedId}`}
            storyId={selectedId}
            aiAvailable={aiAvailable}
          />
        )}

        <StoryHistory
          stories={stories}
          selectedId={selectedId}
          busy={busy}
          onSelect={handleSelect}
          onAnalyze={handleAnalyze}
          onDelete={handleDelete}
        />
      </main>
    </>
  );
}
