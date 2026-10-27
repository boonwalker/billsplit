import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * What changed who is in a bill, for the admin page ("Protokoll"): identities merged (account
 * sign-in, Safari → app, moving the address), people leaving a bill, parts taken off, bills
 * restored from a backup. Kept in `audit.json` next to the data, the newest MAX_ENTRIES.
 */

const MAX_ENTRIES = 1000;

export interface AuditEntry {
  at: string;
  /** e.g. "merge", "leave", "unclaim", "share", "restore". */
  kind: string;
  /** What happened, in German for the operator (with names, never amounts or e-mail addresses). */
  text: string;
  billIds?: string[];
}

export class AuditLog {
  private entries: AuditEntry[] = [];
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string | null) {}

  async load(): Promise<void> {
    if (!this.file) return;
    try {
      this.entries = (JSON.parse(await readFile(this.file, "utf8")) as AuditEntry[]).slice(-MAX_ENTRIES);
    } catch {
      // first start or unreadable: start fresh
    }
  }

  add(entry: Omit<AuditEntry, "at"> & { at?: string }): void {
    this.entries.push({ at: new Date().toISOString(), ...entry });
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    console.log(`Protokoll: ${entry.text}`);
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, 1000);
  }

  /** Newest first; with `billId` only what concerns that bill. */
  list(billId?: string): AuditEntry[] {
    return this.entries.filter((e) => !billId || e.billIds?.includes(billId)).reverse();
  }

  async flush(): Promise<void> {
    if (!this.file) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(`${this.file}.tmp`, JSON.stringify(this.entries));
      await rename(`${this.file}.tmp`, this.file);
    } catch (error) {
      console.error("Protokoll konnte nicht gespeichert werden", error);
    }
  }
}
