import type { Account, Institution, Transaction } from "../../shared/bank";
import type { ProviderId } from "./provider";

// What FiCo keeps per customer: one bank connection with its accounts and about
// 12 months of transactions. Nothing else from the bank is stored, and all of
// it goes when the customer disconnects.
//
// Kept in Cloudflare KV for now. Supabase (docs/build-plan.md) takes over once
// sign-in exists; only this interface needs a new implementation.

export type Connection = {
  provider: ProviderId;
  institution: Institution;
  consentId: string;
  // The provider's consent token, encrypted (see crypto.ts).
  tokenSealed: string;
  connectedAt: string;
  expiresAt: string;
  refreshedAt: string | null;
  accounts: Account[];
  transactions: Transaction[];
};

// A bank approval that has started but not come back yet.
export type Pending = {
  institutionId: string;
  // Whether the customer agreed to analytics, so the callback knows if it may send events.
  analytics: boolean;
  renewing: boolean;
  createdAt: string;
};

export interface BankStore {
  connection(userId: string): Promise<Connection | null>;
  saveConnection(userId: string, connection: Connection): Promise<void>;
  deleteConnection(userId: string): Promise<void>;
  pending(userId: string): Promise<Pending | null>;
  savePending(userId: string, pending: Pending): Promise<void>;
  deletePending(userId: string): Promise<void>;
}

// Approvals left unfinished are forgotten after 15 minutes.
const PENDING_TTL_SECONDS = 15 * 60;

export class KvStore implements BankStore {
  constructor(private readonly kv: KVNamespace) {}

  connection(userId: string) {
    return this.kv.get<Connection>(`bank:${userId}`, "json");
  }
  saveConnection(userId: string, connection: Connection) {
    return this.kv.put(`bank:${userId}`, JSON.stringify(connection));
  }
  deleteConnection(userId: string) {
    return this.kv.delete(`bank:${userId}`);
  }
  pending(userId: string) {
    return this.kv.get<Pending>(`pending:${userId}`, "json");
  }
  savePending(userId: string, pending: Pending) {
    return this.kv.put(`pending:${userId}`, JSON.stringify(pending), { expirationTtl: PENDING_TTL_SECONDS });
  }
  deletePending(userId: string) {
    return this.kv.delete(`pending:${userId}`);
  }
}

// For tests.
export class MemoryStore implements BankStore {
  readonly connections = new Map<string, Connection>();
  readonly pendings = new Map<string, Pending>();

  async connection(userId: string) {
    return structuredClone(this.connections.get(userId) ?? null);
  }
  async saveConnection(userId: string, connection: Connection) {
    this.connections.set(userId, structuredClone(connection));
  }
  async deleteConnection(userId: string) {
    this.connections.delete(userId);
  }
  async pending(userId: string) {
    return this.pendings.get(userId) ?? null;
  }
  async savePending(userId: string, pending: Pending) {
    this.pendings.set(userId, pending);
  }
  async deletePending(userId: string) {
    this.pendings.delete(userId);
  }
}
