# FiCo

A money app for Eurozone customers: connect a bank, see spending and
subscriptions, and buy crypto through Xcoins (a MiCA-licensed exchange). Solo
founder, pilot in Germany. FiCo holds no licence: bank data comes through
Yapily Connect (EU), crypto through Xcoins.

## Read first

- `docs/decisions.md`: what was decided and why. Newest first. Don't reopen a
  decision without the founder asking.
- `docs/build-plan.md`: stack and the order of slices.
- `docs/analytics.md`: events and privacy rules for PostHog.
- `docs/open-banking-providers.md`: Yapily and the alternatives.
- `docs/bank-connection.md`: how the bank connection works and how to try the
  Yapily sandbox.
- `prototype/`: clickable design prototypes. `onboarding.html` is the accepted
  flow and look; `home-nudges.html` holds the home screen and nudge decisions.

## Commands

- `npm run dev`: local app and API (Vite with the Cloudflare plugin)
- `npm run check`: type checks, tests and build; run before every commit
- `npm run deploy`: build and deploy to Cloudflare (founder's account)

## Layout

- `src/client/`: the React web app. Mobile-first; on desktop it sits in a
  phone-width column.
- `src/worker/`: the Hono API on Cloudflare Workers, under `/api`.
- `src/shared/`: code used by both, such as the analytics event list.

## Rules

- **Every user-facing string exists in German and English** (`src/client/i18n`).
  The tests fail if one is missing. German is machine-quality until a native
  speaker reviews it; don't present it as final.
- **Analytics events come from `src/shared/events.ts`** and follow
  `docs/analytics.md`: no amounts (use `amountBucket`), no IBANs, names or
  merchants. PostHog loads only after the customer agrees.
- **Yapily and Xcoins sit behind interfaces with simulated versions**, so the
  app works end to end without either being live.
- **FiCo never moves money or places orders on its own.** Anything that buys,
  sells or transfers happens in the Xcoins window, confirmed by the customer.
- **Secrets never go in the repo.** Locally in `.dev.vars` (template in
  `.dev.vars.example`) and `.env.local`;
  in production as Cloudflare secrets.
