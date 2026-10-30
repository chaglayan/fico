import type { Account, Institution, Transaction } from "../../shared/bank";

// Everything FiCo needs from an open banking provider. Yapily is the real one;
// the simulated provider stands in for it so the app works end to end without
// credentials. Both only read: there is no way to move money through this.
export interface BankProvider {
  readonly id: ProviderId;
  institutions(): Promise<Institution[]>;
  // Starts the bank's approval flow. The customer is sent to `url` and comes
  // back to `callbackUrl` with a one-time token or an error.
  startConsent(req: ConsentRequest): Promise<{ url: string }>;
  // Swaps the one-time token from the callback for a consent.
  completeConsent(oneTimeToken: string): Promise<Consent>;
  accounts(consentToken: string): Promise<Account[]>;
  transactions(consentToken: string, accountId: string, from: Date): Promise<Transaction[]>;
  revokeConsent(consentId: string): Promise<void>;
}

export type ProviderId = "yapily" | "simulated";

export type ConsentRequest = {
  institutionId: string;
  // FiCo's user ID, never a name or email.
  userId: string;
  callbackUrl: string;
  transactionsFrom: Date;
};

export type Consent = {
  id: string;
  token: string;
  institutionId: string;
  userId: string;
  // Null when the provider doesn't say; FiCo then assumes 180 days.
  expiresAt: string | null;
};

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
