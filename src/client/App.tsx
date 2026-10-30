import { useCallback, useEffect, useState } from "react";
import type { FailureReason } from "../shared/bank";
import { identify, readConsent, setConsent, track } from "./analytics";
import { api } from "./api";
import { BankView, Connect, Disconnect, Failed, Reading, SimulatedApprove, type Connected, type T } from "./bank";
import { initialLang, saveLang, translate, type Lang } from "./i18n";

type Screen =
  | { name: "loading"; renewed: boolean }
  | { name: "welcome" }
  | { name: "privacy" }
  | { name: "connect" }
  | { name: "home" }
  | { name: "approve"; bankName: string; token: string }
  | { name: "reading" }
  | { name: "failed"; reason: FailureReason }
  | { name: "bank"; status: Connected; renewed: boolean }
  | { name: "disconnect"; status: Connected };

const REASONS: FailureReason[] = ["denied", "expired", "no_accounts", "provider_error"];

// Where the app starts: the simulated bank page, a return from the bank
// (/?bank=...), or the normal start.
function initialScreen(): Screen {
  const url = new URL(window.location.href);
  if (url.pathname === "/bank/simulated") {
    return { name: "approve", bankName: "", token: url.searchParams.get("token") ?? "" };
  }
  const result = url.searchParams.get("bank");
  if (result) window.history.replaceState(null, "", "/");
  if (result === "syncing") return { name: "reading" };
  if (result === "failed") {
    const reason = url.searchParams.get("reason") as FailureReason;
    return { name: "failed", reason: REASONS.includes(reason) ? reason : "provider_error" };
  }
  return { name: "loading", renewed: result === "renewed" };
}

export function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const t: T = (key, vars) => translate(lang, key, vars);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    track("app_opened", { source: "web" });
    api.session().then(({ userId }) => identify(userId), () => {});
  }, []);

  // Decide between the welcome, home and bank screens once we know the connection.
  const showStart = useCallback((renewed = false) => {
    api.connection().then(
      (status) => {
        if (status.connected) setScreen({ name: "bank", status, renewed });
        else setScreen(readConsent() === null ? { name: "welcome" } : { name: "home" });
      },
      () => setScreen({ name: "welcome" }),
    );
  }, []);

  useEffect(() => {
    if (screen.name === "loading") showStart(screen.renewed);
    if (screen.name === "approve" && !screen.bankName) {
      const id = `simulated:${new URL(window.location.href).searchParams.get("bank")}`;
      api.institutions().then(
        (list) => setScreen({ ...screen, bankName: list.find((b) => b.id === id)?.name ?? "Bank" }),
        () => setScreen({ ...screen, bankName: "Bank" }),
      );
    }
  }, [screen, showStart]);

  const switchLang = () => {
    const next = lang === "de" ? "en" : "de";
    setLang(next);
    saveLang(next);
  };

  const start = () => {
    track("signup_started");
    // Ask for analytics consent only once; afterwards go straight on.
    setScreen(readConsent() === null ? { name: "privacy" } : { name: "connect" });
  };

  const choose = (consent: "granted" | "denied") => {
    setConsent(consent);
    setScreen({ name: "connect" });
  };

  const onReadFail = useCallback((reason: FailureReason) => setScreen({ name: "failed", reason }), []);

  return (
    <div className="phone">
      {screen.name !== "approve" && (
        <header className="bar">
          <span className="logo">
            Fi<span>Co</span>
          </span>
          <button className="link" onClick={switchLang}>
            {t("lang.switch")}
          </button>
        </header>
      )}

      {screen.name === "loading" && (
        <main className="view">
          <p className="lead">{t("common.loading")}</p>
        </main>
      )}

      {screen.name === "welcome" && (
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

      {screen.name === "privacy" && (
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

      {screen.name === "connect" && <Connect t={t} onSkip={() => setScreen({ name: "home" })} />}

      {screen.name === "home" && (
        <main className="view">
          <h1>{t("home.title")}</h1>
          <div className="tile" style={{ background: "var(--t1)" }}>
            <div className="k">{t("home.tileKey")}</div>
            <div className="big">{t("home.tileBig")}</div>
            <div className="sm">{t("home.tileText")}</div>
            <button className="more" onClick={() => setScreen({ name: "connect" })}>
              {t("home.connect")}
            </button>
          </div>
        </main>
      )}

      {screen.name === "approve" && screen.bankName && <SimulatedApprove t={t} bankName={screen.bankName} token={screen.token} />}

      {screen.name === "reading" && (
        <Reading t={t} onDone={(status) => setScreen({ name: "bank", status, renewed: false })} onFail={onReadFail} />
      )}

      {screen.name === "failed" && (
        <Failed t={t} reason={screen.reason} onRetry={() => setScreen({ name: "connect" })} onLater={() => showStart()} />
      )}

      {screen.name === "bank" && (
        <BankView
          t={t}
          lang={lang}
          status={screen.status}
          renewed={screen.renewed}
          onChange={(status) => setScreen({ name: "bank", status, renewed: false })}
          onDisconnect={() => setScreen({ name: "disconnect", status: screen.status })}
        />
      )}

      {screen.name === "disconnect" && (
        <Disconnect
          t={t}
          bank={screen.status.institution.name}
          onDone={() => setScreen({ name: "home" })}
          onCancel={() => setScreen({ name: "bank", status: screen.status, renewed: false })}
        />
      )}
    </div>
  );
}
