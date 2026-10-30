import type { Lang } from "./i18n";

const LOCALE: Record<Lang, string> = { de: "de-DE", en: "en-IE" };

export function money(lang: Lang, amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency }).format(amount);
}

export function day(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export function shortDay(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short" }).format(new Date(iso));
}

export function time(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
