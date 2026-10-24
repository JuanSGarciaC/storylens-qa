import { useParams } from "react-router-dom";
import { EmptyState } from "../shared/ui/EmptyState";
import { ErrorNotice } from "../shared/ui/ErrorNotice";
import { Spinner } from "../shared/ui/Spinner";
import { useStory } from "./useStory";

/** Marcador de posición de las pantallas de historia (Tareas 7–9 lo sustituyen). */
export function StoryScreenPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const { projectId, storyId } = useParams();
  const { story, loading, error } = useStory(projectId, storyId);
  if (error) return <ErrorNotice message={error} />;
  if (loading || !story) return <Spinner label="Cargando historia…" />;
  return (
    <EmptyState
      title={`${title}: ${story.title}`}
      body={`${body} Próximamente.`}
    />
  );
}
