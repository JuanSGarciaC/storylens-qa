import { Button } from "../shared/ui/Button";
import { Spinner } from "../shared/ui/Spinner";

export function ServerWaking({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="server-waking">
      <Spinner label="El servidor está despertando…" />
      <p>
        El servicio gratuito se duerme tras un rato sin uso y puede tardar hasta
        un minuto en responder. Se reintentará solo; también puedes hacerlo
        ahora.
      </p>
      <Button onClick={onRetry}>Reintentar</Button>
    </div>
  );
}
