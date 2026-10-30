import { describe, expect, it } from "vitest";
import { app } from "./index";

describe("api", () => {
  it("answers the health check", async () => {
    const res = await app.request("/api/health", {}, { APP_ENV: "test" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, env: "test" });
  });

  it("returns 404 for unknown API routes", async () => {
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
  });
});
