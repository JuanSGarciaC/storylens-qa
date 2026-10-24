import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * Pruebas de extremo a extremo contra el backend real con una base SQLite desechable.
 * La IA queda siempre apagada (clave vacía): ninguna prueba llama a Gemini.
 *
 * Variables opcionales:
 *   E2E_PYTHON     intérprete de Python con el backend instalado (por defecto `python`)
 *   CHROMIUM_PATH  ejecutable de Chromium/Chrome ya instalado (si no, el de Playwright)
 */
const python = process.env.E2E_PYTHON ?? "python";
const backendEnv = {
  // Base nueva en cada corrida, en la carpeta temporal del sistema.
  DATABASE_URL: `sqlite:///${join(tmpdir(), `storylens-e2e-${Date.now()}.db`).replaceAll("\\", "/")}`,
  OWNER_EMAIL: "owner@e2e.local",
  OWNER_PASSWORD: "e2e-password-123",
  SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "",
  GEMINI_FALLBACK_MODEL: "",
  SEED_DEMO: "true",
  CORS_ORIGINS: "http://localhost:5173",
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1, // comparten una sola base de datos
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    locale: "es-ES",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
  },
  webServer: [
    {
      command: `${python} -m uvicorn app.main:app --port 8000`,
      cwd: "../backend",
      url: "http://localhost:8000/api/v1/health",
      env: backendEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run dev -- --port 5173",
      url: "http://localhost:5173",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
