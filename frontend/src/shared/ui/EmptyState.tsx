import type { ReactNode } from "react";

type Props = {
  title: string;
  body: string;
  action?: ReactNode;
  /** Nivel del encabezado (por defecto 3); las pantallas de error usan 1. */
  headingLevel?: 1 | 2 | 3;
};

export function EmptyState({ title, body, action, headingLevel = 3 }: Props) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className="empty">
      <Heading className="empty__title">{title}</Heading>
      <p className="empty__body">{body}</p>
      {action}
    </div>
  );
}
