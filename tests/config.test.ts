import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("explicit demo and real configuration", () => {
  it("runs without credentials only as clearly selected demo", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const client = await import("../src/api/client");
    expect(client.demoMode).toBe(true);
    expect(client.supabase).toBeNull();
  });
  it("does not fall back when real configuration is incomplete", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const client = await import("../src/api/client");
    expect(client.demoMode).toBe(false);
    expect(client.configError).toContain("Supabase");
    expect(client.supabase).toBeNull();
  });
  it("rejects malformed production URLs with an actionable error", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.stubEnv("VITE_SUPABASE_URL", "https:// invalid");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "fictional-key");
    const client = await import("../src/api/client");
    expect(client.demoMode).toBe(false);
    expect(client.configError).toBeTruthy();
    expect(client.supabase).toBeNull();
  });
});
