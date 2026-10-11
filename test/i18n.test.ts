import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { msg, pickLang, translate, translateMsg } from "../src/i18n";
import { DICTIONARIES } from "../src/i18n/dict";

/** Every source file of the app and the server (not the dictionaries themselves). */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return file.includes(path.join("i18n", "dict")) ? [] : sources(file);
    return /\.(ts|tsx)$/.test(name) ? [file] : [];
  });
}

const root = path.resolve(__dirname, "..");
const files = [...sources(path.join(root, "src")), ...sources(path.join(root, "server"))];
/** German texts handed to t(), msg() or an error class – the keys every dictionary needs. */
const CALL = /(?:\bt|\bmsg|new (?:BillError|HttpError|ReceiptParseError|ApiError))\(\s*"((?:[^"\\]|\\.)*)"/g;

const keys = new Map<string, string>();
for (const file of files) {
  const code = readFileSync(file, "utf8");
  for (const m of code.matchAll(CALL)) keys.set(JSON.parse(`"${m[1]}"`), path.relative(root, file));
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (text: string) => [...text.matchAll(/<\/?(\w+)\s*\/?>/g)].map((m) => m[0].replace(/\s/g, "")).sort();

describe("translations", () => {
  it("finds the texts in the code", () => {
    expect(keys.size).toBeGreaterThan(20);
  });

  for (const lang of ["en", "es"] as const) {
    it(`has every text in ${lang}, with the same placeholders and markup`, () => {
      const dict = DICTIONARIES[lang];
      const missing = [...keys].filter(([key]) => !(key in dict)).map(([key, file]) => `${file}: ${key}`);
      expect(missing).toEqual([]);
      const mismatched = [...keys.keys()]
        .filter((key) => key in dict)
        .filter((key) => placeholders(key).join() !== placeholders(dict[key]).join() || tags(key).join() !== tags(dict[key]).join());
      expect(mismatched).toEqual([]);
    });
  }

  it("never builds a text to translate from pieces", () => {
    const pieced = files.filter((file) => /(?:\bt|\bmsg)\(\s*`/.test(readFileSync(file, "utf8")));
    expect(pieced).toEqual([]);
  });

  it("picks the language from the browser and fills in names and amounts", () => {
    expect(pickLang(["es-MX", "en"])).toBe("es");
    expect(pickLang(["fr-FR", "en-US"])).toBe("en");
    expect(pickLang(["fr-FR"])).toBe("en");
    expect(pickLang("de-DE,de;q=0.9,en;q=0.8", "de")).toBe("de");
    expect(pickLang(undefined, "de")).toBe("de");
    expect(translate("de", "{name} hat bezahlt", { name: "Anna" })).toBe("Anna hat bezahlt");
    expect(translate("de", "{a} offen", { a: { cents: 950, currency: "EUR" } }).replace(/\s/g, " ")).toBe("9,50 € offen");
    expect(translate("en", "{a} offen", { a: { cents: 950, currency: "EUR" } }, "en-GB")).toMatch(/€9\.50/);
    // Nested texts are translated too, unknown ones stay German.
    expect(translateMsg("de", msg("Ungültige Anfrage ({where}).", { where: msg("Position {n}", { n: 3 }) }))).toBe("Ungültige Anfrage (Position 3).");
  });
});
