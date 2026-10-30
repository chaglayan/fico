import { describe, expect, it } from "vitest";
import { EVENTS, amountBucket } from "./events";

describe("events", () => {
  it("has no duplicate names", () => {
    expect(new Set(EVENTS).size).toBe(EVENTS.length);
  });

  it("uses object_action names in lower snake case", () => {
    for (const name of EVENTS) expect(name).toMatch(/^[a-z]+(_[a-z]+)+$/);
  });

  it("buckets amounts into ranges", () => {
    expect(amountBucket(8.99)).toBe("0-20");
    expect(amountBucket(20)).toBe("20-50");
    expect(amountBucket(99.99)).toBe("50-100");
    expect(amountBucket(250)).toBe("250-500");
    expect(amountBucket(5000)).toBe("1000+");
  });
});
