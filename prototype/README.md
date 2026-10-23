# FiCo prototype

A clickable, single-file prototype of FiCo: a customer-facing finance assistant
that acts as an Xcoins partner. Open `index.html` in a browser. There is no
backend; every Xcoins response is simulated in the page.

## Roles

- **FiCo** owns the customer, the app, the conversation and notifications.
- **Xcoins** runs every order, holds the licence (MiCA CASP), runs KYC inside its
  own window, and decides when to hold buys or ask for documents.

FiCo fills in a buy as a signed preset and opens the Xcoins window. The customer
confirms inside Xcoins with a one-time code. FiCo never confirms on the
customer's behalf.

## What the prototype covers

| Flow | Try it |
|---|---|
| One-off buy, first buys reviewed by Xcoins CS | "Buy €50 of bitcoin", then *Approve buys waiting for review* |
| Autobuy mandate, run by Xcoins on schedule | "Buy €25 of BTC every Monday", then *Run autobuys now* |
| Buy delivered to the customer's own wallet | "Buy €100 of ETH to my Ledger" |
| Cancel an autobuy from FiCo (API, no window) | "Cancel my autobuy" |
| Advice request declined | "Should I buy now?" |
| New customer, KYC inside the Xcoins window | Set *New, not verified*, then any buy |
| CS asks for a card photo | *Ask for card photo* |
| AML questionnaire at a threshold, autobuy held | *AML threshold reached*, then *Run autobuys now* |

## Integration surface it assumes

Already exists today (from the partner bank simulator):

- Iframe login with `userId` + one-time `attemptSecret`
- `USER:LOGIN` webhook answered with a signed `APPROVED`
- `USER:APPROVED` / `USER:REJECTED` webhooks, signed with `X-Signature` + `X-Nonce`

Proposed, for discussion with the Xcoins team:

| Name | Direction | Purpose |
|---|---|---|
| `preset` + `presetSig` iframe params | FiCo → Xcoins | Signed with the partner key; `type` BUY or AUTOBUY, asset, EUR amount, optional schedule and destination, nonce, 10-minute expiry. Xcoins locks those fields. |
| `ORDER:CREATED` / `ORDER:IN_REVIEW` / `ORDER:COMPLETED` | Xcoins → FiCo | Order lifecycle, including manual CS review of early buys |
| `ORDER:ON_HOLD` | Xcoins → FiCo | An autobuy run was held, e.g. because a document request is open |
| `AUTOBUY:CREATED` / `AUTOBUY:CANCELLED` | Xcoins → FiCo | Mandate lifecycle; Xcoins runs the schedule itself |
| `POST /v1/app-partners/{id}/autobuys/{autobuyId}/cancel` | FiCo → Xcoins API | Cancel without the window; creating or raising needs the window |
| `ACTION:REQUIRED` / `ACTION:SUBMITTED` | Xcoins → FiCo | CS or AML asks for something (`CARD_PROOF`, `AML_QUESTIONNAIRE`); FiCo only relays, the answer stays at Xcoins |

## Not real

Prices, the 1.5% fee, the 3-buy review threshold, the €10 minimum, the AML
threshold, the OTP (`123456`) and all addresses are placeholders. The "assistant"
is a few regex rules standing in for a language model.
