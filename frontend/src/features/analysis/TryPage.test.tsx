import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { afterEach, expect, it, vi } from "vitest";
import type { Analysis } from "../../api/client";
import { json, stubFetch } from "../../test/renderPage";
import { TryPage } from "./TryPage";

afterEach(() => vi.unstubAllGlobals());

// Como responde /analyze: nada guardado, así que el análisis y sus hallazgos no traen id.
const RESULT = {
  id: null,
  score: 46,
  verdict: "not_ready",
  used_ai: false,
  ai_status: "not_requested",
  rules_catalog_version: "1.0.0",
  findings: [
    {
      id: null,
      rule_id: "US-AMB-001",
      source: "rule",
      severity: "major",
      message: "Se usa el término vago «rápida».",
      suggestion: "Reemplácelo por un valor medible.",
      reference: "ISO/IEC/IEEE 29148:2018",
      evidence_text: "debe ser rápida",
      decision: "pending",
      dismiss_reason: null,
      confidence: null,
    },
  ],
} as unknown as Analysis;

it("analiza el texto escrito y muestra puntaje y hallazgos, sin acciones de decisión", async () => {
  const calls = stubFetch({
    handler: ({ path }) => (path === "/analyze" ? json(RESULT) : undefined),
  });
  const { container } = render(<TryPage />);

  await userEvent.clear(screen.getByLabelText("Criterios de aceptación"));
  await userEvent.type(
    screen.getByLabelText("Criterios de aceptación"),
    "- Debe ser rápida{enter}2. Debe ser amigable",
  );
  await userEvent.click(screen.getByRole("button", { name: "Analizar" }));

  expect(
    await screen.findByRole("img", { name: "Puntaje 46 de 100" }),
  ).toBeVisible();
  expect(screen.getByText("No lista")).toBeVisible();
  expect(screen.getByText("US-AMB-001")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /Aceptar|Descartar/ }),
  ).toBeNull();
  expect(calls.find((c) => c.path === "/analyze")).toMatchObject({
    method: "POST",
    body: { acceptance_criteria: ["Debe ser rápida", "Debe ser amigable"] },
  });
  expect(await axe(container)).toHaveNoViolations();
});

it("muestra el error del servidor y deja reintentar", async () => {
  stubFetch({
    handler: () =>
      json({ detail: "La historia supera el tamaño máximo." }, 422),
  });
  render(<TryPage />);

  await userEvent.click(screen.getByRole("button", { name: "Analizar" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "La historia supera el tamaño máximo.",
  );
  expect(screen.getByRole("button", { name: "Analizar" })).toBeEnabled();
});
