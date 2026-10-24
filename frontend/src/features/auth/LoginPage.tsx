import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../../app/session";
import { Button } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Field } from "../../shared/ui/Field";

/** Solo rutas internas: empiezan por una única «/» y sin barras invertidas ni control. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  // eslint-disable-next-line no-control-regex
  if (next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState({ email: false, password: false });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = { email: !email.trim(), password: !password };
    setMissing(next);
    if (next.email || next.password) return;
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(safeNext(params.get("next")), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <h1>Iniciar sesión</h1>
      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Correo electrónico"
          error={missing.email ? "Escribe tu correo electrónico." : undefined}
        >
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          label="Contraseña"
          error={missing.password ? "Escribe tu contraseña." : undefined}
        >
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? <ErrorNotice message={error} /> : null}
        <Button type="submit" loading={busy}>
          Iniciar sesión
        </Button>
      </form>
    </main>
  );
}
