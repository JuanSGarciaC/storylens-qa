import { Button } from "./Button";

type Props = { message: string; onRetry?: () => void };

export function ErrorNotice({ message, onRetry }: Props) {
  return (
    <div className="notice" role="alert">
      <span>{message}</span>
      {onRetry ? (
        <Button variant="ghost" onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}
