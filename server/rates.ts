import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Exchange rates for the balances in the home currency: the euro foreign exchange reference
 * rates of the European Central Bank, published every working day around 16:00 CET. Fetched at
 * most every few hours and kept next to the bills, so a restart or an unreachable ECB does not
 * leave the dashboard without rates.
 */
export const ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const REFRESH_MS = 4 * 60 * 60 * 1000;

export interface Rates {
  /** Day the ECB published the rates for (YYYY-MM-DD). */
  date: string;
  source: "ECB";
  /** Units of a currency per euro (EUR itself is 1). */
  rates: Record<string, number>;
}

/** Reads the ECB's daily XML: <Cube time='2026-10-15'> with <Cube currency='USD' rate='1.0861'/> lines. */
export function parseEcbXml(xml: string): Rates | null {
  const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  const rates: Record<string, number> = { EUR: 1 };
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) {
    const rate = Number(m[2]);
    if (rate > 0) rates[m[1]] = rate;
  }
  return date && Object.keys(rates).length > 1 ? { date, source: "ECB", rates } : null;
}

export class RateService {
  private current: Rates | null = null;
  private fetchedAt = 0;
  private pending: Promise<Rates | null> | null = null;

  /** dir: where the last rates are kept (null: memory only, for tests). */
  constructor(
    private readonly dir: string | null,
    private readonly fetchXml: () => Promise<string> = async () => {
      // ECB_RATES_URL: another source (the click tests point it nowhere and use stored rates).
      const res = await fetch(process.env.ECB_RATES_URL || ECB_DAILY_URL, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`EZB ${res.status}`);
      return res.text();
    },
    private readonly now: () => number = Date.now,
  ) {}

  async load(): Promise<void> {
    if (!this.dir) return;
    try {
      this.current = JSON.parse(await readFile(path.join(this.dir, "rates.json"), "utf8")) as Rates;
    } catch {
      // No rates yet: the first request fetches them.
    }
  }

  /** Today's rates (fetched when the last ones are a few hours old); the last known ones if the ECB is unreachable. */
  async get(): Promise<Rates | null> {
    if (this.current && this.now() - this.fetchedAt < REFRESH_MS) return this.current;
    this.pending ??= this.refresh().finally(() => (this.pending = null));
    return this.pending;
  }

  private async refresh(): Promise<Rates | null> {
    try {
      const rates = parseEcbXml(await this.fetchXml());
      if (rates) {
        this.current = rates;
        this.fetchedAt = this.now();
        if (this.dir) await writeFile(path.join(this.dir, "rates.json"), JSON.stringify(rates)).catch(() => undefined);
      }
    } catch (error) {
      console.warn("Wechselkurse der EZB nicht erreichbar", error instanceof Error ? error.message : error);
      // Try again in a while, not on every request.
      this.fetchedAt = this.now() - REFRESH_MS + 15 * 60 * 1000;
    }
    return this.current;
  }
}
