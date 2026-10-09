import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { isAiConfigured, isSupportedMediaType, parseReceiptImage, ReceiptParseError } from "./parseReceipt.ts";
import { limitsFromEnv, type Limits, type RateLimiter } from "./rateLimit.ts";
import { BillDataSchema, BillStore, ParticipantNameSchema, participantIdFromKey, StoreError } from "./store.ts";

/** Base64 of a downscaled receipt photo is well below this. */
const MAX_IMAGE_BODY = 12 * 1024 * 1024;
const MAX_JSON_BODY = 256 * 1024;
const HEARTBEAT_MS = 25_000;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSec?: number,
  ) {
    super(message);
  }
}

export interface AppOptions {
  limits?: Limits;
  /** Behind a reverse proxy (Render, Fly, …) the client address is in X-Forwarded-For. */
  trustProxy?: boolean;
}

function clientAddress(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}

/** Throws 429 when the limiter is exhausted for this key. */
function enforce(limiter: RateLimiter, key: string, message: string): void {
  const result = limiter.take(key);
  if (!result.ok) throw new HttpError(message, 429, result.retryAfterSec);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError("Anfrage ist zu groß.", 413);
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError("Ungültige Anfrage.", 400);
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError("Ungültige Anfrage.", 400);
  return result.data;
}

/** Device key from header (fetch) or query (EventSource cannot send headers). */
function viewerId(req: IncomingMessage, url: URL): string | null {
  const key = (req.headers["x-billsplit-key"] as string | undefined) ?? url.searchParams.get("key");
  return key && key.length >= 16 && key.length <= 128 ? participantIdFromKey(key) : null;
}

function requireViewer(req: IncomingMessage, url: URL): string {
  const id = viewerId(req, url);
  if (!id) throw new HttpError("Gerätekennung fehlt.", 401);
  return id;
}

interface Subscriber {
  res: ServerResponse;
  viewer: string | null;
}

export function createApp(store: BillStore, distDir: string, options: AppOptions = {}) {
  const limits = options.limits ?? limitsFromEnv();
  const trustProxy = options.trustProxy ?? false;
  const subscribers = new Map<string, Set<Subscriber>>();

  store.onChange((billId) => {
    const subs = subscribers.get(billId);
    if (!subs) return;
    for (const sub of subs) {
      try {
        sub.res.write(`event: snapshot\ndata: ${JSON.stringify(store.snapshot(billId, sub.viewer))}\n\n`);
      } catch {
        // connection closed; cleaned up by its close handler
      }
    }
  });

  function subscribe(req: IncomingMessage, res: ServerResponse, billId: string, viewer: string | null): void {
    const snapshot = store.snapshot(billId, viewer);
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write(`retry: 2000\nevent: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    const sub: Subscriber = { res, viewer };
    let set = subscribers.get(billId);
    if (!set) subscribers.set(billId, (set = new Set()));
    set.add(sub);
    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
    req.on("close", () => {
      clearInterval(heartbeat);
      set.delete(sub);
      if (set.size === 0) subscribers.delete(billId);
    });
  }

  async function handleParseReceipt(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!isAiConfigured()) {
      sendJson(res, 503, { error: "KI-Belegerkennung ist auf dem Server nicht eingerichtet." });
      return;
    }
    // Every photo costs API usage: limit per client and in total per day.
    enforce(limits.receiptPerClient, clientAddress(req, trustProxy), "Zu viele Belegfotos in kurzer Zeit. Versuch es später noch einmal.");
    enforce(limits.receiptTotal, "all", "Die KI-Belegerkennung hat ihr Tageslimit erreicht. Trag die Positionen bitte selbst ein.");
    const body = (await readJson(req, MAX_IMAGE_BODY)) as { image?: unknown; mediaType?: unknown };
    if (typeof body.image !== "string" || typeof body.mediaType !== "string" || !isSupportedMediaType(body.mediaType)) {
      throw new HttpError("Ungültige Anfrage: Bild fehlt oder Format wird nicht unterstützt.", 400);
    }
    sendJson(res, 200, await parseReceiptImage(body.image, body.mediaType));
  }

  async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const method = req.method ?? "GET";
    const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]

    if (url.pathname === "/api/health" && method === "GET") {
      // Railway sets RAILWAY_GIT_COMMIT_SHA: shows which code version is live.
      const version = (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.RENDER_GIT_COMMIT ?? "dev").slice(0, 7);
      return sendJson(res, 200, { ok: true, ai: isAiConfigured(), version });
    }
    if (url.pathname === "/api/parse-receipt" && method === "POST") {
      return handleParseReceipt(req, res);
    }

    if (parts[1] === "bills" && parts.length === 2 && method === "POST") {
      const viewer = requireViewer(req, url);
      enforce(limits.billsPerClient, clientAddress(req, trustProxy), "Zu viele neue Rechnungen in kurzer Zeit. Versuch es später noch einmal.");
      const body = parse(z.object({ data: BillDataSchema, name: ParticipantNameSchema }), await readJson(req, MAX_JSON_BODY));
      const id = store.createBill(body.data, viewer, body.name);
      return sendJson(res, 201, store.snapshot(id, viewer));
    }

    if (parts[1] === "bills" && parts[2]) {
      const billId = parts[2];
      const action = parts[3] ?? "";
      if (!/^[A-Za-z0-9_-]{6,40}$/.test(billId)) throw new HttpError("Not found", 404);

      if (action === "" && method === "GET") {
        return sendJson(res, 200, store.snapshot(billId, viewerId(req, url)));
      }
      if (action === "events" && method === "GET") {
        return subscribe(req, res, billId, viewerId(req, url));
      }

      const viewer = requireViewer(req, url);
      if (action === "join" && method === "POST") {
        const body = parse(z.object({ name: ParticipantNameSchema }), await readJson(req, MAX_JSON_BODY));
        store.join(billId, viewer, body.name);
        return sendJson(res, 200, store.snapshot(billId, viewer));
      }
      if (action === "claims" && method === "PUT") {
        const body = parse(
          z.object({ claims: z.record(z.string().max(24), z.number().int().min(0).max(999)) }),
          await readJson(req, MAX_JSON_BODY),
        );
        store.setClaims(billId, viewer, body.claims);
        return sendJson(res, 200, store.snapshot(billId, viewer));
      }
      if (action === "pay" && method === "POST") {
        const amount = store.recordPayClick(billId, viewer);
        return sendJson(res, 200, { amount });
      }
      if (action === "received" && method === "POST") {
        const body = parse(z.object({ participantId: z.string().max(32), received: z.boolean() }), await readJson(req, MAX_JSON_BODY));
        store.setReceived(billId, viewer, body.participantId, body.received);
        return sendJson(res, 200, store.snapshot(billId, viewer));
      }
      if (action === "" && method === "PUT") {
        const body = parse(z.object({ data: BillDataSchema }), await readJson(req, MAX_JSON_BODY));
        store.updateData(billId, viewer, body.data);
        return sendJson(res, 200, store.snapshot(billId, viewer));
      }
    }
    throw new HttpError("Not found", 404);
  }

  async function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const urlPath = decodeURIComponent(url.pathname);
    let filePath = path.join(distDir, urlPath);
    if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
    } catch {
      // Unknown paths fall back to the single-page app.
      filePath = path.join(distDir, "index.html");
    }
    try {
      const data = await readFile(filePath);
      const cacheControl = urlPath.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : urlPath.startsWith("/ocr/")
          ? "public, max-age=604800"
          : "no-cache";
      res.writeHead(200, {
        "content-type": MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream",
        "cache-control": cacheControl,
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found – wurde `npm run build` ausgeführt?");
    }
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
      } else if (req.method === "GET" || req.method === "HEAD") {
        await serveStatic(req, res, url);
      } else {
        res.writeHead(405).end();
      }
    } catch (error) {
      if (error instanceof HttpError || error instanceof StoreError || error instanceof ReceiptParseError) {
        if (error instanceof HttpError && error.retryAfterSec) res.setHeader("retry-after", String(error.retryAfterSec));
        sendJson(res, error.status, { error: error.message });
      } else {
        console.error(`${req.method} ${url.pathname} failed`, error);
        sendJson(res, 500, { error: "Interner Serverfehler." });
      }
    }
  };
}
