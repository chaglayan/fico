// Shapes the bank API returns to the app, and the consent rules both sides use.

// EU bank access (PSD2) lasts 180 days; FiCo asks the customer to renew in the
// last week before it ends.
export const CONSENT_DAYS = 180;
export const RENEWAL_WINDOW_DAYS = 7;
// FiCo keeps about 12 months of transactions (docs/decisions.md, "Data: keep it, minimal").
export const HISTORY_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export type Institution = {
  id: string;
  name: string;
  // True for the built-in simulated banks, which never talk to a real bank.
  simulated: boolean;
};

export type Account = {
  id: string;
  name: string;
  // Only the last four characters of the IBAN are kept, for recognising the account.
  ibanLast4: string | null;
  balance: number | null;
  currency: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  // Booking date, YYYY-MM-DD.
  date: string;
  // Negative for money going out.
  amount: number;
  currency: string;
  // Merchant or counterparty text from the bank, needed for categories and subscriptions.
  description: string;
  pending: boolean;
};

export type ConnectionStatus =
  | { connected: false }
  | {
      connected: true;
      institution: Institution;
      connectedAt: string;
      expiresAt: string;
      daysLeft: number;
      state: ConsentState;
      // Null until the first sync after connecting has finished.
      refreshedAt: string | null;
      accounts: Account[];
      transactionsCount: number;
      latest: Transaction[];
    };

export type ConsentState = "active" | "renew_soon" | "expired";

export type FailureReason = "denied" | "expired" | "no_accounts" | "provider_error";

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

// Whole days until the consent ends, rounded up; 0 once it has ended.
export function daysLeft(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS));
}

export function consentState(expiresAt: string, now: Date): ConsentState {
  const left = daysLeft(expiresAt, now);
  if (left === 0) return "expired";
  return left <= RENEWAL_WINDOW_DAYS ? "renew_soon" : "active";
}
