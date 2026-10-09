import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAiConfigured, isSupportedMediaType, parseReceiptImage, ReceiptParseError } from "./parseReceipt.ts";

try {
  process.loadEnvFile();
} catch {
  // No .env file – configuration comes from the environment.
}

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
/** Base64 of a downscaled receipt photo is well below this; it guards against abuse. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new ReceiptParseError("Das Bild ist zu groß.", 413);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function handleParseReceipt(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAiConfigured()) {
    sendJson(res, 503, { error: "KI-Belegerkennung ist auf dem Server nicht eingerichtet." });
    return;
  }
  try {
    const body = JSON.parse(await readBody(req)) as { image?: unknown; mediaType?: unknown };
    if (typeof body.image !== "string" || typeof body.mediaType !== "string" || !isSupportedMediaType(body.mediaType)) {
      sendJson(res, 400, { error: "Ungültige Anfrage: Bild fehlt oder Format wird nicht unterstützt." });
      return;
    }
    const receipt = await parseReceiptImage(body.image, body.mediaType);
    sendJson(res, 200, receipt);
  } catch (error) {
    if (error instanceof ReceiptParseError) {
      sendJson(res, error.status, { error: error.message });
    } else if (error instanceof SyntaxError) {
      sendJson(res, 400, { error: "Ungültige Anfrage." });
    } else {
      console.error("parse-receipt failed", error);
      sendJson(res, 500, { error: "Interner Fehler bei der Belegerkennung." });
    }
  }
}

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  let filePath = path.join(DIST_DIR, urlPath);
  if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    // Unknown paths fall back to the single-page app.
    filePath = path.join(DIST_DIR, "index.html");
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    const cacheControl = urlPath.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : urlPath.startsWith("/ocr/")
        ? "public, max-age=604800"
        : "no-cache";
    res.writeHead(200, {
      "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
      "cache-control": cacheControl,
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found – wurde `npm run build` ausgeführt?");
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, ai: isAiConfigured() });
  } else if (url.pathname === "/api/parse-receipt" && req.method === "POST") {
    void handleParseReceipt(req, res);
  } else if (url.pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "Not found" });
  } else if (req.method === "GET" || req.method === "HEAD") {
    void serveStatic(req, res);
  } else {
    res.writeHead(405).end();
  }
});

server.listen(PORT, () => {
  console.log(`billsplit läuft auf http://localhost:${PORT} (KI-Belegerkennung: ${isAiConfigured() ? "aktiv" : "aus"})`);
});
