import { useEffect, useState } from "react";
import { readConsent, setConsent, track } from "./analytics";
import { initialLang, saveLang, translate, type Lang } from "./i18n";
import type { MessageKey } from "./i18n/en";

type Screen = "welcome" | "privacy" | "next";

export function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [screen, setScreen] = useState<Screen>("welcome");
  const t = (key: MessageKey) => translate(lang, key);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    track("app_opened", { source: "web" });
  }, []);

  const switchLang = () => {
    const next = lang === "de" ? "en" : "de";
    setLang(next);
    saveLang(next);
  };

  const start = () => {
    track("signup_started");
    // Ask for analytics consent only once; afterwards go straight on.
    setScreen(readConsent() === null ? "privacy" : "next");
  };

  const choose = (consent: "granted" | "denied") => {
    setConsent(consent);
    setScreen("next");
  };

  return (
    <div className="phone">
      <header className="bar">
        <span className="logo">
          Fi<span>Co</span>
        </span>
        <button className="link" onClick={switchLang}>
          {t("lang.switch")}
        </button>
      </header>

      {screen === "welcome" && (
        <main className="view">
          <div className="shapes" aria-hidden="true">
            <i className="s1" />
            <i className="s2" />
            <i className="s3" />
            <i className="s4" />
          </div>
          <h1>{t("welcome.title")}</h1>
          <p className="lead">{t("welcome.lead")}</p>
          <div className="actions">
            <button className="cta" onClick={start}>
              {t("welcome.start")}
            </button>
            <button className="ghost" onClick={start}>
              {t("welcome.signin")}
            </button>
          </div>
        </main>
      )}

      {screen === "privacy" && (
        <main className="view">
          <h1>{t("privacy.title")}</h1>
          <p className="lead">{t("privacy.lead")}</p>
          <div className="actions">
            <button className="cta" onClick={() => choose("granted")}>
              {t("privacy.accept")}
            </button>
            <button className="ghost" onClick={() => choose("denied")}>
              {t("privacy.decline")}
            </button>
            <p className="fine">{t("privacy.later")}</p>
          </div>
        </main>
      )}

      {screen === "next" && (
        <main className="view">
          <h1>{t("next.title")}</h1>
          <p className="lead">{t("next.lead")}</p>
          <div className="actions">
            <button className="ghost" onClick={() => setScreen("welcome")}>
              {t("next.restart")}
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
