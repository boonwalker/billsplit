import { getSample, type SampleError, type SampleFn } from "./claudeRuntime";
import { DEMO } from "./demo";
import type { PreparedImage } from "./image";
import { parseReceiptText, readWithSumCheck, RECEIPT_INSTRUCTIONS, type ParsedReceipt } from "./receipt";

export type ProgressFn = (message: string, progress?: number) => void;

class AiUnavailableError extends Error {}

async function recognizeWithAi(image: PreparedImage, onProgress: ProgressFn): Promise<ParsedReceipt> {
  onProgress("billsplit analysiert den Beleg …");
  let res: Response;
  try {
    res = await fetch("/api/parse-receipt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: image.base64, mediaType: image.mediaType }),
    });
  } catch {
    throw new AiUnavailableError("Server nicht erreichbar");
  }
  // 404: static hosting without API, 503: API key not configured, 429: limit reached.
  // In all these cases the photo is read on the device instead.
  if (res.status === 404 || res.status === 503 || res.status === 405 || res.status === 429) {
    throw new AiUnavailableError(`HTTP ${res.status}`);
  }
  const body = (await res.json().catch(() => null)) as (ParsedReceipt & { error?: string }) | null;
  if (!res.ok || !body) {
    throw new Error(body?.error ?? `Belegerkennung fehlgeschlagen (HTTP ${res.status}).`);
  }
  // A missing field means "no tip found" – never "tip taken from the receipt".
  return {
    ...body,
    tip: typeof body.tip === "number" && body.tip > 0 ? body.tip : null,
    total: body.total ?? null,
    fees: Array.isArray(body.fees) ? body.fees : [],
    delivery: body.delivery === true,
    supermarket: body.supermarket === true,
  };
}

async function recognizeWithOcr(image: PreparedImage, onProgress: ProgressFn): Promise<ParsedReceipt> {
  onProgress("Texterkennung wird geladen …", 0);
  const { createWorker, PSM } = await import("tesseract.js");
  // Assets are self-hosted (see scripts/copy-ocr-assets.mjs) instead of loaded from a CDN.
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;
  const worker = await createWorker(["deu", "eng"], undefined, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    logger: (m) => {
      if (m.status === "recognizing text") onProgress("Text wird erkannt …", m.progress);
      else if (m.status.startsWith("loading")) onProgress("Texterkennung wird geladen …", m.progress);
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(image.canvas);
    return parseReceiptText(data.text);
  } finally {
    await worker.terminate();
  }
}

interface SampleReceipt {
  merchant?: unknown;
  date?: unknown;
  currency?: unknown;
  items?: { name?: unknown; quantity?: unknown; line_total?: unknown }[];
  receipt_total?: unknown;
  tip?: unknown;
  fees?: { name?: unknown; amount?: unknown }[];
  delivery?: unknown;
  supermarket?: unknown;
}

const SAMPLE_ERRORS: Record<string, string> = {
  not_granted: "Du hast der Seite nicht erlaubt, Claude zu fragen. Trag die Positionen unten selbst ein.",
  sampling_disabled: "Claude ist für dein Konto hier nicht verfügbar. Trag die Positionen unten selbst ein.",
  images_unavailable: "In dieser Ansicht können keine Fotos an Claude gesendet werden. Trag die Positionen unten selbst ein.",
  image_rejected: "Dieses Foto konnte nicht gelesen werden. Versuch ein anderes Bild (JPG oder PNG).",
  rate_limited: "Gerade zu viele Anfragen. Versuch es in ein paar Minuten noch einmal.",
  refused: "Claude konnte dieses Bild nicht auswerten. Trag die Positionen unten selbst ein.",
  invalid_json: "Die Antwort war unvollständig. Versuch es noch einmal.",
};

/** Demo build: asks Claude through the claude.ai artifact runtime, on the viewer's own account. */
async function recognizeWithSample(image: PreparedImage, onProgress: ProgressFn): Promise<ParsedReceipt> {
  const sample = await getSample();
  if (!sample) throw new Error("Die KI-Erkennung ist nur in der claude.ai-Ansicht verfügbar. Trag die Positionen unten selbst ein.");
  onProgress("billsplit analysiert den Beleg …");
  return readWithSumCheck((hint) => {
    if (hint) onProgress("billsplit rechnet nach …");
    return sampleOnce(sample, image, hint);
  });
}

async function sampleOnce(sample: SampleFn, image: PreparedImage, hint?: string): Promise<ParsedReceipt> {
  let out: SampleReceipt;
  try {
    out = await sample.json<SampleReceipt>(
      `${RECEIPT_INSTRUCTIONS}
${hint ? `\n${hint}\n` : ""}
Reply with only one JSON object of this shape:
{"merchant": string, "date": "YYYY-MM-DD" or "", "currency": "EUR", "items": [{"name": string, "quantity": integer, "line_total": number}], "receipt_total": number (0 if not readable), "tip": number (0 if none), "fees": [{"name": string, "amount": number}], "delivery": boolean, "supermarket": boolean}`,
      { images: [image.blob], modelTier: "default" },
    );
  } catch (e) {
    const code = (e as SampleError)?.code;
    throw new Error(SAMPLE_ERRORS[code] ?? "Die Erkennung hat nicht geklappt. Versuch es noch einmal oder trag die Positionen selbst ein.");
  }
  const cents = (v: unknown) => Math.round(Number(v) * 100);
  const items = (Array.isArray(out.items) ? out.items : [])
    .filter((it) => typeof it?.name === "string" && it.name.trim() && Number.isFinite(Number(it.line_total)))
    .map((it) => ({ name: String(it.name).trim(), qty: Math.max(1, Math.floor(Number(it.quantity)) || 1), total: cents(it.line_total) }));
  const total = Number(out.receipt_total);
  const tip = Number(out.tip);
  return {
    merchant: typeof out.merchant === "string" ? out.merchant.trim() : "",
    date: typeof out.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : "",
    currency: typeof out.currency === "string" && /^[A-Z]{3}$/.test(out.currency) ? out.currency : "EUR",
    items,
    total: Number.isFinite(total) && total > 0 ? cents(total) : null,
    tip: Number.isFinite(tip) && tip > 0 ? cents(tip) : null,
    fees: (Array.isArray(out.fees) ? out.fees : [])
      .filter((f) => typeof f?.name === "string" && f.name.trim() && Number.isFinite(Number(f.amount)) && Number(f.amount) !== 0)
      .map((f) => ({ name: String(f.name).trim(), amount: cents(f.amount) })),
    delivery: out.delivery === true,
    supermarket: out.supermarket === true,
    engine: "ai",
  };
}

/**
 * Reads a receipt photo. Uses the AI recognition on the server when it is
 * configured and falls back to on-device OCR otherwise.
 */
export async function recognizeReceipt(image: PreparedImage, onProgress: ProgressFn): Promise<ParsedReceipt> {
  if (DEMO) return recognizeWithSample(image, onProgress);
  try {
    return await recognizeWithAi(image, onProgress);
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) throw error;
  }
  return recognizeWithOcr(image, onProgress);
}
