// Every analytics event FiCo sends, as listed in docs/analytics.md.
// Add new events here first, so the app and the worker can't drift apart.
export const EVENTS = [
  // Onboarding
  "app_opened",
  "signup_started",
  "signup_completed",
  "goals_selected",
  "bank_selected",
  "bank_consent_started",
  "bank_connected",
  "bank_connection_failed",
  "first_look_viewed",
  "checkins_set",
  "notifications_enabled",
  // Insights and nudges
  "subscriptions_viewed",
  "spending_viewed",
  "nudge_shown",
  "nudge_tapped",
  "nudge_dismissed",
  // Xcoins
  "xcoins_opened",
  "xcoins_verified",
  "first_buy_completed",
  "buy_completed",
  "deposit_completed",
  "autobuy_created",
  // Price alerts
  "price_alert_created",
  "price_alert_triggered",
  // Lifecycle
  "consent_renewal_shown",
  "consent_renewed",
  "bank_disconnected",
  "account_deleted",
] as const;

export type EventName = (typeof EVENTS)[number];

// Property values are limited to plain scalars and lists of strings, which
// keeps amounts and names out unless someone adds them on purpose.
export type EventProps = Record<string, string | number | boolean | string[]>;

// Money goes into events only as a range, never as an exact amount.
export function amountBucket(euros: number): string {
  const edges = [20, 50, 100, 250, 500, 1000];
  for (const [i, edge] of edges.entries()) {
    if (euros < edge) return i === 0 ? `0-${edge}` : `${edges[i - 1]}-${edge}`;
  }
  return "1000+";
}
