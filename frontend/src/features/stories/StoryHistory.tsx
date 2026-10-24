import type { StoryItem } from "../../api/client";

const VERDICT_LABEL: Record<string, string> = {
  ready: "Lista",
  ready_with_notes: "Con observaciones",
  not_ready: "No lista",
};

interface Props {
  stories: StoryItem[];
  selectedId: string | null;
  busy: boolean;
  onSelect: (story: StoryItem) => void;
  onAnalyze: (story: StoryItem) => void;
  onDelete: (story: StoryItem) => void;
}

export function StoryHistory({
  stories,
  selectedId,
  busy,
  onSelect,
  onAnalyze,
  onDelete,
}: Props) {
  return (
    <section className="card" aria-labelledby="history-title">
      <h2 id="history-title">Historial</h2>
      {stories.length === 0 ? (
        <p className="meta">Aún no has analizado ninguna historia.</p>
      ) : (
        <ul className="history">
          {stories.map((story) => {
            const title =
              story.title || story.description.slice(0, 60) || "Sin título";
            const latest = story.latest_analysis;
            return (
              <li
                key={story.id}
                className={story.id === selectedId ? "selected" : undefined}
              >
                <button
                  type="button"
                  className="link"
                  disabled={busy || !latest}
                  aria-current={story.id === selectedId ? "true" : undefined}
                  onClick={() => onSelect(story)}
                >
                  {title}
                </button>
                <span className="meta">
                  {latest
                    ? `${latest.score}/100 · ${VERDICT_LABEL[latest.verdict]}`
                    : "Sin análisis"}
                </span>
                {!latest && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Analizar ${title}`}
                    onClick={() => onAnalyze(story)}
                  >
                    Analizar
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  aria-label={`Eliminar ${title}`}
                  onClick={() => onDelete(story)}
                >
                  Eliminar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
