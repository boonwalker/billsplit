import type { PreparedImage } from "./image";
import { parseReceiptText, type ParsedReceipt } from "./receipt";

export type ProgressFn = (message: string, progress?: number) => void;

class AiUnavailableError extends Error {}

async function recognizeWithAi(image: PreparedImage, onProgress: ProgressFn): Promise<ParsedReceipt> {
  onProgress("KI liest den Beleg …");
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
  // 404: static hosting without API, 503: API key not configured.
  if (res.status === 404 || res.status === 503 || res.status === 405) {
    throw new AiUnavailableError(`HTTP ${res.status}`);
  }
  const body = (await res.json().catch(() => null)) as (ParsedReceipt & { error?: string }) | null;
  if (!res.ok || !body) {
    throw new Error(body?.error ?? `Belegerkennung fehlgeschlagen (HTTP ${res.status}).`);
  }
  return body;
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

/**
 * Reads a receipt photo. Uses the AI recognition on the server when it is
 * configured and falls back to on-device OCR otherwise.
 */
export async function recognizeReceipt(image: PreparedImage, onProgress: ProgressFn): Promise<ParsedReceipt> {
  try {
    return await recognizeWithAi(image, onProgress);
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) throw error;
  }
  return recognizeWithOcr(image, onProgress);
}
