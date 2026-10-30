# FiCo build plan (proposed)

## Stack

| Part | Choice | Why | Pilot cost |
|---|---|---|---|
| Web app | Next.js (React, TypeScript), mobile-first, installable | Mainstream, easy to hire for; the logic carries over to a mobile app later | |
| Hosting | Vercel, EU region | Simple deploys and previews for every pull request | about $20 a month |
| Database and sign-in | Supabase, Frankfurt | Postgres plus email, Google and Apple sign-in in one service | free tier, then $25 a month |
| Bank data | Yapily Connect (EU) | Decided | quote pending |
| Email | Resend or Postmark | Transactional email with templates | free tier for the pilot |
| Analytics, flags | PostHog EU | Decided | free tier |
| Bitcoin price history | CoinGecko until Xcoins has a feed | Free plan with rate limits | free |
| Languages | next-intl, German and English | | |
| Tests | Vitest for logic, Playwright for flows | | |

Everything that talks to Yapily or Xcoins sits behind an interface with a
simulated version, so the app works end to end before either is live.

## Slices

Each slice is one or more pull requests, reviewable and testable on its own.

0. **Foundation.** Project setup, `CLAUDE.md`, design tokens from the
   prototype, German and English, PostHog with consent, CI.
1. **Sign-in and onboarding.** Account, name, goals, analytics consent.
2. **Bank connection.** Yapily sandbox (and a simulated bank), accounts and
   transactions, minimal storage, 180-day consent tracking.
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

- Yapily sandbox application ID and secret, as environment secrets.
- A PostHog EU project key (free sign-up).
- Later: a domain name, and Supabase and Vercel accounts (free to start).
