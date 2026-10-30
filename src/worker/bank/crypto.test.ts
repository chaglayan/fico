import { describe, expect, it } from "vitest";
import { decrypt, encrypt, tokenKey } from "./crypto";

describe("consent token encryption", () => {
  const secret = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

  it("round-trips and never stores the token in the clear", async () => {
    const key = await tokenKey(secret, "production");
    const sealed = await encrypt(key, "consent-token-123");
    expect(sealed).not.toContain("consent-token-123");
    expect(await decrypt(key, sealed)).toBe("consent-token-123");
  });

  it("fails with a different key", async () => {
    const sealed = await encrypt(await tokenKey(secret, "production"), "consent-token-123");
    await expect(decrypt(await tokenKey(undefined, "development"), sealed)).rejects.toThrow();
  });

  it("requires a real key in production", async () => {
    await expect(tokenKey(undefined, "production")).rejects.toThrow("TOKEN_KEY");
    await expect(tokenKey(btoa("short"), "development")).rejects.toThrow("32 bytes");
  });
});
