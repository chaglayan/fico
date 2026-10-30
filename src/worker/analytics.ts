import type { EventName, EventProps } from "../shared/events";

// Server-side PostHog events (docs/analytics.md, "Sent from: Backend"). Sent
// only when the customer agreed to analytics, keyed by FiCo's user ID.

export type AnalyticsEnv = { POSTHOG_KEY?: string; POSTHOG_HOST?: string };

export async function capture(
  env: AnalyticsEnv,
  consent: boolean,
  userId: string,
  event: EventName,
  properties: EventProps = {},
): Promise<void> {
  if (!consent || !env.POSTHOG_KEY) return;
  const host = (env.POSTHOG_HOST ?? "https://eu.i.posthog.com").replace(/\/$/, "");
  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: env.POSTHOG_KEY, event, distinct_id: userId, properties }),
    });
  } catch (err) {
    console.warn("PostHog capture failed", event, err);
  }
}
