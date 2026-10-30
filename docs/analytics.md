# FiCo analytics plan (PostHog)

## Setup

- **PostHog Cloud EU** (data stays in the EU). The free tier covers the pilot
  many times over: about 1M events, 5,000 session recordings and 1M feature
  flag requests a month, according to PostHog's EU page.
  ([PostHog EU](https://posthog.com/eu))
- One project for production, one for development.
- Installed in both the app and the backend. Anything Xcoins tells us through
  webhooks (verified, bought, deposited) is sent **from the backend**, so it is
  trustworthy and survives ad blockers.

## Privacy rules

This is a finance app, so the defaults are strict.

1. **No money details in events.** No amounts, IBANs, account names or
   merchant names. Use buckets instead: `amount_bucket: "50-100"`,
   `subscription_category: "streaming"`.
2. **Person IDs are FiCo's random user ID**, never an email or name.
3. **Session replay masks all text and inputs.** Screens showing balances or
   transactions are excluded from recording altogether.
4. **Consent first.** Analytics starts after the customer agrees in
   onboarding. Before that, PostHog runs without cookies or stored IDs.
5. Deleting a FiCo account also deletes the person in PostHog.

## The funnel we report on

This is the funnel from the pitch, as events:

```
signup_completed → bank_connected → nudge_shown → nudge_tapped
  → xcoins_opened → first_buy_completed → deposit_completed → autobuy_created
```

One PostHog funnel with these steps is the main pilot dashboard. Each step's
conversion is a number the pilot has to prove.

## Events

Names are `object_action`, lower snake case. Properties in brackets.

### Onboarding
| Event | Properties | Sent from |
|---|---|---|
| `app_opened` | `source` | App |
| `signup_started` | | App |
| `signup_completed` | `method` (apple, google, email) | Backend |
| `goals_selected` | `goals` (list) | App |
| `bank_selected` | `bank_id`, `country` | App |
| `bank_consent_started` | `bank_id` | App |
| `bank_connected` | `bank_id`, `accounts_count` | Backend |
| `bank_connection_failed` | `bank_id`, `reason` | Backend |
| `first_look_viewed` | `subscriptions_count`, `categories_count` | App |
| `checkins_set` | `rhythm` | App |
| `notifications_enabled` | | App |

### Insights and nudges
| Event | Properties | Sent from |
|---|---|---|
| `subscriptions_viewed` | `subscriptions_count` | App |
| `spending_viewed` | `period` | App |
| `nudge_shown` | `nudge_type`, `subscription_category` | Backend or App |
| `nudge_tapped` | `nudge_type` | App |
| `nudge_dismissed` | `nudge_type` | App |

### Xcoins
| Event | Properties | Sent from |
|---|---|---|
| `xcoins_opened` | `entry` (nudge, tile, crypto_tab) | App |
| `xcoins_verified` | | Backend (Xcoins webhook) |
| `first_buy_completed` | `coin`, `amount_bucket`, `payment_method` | Backend (Xcoins webhook) |
| `buy_completed` | `coin`, `amount_bucket`, `payment_method` | Backend (Xcoins webhook) |
| `deposit_completed` | `amount_bucket`, `method` | Backend (Xcoins webhook) |
| `autobuy_created` | `frequency`, `amount_bucket` | Backend (Xcoins webhook) |

### Lifecycle
| Event | Properties | Sent from |
|---|---|---|
| `consent_renewal_shown` | `days_left` | App |
| `consent_renewed` | | Backend |
| `bank_disconnected` | `reason` | Backend |
| `account_deleted` | | Backend |

## Feature flags and experiments

- Every new feature ships behind a flag, so it can be switched off without an
  app release.
- **Experiments need volume.** With 50 pilot users no A/B test will give a
  clear answer; use the pilot for funnels and session replays. Start
  experiments (for example, two nudge wordings, both approved by Xcoins
  compliance) at stage 2, around 500 users.
