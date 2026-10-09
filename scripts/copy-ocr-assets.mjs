// Copies the Tesseract.js worker, WebAssembly core and language data into
// public/ocr so the on-device OCR fallback works without a third-party CDN.
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = (...p) => path.join(root, "node_modules", ...p);
const out = (...p) => path.join(root, "public", "ocr", ...p);

const files = [
  [nm("tesseract.js", "dist", "worker.min.js"), out("worker.min.js")],
  // Only the LSTM builds are needed (default OCR engine mode); the worker picks one by CPU features.
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map((f) => [
    nm("tesseract.js-core", f),
    out("core", f),
  ]),
  ...["deu", "eng"].map((lang) => [
    nm("@tesseract.js-data", lang, "4.0.0_best_int", `${lang}.traineddata.gz`),
    out("lang", `${lang}.traineddata.gz`),
  ]),
];

await mkdir(out("core"), { recursive: true });
await mkdir(out("lang"), { recursive: true });
await Promise.all(files.map(([from, to]) => copyFile(from, to)));
console.log(`OCR-Dateien nach public/ocr kopiert (${files.length} Dateien).`);
