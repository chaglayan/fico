import type { ConnectionStatus, Institution } from "../shared/bank";
import { readConsent } from "./analytics";

// Calls to FiCo's own API. The session cookie goes along automatically.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  // Lets the backend know it may send analytics events for this customer.
  if (readConsent() === "granted") headers.set("x-fico-analytics", "granted");
  const res = await fetch(`/api${path}`, { ...init, headers, credentials: "same-origin" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "unknown");
  return body;
}

export const api = {
  session: () => call<{ userId: string }>("/session"),
  institutions: () => call<{ institutions: Institution[] }>("/bank/institutions").then((r) => r.institutions),
  connect: (institutionId: string, renew = false) =>
    call<{ url: string }>("/bank/connect", { method: "POST", body: JSON.stringify({ institutionId, renew }) }),
  connection: () => call<ConnectionStatus>("/bank/connection"),
  refresh: () => call<ConnectionStatus>("/bank/refresh", { method: "POST" }),
  disconnect: () => call<ConnectionStatus>("/bank/connection", { method: "DELETE" }),
};
