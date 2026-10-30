import { Hono, type Context } from "hono";
import {
  CONSENT_DAYS,
  HISTORY_DAYS,
  addDays,
  consentState,
  daysLeft,
  type ConnectionStatus,
  type FailureReason,
  type Institution,
  type Transaction,
} from "../../shared/bank";
import { capture, type AnalyticsEnv } from "../analytics";
import type { SessionVars } from "../session";
import { decrypt, encrypt, tokenKey } from "./crypto";
import { ProviderError, type BankProvider } from "./provider";
import { providersFor, qualify, splitInstitutionId, type ProviderEnv } from "./providers";
import { KvStore, MemoryStore, type BankStore, type Connection } from "./store";

export type BankEnv = ProviderEnv &
  AnalyticsEnv & {
    BANK?: KVNamespace;
    TOKEN_KEY?: string;
    // Public address of the app, if the callback can't be worked out from the request.
    APP_URL?: string;
  };

type Env = { Bindings: BankEnv; Variables: SessionVars & { store: BankStore; providers: BankProvider[] } };
type Ctx = Context<Env>;

// After the first sync, refreshes ask for the last 90 days and keep older
// transactions already stored: many banks only give more history right after
// the customer approves.
const REFRESH_DAYS = 90;
const LATEST_COUNT = 5;

// Used when no KV namespace is bound (tests). Not for deployment.
const fallbackStore = new MemoryStore();

export function bankRoutes(options: { store?: BankStore; providers?: BankProvider[] } = {}) {
  const bank = new Hono<Env>();

  bank.use(async (c, next) => {
    c.set("store", options.store ?? (c.env?.BANK ? new KvStore(c.env.BANK) : fallbackStore));
    c.set("providers", options.providers ?? providersFor(c.env ?? {}));
    await next();
  });

  bank.get("/institutions", async (c) => {
    const lists = await Promise.all(
      c.var.providers.map(async (p) => {
        try {
          return (await p.institutions()).map((i) => qualify(p.id, i));
        } catch (err) {
          console.error("Listing institutions failed", p.id, err);
          return [];
        }
      }),
    );
    return c.json({ institutions: lists.flat() });
  });

  bank.post("/connect", async (c) => {
    const body = await c.req.json<{ institutionId?: string; renew?: boolean }>().catch(() => ({}) as Record<string, never>);
    const found = body.institutionId ? await findInstitution(c, body.institutionId) : null;
    if (!found) return c.json({ error: "unknown_institution" }, 400);

    await c.var.store.savePending(c.var.userId, {
      institutionId: found.institution.id,
      analytics: analyticsConsent(c),
      renewing: body.renew === true,
      createdAt: new Date().toISOString(),
    });
    const { url } = await found.provider.startConsent({
      institutionId: splitInstitutionId(found.institution.id)!.institutionId,
      userId: c.var.userId,
      callbackUrl: callbackUrl(c),
      transactionsFrom: new Date(addDays(new Date().toISOString(), -HISTORY_DAYS)),
    });
    return c.json({ url });
  });

  // The bank (or the simulated bank page) sends the customer back here.
  bank.get("/callback", async (c) => {
    const { store, userId } = c.var;
    const pending = await store.pending(userId);
    if (!pending) return c.redirect("/?bank=failed&reason=expired");
    await store.deletePending(userId);

    const fail = async (reason: FailureReason) => {
      await capture(c.env ?? {}, pending.analytics, userId, "bank_connection_failed", { bank_id: pending.institutionId, reason });
      return c.redirect(`/?bank=failed&reason=${reason}`);
    };

    if (c.req.query("error")) return fail("denied");
    const oneTimeToken = c.req.query("one-time-token") ?? c.req.query("oneTimeToken");
    const found = await findInstitution(c, pending.institutionId);
    if (!oneTimeToken || !found) return fail("provider_error");

    try {
      const consent = await found.provider.completeConsent(oneTimeToken);
      const expected = splitInstitutionId(pending.institutionId)!.institutionId;
      // The consent must belong to this browser's user and the bank they picked.
      if ((consent.userId && consent.userId !== userId) || (consent.institutionId && consent.institutionId !== expected)) {
        return fail("provider_error");
      }

      const now = new Date().toISOString();
      const previous = await store.connection(userId);
      const renewing = pending.renewing && previous?.institution.id === found.institution.id;
      if (previous) await revokeQuietly(c, previous);

      await store.saveConnection(userId, {
        provider: found.provider.id,
        institution: found.institution,
        consentId: consent.id,
        tokenSealed: await encrypt(await key(c), consent.token),
        connectedAt: now,
        expiresAt: consent.expiresAt ?? addDays(now, CONSENT_DAYS),
        // A renewal keeps the data already stored; a new bank starts empty.
        refreshedAt: renewing ? previous.refreshedAt : null,
        accounts: renewing ? previous.accounts : [],
        transactions: renewing ? previous.transactions : [],
      });
      if (renewing) await capture(c.env ?? {}, pending.analytics, userId, "consent_renewed");
      return c.redirect(renewing ? "/?bank=renewed" : "/?bank=syncing");
    } catch (err) {
      console.error("Completing bank consent failed", err);
      return fail("provider_error");
    }
  });

  bank.get("/connection", async (c) => {
    const connection = await c.var.store.connection(c.var.userId);
    return c.json(statusOf(connection));
  });

  // Fetches accounts and transactions from the bank. The first call after
  // connecting counts as the bank being connected.
  bank.post("/refresh", async (c) => {
    const { store, userId } = c.var;
    const connection = await store.connection(userId);
    if (!connection) return c.json({ error: "not_connected" }, 404);
    if (consentState(connection.expiresAt, new Date()) === "expired") return c.json({ error: "expired" }, 409);

    const provider = c.var.providers.find((p) => p.id === connection.provider);
    const first = connection.refreshedAt === null;
    const consent = analyticsConsent(c);
    const failed = async (reason: FailureReason, status: 409 | 502) => {
      if (first) await capture(c.env ?? {}, consent, userId, "bank_connection_failed", { bank_id: connection.institution.id, reason });
      return c.json({ error: reason }, status);
    };
    if (!provider) return failed("provider_error", 502);

    try {
      const token = await decrypt(await key(c), connection.tokenSealed);
      const accounts = await provider.accounts(token);
      if (accounts.length === 0) return failed("no_accounts", 409);

      const now = new Date();
      const from = new Date(addDays(now.toISOString(), -(first ? HISTORY_DAYS : REFRESH_DAYS)));
      const fetched = (await Promise.all(accounts.map((a) => provider.transactions(token, a.id, from)))).flat();
      const updated: Connection = {
        ...connection,
        accounts,
        transactions: mergeTransactions(connection.transactions, fetched, from, now),
        refreshedAt: now.toISOString(),
      };
      await store.saveConnection(userId, updated);
      if (first) {
        await capture(c.env ?? {}, consent, userId, "bank_connected", { bank_id: connection.institution.id, accounts_count: accounts.length });
      }
      return c.json(statusOf(updated));
    } catch (err) {
      console.error("Bank refresh failed", err);
      return failed(err instanceof ProviderError && (err.status === 401 || err.status === 403) ? "expired" : "provider_error", 502);
    }
  });

  bank.get("/transactions", async (c) => {
    const connection = await c.var.store.connection(c.var.userId);
    return c.json({ transactions: connection ? sortTransactions(connection.transactions) : [] });
  });

  // Disconnecting ends the consent at the bank and deletes everything stored.
  bank.delete("/connection", async (c) => {
    const { store, userId } = c.var;
    const connection = await store.connection(userId);
    if (connection) {
      await revokeQuietly(c, connection);
      await store.deleteConnection(userId);
      await capture(c.env ?? {}, analyticsConsent(c), userId, "bank_disconnected", { reason: "customer" });
    }
    return c.json(statusOf(null));
  });

  return bank;
}

export function statusOf(connection: Connection | null, now = new Date()): ConnectionStatus {
  if (!connection) return { connected: false };
  return {
    connected: true,
    institution: connection.institution,
    connectedAt: connection.connectedAt,
    expiresAt: connection.expiresAt,
    daysLeft: daysLeft(connection.expiresAt, now),
    state: consentState(connection.expiresAt, now),
    refreshedAt: connection.refreshedAt,
    accounts: connection.accounts,
    transactionsCount: connection.transactions.length,
    latest: sortTransactions(connection.transactions).slice(0, LATEST_COUNT),
  };
}

// Replaces everything from `from` onwards with what the bank just sent, keeps
// older stored transactions, and drops anything past the 12-month window.
export function mergeTransactions(stored: Transaction[], fetched: Transaction[], from: Date, now: Date): Transaction[] {
  const fromDate = from.toISOString().slice(0, 10);
  const oldest = addDays(now.toISOString(), -HISTORY_DAYS).slice(0, 10);
  const byId = new Map<string, Transaction>();
  for (const t of stored) if (t.date < fromDate && t.date >= oldest) byId.set(t.id, t);
  for (const t of fetched) if (t.date >= oldest) byId.set(t.id, t);
  return sortTransactions([...byId.values()]);
}

function sortTransactions(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
}

async function findInstitution(c: Ctx, id: string): Promise<{ provider: BankProvider; institution: Institution } | null> {
  const parts = splitInstitutionId(id);
  const provider = parts && c.var.providers.find((p) => p.id === parts.provider);
  if (!parts || !provider) return null;
  try {
    const institution = (await provider.institutions()).find((i) => i.id === parts.institutionId);
    return institution ? { provider, institution: qualify(provider.id, institution) } : null;
  } catch (err) {
    console.error("Looking up institution failed", id, err);
    return null;
  }
}

async function revokeQuietly(c: Ctx, connection: Connection): Promise<void> {
  try {
    await c.var.providers.find((p) => p.id === connection.provider)?.revokeConsent(connection.consentId);
  } catch (err) {
    // The data is deleted either way; the bank ends the consent when it expires.
    console.warn("Revoking consent failed", err);
  }
}

function key(c: Ctx): Promise<CryptoKey> {
  return tokenKey(c.env?.TOKEN_KEY, c.env?.APP_ENV);
}

function callbackUrl(c: Ctx): string {
  return new URL("/api/bank/callback", c.env?.APP_URL ?? c.req.url).toString();
}

// The app sends this header on API calls once the customer has agreed to analytics.
function analyticsConsent(c: Ctx): boolean {
  return c.req.header("x-fico-analytics") === "granted";
}
