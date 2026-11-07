import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ headers: new Headers(), validate: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createMiddleware: () => ({ server: (fn: unknown) => fn }) }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => ({ headers: state.headers }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getClaims: state.validate } }) }));
import { requireSupabaseAuth } from "../src/integrations/supabase/auth-middleware";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("real auth middleware in isolation (mock token verifier)", () => {
  it.each([null, "Basic test", "Bearer "])("rejects absent/malformed bearer even in dev: %s", async (header) => {
    vi.stubEnv("SUPABASE_URL", "https://auth.invalid"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture");
    state.headers = new Headers(header ? { Authorization: header } : {});
    const next = vi.fn();
    try {
      await (requireSupabaseAuth as unknown as (arg: unknown) => Promise<unknown>)({ next });
      throw new Error("Expected auth denial");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(401);
    }
    expect(next).not.toHaveBeenCalled(); expect(state.validate).not.toHaveBeenCalled();
  });
  it("rejects invalid claims before passing context", async () => {
    vi.stubEnv("SUPABASE_URL", "https://auth.invalid"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture");
    state.headers = new Headers({ Authorization: "Bearer isolated-invalid-token" });
    state.validate.mockResolvedValue({ data: null, error: { message: "invalid" } });
    const next = vi.fn();
    await expect((requireSupabaseAuth as unknown as (arg: unknown) => Promise<unknown>)({ next })).rejects.toMatchObject({ status: 401 });
    expect(next).not.toHaveBeenCalled();
  });
});