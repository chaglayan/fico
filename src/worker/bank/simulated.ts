import type { Account, Institution, Transaction } from "../../shared/bank";
import { ProviderError, type BankProvider, type Consent, type ConsentRequest } from "./provider";

// A pretend bank for building and demos. The approval screen is a page in the
// app (/bank/simulated) instead of a real bank, and the data is generated:
// a salary, rent, groceries and a handful of subscriptions, the same every
// time for the same consent so refreshes line up.

const BANKS: Institution[] = [
  { id: "musterbank", name: "Musterbank", simulated: true },
  { id: "testbank", name: "Testbank Berlin", simulated: true },
  { id: "direktbank", name: "Demo Direktbank", simulated: true },
];

export class SimulatedBank implements BankProvider {
  readonly id = "simulated";

  async institutions(): Promise<Institution[]> {
    return BANKS;
  }

  async startConsent(req: ConsentRequest): Promise<{ url: string }> {
    if (!BANKS.some((b) => b.id === req.institutionId)) throw new ProviderError("Unknown simulated bank", 404);
    const url = new URL("/bank/simulated", req.callbackUrl);
    url.searchParams.set("bank", req.institutionId);
    url.searchParams.set("token", ["sim1", req.institutionId, req.userId, randomId()].join("."));
    return { url: url.toString() };
  }

  async completeConsent(oneTimeToken: string): Promise<Consent> {
    const [version, institutionId, userId, nonce] = oneTimeToken.split(".");
    if (version !== "sim1" || !institutionId || !userId || !nonce) throw new ProviderError("Invalid one-time token", 400);
    return { id: `simc_${nonce}`, token: `simc.${institutionId}.${nonce}`, institutionId, userId, expiresAt: null };
  }

  async accounts(consentToken: string): Promise<Account[]> {
    const seed = hash(consentToken);
    const today = isoDate(new Date());
    const thisMonth = generate(seed, `${today.slice(0, 8)}01`, today).filter((t) => t.accountId === GIRO);
    const balance = round(1450 + (seed % 900) + thisMonth.reduce((sum, t) => sum + t.amount, 0));
    return [
      { id: GIRO, name: "Girokonto", ibanLast4: String(1000 + (seed % 9000)), balance, currency: "EUR" },
      { id: SAVINGS, name: "Tagesgeld", ibanLast4: String(1000 + ((seed >>> 8) % 9000)), balance: round(4200 + (seed % 3000)), currency: "EUR" },
    ];
  }

  async transactions(consentToken: string, accountId: string, from: Date): Promise<Transaction[]> {
    return generate(hash(consentToken), isoDate(from), isoDate(new Date())).filter((t) => t.accountId === accountId);
  }

  async revokeConsent(): Promise<void> {}
}

const GIRO = "sim-giro";
const SAVINGS = "sim-savings";

type Fixed = { day: number; amount: number; description: string; month?: number };

// Regular payments on the current account. `month` (1-12) marks a yearly one.
const FIXED: Fixed[] = [
  { day: 1, amount: -950, description: "Hausverwaltung Schulz Miete" },
  { day: 2, amount: -29.9, description: "Kraftwerk Fitness Mitgliedsbeitrag" },
  { day: 3, amount: -58, description: "Deutschlandticket Abo" },
  { day: 5, amount: -13.99, description: "Netflix.com" },
  { day: 10, amount: -78, description: "Stadtwerke Strom Abschlag" },
  { day: 12, amount: -10.99, description: "Spotify AB" },
  { day: 15, amount: -39.95, description: "Telekom Deutschland GmbH" },
  { day: 18, amount: -8.99, description: "Disney Plus" },
  { day: 25, amount: 2840, description: "Brightwell GmbH Gehalt" },
  { day: 26, amount: -200, description: "Übertrag auf Tagesgeld" },
  { day: 14, month: 1, amount: -64.2, description: "HUK-Coburg Haftpflicht" },
  { day: 9, month: 6, amount: -89.9, description: "Amazon Prime Jahresmitgliedschaft" },
];

// Everyday spending: chance per day, amount range, merchants.
const EVERYDAY: [number, number, number, string[]][] = [
  [0.42, 12, 95, ["REWE", "EDEKA", "Lidl", "ALDI SÜD", "Kaufland"]],
  [0.1, 5, 35, ["dm-drogerie markt", "Rossmann"]],
  [0.2, 8, 45, ["Lieferando.de", "Restaurant Da Mario", "Bäckerei Kamps", "Café Liebling"]],
  [0.04, 29, 89, ["DB Fernverkehr"]],
  [0.07, 10, 80, ["Amazon EU S.à r.l.", "Zalando SE"]],
  [0.03, 50, 100, ["Geldautomat"]],
];

function generate(seed: number, from: string, to: string): Transaction[] {
  const out: Transaction[] = [];
  const pendingFrom = isoDate(new Date(Date.parse(to) - 2 * 86_400_000));
  for (let d = new Date(`${from}T00:00:00Z`); isoDate(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = isoDate(d);
    const rand = mulberry32(seed ^ hash(date));
    const pending = date > pendingFrom;
    const add = (accountId: string, n: number, amount: number, description: string) =>
      out.push({ id: `sim-${date}-${accountId === GIRO ? "g" : "s"}${n}`, accountId, date, amount: round(amount), currency: "EUR", description, pending });

    let n = 0;
    for (const f of FIXED) {
      if (f.day === d.getUTCDate() && (f.month === undefined || f.month === d.getUTCMonth() + 1)) {
        add(GIRO, n++, f.amount, f.description);
        if (f.description.startsWith("Übertrag")) add(SAVINGS, 0, -f.amount, "Übertrag vom Girokonto");
      }
    }
    for (const [chance, min, max, merchants] of EVERYDAY) {
      if (rand() < chance) {
        const amount = merchants[0] === "Geldautomat" ? (rand() < 0.5 ? 50 : 100) : min + rand() * (max - min);
        add(GIRO, n++, -amount, merchants[Math.floor(rand() * merchants.length)]!);
      }
    }
  }
  return out;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function randomId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

// FNV-1a, enough to turn a string into a seed.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
