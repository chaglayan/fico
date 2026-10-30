# Bank connection (slice 2)

How FiCo connects a bank, what it keeps, and how to try it with the Yapily
sandbox.

## The flow

1. **Pick a bank.** The app lists banks from every provider that's switched on:
   Yapily (when its credentials are set) and the simulated banks (outside
   production). IDs carry the provider: `yapily:modelo-sandbox`,
   `simulated:musterbank`.
2. **Approve in the bank.** `POST /api/bank/connect` asks the provider for an
   approval link and remembers the choice for 15 minutes. The customer approves
   in the bank (or on the simulated bank page, `/bank/simulated`).
3. **Back to FiCo.** The bank redirects to `/api/bank/callback` with a one-time
   token. The backend checks that this browser started the approval, swaps the
   token for a consent, encrypts the consent token and stores it.
4. **Read the accounts.** The app shows "Getting to know your money" while
   `POST /api/bank/refresh` fetches accounts and 12 months of transactions. The
   first successful read sends `bank_connected`.
5. **Stay up to date.** Opening the app refreshes if the last update is older
   than 6 hours; there's also an "Update now" button. Refreshes ask for the last
   90 days and keep older transactions already stored. A daily background
   refresh (Cron Trigger) comes with nudges in slice 5.
6. **Renew.** EU consent lasts 180 days. In the last 7 days the app shows a
   renewal card; renewing goes through the bank again and keeps the data.
   After expiry the data stays visible but can't be refreshed.
7. **Disconnect.** Ends the consent at the bank and deletes everything stored.

## What's stored

Per customer, one connection: the bank's name, the consent (encrypted token,
expiry), accounts (name, last four IBAN characters, balance) and transactions
from the last 12 months (date, signed amount, description, pending flag).
Nothing else from the bank. See `src/worker/bank/store.ts`.

## Try the Yapily sandbox

1. In the [Yapily Console](https://console.yapily.com), open the sandbox
   application and add these callback URLs:
   - `http://localhost:5173/api/bank/callback`
   - the deployed address, for example `https://fico.<account>.workers.dev/api/bank/callback`
2. Copy `.dev.vars.example` to `.dev.vars` and fill in the application ID and
   secret.
3. `npm run dev`, open the app, and pick **Modelo Sandbox** (Yapily's test
   bank; the login details are in Yapily's sandbox docs).
4. For the deployed app, set the secrets once:

   ```bash
   npx wrangler secret put YAPILY_APPLICATION_ID
   npx wrangler secret put YAPILY_APPLICATION_SECRET
   npx wrangler secret put TOKEN_KEY
   ```

The bank list shows banks for Germany. A sandbox application usually only has
Modelo Sandbox (UK), so then it shows everything the application has.

## To check against the real sandbox

The Yapily client (`src/worker/bank/yapily.ts`) was written from Yapily's API
reference without live credentials; its tests use made-up responses in
Yapily's shape. On the first sandbox run, check:

- the callback's query parameter is `one-time-token` (the callback also accepts
  `oneTimeToken`), and a cancelled approval arrives with an `error` parameter;
- `POST /exchange-one-time-token` returns the consent with `consentToken` and
  `expiresAt`;
- transaction amounts arrive signed (negative for money out).
