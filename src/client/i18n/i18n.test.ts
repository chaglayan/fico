import { describe, expect, it } from "vitest";
import { MESSAGES, detectLang, fill, translate } from "./index";

describe("i18n", () => {
  it("has every message in both languages, none empty", () => {
    const keys = Object.keys(MESSAGES.en).sort();
    expect(Object.keys(MESSAGES.de).sort()).toEqual(keys);
    for (const lang of ["de", "en"] as const) {
      for (const key of keys) expect(MESSAGES[lang][key as keyof typeof MESSAGES.en].trim()).not.toBe("");
    }
  });

  it("uses the same placeholders in both languages", () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(MESSAGES.en) as (keyof typeof MESSAGES.en)[]) {
      expect(placeholders(MESSAGES.de[key])).toEqual(placeholders(MESSAGES.en[key]));
    }
  });

  it("prefers the saved language, then the browser's", () => {
    expect(detectLang("en", "de-DE")).toBe("en");
    expect(detectLang(null, "de-AT")).toBe("de");
    expect(detectLang(null, "fr-FR")).toBe("en");
    expect(detectLang("xx", undefined)).toBe("en");
  });

  it("fills in placeholders", () => {
    expect(fill("Hi {name}, {n} new", { name: "Alex", n: "2" })).toBe("Hi Alex, 2 new");
    expect(fill("Hi {name}", {})).toBe("Hi {name}");
  });

  it("translates by key", () => {
    expect(translate("de", "welcome.start")).toBe("Los geht’s");
    expect(translate("en", "welcome.start")).toBe("Let’s go");
  });
});
