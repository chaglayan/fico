import type { Account, Institution, Transaction } from "../../shared/bank";
import { ProviderError, type BankProvider, type Consent, type ConsentRequest } from "./provider";

// Yapily's REST API, read-only (account information). Request and response
// fields follow Yapily's API reference; anything optional is read defensively
// because banks fill in different fields.

export type YapilyConfig = {
  applicationId: string;
  secret: string;
  baseUrl?: string;
  // Institutions offered to customers. If the application has none for this
  // country (a sandbox application usually only has Modelo Sandbox), all are shown.
  country?: string;
  fetch?: typeof fetch;
};

const PAGE_LIMIT = 1000;
const MAX_PAGES = 20;

export class Yapily implements BankProvider {
  readonly id = "yapily";
  private readonly baseUrl: string;
  private readonly auth: string;
  private readonly doFetch: typeof fetch;

  constructor(private readonly config: YapilyConfig) {
    this.baseUrl = (config.baseUrl ?? "https://api.yapily.com").replace(/\/$/, "");
    this.auth = `Basic ${btoa(`${config.applicationId}:${config.secret}`)}`;
    this.doFetch = config.fetch ?? ((input, init) => fetch(input, init));
  }

  async institutions(): Promise<Institution[]> {
    const body = await this.call<{ data?: YapilyInstitution[] }>("GET", "/institutions");
    const all = (body.data ?? []).filter(
      (i) => !i.features || i.features.includes("ACCOUNT_TRANSACTIONS") || i.features.includes("ACCOUNTS"),
    );
    const country = (this.config.country ?? "DE").toUpperCase();
    const local = all.filter((i) => i.countries?.some((c) => c.countryCode2?.toUpperCase() === country));
    return (local.length > 0 ? local : all).map((i) => ({ id: i.id, name: i.name ?? i.fullName ?? i.id, simulated: false }));
  }

  async startConsent(req: ConsentRequest): Promise<{ url: string }> {
    const body = await this.call<{ data?: { authorisationUrl?: string } }>("POST", "/account-auth-requests", {
      body: {
        applicationUserId: req.userId,
        institutionId: req.institutionId,
        callback: req.callbackUrl,
        // The callback gets a one-time token, swapped for the consent server-side,
        // so the consent token never appears in the browser.
        oneTimeToken: true,
        accountRequest: { transactionFrom: req.transactionsFrom.toISOString() },
      },
    });
    const url = body.data?.authorisationUrl;
    if (!url) throw new ProviderError("Yapily returned no authorisation URL");
    return { url };
  }

  async completeConsent(oneTimeToken: string): Promise<Consent> {
    const body = await this.call<YapilyConsent | { data?: YapilyConsent }>("POST", "/exchange-one-time-token", {
      body: { oneTimeToken },
    });
    const consent = ("data" in body && body.data ? body.data : body) as YapilyConsent;
    if (!consent.consentToken || !consent.id) throw new ProviderError("Yapily returned no consent");
    return {
      id: consent.id,
      token: consent.consentToken,
      institutionId: consent.institutionId ?? "",
      userId: consent.applicationUserId ?? "",
      expiresAt: consent.expiresAt ?? null,
    };
  }

  async accounts(consentToken: string): Promise<Account[]> {
    const body = await this.call<{ data?: YapilyAccount[] }>("GET", "/accounts", { consent: consentToken });
    return (body.data ?? []).map((a) => {
      const iban = a.accountIdentifications?.find((i) => i.type === "IBAN")?.identification;
      return {
        id: a.id,
        name: a.nickname || a.accountNames?.[0]?.name || a.type || "Account",
        ibanLast4: iban ? iban.replace(/\s/g, "").slice(-4) : null,
        balance: typeof a.balance === "number" ? a.balance : null,
        currency: a.currency ?? "EUR",
      };
    });
  }

  async transactions(consentToken: string, accountId: string, from: Date): Promise<Transaction[]> {
    const out: Transaction[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams({ from: from.toISOString(), limit: String(PAGE_LIMIT), offset: String(page * PAGE_LIMIT) });
      const body = await this.call<{ data?: YapilyTransaction[] }>(
        "GET",
        `/accounts/${encodeURIComponent(accountId)}/transactions?${query}`,
        { consent: consentToken },
      );
      const data = body.data ?? [];
      for (const t of data) out.push(toTransaction(t, accountId));
      if (data.length < PAGE_LIMIT) break;
    }
    return out;
  }

  async revokeConsent(consentId: string): Promise<void> {
    await this.call("DELETE", `/consents/${encodeURIComponent(consentId)}`);
  }

  private async call<T>(method: string, path: string, opts: { body?: unknown; consent?: string } = {}): Promise<T> {
    const headers: Record<string, string> = { Authorization: this.auth, Accept: "application/json" };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.consent) headers.consent = opts.consent;
    const res = await this.doFetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    if (!res.ok) {
      // Yapily's error body carries a message; it never contains account data.
      const detail = await res.text().catch(() => "");
      throw new ProviderError(`Yapily ${method} ${path.split("?")[0]} failed: ${res.status} ${detail.slice(0, 200)}`, res.status);
    }
    return (res.status === 204 ? {} : await res.json()) as T;
  }
}

export function toTransaction(t: YapilyTransaction, accountId: string): Transaction {
  const raw = t.transactionAmount?.amount ?? t.amount ?? 0;
  // Amounts are normally signed already; some banks send a positive amount with an indicator.
  const amount = t.creditDebitIndicator === "DEBIT" && raw > 0 ? -raw : raw;
  const date = (t.bookingDateTime ?? t.date ?? t.valueDateTime ?? "").slice(0, 10);
  const description =
    t.merchant?.merchantName ||
    (amount < 0 ? t.payeeDetails?.name : t.payerDetails?.name) ||
    t.description ||
    t.transactionInformation?.join(" ") ||
    t.reference ||
    "";
  return {
    id: t.id ?? `${accountId}-${date}-${amount}-${description}`.slice(0, 120),
    accountId,
    date,
    amount,
    currency: t.transactionAmount?.currency ?? t.currency ?? "EUR",
    description: description.trim(),
    pending: t.status === "PENDING",
  };
}

type YapilyInstitution = {
  id: string;
  name?: string;
  fullName?: string;
  countries?: { countryCode2?: string }[];
  features?: string[];
};

type YapilyConsent = {
  id?: string;
  consentToken?: string;
  institutionId?: string;
  applicationUserId?: string;
  expiresAt?: string;
};

type YapilyAccount = {
  id: string;
  type?: string;
  nickname?: string;
  balance?: number;
  currency?: string;
  accountNames?: { name?: string }[];
  accountIdentifications?: { type?: string; identification?: string }[];
};

export type YapilyTransaction = {
  id?: string;
  date?: string;
  bookingDateTime?: string;
  valueDateTime?: string;
  status?: string;
  amount?: number;
  currency?: string;
  transactionAmount?: { amount?: number; currency?: string };
  creditDebitIndicator?: string;
  description?: string;
  reference?: string;
  transactionInformation?: string[];
  merchant?: { merchantName?: string };
  payeeDetails?: { name?: string };
  payerDetails?: { name?: string };
};
