import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { ErrorNotice } from "./ErrorNotice";
import { Field } from "./Field";
import { Icon, ICON_NAMES } from "./Icon";
import { Ring } from "./Ring";
import { Spinner } from "./Spinner";

describe("Button", () => {
  it("con loading queda aria-busy y deshabilitado", () => {
    const { container } = render(<Button loading>Guardar</Button>);
    const btn = screen.getByRole("button", { name: /guardar/i });
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    return axe(container).then((r) => expect(r).toHaveNoViolations());
  });
  it("variantes pasan axe", async () => {
    const { container } = render(
      <div>
        <Button variant="primary">A</Button>
        <Button variant="ghost">B</Button>
        <Button variant="danger">C</Button>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Field", () => {
  it("enlaza etiqueta, pista y error", async () => {
    const { container } = render(
      <Field label="Correo" hint="Usa tu correo" error="Correo inválido">
        <input />
      </Field>,
    );
    const input = screen.getByLabelText("Correo");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Correo inválido/);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Badge", () => {
  it("muestra texto y pasa axe", async () => {
    const { container } = render(
      <div>
        {(["ok", "warn", "danger", "info", "neutral"] as const).map((t) => (
          <Badge key={t} tone={t}>
            Estado {t}
          </Badge>
        ))}
      </div>,
    );
    expect(screen.getByText("Estado ok")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("EmptyState", () => {
  it("renderiza título, cuerpo y acción", async () => {
    const { container } = render(
      <EmptyState
        title="Sin datos"
        body="Aún no hay nada"
        action={<Button>Crear</Button>}
      />,
    );
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Spinner", () => {
  it("tiene role status", async () => {
    const { container } = render(<Spinner label="Cargando" />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ErrorNotice", () => {
  it("tiene role alert y llama onRetry", async () => {
    const onRetry = vi.fn();
    const { container } = render(
      <ErrorNotice message="Falló" onRetry={onRetry} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Falló");
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Ring", () => {
  it("muestra leyenda textual y svg accesible", async () => {
    const { container } = render(
      <Ring
        segments={[
          { label: "Aprobadas", value: 3, tone: "ok" },
          { label: "Fallidas", value: 1, tone: "danger" },
        ]}
      />,
    );
    expect(screen.getByText("Aprobadas 3")).toBeInTheDocument();
    expect(screen.getByText("Fallidas 1")).toBeInTheDocument();
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("role", "img");
    expect(svg.getAttribute("aria-label")).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });
  it("con todo en 0 muestra EmptyState", () => {
    const { container } = render(
      <Ring segments={[{ label: "Aprobadas", value: 0, tone: "ok" }]} />,
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument();
  });
});

describe("Icon", () => {
  it("tiene como máximo 12 iconos y pasan axe", async () => {
    expect(ICON_NAMES.length).toBeLessThanOrEqual(12);
    const { container } = render(
      <div>
        {ICON_NAMES.map((n) => (
          <Icon key={n} name={n} />
        ))}
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
