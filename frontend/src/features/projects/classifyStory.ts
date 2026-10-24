import type { Project, StoryItem } from "../../api/client";

export type StoryState = "unanalyzed" | "blocking" | "notes" | "ready";

type Settings = Project["settings"];

/**
 * Clasifica una historia para el resumen del proyecto.
 *
 * Fuente: `latest_analysis` (único dato de análisis que expone `StoryOut`).
 * - Sin análisis: "unanalyzed".
 * - El veredicto del servidor manda, porque ya aplicó los umbrales del proyecto
 *   al analizar: `not_ready` -> "blocking" (el backend lo emite con bloqueantes
 *   o con puntaje bajo `not_ready_below`), `ready_with_notes` -> "notes",
 *   `ready` -> "ready".
 * - Si el veredicto no se reconoce, se deriva del puntaje con los umbrales
 *   del proyecto: < not_ready_below -> "blocking"; < ready_from -> "notes";
 *   en otro caso "ready".
 */
export function classifyStory(
  story: StoryItem,
  settings: Settings,
): StoryState {
  const latest = story.latest_analysis;
  if (!latest) return "unanalyzed";
  if (latest.verdict === "not_ready") return "blocking";
  if (latest.verdict === "ready_with_notes") return "notes";
  if (latest.verdict === "ready") return "ready";
  if (latest.score < (settings.not_ready_below ?? 60)) return "blocking";
  if (latest.score < (settings.ready_from ?? 85)) return "notes";
  return "ready";
}

export type StorySummary = {
  total: number;
  analyzed: number;
  counts: Record<StoryState, number>;
  /** Puntaje medio de las historias analizadas; null si no hay ninguna. */
  meanScore: number | null;
  /** % (entero) de historias analizadas con bloqueantes; null si no hay ninguna. */
  blockingPercent: number | null;
};

export function summarizeStories(
  stories: StoryItem[],
  settings: Settings,
): StorySummary {
  const counts: Record<StoryState, number> = {
    unanalyzed: 0,
    blocking: 0,
    notes: 0,
    ready: 0,
  };
  let scoreSum = 0;
  for (const story of stories) {
    counts[classifyStory(story, settings)] += 1;
    if (story.latest_analysis) scoreSum += story.latest_analysis.score;
  }
  const analyzed = stories.length - counts.unanalyzed;
  return {
    total: stories.length,
    analyzed,
    counts,
    meanScore: analyzed > 0 ? scoreSum / analyzed : null,
    blockingPercent:
      analyzed > 0 ? Math.round((counts.blocking / analyzed) * 100) : null,
  };
}
