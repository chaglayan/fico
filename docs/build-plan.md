# FiCo build plan

## Stack

| Part | Choice | Why | Pilot cost |
|---|---|---|---|
| Web app | React (TypeScript) built with Vite, mobile-first, installable | Plain and well known; the logic carries over to a mobile app later | |
| API and jobs | Hono on Cloudflare Workers, Cron Triggers for daily refresh and nudges | Runs natively on Cloudflare, where the founder already hosts | free plan, or $5 a month |
| Hosting | Cloudflare Workers with static assets | One deploy for the app and the API | included above |
| Database and sign-in | Supabase, Frankfurt | Postgres plus email, Google and Apple sign-in in one service | free tier, then $25 a month |
| Bank data | Yapily Connect (EU) | Decided | quote pending |
| Email | Resend or Postmark | Transactional email with templates | free tier for the pilot |
| Analytics, flags | PostHog EU | Decided | free tier |
| Bitcoin price history | CoinGecko until Xcoins has a feed | Free plan with rate limits | free |
| Languages | A small typed dictionary, German and English | No library needed at this size; missing translations fail the tests | |
| Tests | Vitest for logic, Playwright for flows | | |

Everything that talks to Yapily or Xcoins sits behind an interface with a
simulated version, so the app works end to end before either is live.

## Slices

Each slice is one or more pull requests, reviewable and testable on its own.

0. **Foundation.** Project setup, `CLAUDE.md`, design tokens from the
   prototype, German and English, PostHog with consent, CI.
1. **Sign-in and onboarding.** Account, name, goals, analytics consent.
2. **Bank connection.** Yapily sandbox (and a simulated bank), accounts and
   transactions, minimal storage, 180-day consent tracking. *Built; see
   `bank-connection.md`. Not yet tried against Yapily's sandbox.*
3. **Spending and subscriptions.** Categories, subscription detection with
   tests, the first look.
4. **Home and Money.** Home option A; the feed under Money.
5. **Nudges, email, price alerts.** The six pilot nudges, caps, the weekly
   summary email, price alerts.
6. **Crypto, simulated.** The Xcoins handoff and the crypto tile against a
   simulated Xcoins, swapped for the real one when it's ready.
7. **Pilot readiness.** Privacy policy and terms, account deletion, PostHog
   dashboards, German review.

## Needed from the founder

- Yapily sandbox application ID and secret, as environment secrets, and the
  callback URLs added in the Yapily Console (`bank-connection.md`).
- A PostHog EU project key (free sign-up).
- Later: a domain name on Cloudflare, and a Supabase account (free to start).
