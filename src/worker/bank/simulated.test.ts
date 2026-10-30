import { describe, expect, it } from "vitest";
import { SimulatedBank } from "./simulated";

describe("simulated bank", () => {
  const bank = new SimulatedBank();
  const yearAgo = new Date(Date.now() - 365 * 86_400_000);

  async function connect() {
    const { url } = await bank.startConsent({
      institutionId: "musterbank",
      userId: "u_test",
      callbackUrl: "https://fico.example/api/bank/callback",
      transactionsFrom: yearAgo,
    });
    const token = new URL(url).searchParams.get("token")!;
    return bank.completeConsent(token);
  }

  it("sends the customer to the in-app approval page and back with a consent for them", async () => {
    const { url } = await bank.startConsent({
      institutionId: "musterbank",
      userId: "u_test",
      callbackUrl: "https://fico.example/api/bank/callback",
      transactionsFrom: yearAgo,
    });
    expect(new URL(url).origin + new URL(url).pathname).toBe("https://fico.example/bank/simulated");
    const consent = await connect();
    expect(consent).toMatchObject({ institutionId: "musterbank", userId: "u_test", expiresAt: null });
    await expect(bank.completeConsent("forged")).rejects.toThrow();
  });

  it("generates a year of transactions with salary and subscriptions, the same each time", async () => {
    const { token } = await connect();
    const [giro] = await bank.accounts(token);
    const first = await bank.transactions(token, giro!.id, yearAgo);
    const again = await bank.transactions(token, giro!.id, yearAgo);
    expect(again).toEqual(first);

    const salaries = first.filter((t) => t.description.includes("Gehalt"));
    expect(salaries.length).toBeGreaterThanOrEqual(11);
    expect(salaries.every((t) => t.amount > 0)).toBe(true);
    expect(first.filter((t) => t.description === "Netflix.com").length).toBeGreaterThanOrEqual(11);
    expect(first.filter((t) => t.amount < 0).length).toBeGreaterThan(200);
    expect(new Set(first.map((t) => t.id)).size).toBe(first.length);
  });

  it("only returns transactions for the account asked for", async () => {
    const { token } = await connect();
    const [, savings] = await bank.accounts(token);
    const list = await bank.transactions(token, savings!.id, yearAgo);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.accountId === savings!.id && t.amount > 0)).toBe(true);
  });
});
