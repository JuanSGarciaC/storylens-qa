import { afterEach, describe, expect, it, vi } from "vitest";

async function load() {
  vi.resetModules();
  return import("./evidenceRules");
}

afterEach(() => vi.unstubAllEnvs());

describe("evidenceFileUrl", () => {
  it("usa la base por defecto /api/v1", async () => {
    const { evidenceFileUrl } = await load();
    expect(evidenceFileUrl("/api/v1/evidences/e1/file")).toBe(
      "/api/v1/evidences/e1/file",
    );
  });

  it("respeta una base absoluta configurada", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/api/v1");
    const { evidenceFileUrl } = await load();
    expect(evidenceFileUrl("/api/v1/evidences/e1/file")).toBe(
      "https://api.example.com/api/v1/evidences/e1/file",
    );
    expect(
      evidenceFileUrl("https://otro.example.org/api/v1/evidences/e1/file"),
    ).toBe("https://api.example.com/api/v1/evidences/e1/file");
  });

  it("descarta rutas ajenas al endpoint de evidencias", async () => {
    const { evidenceFileUrl } = await load();
    expect(evidenceFileUrl(null)).toBeNull();
    expect(evidenceFileUrl("javascript:alert(1)")).toBeNull();
    expect(evidenceFileUrl("/api/v1/evidences/e1/file/../x")).toBeNull();
    expect(evidenceFileUrl("//evil.com/api/v1/evidences/e1/file")).toBeNull();
    expect(evidenceFileUrl("https://x.com/otra/evidences/e1/file")).toBeNull();
  });
});
