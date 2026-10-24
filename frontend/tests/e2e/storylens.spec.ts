import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const OWNER = { email: "owner@e2e.local", password: "e2e-password-123" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/correo|email/i).fill(OWNER.email);
  await page.getByLabel(/contraseña/i).fill(OWNER.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Proyectos" })).toBeVisible();
}

async function noAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    "violaciones de accesibilidad",
  ).toEqual([]);
}

test.describe("modo demo (sin sesión)", () => {
  test("se puede explorar el proyecto de demostración pero no modificarlo", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Demostración").first()).toBeVisible();
    await page
      .getByRole("link", { name: /Demo — Plataforma de pagos/ })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByRole("link", { name: "Historias", exact: true }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Crear historia" }),
    ).toHaveCount(0);
    await expect(page.getByText(/solo lectura/i).first()).toBeVisible();

    // Cada módulo del menú tiene su pantalla.
    for (const name of [
      "Análisis transversal",
      "Informes",
      "Métricas y mejora",
      "Evaluación de la IA",
    ]) {
      await page.getByRole("link", { name }).click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    await noAccessibilityViolations(page);
  });

  test("la demo trae una evaluación de ejemplo y no permite ejecutar otra", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /Demo — Plataforma de pagos/ })
      .click();
    await page.getByRole("link", { name: "Evaluación de la IA" }).click();
    await expect(
      page.getByRole("table", { name: "Evaluaciones realizadas" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Evaluar|Probar/ }),
    ).toHaveCount(0);
  });

  test("una ruta que no existe muestra la pantalla de no encontrado", async ({
    page,
  }) => {
    await page.goto("/p/no-existe");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /no encontrado/i,
    );
  });
});

test.describe("flujo del dueño", () => {
  test("crea un proyecto, una historia, la analiza por reglas y ve métricas e informes", async ({
    page,
  }) => {
    await login(page);

    await page.getByLabel("Nombre").fill("Proyecto E2E");
    await page.getByLabel("Objetivo").fill("Probar el flujo completo");
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(
      page.getByRole("heading", { name: "Proyecto E2E" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Historias", exact: true }).click();
    await page.getByRole("button", { name: "Crear historia" }).click();
    await page.getByLabel("Título").fill("Retirar efectivo");
    await page
      .getByLabel("Descripción")
      .fill("Como cliente quiero retirar efectivo para pagar rápido");
    await page
      .getByLabel("Criterios de aceptación")
      .fill("Dado saldo suficiente, entonces se descuenta el monto");
    await page.getByRole("button", { name: "Guardar historia" }).click();
    await expect(page.getByText("Historia creada.")).toBeVisible();

    await page.getByRole("link", { name: "Retirar efectivo" }).click();
    await page.getByRole("button", { name: "Analizar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Hallazgos" }),
    ).toBeVisible();
    await noAccessibilityViolations(page);

    await page.getByRole("link", { name: "Métricas y mejora" }).click();
    await expect(
      page.getByText("Historias analizadas", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("1 de 1").first()).toBeVisible();

    await page.getByRole("link", { name: "Análisis transversal" }).click();
    await expect(
      page.getByRole("heading", { name: /Riesgo por épica/ }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Informes" }).click();
    await expect(
      page.getByRole("link", { name: /Informe de .* \(Markdown\)/ }).first(),
    ).toBeVisible();
  });

  test("importa un CSV en segundo plano y sigue su avance hasta terminar", async ({
    page,
  }) => {
    await login(page);
    await page.getByLabel("Nombre").fill("Proyecto importación");
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(
      page.getByRole("heading", { name: "Proyecto importación" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Historias", exact: true }).click();

    await page.getByText("Importar historias desde Jira (CSV o JSON)").click();
    const csv = [
      "Summary,Issue key,Description",
      "Iniciar sesión,K-1,Como usuario quiero iniciar sesión con mi correo",
      "Cerrar sesión,K-2,Como usuario quiero cerrar sesión para proteger mi cuenta",
    ].join("\n");
    await page.getByLabel(/archivo de jira/i).setInputFiles({
      name: "jira.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: "Importar 2 historias" }).click();

    await expect(
      page.getByRole("heading", { name: "Importación de historias" }),
    ).toBeVisible();
    await expect(page.getByText("Terminada", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("2 de 2 filas")).toBeVisible();
    await noAccessibilityViolations(page);
  });

  test("ejecuta una evaluación solo con reglas y la ve en el historial", async ({
    page,
  }) => {
    await login(page);
    await page.getByLabel("Nombre").fill("Proyecto evaluación");
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(
      page.getByRole("heading", { name: "Proyecto evaluación" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Evaluación de la IA" }).click();

    await page.getByRole("button", { name: "Evaluar solo con reglas" }).click();
    await expect(
      page.getByRole("table", { name: "Evaluaciones realizadas" }),
    ).toBeVisible();
    await expect(
      page.getByText("Terminada", { exact: true }).first(),
    ).toBeVisible({
      timeout: 30_000,
    });
    // Sin IA configurada, las evaluaciones con IA están deshabilitadas y dicen por qué.
    await expect(
      page.getByRole("button", { name: "Evaluar con reglas e IA" }),
    ).toBeDisabled();
    await noAccessibilityViolations(page);
  });

  test("cerrar sesión devuelve a la vista pública y no deja datos privados", async ({
    page,
  }) => {
    await login(page);
    await page.getByLabel("Nombre").fill("Proyecto privado");
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await expect(
      page.getByRole("heading", { name: "Proyecto privado" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Proyecto privado")).toHaveCount(0);
  });

  test("una clave incorrecta no revela si el correo existe", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill(OWNER.email);
    await page.getByLabel(/contraseña/i).fill("clave-incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    const wrong = await page.getByRole("alert").innerText();
    await page.getByLabel(/correo|email/i).fill("nadie@e2e.local");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("alert")).toHaveText(wrong);
  });
});
