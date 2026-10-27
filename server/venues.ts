import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Venue, VenueTable } from "../src/lib/bill.ts";

/**
 * Restaurant mode: a restaurant (a device or account, known by its participant id) has tables,
 * each with a QR code of its own (klicksplit.de/t/<table id>). A table points at the bill that is
 * open at it right now; guests who scan the code land in that bill, the staff see on one page
 * which tables have paid (see src/pages/Restaurant.tsx). Kept in venues.json next to the bills.
 */

export const MAX_TABLES = 80;

const newId = () => randomBytes(8).toString("base64url");

export class VenueError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class VenueStore {
  private venues = new Map<string, Venue>();
  /** table id → venue id */
  private tables = new Map<string, string>();
  private saveTimer: NodeJS.Timeout | null = null;

  /** file: where the restaurants are kept (null: in memory only, for tests). */
  constructor(private readonly file: string | null) {}

  async load(): Promise<void> {
    if (!this.file) return;
    try {
      const list = JSON.parse(await readFile(this.file, "utf8")) as Venue[];
      for (const v of list) this.put(v);
    } catch {
      // No restaurants yet.
    }
  }

  private put(venue: Venue): void {
    this.venues.set(venue.id, venue);
    for (const t of venue.tables) this.tables.set(t.id, venue.id);
  }

  create(ownerId: string, name: string, tableCount: number): Venue {
    const count = Math.max(1, Math.min(MAX_TABLES, Math.floor(tableCount)));
    const venue: Venue = {
      id: newId(),
      name,
      ownerId,
      createdAt: new Date().toISOString(),
      tables: Array.from({ length: count }, (_, i) => ({ id: newId(), name: `Tisch ${i + 1}`, billId: null })),
    };
    this.put(venue);
    this.scheduleSave();
    return venue;
  }

  ofOwner(ownerId: string): Venue[] {
    return [...this.venues.values()].filter((v) => v.ownerId === ownerId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** A table by the id on its QR code, with its restaurant. */
  find(tableId: string): { venue: Venue; table: VenueTable } | null {
    const venue = this.venues.get(this.tables.get(tableId) ?? "");
    const table = venue?.tables.find((t) => t.id === tableId);
    return venue && table ? { venue, table } : null;
  }

  /** The restaurant opens a bill at a table (billId) or clears the table (null). */
  setBill(ownerId: string, tableId: string, billId: string | null): Venue {
    const found = this.find(tableId);
    if (!found) throw new VenueError("Diesen Tisch gibt es nicht.", 404);
    if (found.venue.ownerId !== ownerId) throw new VenueError("Nur das Restaurant kann seine Tische ändern.", 403);
    found.table.billId = billId;
    if (billId) found.table.openedAt = new Date().toISOString();
    else delete found.table.openedAt;
    this.scheduleSave();
    return found.venue;
  }

  async flush(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.file) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(`${this.file}.tmp`, JSON.stringify([...this.venues.values()]));
    await rename(`${this.file}.tmp`, this.file);
  }

  private scheduleSave(): void {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush().catch((error: unknown) => console.error("Restaurants speichern fehlgeschlagen", error));
    }, 500);
    this.saveTimer.unref?.();
  }
}
