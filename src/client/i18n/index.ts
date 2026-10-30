import { de } from "./de";
import { en, type MessageKey, type Messages } from "./en";

export type Lang = "de" | "en";
export const MESSAGES: Record<Lang, Messages> = { de, en };

const STORAGE_KEY = "fico.lang";

export function detectLang(saved: string | null, browser: string | undefined): Lang {
  if (saved === "de" || saved === "en") return saved;
  return browser?.toLowerCase().startsWith("de") ? "de" : "en";
}

export function initialLang(): Lang {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; fall back to the browser language.
  }
  return detectLang(saved, typeof navigator === "undefined" ? undefined : navigator.language);
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not remembered; the app still works.
  }
}

// Replaces {placeholders} with values; unknown placeholders are left as they are.
export function fill(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}

export function translate(lang: Lang, key: MessageKey, vars: Record<string, string> = {}): string {
  return fill(MESSAGES[lang][key], vars);
}
