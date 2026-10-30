# Open banking for FiCo: providers and integration

Research notes, October 2026. Prices and some licensing details come from
third-party sources; everything marked *unconfirmed* needs checking with the
provider before we rely on it.

## What FiCo needs

| When | Capability | Open banking term | Used for |
|---|---|---|---|
| Pilot | Read accounts, balances, transactions | AIS (account information) | First look, spending, subscriptions, the nudge |
| Pilot | Recurring payment detection | Enrichment (provider add-on) or our own code | The subscription list and "Disney+ or bitcoin?" |
| Later | One-off transfer from the customer's bank to their Xcoins IBAN | PIS (payment initiation) | Euro deposits ("fuel up") |

FiCo holds no PSD2 licence. Every provider below offers a way for an
unlicensed company to operate under the provider's licence, usually as its
**agent**.

## What "using their licence" means

- Under PSD2 Article 19 a licensed payment institution can appoint agents. The
  agent is entered in the register of the provider's home regulator, and the
  provider stays liable for what the agent does. ([EBA single rulebook, Art. 19](https://www.eba.europa.eu/regulation-and-policy/single-rulebook/interactive-single-rulebook/16241))
- In practice the provider runs due diligence on us (company, directors, AML
  controls), files the agent registration, and makes us show their consent
  wording and a regulatory disclosure. TrueLayer documents this; it also
  charges a fee for agency and notes the agent model has limitations.
  ([TrueLayer consent docs](https://docs.truelayer.com/docs/collect-user-consent),
  [TrueLayer agent support article](https://support.truelayer.com/hc/en-us/articles/360016552778-Are-you-interested-in-becoming-a-TrueLayer-agent),
  [Codat on TrueLayer agents](https://docs.codat.io/integrations/banking/truelayer/register-for-truelayer))
- **Consequence: the contracting party must be a company.** Either a FiCo
  legal entity, or Xcoins signs and FiCo runs under Xcoins. This is a decision,
  not a detail: it decides who owns the customer data relationship.
- Agent onboarding takes longer than a normal signup (the regulator filing is
  part of it). Plan for weeks, not days. *Exact timelines unconfirmed.*

## Providers

| | Tink | TrueLayer | Enable Banking | Yapily | Salt Edge |
|---|---|---|---|---|---|
| Unlicensed route | Agent under Tink AB's licence ([Tink](https://tink.com/account-aggregation/), [FAQ](https://tink.com/legal/faq/)) | Agent of TrueLayer ([France launch](https://truelayer.com/blog/france-launch/)) | Agent under its AISP licence ([landscape post](https://enablebanking.com/blog/the-open-banking-provider-landscape-in-europe-what-to-know-before-you-choose?rq=yapily)) | Yapily Connect holds the licence for you ([docs](https://docs.yapily.com/tools-and-services/yapily-connect/overview)) | Partner Program ([Salt Edge](https://www.saltedge.com/partner_program)) |
| Home regulator (EEA) | Sweden (Finansinspektionen) | Ireland (Central Bank) | Finland *unconfirmed* | Lithuania *per tracker* | *unconfirmed* |
| Subscriptions built in | Yes: recurring transaction detection and prediction in Data Enrichment ([Tink](https://tink.com/products/data-enrichment/)) | Not found | Not found (raw data) | Not found | Not found |
| EU payments | Yes, SEPA Instant where the bank supports it | Yes ([EU payments guide](https://docs.truelayer.com/docs/eu-payments-guide)) | Yes | Yes | Yes |
| Free testing | Console signup, demo data ([Tink Console](https://tink.com/open-banking-developer-console/)) | Sandbox with mock data | **Restricted production: real data from accounts you link yourself** ([tracker](https://www.openbankingtracker.com/guides/free-open-banking-apis)) | Sandbox | Not found |
| Public pricing | No. Older third-party figure: €0.50 per user per month (*unconfirmed*, [Finexer](https://blog.finexer.com/tink-pricing/)) | No, sales-led | No. Volume-based with a monthly minimum ([FAQ](https://enablebanking.com/docs/faq)) | No. Platform fee plus usage | No |
| Notes | Owned by Visa. 18 European markets. | Strongest in the UK; good in large EU markets. | 2,700+ banks in 30 countries (vendor claim). Terms limit some business use; check. | UK and EU. | 2,500+ EU banks (vendor claim). |

Avoid **GoCardless Bank Account Data** (formerly Nordigen): it reportedly
stopped accepting new accounts in July 2025. ([Actual Budget docs](https://actualbudget.org/docs/advanced/bank-sync/gocardless/))

On crypto: no provider policy restricting crypto use cases turned up, and
TrueLayer is often listed as suiting crypto platforms, but this is from
comparison blogs, not policies. **Ask each provider directly.**

## Recommendation

1. **Build on Enable Banking's free restricted production.** Real data from
   your own bank accounts, no contract. Enough to build bank connection,
   transactions and our own subscription detection before any money is spent.
   *Check the free tier still exists when you sign up.*
2. **Get quotes from Tink and TrueLayer in parallel.** Tink is the favourite for
   the pilot: subscription detection comes built in, which saves the hardest
   piece of FiCo logic, and it covers payments later.
3. **Hide the provider behind one adapter** in FiCo's backend, so moving from
   Enable Banking to Tink (or back) is a configuration change, not a rewrite.

## How the integration works

```
FiCo app ──▶ FiCo backend ──▶ Provider API (Tink / TrueLayer / Enable Banking)
                │                  │
                │                  └─▶ Provider's hosted consent screen ─▶ Customer's bank (SCA)
                │
                └─▶ Xcoins (iframe handoff, presets, webhooks)
```

1. **Connect.** The backend asks the provider for a consent link for the chosen
   bank. The app opens the provider's hosted screen (Tink Link, TrueLayer's
   auth dialog, Enable Banking's auth page). The customer approves in their
   bank and is redirected back with a code.
2. **Fetch.** The backend exchanges the code, then pulls accounts, balances and
   about 90 days of transactions.
3. **Refresh.** Up to 4 background refreshes a day are allowed without the
   customer present. One or two a day is enough for us, and each refresh may
   cost money.
4. **Renew.** EU consent lasts 180 days. FiCo tracks the expiry date and asks
   the customer to reconfirm a week before.
5. **Detect subscriptions.** With Tink, read its recurring-transaction output.
   Without it, our own first version:
   - group transactions by cleaned-up merchant name;
   - keep groups with at least 3 payments of similar amount (±10%);
   - intervals of about 7, 30 or 365 days mean weekly, monthly or yearly;
   - predict the next date from the last one plus the interval.
6. **Nudge.** "€8.99 a month in bitcoin since the first Disney+ payment would be
   worth €X" needs daily bitcoin prices. Use Xcoins' price feed if it has
   history; otherwise a public price API. Xcoins compliance approves the
   wording.
7. **Pay (later).** One-off payment to the customer's Xcoins IBAN, approved in
   the bank. The IBAN is a GB IBAN from OpenPayd: confirm that SEPA Instant
   reaches it, and what name the payee-name check returns.

## Data and security

- FiCo is the data controller for bank data it stores. Store only what the
  features need: account names, balances, transactions for the last 12 months,
  detected subscriptions. Delete on disconnect.
- Provider credentials and consent tokens live only in the backend, encrypted.
- We need a privacy policy, a data processing agreement with the provider, and
  the agreed data agreement with Xcoins.

## Update: Yapily, no licence, no stored data (30 Oct 2026)

- **Yapily Connect lets an unlicensed company show bank data to EEA users
  without becoming an agent**, according to Yapily's docs. Customers of
  Yapily Connect UAB (Lithuania) can show account information to EEA users
  without agency; Yapily Connect Ltd (UK) customers need an FCA-approved agency
  for personal finance apps. The bank shows "Yapily Connect" to the customer,
  not FiCo. ([Yapily Connect AIS UX guidelines](https://docs.yapily.com/tools-and-services/yapily-connect/yapilyconnect-ux-ais-guidelines),
  [Licensing & registration](https://docs.yapily.com/concepts/licensing-and-registration))
- **"Hold no data" design: a stateless backend.** The app keeps the consent
  token in the phone's secure storage. FiCo's backend only signs requests to
  Yapily with FiCo's secret, passes the data through, and stores nothing.
  Subscriptions are worked out on the fly. Trade-off: no reliable background
  refresh, so no "Disney+ just charged you" push. Nudges appear when the
  customer opens the app. FiCo is still a GDPR controller while it processes
  the data, so a privacy policy and a data processing agreement with Yapily are
  still needed.
- **Contracting entity.** A Turkish sole proprietorship is a poor fit:
  unlimited personal liability, EU personal data processed outside the EU
  (Turkey has no EU adequacy decision), and its use for salary income may have
  tax consequences. Options: Xcoins signs for the pilot, or an EU company once
  the team is settled. The sandbox needs no entity.

## Questions to send every provider

1. Do you offer the agent model for EU customers in [countries], and how long
   does onboarding take?
2. What do you need from us for due diligence? Do you accept a newly formed
   company with one or two directors?
3. Is our use case acceptable: a money app that offers crypto purchases through
   a MiCA-licensed partner?
4. Price per connected customer, per refresh, per payment; the monthly minimum;
   any startup or pilot tier?
5. Is recurring-transaction or subscription detection included, and at what
   price?
6. Can payment initiation pay a GB IBAN (OpenPayd) over SEPA Instant from EU
   banks?
7. Where is data stored and processed?
8. What do we have to show to customers (consent wording, disclosures)?
