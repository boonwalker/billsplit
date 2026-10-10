import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import webpush, { type PushSubscription } from "web-push";
import type { Notice } from "../src/lib/billCore.ts";

/**
 * Push notifications ("Niklas hat Dir 8,00 € gesendet"): devices subscribe through their
 * browser's push service; the server signs its messages with its VAPID key pair. The keys come
 * from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY or are created once and kept next to the bills,
 * so subscriptions survive restarts. Subscriptions are stored per participant id.
 */

/** Push services of the browsers; the server only ever sends to these (never to arbitrary URLs). */
const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
/** Devices per participant (the same key on a phone and a tablet, …). */
const MAX_PER_PARTICIPANT = 5;
/** A notice is still worth delivering this long (a phone that is off gets it later). */
const TTL_SECONDS = 24 * 60 * 60;

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

export class PushService {
  private keys: { publicKey: string; privateKey: string } | null = null;
  private subscriptions = new Map<string, PushSubscription[]>();
  private saveTimer: NodeJS.Timeout | null = null;

  /** dir: where the keys and subscriptions are kept (null: in memory only, for tests). */
  constructor(
    private readonly dir: string | null,
    private readonly send: typeof webpush.sendNotification = webpush.sendNotification.bind(webpush),
  ) {}

  async init(): Promise<void> {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) this.keys = { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
    else this.keys = (await this.read<{ publicKey: string; privateKey: string }>("vapid.json")) ?? null;
    if (!this.keys) {
      this.keys = webpush.generateVAPIDKeys();
      await this.write("vapid.json", this.keys);
    }
    const stored = await this.read<Record<string, PushSubscription[]>>("push.json");
    if (stored) this.subscriptions = new Map(Object.entries(stored));
  }

  get publicKey(): string | null {
    return this.keys?.publicKey ?? null;
  }

  subscribe(participantId: string, sub: PushSubscription): void {
    const others = (this.subscriptions.get(participantId) ?? []).filter((s) => s.endpoint !== sub.endpoint);
    this.subscriptions.set(participantId, [sub, ...others].slice(0, MAX_PER_PARTICIPANT));
    this.scheduleSave();
  }

  unsubscribe(participantId: string, endpoint: string): void {
    const left = (this.subscriptions.get(participantId) ?? []).filter((s) => s.endpoint !== endpoint);
    if (left.length) this.subscriptions.set(participantId, left);
    else this.subscriptions.delete(participantId);
    this.scheduleSave();
  }

  has(participantId: string, endpoint: string): boolean {
    return (this.subscriptions.get(participantId) ?? []).some((s) => s.endpoint === endpoint);
  }

  /** Sends a notice to all devices of a participant; subscriptions the push service dropped are removed. */
  async notify(participantId: string, notice: Notice): Promise<void> {
    const keys = this.keys;
    const subs = this.subscriptions.get(participantId);
    if (!keys || !subs?.length) return;
    const payload = JSON.stringify(notice);
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await this.send(sub, payload, {
            TTL: TTL_SECONDS,
            urgency: "high",
            vapidDetails: { subject: process.env.VAPID_SUBJECT || "mailto:hallo@billsplit.app", ...keys },
          });
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // Gone or unknown: the device unsubscribed or the app was removed.
          if (status === 404 || status === 410) this.unsubscribe(participantId, sub.endpoint);
          else console.warn(`Push an ${new URL(sub.endpoint).hostname} fehlgeschlagen`, status ?? error);
        }
      }),
    );
  }

  private scheduleSave(): void {
    if (!this.dir || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.write("push.json", Object.fromEntries(this.subscriptions));
    }, 500);
  }

  private async read<T>(name: string): Promise<T | null> {
    if (!this.dir) return null;
    try {
      return JSON.parse(await readFile(path.join(this.dir, name), "utf8")) as T;
    } catch {
      return null;
    }
  }

  private async write(name: string, value: unknown): Promise<void> {
    if (!this.dir) return;
    await mkdir(this.dir, { recursive: true });
    const file = path.join(this.dir, name);
    await writeFile(`${file}.tmp`, JSON.stringify(value));
    await rename(`${file}.tmp`, file);
  }
}
