export const en = {
  "lang.switch": "Deutsch",
  "welcome.title": "Money, minus the stress.",
  "welcome.lead": "FiCo keeps track of your accounts, bills and subscriptions, and helps you start with crypto when you want.",
  "welcome.start": "Let’s go",
  "welcome.signin": "I already have an account",
  "privacy.title": "Help us make FiCo better?",
  "privacy.lead": "We’d like to see how people use FiCo, so we can fix what’s confusing. We never record amounts, account numbers or what you buy.",
  "privacy.accept": "Yes, that’s fine",
  "privacy.decline": "No thanks",
  "privacy.later": "You can change this any time in your profile.",
  "next.title": "You’re in early.",
  "next.lead": "Sign-in and connecting your bank come next. Thanks for testing FiCo.",
  "next.restart": "Start again",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
