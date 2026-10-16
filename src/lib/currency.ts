import { DEMO } from "./demo";
import { locale } from "./i18n";

/**
 * The home currency: balances in several currencies are converted into it and added up, with
 * the ECB's reference rates of the day (server/rates.ts). Chosen in the profile; by default the
 * currency of the device's region (euro when unknown).
 */
const KEY = "billsplit.currency";

/** The currencies the ECB publishes rates for (the euro included). */
export const CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "JPY", "AUD", "BGN", "BRL", "CAD", "CNY", "CZK", "DKK", "HKD", "HUF", "IDR", "ILS",
  "INR", "ISK", "KRW", "MXN", "MYR", "NOK", "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY", "ZAR",
];

const REGION_CURRENCY: Record<string, string> = {
  US: "USD", GB: "GBP", CH: "CHF", LI: "CHF", JP: "JPY", AU: "AUD", BG: "BGN", BR: "BRL", CA: "CAD", CN: "CNY",
  CZ: "CZK", DK: "DKK", HK: "HKD", HU: "HUF", ID: "IDR", IL: "ILS", IN: "INR", IS: "ISK", KR: "KRW", MX: "MXN",
  MY: "MYR", NO: "NOK", NZ: "NZD", PH: "PHP", PL: "PLN", RO: "RON", SE: "SEK", SG: "SGD", TH: "THB", TR: "TRY", ZA: "ZAR",
};

/** The currency of the device's region (e.g. en-US → USD), else the euro. */
export function deviceCurrency(): string {
  const region = locale.split("-")[1]?.toUpperCase();
  return (region && REGION_CURRENCY[region]) || "EUR";
}

/** What the profile says: a currency, or null for the device's. */
export function chosenCurrency(): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return typeof value === "string" && CURRENCIES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export const homeCurrency = (): string => chosenCurrency() ?? deviceCurrency();

export function setHomeCurrency(currency: string | null): void {
  try {
    if (currency) localStorage.setItem(KEY, JSON.stringify(currency));
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the device's currency stays.
  }
}

export interface Rates {
  /** Day of the ECB's reference rates (YYYY-MM-DD). */
  date: string;
  source: string;
  /** Units per euro. */
  rates: Record<string, number>;
}

/** An amount in cents of `from` in cents of `to`; null without a rate for one of them. */
export function convert(cents: number, from: string, to: string, rates: Rates): number | null {
  if (from === to) return cents;
  const a = rates.rates[from];
  const b = rates.rates[to];
  return a && b ? Math.round((cents / a) * b) : null;
}

let loaded: Promise<Rates | null> | null = null;
/** The rates of the day from the server (once per app start); null in the demo or without them. */
export function loadRates(): Promise<Rates | null> {
  if (DEMO) return Promise.resolve(null);
  loaded ??= fetch("/api/rates")
    .then((res) => (res.ok ? (res.json() as Promise<{ rates: Rates | null }>) : { rates: null }))
    .then((body) => body.rates)
    .catch(() => null);
  return loaded;
}
