import { DICTIONARIES } from "./dict";

/**
 * Languages of the app. German is the source: every text is written in German in the code
 * (`t("Rechnung erstellen")`) and looked up in the English and Spanish dictionaries
 * (src/i18n/dict). A missing entry falls back to German; test/i18n.test.ts makes sure there
 * is none. Shared by the app and the server (errors, notifications, mails).
 */
export type Lang = "de" | "en" | "es";
export const LANGS: readonly Lang[] = ["de", "en", "es"];
export const LANG_NAMES: Record<Lang, string> = { de: "Deutsch", en: "English", es: "Español" };

/** An amount in a variable, formatted for the reader's language. */
export interface MoneyVar {
  cents: number;
  currency: string;
}
/** A text to translate later (server errors and notifications go to readers of any language). */
export interface Msg {
  text: string;
  vars?: Vars;
}
/** Values for {placeholders}: plain, an amount, or a text that is translated as well. */
export type Vars = { [key: string]: string | number | MoneyVar | Msg };
export const msg = (text: string, vars?: Vars): Msg => ({ text, vars });

/** Number and date formats per language when the device names none. */
const LOCALES: Record<Lang, string> = { de: "de-DE", en: "en-GB", es: "es-ES" };
export const localeOf = (lang: Lang): string => LOCALES[lang];

/** The first supported language in a list like navigator.languages or an Accept-Language header. */
export function pickLang(wanted: readonly string[] | string | null | undefined, fallback: Lang = "en"): Lang {
  const list = typeof wanted === "string" ? wanted.split(",").map((part) => part.split(";")[0]) : (wanted ?? []);
  for (const tag of list) {
    const base = tag.trim().toLowerCase().slice(0, 2);
    if ((LANGS as readonly string[]).includes(base)) return base as Lang;
  }
  return fallback;
}

export const isLang = (value: unknown): value is Lang => typeof value === "string" && (LANGS as readonly string[]).includes(value);

export function formatMoneyIn(locale: string, cents: number, currency: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Fills {name} placeholders (in German for nested texts); amounts are formatted in `locale`. */
export function fill(text: string, vars: Vars | undefined, locale: string, lang: Lang = "de"): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = vars[key];
    if (value === undefined) return whole;
    if (typeof value !== "object") return String(value);
    return "text" in value ? translate(lang, value.text, value.vars, locale) : formatMoneyIn(locale, value.cents, value.currency);
  });
}

/**
 * The text in `lang` (German when the dictionary has no entry), placeholders filled. A German
 * word with two meanings gets a context after "@@" ("Übernehmen@@Teiler"), which only the
 * dictionaries see.
 */
export function translate(lang: Lang, text: string, vars?: Vars, locale: string = localeOf(lang)): string {
  const translated = lang === "de" ? undefined : DICTIONARIES[lang][text];
  return fill(translated ?? text.split("@@")[0], vars, locale, lang);
}

export const translateMsg = (lang: Lang, m: Msg, locale?: string): string => translate(lang, m.text, m.vars, locale);
