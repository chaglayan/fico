import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConnectionStatus, Transaction } from "../../shared/bank";
import { createApp } from "../index";
import { mergeTransactions } from "./routes";
import { SimulatedBank } from "./simulated";
import { MemoryStore } from "./store";

const env = { APP_ENV: "test", POSTHOG_KEY: "phc_test" };

function setup() {
  const store = new MemoryStore();
  const app = createApp({ store, providers: [new SimulatedBank()] });
  let cookie = "";
  const request = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("cookie", cookie);
    const res = await app.request(`https://fico.example${path}`, { ...init, headers }, env);
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0]!;
    return res;
  };
  const json = (path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) =>
    request(path, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });

  // Picks a bank, then follows the approval page's Approve link back to the callback.
  const approve = async (opts: { renew?: boolean; analytics?: boolean } = {}) => {
    const res = await json("/api/bank/connect", "POST", { institutionId: "simulated:musterbank", renew: opts.renew }, opts.analytics ? { "x-fico-analytics": "granted" } : {});
    const { url } = (await res.json()) as { url: string };
    const token = new URL(url).searchParams.get("token")!;
    return request(`/api/bank/callback?one-time-token=${encodeURIComponent(token)}`);
  };
  return { store, request, json, approve, setCookie: (c: string) => (cookie = c) };
}

const captured = () =>
  vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as { event: string; distinct_id: string; properties: Record<string, unknown> });

afterEach(() => vi.unstubAllGlobals());

describe("bank API", () => {
  it("connects, syncs, reports and disconnects with the simulated bank", async () => {
    const { json, approve, store } = setup();

    const list = (await (await json("/api/bank/institutions")).json()) as { institutions: { id: string }[] };
    expect(list.institutions.map((i) => i.id)).toContain("simulated:musterbank");

    const back = await approve();
    expect(back.status).toBe(302);
    expect(back.headers.get("location")).toBe("/?bank=syncing");

    let status = (await (await json("/api/bank/connection")).json()) as ConnectionStatus;
    expect(status).toMatchObject({ connected: true, refreshedAt: null, daysLeft: 180, state: "active", transactionsCount: 0 });

    status = (await (await json("/api/bank/refresh", "POST")).json()) as ConnectionStatus;
    if (!status.connected) throw new Error("not connected");
    expect(status.accounts).toHaveLength(2);
    expect(status.transactionsCount).toBeGreaterThan(300);
    expect(status.latest).toHaveLength(5);

    // The consent token is stored encrypted.
    const [stored] = [...store.connections.values()];
    expect(stored!.tokenSealed).not.toContain("simc.");

    const gone = (await (await json("/api/bank/connection", "DELETE")).json()) as ConnectionStatus;
    expect(gone).toEqual({ connected: false });
    expect(store.connections.size).toBe(0);
  });

  it("keeps the data and the bank when the customer renews", async () => {
    const { json, approve, store } = setup();
    await approve();
    await json("/api/bank/refresh", "POST");
    const [userId, before] = [...store.connections.entries()][0]!;
    await store.saveConnection(userId, { ...before, expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });

    const soon = (await (await json("/api/bank/connection")).json()) as ConnectionStatus;
    expect(soon).toMatchObject({ state: "renew_soon", daysLeft: 3 });

    const back = await approve({ renew: true });
    expect(back.headers.get("location")).toBe("/?bank=renewed");
    const after = store.connections.get(userId)!;
    expect(after.transactions).toEqual(before.transactions);
    expect(after.consentId).not.toBe(before.consentId);
    expect((await (await json("/api/bank/connection")).json()) as ConnectionStatus).toMatchObject({ state: "active", daysLeft: 180 });
  });

  it("refuses to sync an expired consent", async () => {
    const { json, approve, store } = setup();
    await approve();
    const [userId, connection] = [...store.connections.entries()][0]!;
    await store.saveConnection(userId, { ...connection, expiresAt: new Date(Date.now() - 1000).toISOString() });
    const res = await json("/api/bank/refresh", "POST");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "expired" });
  });

  it("fails when the customer cancels in the bank", async () => {
    const { json, request } = setup();
    await json("/api/bank/connect", "POST", { institutionId: "simulated:musterbank" });
    const res = await request("/api/bank/callback?error=access_denied");
    expect(res.headers.get("location")).toBe("/?bank=failed&reason=denied");
  });

  it("ignores a callback this browser didn't start", async () => {
    const victim = setup();
    const attacker = setup();
    const res = await victim.json("/api/bank/connect", "POST", { institutionId: "simulated:musterbank" });
    const { url } = (await res.json()) as { url: string };
    const token = new URL(url).searchParams.get("token")!;

    // Another browser with no approval in progress.
    expect((await attacker.request(`/api/bank/callback?one-time-token=${token}`)).headers.get("location")).toBe("/?bank=failed&reason=expired");
    // Another browser with its own approval in progress, replaying someone else's token.
    await attacker.json("/api/bank/connect", "POST", { institutionId: "simulated:musterbank" });
    expect((await attacker.request(`/api/bank/callback?one-time-token=${token}`)).headers.get("location")).toBe("/?bank=failed&reason=provider_error");
    expect(attacker.store.connections.size).toBe(0);
  });

  it("rejects unknown banks", async () => {
    const { json } = setup();
    expect((await json("/api/bank/connect", "POST", { institutionId: "simulated:nope" })).status).toBe(400);
    expect((await json("/api/bank/connect", "POST", { institutionId: "other:bank" })).status).toBe(400);
  });

  it("sends backend events only with analytics consent, keyed by user ID, without amounts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    const withConsent = setup();
    await withConsent.approve({ analytics: true });
    await withConsent.json("/api/bank/refresh", "POST", undefined, { "x-fico-analytics": "granted" });
    const session = (await (await withConsent.json("/api/session")).json()) as { userId: string };

    expect(captured()).toEqual([
      { api_key: "phc_test", event: "bank_connected", distinct_id: session.userId, properties: { bank_id: "simulated:musterbank", accounts_count: 2 } },
    ]);

    vi.mocked(fetch).mockClear();
    const without = setup();
    await without.approve();
    await without.json("/api/bank/refresh", "POST");
    await without.json("/api/bank/connection", "DELETE");
    expect(captured()).toEqual([]);
  });

  it("gives each browser a session cookie whose user ID isn't the cookie", async () => {
    const { request } = setup();
    const res = await request("/api/session");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/fico_session=[0-9a-f]{64}; Max-Age=\d+; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    const { userId } = (await res.json()) as { userId: string };
    expect(userId).toMatch(/^u_[0-9a-f]{32}$/);
    expect(cookie).not.toContain(userId.slice(2));
  });
});

describe("mergeTransactions", () => {
  const t = (id: string, date: string): Transaction => ({ id, accountId: "a", date, amount: -1, currency: "EUR", description: "x", pending: false });
  const now = new Date("2026-10-30T12:00:00Z");

  it("keeps older stored transactions, replaces the refreshed window, drops beyond 12 months", () => {
    const stored = [t("old", "2025-09-01"), t("kept", "2026-03-01"), t("pending", "2026-10-29")];
    const fetched = [t("booked", "2026-10-29"), t("new", "2026-10-30")];
    const merged = mergeTransactions(stored, fetched, new Date("2026-08-01T00:00:00Z"), now);
    expect(merged.map((x) => x.id)).toEqual(["new", "booked", "kept"]);
  });
});
