import { createElement, Fragment, type ReactNode } from "react";
import { isLang, localeOf, pickLang, translate, type Lang, type Msg, type Vars } from "../i18n";
import { setMoneyLocale } from "./money";

/**
 * The app's language: chosen in the profile ("Sprache"), else the browser's (navigator.languages:
 * German, English or Spanish), else English. Changing it reloads the app.
 */
const LANG_KEY = "billsplit.lang";

function stored(): Lang | null {
  try {
    const value = JSON.parse(localStorage.getItem(LANG_KEY) ?? "null");
    return isLang(value) ? value : null;
  } catch {
    return null;
  }
}

const browserLangs = (): readonly string[] =>
  typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language ?? ""];

/** What the profile says: a language, or null for "like the device". */
export const chosenLang = (): Lang | null => (typeof localStorage === "undefined" ? null : stored());

export const lang: Lang = chosenLang() ?? pickLang(browserLangs());

/** Number and date format: the device's own when it speaks this language (en-US, es-MX, …). */
export const locale: string = browserLangs().find((tag) => tag.toLowerCase().startsWith(lang)) ?? localeOf(lang);

setMoneyLocale(locale);
if (typeof document !== "undefined") document.documentElement.lang = lang;

/** Translates a German text (a literal – test/i18n.test.ts checks every one has its translations). */
export const t = (text: string, vars?: Vars): string => translate(lang, text, vars, locale);
export const tMsg = (m: Msg): string => t(m.text, m.vars);

/** Language from the profile; null follows the device again. */
export function setLang(next: Lang | null): void {
  try {
    if (next) localStorage.setItem(LANG_KEY, JSON.stringify(next));
    else localStorage.removeItem(LANG_KEY);
  } catch {
    // Without storage the device's language stays.
  }
  window.location.reload();
}

export const formatDate = (date: Date | string, options: Intl.DateTimeFormatOptions = {}): string =>
  new Date(date).toLocaleDateString(locale, options);
export const formatTime = (date: Date | string, options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }): string =>
  new Date(date).toLocaleTimeString(locale, options);

const TAGS = new Set(["b", "strong", "i", "em", "small", "br"]);

/**
 * A translated text with simple markup – <b>, <strong>, <i>, <em>, <small>, <br> – as React
 * nodes, so a sentence with a bold word stays one text to translate.
 */
export function rich(text: string): ReactNode {
  const out: ReactNode[] = [];
  const pattern = /<(\/?)(\w+)\s*\/?>/g;
  const stack: { tag: string; children: ReactNode[] }[] = [{ tag: "", children: out }];
  let last = 0;
  let key = 0;
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    const [whole, closing, tag] = m;
    if (!TAGS.has(tag)) continue;
    const top = stack[stack.length - 1];
    if (m.index > last) top.children.push(text.slice(last, m.index));
    last = m.index + whole.length;
    if (tag === "br") top.children.push(createElement("br", { key: key++ }));
    else if (!closing) stack.push({ tag, children: [] });
    else if (stack.length > 1) {
      const done = stack.pop()!;
      stack[stack.length - 1].children.push(createElement(done.tag, { key: key++ }, ...done.children));
    }
  }
  if (last < text.length) stack[stack.length - 1].children.push(text.slice(last));
  while (stack.length > 1) {
    const open = stack.pop()!;
    stack[stack.length - 1].children.push(...open.children);
  }
  return createElement(Fragment, null, ...out);
}
