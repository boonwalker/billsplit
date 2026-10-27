import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Visits for the admin page: how many people use klicksplit, how many are new, and whether
 * they use the home-screen app or the browser. A visit is an app start or coming back after a
 * while (the app reports it, see src/lib/visits.ts); the same device counts once per
 * SESSION_GAP_MS. Devices are known only by their participant id (a hash of their key).
 * Kept in `visits.json` next to the data.
 */

export const SESSION_GAP_MS = 30 * 60 * 1000;
const KEEP_DAYS = 400;

export interface DeviceInfo {
  firstSeen: string;
  lastSeen: string;
  visits: number;
  /** Last seen as the home-screen app (else in the browser). */
  app: boolean;
  lang?: string;
}

export interface VisitDay {
  day: string;
  visits: number;
  /** Different devices that day. */
  devices: number;
  /** Devices seen for the first time that day. */
  newDevices: number;
  /** Visits from the home-screen app. */
  appVisits: number;
  /** Opened through a printed link (e.g. the QR code on the beer mats: "koeln"), per link. */
  sources?: Record<string, number>;
}

interface Stored {
  devices: Record<string, DeviceInfo>;
  days: VisitDay[];
  /** Devices already counted today (so that `devices` survives a restart). */
  today?: { day: string; ids: string[] };
}

export class VisitLog {
  private devices = new Map<string, DeviceInfo>();
  private days = new Map<string, VisitDay>();
  private todayIds = new Set<string>();
  private todayKey = "";
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly file: string | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async load(): Promise<void> {
    if (!this.file) return;
    try {
      const raw = JSON.parse(await readFile(this.file, "utf8")) as Stored;
      this.devices = new Map(Object.entries(raw.devices ?? {}));
      for (const d of raw.days ?? []) this.days.set(d.day, d);
      if (raw.today) {
        this.todayKey = raw.today.day;
        this.todayIds = new Set(raw.today.ids);
      }
    } catch {
      // first start or unreadable: start fresh
    }
  }

  private day(): VisitDay {
    const key = this.now().toISOString().slice(0, 10);
    if (key !== this.todayKey) {
      this.todayKey = key;
      this.todayIds = new Set();
    }
    let stats = this.days.get(key);
    if (!stats) {
      stats = { day: key, visits: 0, devices: 0, newDevices: 0, appVisits: 0 };
      this.days.set(key, stats);
      const old = [...this.days.keys()].sort().slice(0, Math.max(0, this.days.size - KEEP_DAYS));
      for (const k of old) this.days.delete(k);
    }
    return stats;
  }

  /** The app was opened (or came back after a while) on this device; false when it already counted. */
  visit(participantId: string, info: { app: boolean; lang?: string }): boolean {
    const now = this.now();
    const at = now.toISOString();
    const known = this.devices.get(participantId);
    if (known && now.getTime() - Date.parse(known.lastSeen) < SESSION_GAP_MS) {
      known.lastSeen = at;
      known.app = info.app;
      this.scheduleSave();
      return false;
    }
    const day = this.day();
    day.visits++;
    if (info.app) day.appVisits++;
    if (!this.todayIds.has(participantId)) {
      this.todayIds.add(participantId);
      day.devices++;
    }
    if (!known) day.newDevices++;
    this.devices.set(participantId, {
      firstSeen: known?.firstSeen ?? at,
      lastSeen: at,
      visits: (known?.visits ?? 0) + 1,
      app: info.app,
      ...(info.lang ? { lang: info.lang } : known?.lang ? { lang: known.lang } : {}),
    });
    this.scheduleSave();
    return true;
  }

  /** Someone opened a printed link (see PRINTED_LINKS in app.ts). */
  source(name: string): void {
    const day = this.day();
    day.sources = { ...day.sources, [name]: (day.sources?.[name] ?? 0) + 1 };
    this.scheduleSave();
  }

  /** Forgets a device (its owner's data was erased); the daily counts stay. */
  forget(participantId: string): void {
    if (this.devices.delete(participantId)) this.scheduleSave();
  }

  device(participantId: string): DeviceInfo | null {
    return this.devices.get(participantId) ?? null;
  }

  /** All known devices, most recently seen first. */
  allDevices(): (DeviceInfo & { id: string })[] {
    return [...this.devices.entries()].map(([id, d]) => ({ id, ...d })).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  }

  /** Devices seen within the last `days` days. */
  activeWithin(days: number): number {
    const since = this.now().getTime() - days * 24 * 60 * 60 * 1000;
    let n = 0;
    for (const d of this.devices.values()) if (Date.parse(d.lastSeen) >= since) n++;
    return n;
  }

  stats(): VisitDay[] {
    return [...this.days.values()].sort((a, b) => b.day.localeCompare(a.day));
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
    const data: Stored = {
      devices: Object.fromEntries(this.devices),
      days: this.stats(),
      today: { day: this.todayKey, ids: [...this.todayIds] },
    };
    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(`${this.file}.tmp`, JSON.stringify(data));
      await rename(`${this.file}.tmp`, this.file);
    } catch (error) {
      console.error("Besuche konnten nicht gespeichert werden", error);
    }
  }
}
