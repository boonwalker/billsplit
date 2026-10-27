import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fill, isLang, msg, pickLang, translate, type Lang, type Msg, type Vars } from "../src/i18n/index.ts";
import { adminLogin, adminPage } from "./adminPage.ts";
import type { VisitLog } from "./visits.ts";
import type { Monitor } from "./monitor.ts";
import { isAiConfigured, isSupportedMediaType, observeAi, parseReceiptImage, ReceiptParseError } from "./parseReceipt.ts";
import { limitsFromEnv, RateLimiter, type Limits } from "./rateLimit.ts";
import { DeviceLinks } from "./deviceLink.ts";
import { AccountStore, normalizeEmail } from "./accounts.ts";
import { mailerFromEnv, type SendCode, type SendWelcome } from "./mail.ts";
import { HandoffBoard, networkKey } from "./handoff.ts";
import { isPushEndpoint, type PushService } from "./push.ts";
import type { RateService } from "./rates.ts";
import { BillDataSchema, BillStore, ParticipantNameSchema, participantIdFromKey, StoreError } from "./store.ts";
import { operatorFromEnv, operatorMeta, type Operator } from "./operator";
import { previewBillId, previewMeta, type PreviewBill } from "./preview";
import { MAX_TABLES, VenueError, VenueStore } from "./venues.ts";

/** Base64 of a downscaled receipt photo is well below this. */
const MAX_IMAGE_BODY = 12 * 1024 * 1024;
const MAX_JSON_BODY = 256 * 1024;
/** Stored receipt photos are downscaled JPEGs of a few hundred KB. */
const MAX_RECEIPT_IMAGE = 6 * 1024 * 1024;
const HEARTBEAT_MS = 25_000;
/** How long a device still counts as online after its last connection closed. */
const PRESENCE_GRACE_MS = 12_000;

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
  readonly template: string;
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSec?: number,
    readonly vars?: Vars,
  ) {
    super(fill(message, vars, "de-DE"));
    this.template = message;
  }
}

/** The reader's language: what the app sends along, else the browser's Accept-Language. */
function requestLang(req: IncomingMessage): Lang {
  const sent = req.headers["x-billsplit-lang"];
  if (isLang(sent)) return sent;
  return pickLang(req.headers["accept-language"], "de");
}

export interface AppOptions {
  limits?: Limits;
  /** Behind a reverse proxy (Render, Fly, …) the client address is in X-Forwarded-For. */
  trustProxy?: boolean;
  /** Push notifications; without it the app does not offer them. */
  push?: PushService;
  /** Exchange rates for the balances in the home currency (ECB); without it there are none. */
  rates?: RateService;
  /** Errors and AI usage for the admin page. */
  monitor?: Monitor;
  /** Opens the admin page (`/api/admin?token=…`); without it there is none. */
  adminToken?: string;
  /** App starts per day and the devices behind them, for the admin page. */
  visits?: VisitLog;
  /** Optional e-mail accounts (in memory when not given). */
  accounts?: AccountStore;
  /** Sends a sign-in code (default: Resend, or the log without a mail service). */
  sendCode?: SendCode;
  /** Sends the welcome after an account was created (default: as above). */
  sendWelcome?: SendWelcome;
  /**
   * The app's address (PUBLIC_URL, e.g. https://klicksplit.de). Pages opened at any other
   * address move there and take the device's data along (see src/lib/move.ts).
   */
  homeUrl?: string;
  /** Who runs klicksplit, for imprint and privacy policy (default: OPERATOR_* variables, see operator.ts). */
  operator?: Operator | null;
  /** Restaurants and their tables (restaurant mode; in memory when not given). */
  venues?: VenueStore;
}

/**
 * ADMIN_TOKEN as compared: without surrounding spaces or quotes (pasted into Railway with them by
 * accident), and only from 12 characters on – a shorter one opens nothing.
 */
export function adminSecret(value: string | undefined): string | null {
  const clean = (value ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
  return clean.length >= 12 ? clean : null;
}

/**
 * Short links printed on paper (QR codes), e.g. klicksplit.de/koeln on the beer mats for bars in
 * Cologne. Opening one counts for the admin page ("Gedruckt") and leads to the start page.
 */
export const PRINTED_LINKS = ["koeln"];

/** The origin of an address like "https://klicksplit.de/", or null when there is none. */
export function originOf(url: string | undefined): string | null {
  try {
    return url?.trim() ? new URL(url.trim()).origin : null;
  } catch {
    return null;
  }
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
function enforce(limiter: RateLimiter, key: string, message: Msg): void {
  const result = limiter.take(key);
  if (!result.ok) throw new HttpError(message.text, 429, result.retryAfterSec, message.vars);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError("Anfrage ist zu groß.", 413);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage, limit: number): Promise<unknown> {
  const body = await readBody(req, limit);
  try {
    return JSON.parse(body.toString("utf8") || "{}");
  } catch {
    throw new HttpError("Ungültige Anfrage.", 400);
  }
}

/** Where in a bill a validation problem is, in the user's words ("Position 4", "Gebühr 1", …). */
function describePath(path: PropertyKey[]): Msg {
  const parts = path.filter((p) => p !== "data");
  const [head, index] = parts;
  if (head === "items" && typeof index === "number") return msg("Position {n}", { n: index + 1 });
  if (head === "fees" && typeof index === "number") return msg("Gebühr {n}", { n: index + 1 });
  const names: Record<string, Msg> = {
    title: msg("Titel"),
    date: msg("Datum"),
    currency: msg("Währung"),
    tipAmount: msg("Trinkgeld"),
    tipPercent: msg("Trinkgeld"),
    name: msg("Name"),
  };
  return names[String(head)] ?? { text: parts.map(String).join(".") };
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    // Say what is wrong and where, so the user can fix it.
    const issue = result.error.issues[0];
    const field = String(issue?.path.at(-1) ?? "");
    const where = issue?.path.length ? describePath(issue.path) : null;
    if (issue?.code === "too_big" && ["total", "amount", "tipAmount", "fullTotal"].includes(field)) {
      throw where ? new HttpError("Ein Betrag ist zu hoch ({where}).", 400, undefined, { where }) : new HttpError("Ein Betrag ist zu hoch.", 400);
    }
    if (issue?.code === "too_big" && field === "name") {
      throw where ? new HttpError("Eine Bezeichnung ist zu lang ({where}).", 400, undefined, { where }) : new HttpError("Eine Bezeichnung ist zu lang.", 400);
    }
    throw where ? new HttpError("Ungültige Anfrage ({where}).", 400, undefined, { where }) : new HttpError("Ungültige Anfrage.", 400);
  }
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
  /** Per device: the app's own event stream (changes in any of its bills). */
  const userStreams = new Map<string, Set<ServerResponse>>();
  const handoffs = new HandoffBoard();
  const deviceLinks = new DeviceLinks();
  const accounts = options.accounts ?? new AccountStore(null);
  const venues = options.venues ?? new VenueStore(null);
  /** The bill open at a table – none when it was deleted meanwhile. */
  const openBill = (billId: string | null) => (billId && store.has(billId) ? billId : null);
  const mailer = options.sendCode && options.sendWelcome ? null : mailerFromEnv();
  const sendCode = options.sendCode ?? mailer!.sendCode;
  const sendWelcome = options.sendWelcome ?? mailer!.sendWelcome;
  /** Sign-in codes: per address (nobody floods a mailbox through billsplit) and per client. */
  const codesPerEmail = new RateLimiter(5, 60 * 60 * 1000);
  const codesPerClient = new RateLimiter(15, 60 * 60 * 1000);
  const verifiesPerClient = new RateLimiter(40, 60 * 60 * 1000);
  const home = originOf(options.homeUrl ?? process.env.PUBLIC_URL);
  const operator = options.operator === undefined ? operatorFromEnv() : options.operator;
  /** The admin token as sent matches ADMIN_TOKEN (compared in constant time; none set: never). */
  const adminOk = (sent: string): boolean => {
    const expected = adminSecret(options.adminToken);
    const token = adminSecret(sent) ?? "";
    return Boolean(expected) && token.length === expected!.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected!));
  };
  // Added to every page's head: the app's address (see src/lib/move.ts) and who runs it.
  const headExtra = `${home ? `<meta name="klicksplit-home" content="${home}">` : ""}${operator ? operatorMeta(operator) : ""}`;
  const monitor = options.monitor;
  if (monitor) observeAi({ call: (usage) => monitor.aiCall(usage), failure: (message) => monitor.aiFailure(message) });
  /** Error reports from the app, per client address (a broken page must not flood the log). */
  const appErrors = new RateLimiter(30, 60 * 60 * 1000);
  const visitReports = new RateLimiter(120, 60 * 60 * 1000);
  const visits = options.visits;
  const push = options.push;
  // Whatever needs someone (money arrived, a payment to confirm, …) goes to their devices.
  if (push) {
    store.onNotice((participantId, notice) => void push.notify(participantId, notice));
    // "Erinnern" sends a notification to those it reaches (WhatsApp for the others).
    store.setReachability((participantId) => push.reachable(participantId));
  }

  /** Tells these people's apps that a bill of theirs changed (the dashboard and list reload it). */
  function tellChanged(people: Iterable<string>, billId: string): void {
    for (const viewer of people) {
      for (const res of userStreams.get(viewer) ?? []) {
        try {
          res.write(`event: changed\ndata: ${JSON.stringify({ billId })}\n\n`);
        } catch {
          // connection closed; cleaned up by its close handler
        }
      }
    }
  }

  store.onChange((billId, kind) => {
    // Deleted on the admin page: whoever has it open learns so, the stream ends.
    if (!store.has(billId)) {
      for (const sub of subscribers.get(billId) ?? []) {
        try {
          sub.res.end(`event: deleted\ndata: {}\n\n`);
        } catch {
          // see below
        }
      }
      return;
    }
    for (const sub of subscribers.get(billId) ?? []) {
      try {
        sub.res.write(`event: snapshot\ndata: ${JSON.stringify(store.snapshot(billId, sub.viewer))}\n\n`);
      } catch {
        // connection closed; cleaned up by its close handler
      }
    }
    // The dashboards of everyone in the bill reload their balances.
    if (kind !== "data") return;
    tellChanged(
      [...userStreams.keys()].filter((viewer) => store.participates(billId, viewer)),
      billId,
    );
  });

  /**
   * Presence: a device counts as online while it has an event stream open (the app keeps one
   * while it is in the foreground). Going offline waits a moment, so switching screens or a
   * short reconnect does not make the count flicker.
   */
  const connections = new Map<string, number>();
  const offlineTimers = new Map<string, NodeJS.Timeout>();
  function connected(viewer: string | null): () => void {
    if (!viewer) return () => {};
    connections.set(viewer, (connections.get(viewer) ?? 0) + 1);
    clearTimeout(offlineTimers.get(viewer));
    offlineTimers.delete(viewer);
    store.setOnline(viewer, true);
    return () => {
      const left = (connections.get(viewer) ?? 1) - 1;
      if (left > 0) return void connections.set(viewer, left);
      connections.delete(viewer);
      offlineTimers.set(
        viewer,
        setTimeout(() => {
          offlineTimers.delete(viewer);
          if (!connections.has(viewer)) store.setOnline(viewer, false);
        }, PRESENCE_GRACE_MS),
      );
    };
  }

  function subscribeUser(req: IncomingMessage, res: ServerResponse, viewer: string): void {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write(`retry: 2000\nevent: hello\ndata: {}\n\n`);
    let set = userStreams.get(viewer);
    if (!set) userStreams.set(viewer, (set = new Set()));
    set.add(res);
    const leave = connected(viewer);
    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
    req.on("close", () => {
      clearInterval(heartbeat);
      set.delete(res);
      if (set.size === 0) userStreams.delete(viewer);
      leave();
    });
  }

  function subscribe(req: IncomingMessage, res: ServerResponse, billId: string, viewer: string | null): void {
    store.snapshot(billId, viewer); // throws for unknown bills before anything is counted
    const leave = connected(viewer);
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
      leave();
    });
  }

  async function handleParseReceipt(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!isAiConfigured()) throw new HttpError("KI-Belegerkennung ist auf dem Server nicht eingerichtet.", 503);
    // Every photo costs API usage: limit per client and in total per day.
    enforce(limits.receiptPerClient, clientAddress(req, trustProxy), msg("Zu viele Belegfotos in kurzer Zeit. Versuch es später noch einmal."));
    enforce(limits.receiptTotal, "all", msg("Die KI-Belegerkennung hat ihr Tageslimit erreicht. Trag die Positionen bitte selbst ein."));
    const body = (await readJson(req, MAX_IMAGE_BODY)) as { image?: unknown; mediaType?: unknown };
    if (typeof body.image !== "string" || typeof body.mediaType !== "string" || !isSupportedMediaType(body.mediaType)) {
      throw new HttpError("Ungültige Anfrage: Bild fehlt oder Format wird nicht unterstützt.", 400);
    }
    monitor?.receipt();
    sendJson(res, 200, await parseReceiptImage(body.image, body.mediaType));
  }

  async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const method = req.method ?? "GET";
    const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]

    if (url.pathname === "/api/health" && method === "GET") {
      // Railway sets RAILWAY_GIT_COMMIT_SHA: shows which code version is live.
      const version = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev").slice(0, 7);
      return sendJson(res, 200, { ok: true, ai: isAiConfigured(), version });
    }
    if (url.pathname === "/api/parse-receipt" && method === "POST") {
      return handleParseReceipt(req, res);
    }
    // Browser → home-screen app hand-over (see handoff.ts).
    if (url.pathname === "/api/handoff") {
      const address = clientAddress(req, trustProxy);
      if (method === "POST") {
        handoffs.mark(address);
        return sendJson(res, 200, { ok: true });
      }
      if (method === "GET") return sendJson(res, 200, { pending: handoffs.pending(address) });
      if (method === "DELETE") {
        handoffs.clear(address);
        return sendJson(res, 200, { ok: true });
      }
    }

    // The app's own event stream: presence, and changes in any of the viewer's bills.
    if (parts[1] === "events" && parts.length === 2 && method === "GET") {
      return subscribeUser(req, res, requireViewer(req, url));
    }

    // Errors in the app (uncaught exceptions, crashed screens) for the admin page.
    if (url.pathname === "/api/client-error" && method === "POST") {
      const body = parse(
        z.object({ message: z.string().max(1000), stack: z.string().max(4000).optional(), path: z.string().max(300).optional(), device: z.string().max(300).optional() }),
        await readJson(req, 16 * 1024),
      );
      if (monitor && appErrors.take(clientAddress(req, trustProxy)).ok) {
        monitor.error("app", `${body.message}${body.path ? ` (${body.path})` : ""}`, [body.device && `Gerät: ${body.device}`, body.stack].filter(Boolean).join("\n"));
      }
      return sendJson(res, 200, { ok: true });
    }

    // The app was opened (see src/lib/visits.ts): counted for the admin page.
    if (url.pathname === "/api/visit" && method === "POST") {
      const body = parse(z.object({ app: z.boolean(), lang: z.string().max(8).optional() }), await readJson(req, 1024));
      const viewer = viewerId(req, url);
      if (visits && viewer && visitReports.take(clientAddress(req, trustProxy)).ok) visits.visit(viewer, body);
      return sendJson(res, 200, { ok: true });
    }

    // Admin page: deleting an account, resetting its profile or erasing all of a person's data.
    // A form post with the token; deleting and erasing need the address typed in once more.
    if (parts[1] === "admin" && parts[2] === "account" && parts.length === 3 && method === "POST") {
      const form = new URLSearchParams((await readBody(req, MAX_JSON_BODY)).toString("utf8"));
      const sent = form.get("token") ?? "";
      if (!adminOk(sent)) throw new HttpError("Nicht gefunden.", 404);
      const action = form.get("action");
      const email = normalizeEmail(form.get("email") ?? "");
      const account = accounts.get(email);
      let notice: string;
      if (!account) notice = `Kein Konto mit ${email || "dieser Adresse"} gefunden.`;
      else if (action === "reset") {
        accounts.resetProfile(email);
        notice = `Profil von ${email} zurückgesetzt (Name und Zahlungsdaten im Konto gelöscht).`;
      } else if ((action === "delete" || action === "erase") && normalizeEmail(form.get("confirm") ?? "") !== email) {
        notice = `Nichts geändert: Zur Bestätigung muss die Adresse ${email} genau abgetippt werden.`;
      } else if (action === "delete") {
        accounts.removeByAddress(email, "deleted");
        notice = `Konto ${email} gelöscht. Rechnungen und Gerät bleiben, die Adresse ist wieder frei.`;
      } else if (action === "erase") {
        const id = participantIdFromKey(account.key);
        accounts.removeByAddress(email, "erased");
        const paid = await store.erase(id);
        push?.forget(id);
        visits?.forget(id);
        notice = `Alle Daten von ${email} gelöscht: Konto weg, Name in allen Rechnungen „Gelöscht“, Zahlungsdaten und Belegfotos von ${paid} eigenen Rechnung(en) entfernt.`;
      } else notice = "Unbekannte Aktion.";
      console.log(`Betriebsseite: ${notice}`);
      res.writeHead(303, { location: `/api/admin?token=${encodeURIComponent(sent)}&meldung=${encodeURIComponent(notice)}#konten`, "cache-control": "no-store" });
      return void res.end();
    }

    // Admin page: deleting a bill as if it had never existed (a form post with the token, ticked to confirm).
    if (parts[1] === "admin" && parts[2] === "bill" && parts.length === 3 && method === "POST") {
      const form = new URLSearchParams((await readBody(req, MAX_JSON_BODY)).toString("utf8"));
      const sent = form.get("token") ?? "";
      if (!adminOk(sent)) throw new HttpError("Nicht gefunden.", 404);
      const billId = form.get("id") ?? "";
      let notice: string;
      if (!store.has(billId)) notice = "Diese Rechnung gibt es nicht (mehr).";
      else if (form.get("confirm") !== "ja") notice = "Nichts geändert: Zum Löschen bitte „Endgültig löschen“ ankreuzen.";
      else {
        const title = store.summaries().find((b) => b.id === billId)?.title || "Rechnung";
        const { people, adjusted, dropped } = await store.deleteBill(billId);
        tellChanged(people, billId);
        notice =
          `Rechnung „${title}“ (${billId}) gelöscht – auch aus den Listen und Bilanzen aller ${people.length} Beteiligten.` +
          (adjusted || dropped ? ` Ausgleichszahlungen: ${adjusted} angepasst, ${dropped} entfernt.` : "");
      }
      console.log(`Betriebsseite: ${notice}`);
      res.writeHead(303, { location: `/api/admin?token=${encodeURIComponent(sent)}&meldung=${encodeURIComponent(notice)}#rechnungen`, "cache-control": "no-store" });
      return void res.end();
    }

    // Admin page: taking one person's ticks off one line of a bill ("Anteil entfernen").
    if (parts[1] === "admin" && parts[2] === "share" && parts.length === 3 && method === "POST") {
      const form = new URLSearchParams((await readBody(req, MAX_JSON_BODY)).toString("utf8"));
      const sent = form.get("token") ?? "";
      if (!adminOk(sent)) throw new HttpError("Nicht gefunden.", 404);
      const billId = form.get("id") ?? "";
      const [participantId = "", itemId = ""] = (form.get("share") ?? "").split(" ");
      let notice: string;
      if (!store.has(billId)) notice = "Diese Rechnung gibt es nicht (mehr).";
      else {
        const title = store.summaries().find((b) => b.id === billId)?.title || "Rechnung";
        const removed = store.removeShare(billId, participantId, itemId);
        if (removed) {
          tellChanged(store.summaries().find((b) => b.id === billId)?.participants.map((p) => p.id) ?? [], billId);
          notice = `Anteil von ${removed.name} an „${removed.item}“ in „${title}“ entfernt.`;
        } else notice = "Nichts geändert: Diesen Anteil gibt es nicht (mehr).";
      }
      console.log(`Betriebsseite: ${notice}`);
      res.writeHead(303, { location: `/api/admin?token=${encodeURIComponent(sent)}&meldung=${encodeURIComponent(notice)}#rechnungen`, "cache-control": "no-store" });
      return void res.end();
    }

    // The operator's page: usage, cost and errors – and a copy of the data.
    if (parts[1] === "admin" && method === "GET") {
      const expected = adminSecret(options.adminToken);
      if (!expected) throw new HttpError("Nicht gefunden.", 404);
      const sent = url.searchParams.get("token");
      const token = adminSecret(sent ?? "") ?? "";
      const ok = adminOk(sent ?? "");
      if (!ok) {
        // A form instead of a bare "not found": the token can be typed (or filled in by the password manager).
        if (sent !== null) console.warn(`Betriebsseite: Token passt nicht (${token.length} Zeichen geschickt, ${expected.length} erwartet)`);
        res.writeHead(sent === null ? 200 : 403, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" });
        return void res.end(adminLogin(sent !== null));
      }
      if (parts.length === 2) {
        const { days, errors } = monitor?.stats() ?? { days: [], errors: [] };
        const html = adminPage({
          days,
          errors,
          storage: store.storage,
          version: (process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev").slice(0, 7),
          backupUrl: store.storage === "memory" ? null : `/api/admin/backup?token=${encodeURIComponent(token)}`,
          visitDays: visits?.stats() ?? [],
          devices: visits?.allDevices() ?? [],
          active: { day: visits?.activeWithin(1) ?? 0, week: visits?.activeWithin(7) ?? 0, month: visits?.activeWithin(30) ?? 0 },
          online: new Set(userStreams.keys()),
          accounts: accounts.all().map((a) => ({ email: a.email, name: a.profile.name ?? "", createdAt: a.createdAt, id: participantIdFromKey(a.key) })),
          bills: store.summaries(),
          pushSubscribers: push?.subscribers ?? 0,
          isPushed: (id: string) => push?.reachable(id) ?? false,
          token,
          notice: url.searchParams.get("meldung"),
        });
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" });
        return void res.end(html);
      }
      if (parts[2] === "backup" && parts.length === 3) {
        const dir = await mkdtemp(path.join(tmpdir(), "billsplit-export-"));
        try {
          const file = path.join(dir, store.storage === "sqlite" ? "billsplit.db" : "bills.json");
          if (!(await store.exportTo(file))) throw new HttpError("Keine Daten.", 404);
          const data = await readFile(file).catch(() => Buffer.alloc(0));
          const day = new Date().toISOString().slice(0, 10);
          res.writeHead(200, {
            "content-type": "application/octet-stream",
            "content-disposition": `attachment; filename="klicksplit-${day}.${store.storage === "sqlite" ? "db" : "json"}"`,
            "cache-control": "no-store",
          });
          return void res.end(data);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
    }

    // Push notifications: the server's public key and the device's subscription.
    // Exchange rates of the day (ECB), for balances in the home currency.
    if (parts[1] === "rates" && parts.length === 2 && method === "GET") {
      const rates = options.rates ? await options.rates.get() : null;
      res.setHeader("cache-control", "public, max-age=3600");
      return sendJson(res, 200, { rates });
    }
    if (parts[1] === "push") {
      if (parts[2] === "key" && method === "GET") return sendJson(res, 200, { publicKey: push?.publicKey ?? null });
      if (!push) throw new HttpError("Benachrichtigungen sind auf diesem Server nicht eingerichtet.", 404);
      const viewer = requireViewer(req, url);
      if (parts[2] === "subscribe" && method === "POST") {
        const body = parse(
          z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
          await readJson(req, MAX_JSON_BODY),
        );
        if (!isPushEndpoint(body.endpoint)) throw new HttpError("Unbekannter Push-Dienst.", 400);
        push.subscribe(viewer, { endpoint: body.endpoint, keys: body.keys }, requestLang(req));
        return sendJson(res, 200, { ok: true });
      }
      if (parts[2] === "unsubscribe" && method === "POST") {
        const body = parse(z.object({ endpoint: z.string().max(1000) }), await readJson(req, MAX_JSON_BODY));
        push.unsubscribe(viewer, body.endpoint);
        return sendJson(res, 200, { ok: true });
      }
    }

    // Moving to a new device (see deviceLink.ts) and the bills to show there.
    // People I share bills with: "Ausgabe eingeben" can assign them an expense directly.
    if (parts[1] === "contacts" && parts.length === 2 && method === "GET") {
      return sendJson(res, 200, { contacts: store.contacts(requireViewer(req, url)) });
    }
    // Restaurant mode (see venues.ts): the restaurant's tables, and what a scanned table shows.
    if (parts[1] === "venues") {
      const viewer = requireViewer(req, url);
      try {
        if (parts.length === 2 && method === "GET") return sendJson(res, 200, { venues: venues.ofOwner(viewer) });
        if (parts.length === 2 && method === "POST") {
          const body = parse(z.object({ name: z.string().trim().min(1).max(60), tables: z.number().int().min(1).max(MAX_TABLES) }), await readJson(req, MAX_JSON_BODY));
          return sendJson(res, 201, venues.create(viewer, body.name, body.tables));
        }
        if (parts[2] === "tables" && parts[3] && parts.length === 4 && method === "POST") {
          const body = parse(z.object({ billId: z.string().regex(/^[A-Za-z0-9_-]{6,40}$/).nullable() }), await readJson(req, MAX_JSON_BODY));
          if (body.billId && !store.snapshot(body.billId, viewer).isOwner) throw new HttpError("Nur eigene Rechnungen lassen sich einem Tisch zuordnen.", 403);
          return sendJson(res, 200, venues.setBill(viewer, parts[3], body.billId));
        }
      } catch (error) {
        throw error instanceof VenueError ? new HttpError(error.message, error.status) : error;
      }
    }
    if (parts[1] === "tables" && parts[2] && parts.length === 3 && method === "GET") {
      const found = venues.find(parts[2]);
      if (!found) throw new HttpError("Diesen Tisch gibt es nicht.", 404);
      return sendJson(res, 200, { venue: found.venue.name, table: found.table.name, billId: openBill(found.table.billId) });
    }
    if (parts[1] === "my-bills" && parts.length === 2 && method === "GET") {
      return sendJson(res, 200, { bills: store.myBills(requireViewer(req, url)) });
    }
    if (parts[1] === "device-link" && method === "POST") {
      if (parts.length === 2) {
        requireViewer(req, url);
        const key = (req.headers["x-billsplit-key"] as string | undefined) ?? url.searchParams.get("key")!;
        const text = z.string().max(140).optional();
        const body = parse(
          z.object({ profile: z.object({ name: text, paypalMe: text, paypalEmail: text, iban: text, holder: text, wero: text }) }),
          await readJson(req, MAX_JSON_BODY),
        );
        const profile = Object.fromEntries(Object.entries(body.profile).filter((e): e is [string, string] => typeof e[1] === "string"));
        return sendJson(res, 201, deviceLinks.create({ key, profile, network: networkKey(clientAddress(req, trustProxy)) }));
      }
      if (parts.length === 3) {
        const link = deviceLinks.claim(parts[2]);
        if (!link) throw new HttpError("Dieser Code ist abgelaufen oder wurde schon benutzt. Lass Dir auf dem alten Gerät einen neuen zeigen.", 410);
        return sendJson(res, 200, { key: link.key, profile: link.profile });
      }
    }

    // Moving to the new address: the old one hands over its key with a one-time code (see move.ts).
    if (parts[1] === "move" && parts.length === 2 && method === "POST") {
      const viewer = requireViewer(req, url);
      const key = (req.headers["x-billsplit-key"] as string | undefined) ?? url.searchParams.get("key")!;
      const body = parse(z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/) }), await readJson(req, MAX_JSON_BODY));
      const link = deviceLinks.claim(body.code);
      if (!link) throw new HttpError("Die Übergabe ist abgelaufen. Öffne klicksplit an der alten Adresse nochmal.", 410);
      const old = participantIdFromKey(link.key);
      // The code proves the old key, the request this browser's own: one person, so the payer's role moves too.
      if (accounts.byKey(key) && link.key !== key) {
        // This browser is signed in here already: the account's key stays, the old address's bills join it.
        store.mergeParticipant(old, viewer);
        return sendJson(res, 200, { key, profile: link.profile, bills: store.myBills(viewer) });
      }
      // Usually: the old key moves in, and whatever this browser did here so far joins it.
      store.mergeParticipant(viewer, old);
      return sendJson(res, 200, { key: link.key, profile: link.profile, bills: store.myBills(old) });
    }

    // Optional e-mail account (see accounts.ts): sign in with a code from the mail.
    if (parts[1] === "account") {
      const viewer = requireViewer(req, url);
      const key = (req.headers["x-billsplit-key"] as string | undefined) ?? url.searchParams.get("key")!;
      const text = z.string().max(140).optional();
      const profileSchema = z.object({ name: text, paypalMe: text, paypalEmail: text, iban: text, holder: text, wero: text });
      const cleanProfile = (p: z.infer<typeof profileSchema>) =>
        Object.fromEntries(Object.entries(p).filter((e): e is [string, string] => typeof e[1] === "string"));
      const email = z.string().trim().max(200).email();
      if (parts.length === 2 && method === "GET") {
        const account = accounts.byKey(key);
        // Deleted on the admin page: the device says so (instead of "the server no longer knew it").
        const removed = account ? null : accounts.removalOf(key);
        return sendJson(res, 200, { account: account ? { email: account.email } : null, ...(removed ? { removed } : {}) });
      }
      if (parts.length === 2 && method === "DELETE") {
        accounts.remove(key);
        return sendJson(res, 200, { account: null });
      }
      if (parts[2] === "code" && parts.length === 3 && method === "POST") {
        // name: the profile name so far, for "Hi Niklas," in the mail.
        const body = parse(z.object({ email, name: z.string().trim().max(40).optional() }), await readJson(req, MAX_JSON_BODY));
        const address = normalizeEmail(body.email);
        const tooMany = msg("Zu viele Codes angefordert. Bitte warte etwas und versuche es dann nochmal.");
        enforce(codesPerClient, clientAddress(req, trustProxy), tooMany);
        enforce(codesPerEmail, address, tooMany);
        try {
          await sendCode(address, accounts.newCode(address), body.name || undefined, requestLang(req));
        } catch (error) {
          monitor?.error("server", `Mail an ${address.replace(/^(.).*@/, "$1…@")} fehlgeschlagen`, error instanceof Error ? error.message : String(error));
          throw new HttpError("Die Mail konnte gerade nicht verschickt werden. Bitte versuche es gleich nochmal.", 502);
        }
        return sendJson(res, 200, { ok: true });
      }
      if (parts[2] === "verify" && parts.length === 3 && method === "POST") {
        enforce(verifiesPerClient, clientAddress(req, trustProxy), msg("Zu viele Versuche. Bitte warte etwas."));
        const body = parse(
          z.object({ email, code: z.string().trim().regex(/^\d{6}$/), profile: profileSchema.optional() }),
          await readJson(req, MAX_JSON_BODY),
        );
        const check = accounts.verify(body.email, body.code);
        if (!check.ok) {
          throw check.reason === "wrong"
            ? new HttpError("Der Code stimmt nicht. Bitte prüfe ihn nochmal.", 400)
            : new HttpError("Der Code ist abgelaufen. Lass Dir einen neuen schicken.", 410);
        }
        const existing = accounts.get(body.email);
        const current = accounts.byKey(key);
        if (existing?.key === key) return sendJson(res, 200, { status: "same", email: existing.email, profile: existing.profile });
        if (current) throw new HttpError("Dieses Gerät ist schon mit {email} verbunden. Melde Dich dort erst ab.", 409, undefined, { email: current.email });
        if (!existing) {
          const account = accounts.create(body.email, key, cleanProfile(body.profile ?? {}));
          // A warm welcome – and how to get into the account from anywhere (not waited for).
          sendWelcome(account.email, account.profile.name, requestLang(req)).catch((error: unknown) =>
            monitor?.error("server", "Willkommensmail fehlgeschlagen", error instanceof Error ? error.message : String(error)),
          );
          return sendJson(res, 200, { status: "created", email: account.email });
        }
        // Signing in on another device: what this device did so far moves into the account.
        const owner = participantIdFromKey(existing.key);
        store.mergeParticipant(viewer, owner);
        return sendJson(res, 200, { status: "login", email: existing.email, key: existing.key, profile: existing.profile, bills: store.myBills(owner) });
      }
      if (parts[2] === "profile" && parts.length === 3 && method === "PUT") {
        const body = parse(z.object({ profile: profileSchema }), await readJson(req, MAX_JSON_BODY));
        if (!accounts.setProfile(key, cleanProfile(body.profile))) throw new HttpError("Kein Konto auf diesem Gerät.", 404);
        return sendJson(res, 200, { ok: true });
      }
    }

    // Safari → home-screen app: the app takes over what the same person did in Safari (see mergeParticipant).
    if (parts[1] === "merge-device" && parts.length === 2 && method === "POST") {
      const viewer = requireViewer(req, url);
      const body = parse(z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/) }), await readJson(req, MAX_JSON_BODY));
      const link = deviceLinks.claim(body.code);
      if (!link) throw new HttpError("Die Übernahme aus Safari ist abgelaufen. Öffne den Link in Safari nochmal und tippe „In der App öffnen“.", 410);
      // Safari and the app are one phone in one network: a code that went elsewhere (e.g. pasted
      // into a chat) takes nothing over.
      if (link.network !== networkKey(clientAddress(req, trustProxy))) {
        throw new HttpError("Die Übernahme aus Safari klappt nur auf demselben Handy.", 403);
      }
      const from = participantIdFromKey(link.key);
      // The name may have been entered in Safari only after the code was made.
      const name = store.nameOf(from);
      // Never the payer's role: bills paid in Safari stay with Safari's identity (the account moves those).
      const merged = store.mergeParticipant(from, viewer, { ownership: false });
      return sendJson(res, 200, { merged, bills: store.myBills(viewer), profile: { ...link.profile, ...(name ? { name } : {}) } });
    }

    // "Erinnern" in the dashboard: whom notifications reach, and one reminder for a person's open shares.
    if (parts[1] === "reminders" && parts.length === 2) {
      const viewer = requireViewer(req, url);
      if (method === "POST") {
        const body = parse(z.object({ personId: z.string().max(32) }), await readJson(req, MAX_JSON_BODY));
        store.remindPerson(viewer, body.personId);
      }
      if (method === "GET" || method === "POST") return sendJson(res, 200, store.reminderStatus(viewer));
    }

    // Settling up across bills: open shares in the viewer's bills and settlement payments.
    if (parts[1] === "network" && parts.length === 2 && method === "GET") {
      return sendJson(res, 200, { edges: store.network(requireViewer(req, url)) });
    }
    if (parts[1] === "transfers") {
      const viewer = requireViewer(req, url);
      if (parts.length === 2 && method === "GET") return sendJson(res, 200, { me: viewer, transfers: store.listTransfers(viewer) });
      if (parts.length === 2 && method === "POST") {
        const id = z.string().min(1).max(32);
        const cents = z.number().int().min(1).max(1_000_000_000);
        const body = parse(
          z.object({
            toId: id,
            fromId: id.optional(),
            amount: z.number().int().min(0).max(1_000_000_000),
            currency: z.string().min(1).max(8),
            allocations: z.array(z.object({ billId: z.string().max(40), debtorId: id, creditorId: id, amount: cents })).min(1).max(200),
          }),
          await readJson(req, MAX_JSON_BODY),
        );
        const transferId = store.createTransfer(viewer, body);
        return sendJson(res, 201, { id: transferId, me: viewer, transfers: store.listTransfers(viewer) });
      }
      const action = parts[3];
      if (parts.length === 4 && method === "POST" && (action === "confirm" || action === "reject" || action === "cancel")) {
        store.decideTransfer(viewer, parts[2], action);
        return sendJson(res, 200, { me: viewer, transfers: store.listTransfers(viewer) });
      }
    }

    if (parts[1] === "bills" && parts.length === 2 && method === "POST") {
      const viewer = requireViewer(req, url);
      enforce(limits.billsPerClient, clientAddress(req, trustProxy), msg("Zu viele neue Rechnungen in kurzer Zeit. Versuch es später noch einmal."));
      const body = parse(z.object({ data: BillDataSchema, name: ParticipantNameSchema }), await readJson(req, MAX_JSON_BODY));
      const id = store.createBill(body.data, viewer, body.name);
      return sendJson(res, 201, store.snapshot(id, viewer));
    }

    // Several bills at once (home list, dashboard): one request instead of one per bill.
    if (parts[1] === "bills" && parts[2] === "batch" && parts.length === 3 && method === "POST") {
      const viewer = viewerId(req, url);
      const body = parse(z.object({ ids: z.array(z.string().regex(/^[A-Za-z0-9_-]{6,40}$/)).max(100) }), await readJson(req, MAX_JSON_BODY));
      const bills: Record<string, unknown> = {};
      for (const id of new Set(body.ids)) bills[id] = store.has(id) ? store.snapshot(id, viewer) : null;
      // Deleted on the admin page (not lost): the app drops them from its list.
      return sendJson(res, 200, { bills, deleted: body.ids.filter((id) => store.wasDeleted(id)) });
    }

    if (parts[1] === "bills" && parts[2]) {
      const billId = parts[2];
      const action = parts[3] ?? "";
      if (!/^[A-Za-z0-9_-]{6,40}$/.test(billId)) throw new HttpError("Nicht gefunden.", 404);
      if (store.wasDeleted(billId)) throw new HttpError("Diese Rechnung wurde gelöscht.", 410);

      if (action === "" && method === "GET") {
        return sendJson(res, 200, store.snapshot(billId, viewerId(req, url)));
      }
      if (action === "events" && method === "GET") {
        return subscribe(req, res, billId, viewerId(req, url));
      }
      if (action === "receipt-image" && method === "GET") {
        const image = await store.receiptImage(billId);
        if (!image) throw new HttpError("Kein Originalbeleg gespeichert.", 404);
        res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" });
        res.end(image);
        return;
      }

      const viewer = requireViewer(req, url);
      if (action === "join" && method === "POST") {
        const body = parse(z.object({ name: ParticipantNameSchema }), await readJson(req, MAX_JSON_BODY));
        store.join(billId, viewer, body.name);
        return sendJson(res, 200, store.snapshot(billId, viewer));
      }
      if (action === "assign" && method === "POST") {
        const claims = z.record(z.string().max(24), z.array(z.number().int().min(0).max(998)).max(999));
        const body = parse(z.object({ people: z.array(z.object({ id: z.string().max(64), claims })).min(1).max(20) }), await readJson(req, MAX_JSON_BODY));
        store.assign(billId, viewer, body.people);
        return sendJson(res, 200, store.snapshot(billId, viewer));
      }
      if (action === "claims" && method === "PUT") {
        const body = parse(
          z.object({
            claims: z.record(z.string().max(24), z.union([z.number().int().min(0).max(999), z.array(z.number().int().min(0).max(998)).max(999)])),
            splits: z.record(z.string().max(24), z.array(z.number().int().min(0).max(998)).max(999)).optional(),
          }),
          await readJson(req, MAX_JSON_BODY),
        );
        store.setClaims(billId, viewer, body.claims, body.splits);
        return sendJson(res, 200, store.snapshot(billId, viewer));
      }
      if (action === "receipt-image" && method === "PUT") {
        const jpeg = await readBody(req, MAX_RECEIPT_IMAGE);
        // Only JPEG (as produced by the app), recognised by its signature.
        if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[2] !== 0xff) {
          throw new HttpError("Der Originalbeleg muss ein JPEG-Bild sein.", 400);
        }
        await store.setReceiptImage(billId, viewer, jpeg);
        return sendJson(res, 200, store.snapshot(billId, viewer));
      }
      if (action === "pay" && method === "POST") {
        const amount = store.recordPayClick(billId, viewer);
        return sendJson(res, 200, { amount });
      }
      if (action === "paid" && method === "POST") {
        const body = parse(z.object({ paid: z.boolean() }), await readJson(req, MAX_JSON_BODY));
        store.setMarkedPaid(billId, viewer, body.paid);
        return sendJson(res, 200, store.snapshot(billId, viewer));
      }
      if (action === "contest" && method === "POST") {
        const body = parse(z.object({ participantId: z.string().max(64), itemId: z.string().max(24) }), await readJson(req, MAX_JSON_BODY));
        store.contestShare(billId, viewer, body.participantId, body.itemId);
        return sendJson(res, 200, store.snapshot(billId, viewer));
      }
      if (action === "remind" && method === "POST") {
        const body = parse(z.object({ participantId: z.string().max(32) }), await readJson(req, MAX_JSON_BODY));
        store.remind(billId, viewer, body.participantId);
        return sendJson(res, 200, store.snapshot(billId, viewer));
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
    throw new HttpError("Nicht gefunden.", 404);
  }

  /** Link preview tags for the page (see preview.ts): a shared bill link shows its title and who paid. */
  function previewFor(req: IncomingMessage, url: URL): string {
    const forwarded = trustProxy ? (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() : undefined;
    const origin = home ?? `${forwarded ?? "http"}://${req.headers.host ?? "localhost"}`;
    const billId = previewBillId(url.pathname);
    let bill: PreviewBill | null = null;
    if (billId && store.has(billId)) {
      const snap = store.snapshot(billId, null);
      bill = { title: snap.data.title, ownerName: snap.ownerName };
    }
    return previewMeta(origin, url.pathname, requestLang(req), bill);
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
      let data: Buffer | string = await readFile(filePath);
      if (filePath.endsWith(".html")) data = data.toString("utf8").replace("</head>", `${headExtra}${previewFor(req, url)}</head>`);
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
      const printed = PRINTED_LINKS.find((name) => url.pathname.replace(/\/+$/, "").toLowerCase() === `/${name}`);
      if (printed && (req.method === "GET" || req.method === "HEAD")) {
        // A printed QR code (beer mats …): counted for the admin page, then the start page.
        if (req.method === "GET") visits?.source(printed);
        res.writeHead(302, { location: "/", "cache-control": "no-store" });
        return void res.end();
      }
      // A table's QR code (restaurant mode): straight to the bill open there, else the waiting page.
      const table = /^\/t\/([A-Za-z0-9_-]{6,20})\/?$/.exec(url.pathname);
      if (table && (req.method === "GET" || req.method === "HEAD")) {
        const found = venues.find(table[1]);
        const billId = found ? openBill(found.table.billId) : null;
        res.writeHead(302, { location: billId ? `/b/${billId}` : found ? `/#/tisch/${table[1]}` : "/", "cache-control": "no-store" });
        return void res.end();
      }
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
      } else if (req.method === "GET" || req.method === "HEAD") {
        await serveStatic(req, res, url);
      } else {
        res.writeHead(405).end();
      }
    } catch (error) {
      // Errors are answered in the reader's language (the error keeps its German template).
      const t = (text: string, vars?: Vars) => translate(requestLang(req), text, vars);
      if (error instanceof HttpError || error instanceof StoreError || error instanceof ReceiptParseError) {
        if (error instanceof HttpError && error.retryAfterSec) res.setHeader("retry-after", String(error.retryAfterSec));
        sendJson(res, error.status, { error: t(error.template, error.vars) });
      } else {
        console.error(`${req.method} ${url.pathname} failed`, error);
        monitor?.error("server", `${req.method} ${url.pathname}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
        sendJson(res, 500, { error: t("Interner Serverfehler.") });
      }
    }
  };
}
