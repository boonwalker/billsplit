/**
 * English and Spanish texts, keyed by the German original. One module per area of the app
 * (each exports `{ en, es }`), merged here.
 */
import bill from "./bill";
import core from "./core";
import editor from "./editor";
import pay from "./pay";
import start from "./start";

type Dict = Record<string, string>;
type Part = { en: Dict; es: Dict };

const PARTS: Part[] = [core, start, bill, pay, editor];

export const DICTIONARIES: { en: Dict; es: Dict } = {
  en: Object.assign({}, ...PARTS.map((p) => p.en)),
  es: Object.assign({}, ...PARTS.map((p) => p.es)),
};
