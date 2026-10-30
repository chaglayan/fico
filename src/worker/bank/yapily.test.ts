import { describe, expect, it } from "vitest";
import { Yapily, toTransaction } from "./yapily";

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Record<string, unknown | ((url: URL) => unknown)>) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), init });
    const key = `${init.method ?? "GET"} ${url.pathname}`;
    const body = responses[key];
    if (body === undefined) return new Response("not found", { status: 404 });
    const value = typeof body === "function" ? body(url) : body;
    return value === null ? new Response(null, { status: 204 }) : Response.json(value);
  }) as typeof fetch;
  return { fn, calls };
}

const headers = (call: Call) => call.init.headers as Record<string, string>;

describe("Yapily client", () => {
  const make = (responses: Parameters<typeof fakeFetch>[0]) => {
    const fake = fakeFetch(responses);
    return { yapily: new Yapily({ applicationId: "app", secret: "shh", fetch: fake.fn }), calls: fake.calls };
  };

  it("signs requests with the application credentials", async () => {
    const { yapily, calls } = make({ "GET /institutions": { data: [] } });
    await yapily.institutions();
    expect(headers(calls[0]!).Authorization).toBe(`Basic ${btoa("app:shh")}`);
    expect(calls[0]!.url).toBe("https://api.yapily.com/institutions");
  });

  it("offers German banks, or every bank when the application has none", async () => {
    const de = { id: "sparkasse", name: "Sparkasse", countries: [{ countryCode2: "DE" }], features: ["ACCOUNT_TRANSACTIONS"] };
    const gb = { id: "modelo-sandbox", name: "Modelo Sandbox", countries: [{ countryCode2: "GB" }] };
    const payments = { id: "pay-only", name: "Pay only", countries: [{ countryCode2: "DE" }], features: ["INITIATE_SINGLE_PAYMENT_SORTCODE"] };
    expect((await make({ "GET /institutions": { data: [de, gb, payments] } }).yapily.institutions()).map((i) => i.id)).toEqual(["sparkasse"]);
    expect((await make({ "GET /institutions": { data: [gb] } }).yapily.institutions()).map((i) => i.id)).toEqual(["modelo-sandbox"]);
  });

  it("starts an account authorisation with a one-time token callback", async () => {
    const { yapily, calls } = make({
      "POST /account-auth-requests": { data: { id: "req1", authorisationUrl: "https://bank.example/auth" } },
    });
    const from = new Date("2025-11-01T00:00:00Z");
    const { url } = await yapily.startConsent({ institutionId: "modelo-sandbox", userId: "u_1", callbackUrl: "https://fico.example/api/bank/callback", transactionsFrom: from });
    expect(url).toBe("https://bank.example/auth");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      applicationUserId: "u_1",
      institutionId: "modelo-sandbox",
      callback: "https://fico.example/api/bank/callback",
      oneTimeToken: true,
      accountRequest: { transactionFrom: "2025-11-01T00:00:00.000Z" },
    });
  });

  it("swaps the one-time token for a consent", async () => {
    const { yapily, calls } = make({
      "POST /exchange-one-time-token": {
        id: "consent1",
        consentToken: "tok",
        institutionId: "modelo-sandbox",
        applicationUserId: "u_1",
        expiresAt: "2027-04-30T00:00:00Z",
      },
    });
    expect(await yapily.completeConsent("ott")).toEqual({
      id: "consent1",
      token: "tok",
      institutionId: "modelo-sandbox",
      userId: "u_1",
      expiresAt: "2027-04-30T00:00:00Z",
    });
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ oneTimeToken: "ott" });
  });

  it("keeps only the last four IBAN characters of an account", async () => {
    const { yapily, calls } = make({
      "GET /accounts": {
        data: [
          {
            id: "acc1",
            type: "Personal - Current",
            balance: 1234.5,
            currency: "EUR",
            accountNames: [{ name: "Girokonto" }],
            accountIdentifications: [{ type: "IBAN", identification: "DE89 3704 0044 0532 0130 00" }],
          },
        ],
      },
    });
    expect(await yapily.accounts("tok")).toEqual([{ id: "acc1", name: "Girokonto", ibanLast4: "3000", balance: 1234.5, currency: "EUR" }]);
    expect(headers(calls[0]!).consent).toBe("tok");
  });

  it("pages through transactions", async () => {
    const page = (offset: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${offset + i}`, date: "2026-10-01T00:00:00Z", amount: -1 }));
    const { yapily, calls } = make({
      "GET /accounts/acc1/transactions": (url: URL) => {
        const offset = Number(url.searchParams.get("offset"));
        return { data: offset === 0 ? page(0, 1000) : page(1000, 3) };
      },
    });
    const list = await yapily.transactions("tok", "acc1", new Date("2026-08-01T00:00:00Z"));
    expect(list).toHaveLength(1003);
    expect(calls).toHaveLength(2);
    expect(new URL(calls[0]!.url).searchParams.get("from")).toBe("2026-08-01T00:00:00.000Z");
  });

  it("maps transactions, signing debits and preferring the merchant name", () => {
    expect(
      toTransaction(
        {
          id: "t1",
          bookingDateTime: "2026-10-05T08:00:00Z",
          status: "BOOKED",
          transactionAmount: { amount: 13.99, currency: "EUR" },
          creditDebitIndicator: "DEBIT",
          merchant: { merchantName: "Netflix" },
          description: "NETFLIX.COM 866-579-7172",
        },
        "acc1",
      ),
    ).toEqual({ id: "t1", accountId: "acc1", date: "2026-10-05", amount: -13.99, currency: "EUR", description: "Netflix", pending: false });
    expect(toTransaction({ id: "t2", date: "2026-10-06", amount: -5, status: "PENDING", payeeDetails: { name: "REWE" } }, "acc1")).toMatchObject({
      amount: -5,
      description: "REWE",
      pending: true,
    });
  });

  it("revokes a consent and reports failures with the status", async () => {
    const { yapily, calls } = make({ "DELETE /consents/consent1": null });
    await yapily.revokeConsent("consent1");
    expect(calls[0]!.init.method).toBe("DELETE");
    await expect(make({}).yapily.accounts("tok")).rejects.toMatchObject({ status: 404 });
  });
});
