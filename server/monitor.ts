import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * What the operator wants to know without asking friends: errors (server and app) and the
 * receipt recognition – calls, failures, tokens and estimated cost per day. Kept small in
 * `monitor.json` next to the data and shown on the admin page (see app.ts).
 */

/** US dollars per million tokens (Claude API list prices). */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};
const DEFAULT_PRICE = PRICES["claude-opus-5-5"];

const KEEP_DAYS = 60;
const KEEP_ERRORS = 200;

export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface DayStats {
  day: string;
  aiCalls: number;
  aiFailures: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  receipts: number;
  serverErrors: number;
  appErrors: number;
}

export interface ErrorEntry {
  at: string;
  source: "server" | "app" | "ai";
  message: string;
  detail?: string;
}

export function costOf(usage: AiUsage): number {
  const price = PRICES[usage.model] ?? DEFAULT_PRICE;
  return (
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      (usage.cacheReadTokens ?? 0) * price.cacheRead +
      (usage.cacheWriteTokens ?? 0) * price.cacheWrite) /
    1_000_000
  );
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

export class Monitor {
  private days = new Map<string, DayStats>();
  private errors: ErrorEntry[] = [];
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly file: string | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async load(): Promise<void> {
    if (!this.file) return;
    try {
      const raw = JSON.parse(await readFile(this.file, "utf8")) as { days?: DayStats[]; errors?: ErrorEntry[] };
      for (const d of raw.days ?? []) this.days.set(d.day, d);
      this.errors = raw.errors ?? [];
    } catch {
      // first start or unreadable: start fresh
    }
  }

  private today(): DayStats {
    const day = this.now().toISOString().slice(0, 10);
    let stats = this.days.get(day);
    if (!stats) {
      stats = { day, aiCalls: 0, aiFailures: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, receipts: 0, serverErrors: 0, appErrors: 0 };
      this.days.set(day, stats);
      const old = [...this.days.keys()].sort().slice(0, Math.max(0, this.days.size - KEEP_DAYS));
      for (const key of old) this.days.delete(key);
    }
    return stats;
  }

  /** One request to Claude (a receipt can take two: the sum check reads it again). */
  aiCall(usage: AiUsage): void {
    const day = this.today();
    day.aiCalls++;
    day.inputTokens += usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
    day.outputTokens += usage.outputTokens;
    day.costUsd += costOf(usage);
    this.scheduleSave();
  }

  aiFailure(message: string): void {
    this.today().aiFailures++;
    this.error("ai", message);
  }

  /** A receipt photo was read (successfully or not). */
  receipt(): void {
    this.today().receipts++;
    this.scheduleSave();
  }

  error(source: ErrorEntry["source"], message: string, detail?: string): void {
    if (source === "server") this.today().serverErrors++;
    if (source === "app") this.today().appErrors++;
    this.errors.unshift({ at: this.now().toISOString(), source, message: clip(message, 500), ...(detail ? { detail: clip(detail, 2000) } : {}) });
    this.errors.length = Math.min(this.errors.length, KEEP_ERRORS);
    this.scheduleSave();
  }

  stats(): { days: DayStats[]; errors: ErrorEntry[] } {
    return { days: [...this.days.values()].sort((a, b) => b.day.localeCompare(a.day)), errors: this.errors };
  }

  private scheduleSave(): void {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, 2000);
    this.saveTimer.unref?.();
  }

  async flush(): Promise<void> {
    if (!this.file) return;
    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(`${this.file}.tmp`, JSON.stringify(this.stats()));
      await rename(`${this.file}.tmp`, this.file);
    } catch (error) {
      console.error("Monitor konnte nicht gespeichert werden", error);
    }
  }
}
