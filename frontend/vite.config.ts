import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo el navegador habla con Vite y este reenvía al backend: sin CORS.
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    testTimeout: 15000,
    include: ["src/**/*.test.{ts,tsx}"], // tests/e2e los corre Playwright
  },
});
