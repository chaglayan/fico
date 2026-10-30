# FiCo decisions

The running record of what we decided and why. Newest first. Every build
session reads this before starting.

## 2026-10-31 (later)

**Hosting: Cloudflare, not Vercel.** The founder already hosts on Cloudflare.
The app is a React single-page app built with Vite; the API is Hono on
Cloudflare Workers, deployed together. Supabase (Frankfurt) stays for the
database and sign-in.

**Solo founder for now.** No co-founder is assumed. The UK company stays an
option if someone joins; until then: sandbox without a company, pilot under
Xcoins.

## 2026-10-31

**Home: option A, "Today first".** One action at the top, tiles below. The
feed (option B) lives under the Money tab.

**Pilot nudges:** Subscription or bitcoin, Payday, Price went up, New
subscription, Paying twice, Weekly summary.

**Channels and caps.**
- In the app: no hard cap. At most one new "Today" nudge a day on Home; the
  rest go to the Money feed.
- Email: at most 2 a week, one of them the weekly summary.
- Price alerts the customer sets don't count toward either cap.

**Price alerts in the pilot, alert only.** The customer picks a coin and a
price; FiCo notifies in the app and by email. "Buy automatically when the price
reaches X" needs Xcoins to support conditional orders, so it is an ask for
Xcoins, not pilot scope. FiCo never places an order on its own.

**Language: German and English.** The founder doesn't speak German, so a
native speaker reviews German copy before the pilot, and Xcoins compliance
approves the German wording of crypto nudges.

## 2026-10-30

**Platform: web app first.** Built so it can become a mobile app later. No
app stores for the pilot.

**Pilot country: Germany.** German banks first; the app needs German.

**Pilot scope (v1).**
- Bank connection and spending by category
- Subscriptions list
- The nudge ("Disney+ or bitcoin?") with real bitcoin price history
- Xcoins handoff and the crypto tile, **simulated until Xcoins is ready**,
  behind the same interface the real Xcoins integration will use

**Not final yet: nudges and other actions, and the home screen.** One more
design round before building those. Onboarding, the look, and the crypto flows
are accepted as prototyped.

**Data: keep it, minimal.** FiCo stores the bank data its features need
(accounts, balances, about 12 months of transactions, detected subscriptions)
so we can learn from it and send timely nudges. Everything else is not stored.
Deleted when the customer disconnects or closes their account.

**Licence: none of our own.** Bank data through Yapily Connect's EU entity
(Lithuania), which lets an unlicensed company show account data to EEA users
without becoming an agent. Crypto through Xcoins' MiCA licence.

**Entity path.**
1. Sandbox build: no company. Uses the founder's Yapily sandbox account.
2. Pilot: Xcoins signs the Yapily contract.
3. If the co-founder joins: a UK limited company, with the UK-resident
   co-founder as a director. Costs below.
The founder's Turkish sole proprietorship is not used (personal liability,
EU data outside the EU, tax status of salary income).

**Analytics: PostHog, EU cloud.** Product analytics, session replay (masked),
feature flags and experiments in one tool. Tracking plan in `analytics.md`.
Spotify Confidence reconsidered once we run experiments at a scale PostHog
handles badly.

## UK limited company: cost estimate

Official fees confirmed from secondary sources (Companies House from
1 February 2026, ICO from February 2025); service prices are typical ranges,
not quotes.

| Item | When | Cost |
|---|---|---|
| Incorporation at Companies House (online) | Once | £100 |
| Confirmation statement | Yearly | £50 |
| ICO data protection fee (tier 1) | Yearly | £52 |
| Registered office address service (keeps a home address off the register) | Yearly | £30–£150 |
| Director identity verification (GOV.UK) | Once per director | Free |
| Business bank account (Tide, Starling and similar) | Monthly | £0–£10 |
| Accountant: annual accounts, corporation tax return | Yearly | £1,000–£1,800 |
| Shareholder agreement, IP assignment, vesting | Once | £500–£2,000 (or a template service) |
| **First year** | | **about £1,800–£4,200** |
| **Each year after** | | **about £1,200–£2,100** |

Notes:
- The UK has an EU adequacy decision, so EU customers' data can flow to a UK
  company without extra contracts, unlike Turkey.
- Confirm with Yapily that a UK company can use Yapily Connect UAB for EEA
  customers.
- The founder, as a Turkish-resident shareholder, should ask a mali müşavir
  about Turkish tax on any future dividends.

Sources: [ICAEW on 2026 Companies House fees](https://www.icaew.com/insights/viewpoints-on-the-news/2025/nov-2025/significant-hikes-to-companies-house-fees-in-2026),
[Rapid Formations](https://www.rapidformations.co.uk/blog/companies-house-fees-increase/),
[Lewis Silkin on ICO fees](https://www.lewissilkin.com/insights/2025/02/06/fee-payable-to-the-ico-to-increase-in-february-102jzb9).
