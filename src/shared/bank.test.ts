import { describe, expect, it } from "vitest";
import { addDays, consentState, daysLeft } from "./bank";

describe("consent tracking", () => {
  const start = "2026-11-01T10:00:00.000Z";
  const expires = addDays(start, 180);

  it("counts whole days left, rounding up", () => {
    expect(daysLeft(expires, new Date(start))).toBe(180);
    expect(daysLeft(expires, new Date(addDays(expires, -0.5)))).toBe(1);
    expect(daysLeft(expires, new Date(addDays(expires, 3)))).toBe(0);
  });

  it("asks for renewal in the last 7 days", () => {
    expect(consentState(expires, new Date(addDays(expires, -8)))).toBe("active");
    expect(consentState(expires, new Date(addDays(expires, -7)))).toBe("renew_soon");
    expect(consentState(expires, new Date(addDays(expires, -0.1)))).toBe("renew_soon");
    expect(consentState(expires, new Date(expires))).toBe("expired");
  });
});
