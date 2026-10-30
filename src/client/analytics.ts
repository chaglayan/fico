import type { PostHog } from "posthog-js";
import type { EventName, EventProps } from "../shared/events";

// Analytics follows docs/analytics.md: PostHog EU, loaded only after the
// customer agrees, with every piece of text masked in session replays.

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://eu.i.posthog.com";
const CONSENT_KEY = "fico.analytics";

export type Consent = "granted" | "denied" | null;

let posthog: PostHog | null = null;
let loading: Promise<void> | null = null;
// Events tracked while PostHog is still loading, sent once it's ready.
const queued: [EventName, EventProps | undefined][] = [];

export function readConsent(): Consent {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(consent: Exclude<Consent, null>): void {
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    // Not remembered; we ask again next time.
  }
  if (consent === "granted") void start();
  else {
    queued.length = 0;
    posthog?.opt_out_capturing();
  }
}

function start(): Promise<void> {
  if (!KEY) return Promise.resolve();
  loading ??= import("posthog-js").then(({ default: ph }) => {
    ph.init(KEY, {
      api_host: HOST,
      person_profiles: "identified_only",
      session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    });
    ph.opt_in_capturing();
    posthog = ph;
    for (const [event, props] of queued.splice(0)) ph.capture(event, props);
  });
  return loading;
}

// Called once on load: resumes analytics only if the customer already agreed.
export function resumeAnalytics(): void {
  if (readConsent() === "granted") void start();
}

export function track(event: EventName, props?: EventProps): void {
  if (posthog) posthog.capture(event, props);
  else if (loading) queued.push([event, props]);
}
