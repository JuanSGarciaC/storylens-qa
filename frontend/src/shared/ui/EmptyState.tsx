import type { ReactNode } from "react";

type Props = { title: string; body: string; action?: ReactNode };

export function EmptyState({ title, body, action }: Props) {
  return (
    <div className="empty">
      <h3 className="empty__title">{title}</h3>
      <p className="empty__body">{body}</p>
      {action}
    </div>
  );
}
