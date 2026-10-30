import { useEffect, useMemo, useState } from "react";
import type { ConnectionStatus, FailureReason, Institution } from "../shared/bank";
import { hideFromReplay, track } from "./analytics";
import { api } from "./api";
import { day, money, shortDay, time } from "./format";
import type { Lang } from "./i18n";
import type { MessageKey } from "./i18n/en";

export type T = (key: MessageKey, vars?: Record<string, string>) => string;
export type Connected = Extract<ConnectionStatus, { connected: true }>;

const TINTS = ["--t1", "--t2", "--t3", "--t4", "--t5"];
// Fetch new transactions when the app opens if the last update is older than this.
const STALE_MS = 6 * 60 * 60 * 1000;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Asks the backend for the bank's approval page and goes there.
export async function startConnect(institutionId: string, renew = false): Promise<void> {
  if (!renew) track("bank_selected", { bank_id: institutionId, country: "DE" });
  const { url } = await api.connect(institutionId, renew);
  track("bank_consent_started", { bank_id: institutionId });
  window.location.assign(url);
}

export function Connect({ t, onSkip }: { t: T; onSkip: () => void }) {
  const [banks, setBanks] = useState<Institution[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setFailed(false);
    api.institutions().then(setBanks, () => setFailed(true));
  };
  useEffect(load, []);

  const shown = useMemo(
    () => (banks ?? []).filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())),
    [banks, query],
  );

  const pick = async (bank: Institution) => {
    setBusy(bank.id);
    try {
      await startConnect(bank.id);
    } catch {
      setBusy(null);
      setFailed(true);
    }
  };

  return (
    <main className="view">
      <h1>{t("connect.title")}</h1>
      <div className="promise">
        <div>
          <span className="ic" style={{ background: "var(--t1)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F6B4F" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <span>
            <b>{t("connect.lookStrong")}</b>
            {t("connect.lookRest")}
          </span>
        </div>
        <div>
          <span className="ic" style={{ background: "var(--t2)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7A5C00" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <rect x="6" y="2" width="12" height="20" rx="3" />
              <path d="M11 18h2" />
            </svg>
          </span>
          <span>
            <b>{t("connect.approveStrong")}</b>
            {t("connect.approveRest")}
          </span>
        </div>
        <div>
          <span className="ic" style={{ background: "var(--t4)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A3442C" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </span>
          <span>
            <b>{t("connect.disconnectStrong")}</b>
            {t("connect.disconnectRest")}
          </span>
        </div>
      </div>

      <input
        className="search"
        type="search"
        placeholder={t("connect.search")}
        aria-label={t("connect.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {failed && (
        <div className="notice">
          <span>{t("connect.error")}</span>
          <button className="pill" onClick={load}>
            {t("connect.retry")}
          </button>
        </div>
      )}
      {!banks && !failed && <p className="fine">{t("common.loading")}</p>}
      {banks && shown.length === 0 && <p className="fine">{t("connect.empty")}</p>}

      <div className="banks">
        {shown.map((b, i) => (
          <button key={b.id} className="bank" onClick={() => pick(b)} disabled={busy !== null} aria-busy={busy === b.id}>
            <i style={{ background: `var(${TINTS[i % TINTS.length]})` }}>{initials(b.name)}</i>
            {b.name}
            {b.simulated && <small>{t("connect.simulated")}</small>}
          </button>
        ))}
      </div>

      <p className="partner">{t("connect.partner")}</p>
      <button className="ghost" onClick={onSkip}>
        {t("connect.skip")}
      </button>
    </main>
  );
}

// Stands in for the bank's own approval screen when the simulated bank is used.
// Deliberately styled as "not FiCo", like the prototype.
export function SimulatedApprove({ t, bankName, token }: { t: T; bankName: string; token: string }) {
  const back = (params: string) => window.location.assign(`/api/bank/callback?${params}`);
  return (
    <>
      <span className="tag">{t("approve.tag", { bank: bankName })}</span>
      <div className="bankapp">
        <div className="bankbar">
          <i>{initials(bankName)}</i>
          {bankName}
        </div>
        <div className="bd">
          <p className="meta">{t("approve.simulated")}</p>
          <h2>{t("approve.title")}</h2>
          <ul>
            <li>{t("approve.item1")}</li>
            <li>{t("approve.item2")}</li>
            <li>{t("approve.item3")}</li>
          </ul>
          <div className="acc">
            <span>
              {t("approve.account")}
              <br />
              <span className="meta">DE00 •••• 0000</span>
            </span>
            <span aria-hidden="true">✓</span>
          </div>
          <p className="meta">{t("approve.meta")}</p>
        </div>
        <button className="go" onClick={() => back(`one-time-token=${encodeURIComponent(token)}`)}>
          {t("approve.approve")}
        </button>
        <button className="no" onClick={() => back("error=access_denied")}>
          {t("approve.cancel")}
        </button>
      </div>
    </>
  );
}

// Shown right after the bank sends the customer back, while FiCo reads the accounts.
export function Reading({ t, onDone, onFail }: { t: T; onDone: (s: Connected) => void; onFail: (r: FailureReason) => void }) {
  const [status, setStatus] = useState<Connected | null>(null);

  useEffect(() => {
    let live = true;
    api.refresh().then(
      (s) => live && (s.connected ? setStatus(s) : onFail("provider_error")),
      (err: { code?: string }) => {
        const code = err.code as FailureReason | undefined;
        if (live) onFail(code === "expired" || code === "no_accounts" ? code : "provider_error");
      },
    );
    return () => {
      live = false;
    };
  }, [onFail]);

  const steps = status
    ? [
        t("reading.bank", { bank: status.institution.name }),
        t("reading.accounts", { n: String(status.accounts.length) }),
        t("reading.transactions", { n: String(status.transactionsCount) }),
        t("reading.saved"),
      ]
    : [];

  return (
    <main className="view">
      <h1>{t("reading.title")}</h1>
      <div className="reading" aria-live="polite">
        {status ? (
          steps.map((s, i) => (
            <div key={s} style={{ animationDelay: `${i * 0.35}s` }}>
              <span className="ck">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2F6B4F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              </span>
              {s}
            </div>
          ))
        ) : (
          <p className="lead">{t("common.loading")}</p>
        )}
      </div>
      <div className="actions">
        <button className="cta" disabled={!status} onClick={() => status && onDone(status)}>
          {t("reading.cta")}
        </button>
      </div>
    </main>
  );
}

export function Failed({ t, reason, onRetry, onLater }: { t: T; reason: FailureReason; onRetry: () => void; onLater: () => void }) {
  return (
    <main className="view">
      <h1>{t(`failed.${reason}.title` as const)}</h1>
      <p className="lead">{t(`failed.${reason}.lead` as const)}</p>
      <div className="actions">
        <button className="cta" onClick={onRetry}>
          {t("failed.retry")}
        </button>
        <button className="ghost" onClick={onLater}>
          {t("failed.later")}
        </button>
      </div>
    </main>
  );
}

export function BankView({
  t,
  lang,
  status,
  renewed,
  onChange,
  onDisconnect,
}: {
  t: T;
  lang: Lang;
  status: Connected;
  renewed: boolean;
  onChange: (s: Connected) => void;
  onDisconnect: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const bank = status.institution.name;

  useEffect(() => {
    hideFromReplay(true);
    return () => hideFromReplay(false);
  }, []);

  useEffect(() => {
    if (status.state !== "active") track("consent_renewal_shown", { days_left: status.daysLeft });
  }, [status.state, status.daysLeft]);

  const refresh = async () => {
    setUpdating(true);
    setError(false);
    try {
      const next = await api.refresh();
      if (next.connected) onChange(next);
    } catch {
      setError(true);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    const stale = !status.refreshedAt || Date.now() - new Date(status.refreshedAt).getTime() > STALE_MS;
    if (stale && status.state !== "expired") void refresh();
    // Only when the screen opens.
  }, []);

  const renew = async () => {
    setRenewing(true);
    try {
      await startConnect(status.institution.id, true);
    } catch {
      setRenewing(false);
      setError(true);
    }
  };

  return (
    // ph-no-capture keeps balances and transactions out of replays even if recording runs.
    <main className="view ph-no-capture">
      {status.state !== "active" && (
        <div className="tile" style={{ background: "var(--t2)" }}>
          <div className="k">{status.state === "expired" ? t("bank.expiredTitle", { bank }) : t("bank.renewTitle", { bank, date: day(lang, status.expiresAt) })}</div>
          <div className="sm">{status.state === "expired" ? t("bank.expiredLead") : t("bank.renewLead")}</div>
          <button className="more" onClick={renew} disabled={renewing}>
            {t("bank.renew")}
          </button>
        </div>
      )}
      {renewed && status.state === "active" && <div className="notice">{t("bank.renewed", { date: day(lang, status.expiresAt) })}</div>}

      <h1>{t("bank.title", { bank })}</h1>

      <div className="tiles">
        {status.accounts.map((a, i) => (
          <div key={a.id} className="tile" style={{ background: `var(${TINTS[i % TINTS.length]})` }}>
            <div className="k">
              {a.name}
              {a.ibanLast4 && ` •• ${a.ibanLast4}`}
            </div>
            <div className="big">{a.balance === null ? t("bank.noBalance") : money(lang, a.balance, a.currency)}</div>
          </div>
        ))}
      </div>

      <p className="lead">
        {t("bank.transactions", { n: String(status.transactionsCount) })}
        <br />
        <span className="fine-left">
          {updating ? t("bank.updating") : status.refreshedAt ? t("bank.updated", { time: time(lang, status.refreshedAt) }) : ""}
        </span>
      </p>
      {error && <div className="notice">{t("bank.refreshError")}</div>}

      {status.latest.length > 0 && (
        <section className="card">
          <h2 className="k">{t("bank.latest")}</h2>
          <div className="rows">
            {status.latest.map((tx) => (
              <div className="r" key={tx.id}>
                <span>{tx.description}</span>
                <span className={tx.amount > 0 ? "in" : undefined}>{money(lang, tx.amount, tx.currency)}</span>
                <small>
                  {shortDay(lang, tx.date)}
                  {tx.pending && ` · ${t("bank.pending")}`}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="fine">{t("bank.next")}</p>

      <div className="actions">
        <button className="cta" onClick={refresh} disabled={updating || status.state === "expired"}>
          {t("bank.refresh")}
        </button>
        <button className="ghost" onClick={onDisconnect}>
          {t("bank.disconnect")}
        </button>
        <p className="fine">{t("bank.until", { date: day(lang, status.expiresAt) })}</p>
      </div>
    </main>
  );
}

export function Disconnect({ t, bank, onDone, onCancel }: { t: T; bank: string; onDone: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await api.disconnect();
      onDone();
    } catch {
      setBusy(false);
    }
  };
  return (
    <main className="view">
      <h1>{t("disconnect.title", { bank })}</h1>
      <p className="lead">{t("disconnect.lead")}</p>
      <div className="actions">
        <button className="cta danger" onClick={confirm} disabled={busy}>
          {t("disconnect.confirm")}
        </button>
        <button className="ghost" onClick={onCancel}>
          {t("disconnect.cancel")}
        </button>
      </div>
    </main>
  );
}
