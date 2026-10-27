import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoredBill, StoredTransfer } from "../src/lib/billCore.ts";

/**
 * Where bills and settlement payments are kept on disk.
 *
 * SQLite (`billsplit.db`, Node's built-in `node:sqlite`): every change writes only the bills
 * and payments that changed, in one transaction. On the first start an existing `bills.json`
 * is imported (and kept as `bills.json.imported`). Where the Node version has no SQLite, the
 * whole state is written to `bills.json` as before.
 *
 * Backups: one copy per day in `backups/` (the last BACKUP_DAYS days are kept).
 */

export const BACKUP_DAYS = 14;

export interface Snapshot {
  bills: StoredBill[];
  transfers: StoredTransfer[];
}

export interface Changes {
  bills: StoredBill[];
  removedBills: string[];
  transfers: StoredTransfer[];
  removedTransfers: string[];
}

export interface Persistence {
  readonly kind: "sqlite" | "json";
  load(): Promise<Snapshot>;
  /** Writes what changed; `all` is the complete state (for the JSON file). */
  save(changes: Changes, all: () => Snapshot): Promise<void>;
  /** Writes a consistent copy of everything to `file`. */
  copyTo(file: string): Promise<void>;
  close(): void;
}

type Sqlite = typeof import("node:sqlite");

async function loadSqlite(): Promise<Sqlite | null> {
  try {
    // Node prints an "experimental" warning for SQLite once; it is stable enough for this.
    const original = process.emitWarning;
    process.emitWarning = (() => {}) as typeof process.emitWarning;
    try {
      return await import("node:sqlite");
    } finally {
      process.emitWarning = original;
    }
  } catch {
    return null;
  }
}

/** Reads the old JSON file: a plain list of bills, or bills plus settlement payments. */
async function readJsonFile(file: string): Promise<Snapshot | null> {
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as StoredBill[] | { bills: StoredBill[]; transfers?: StoredTransfer[] };
    return Array.isArray(raw) ? { bills: raw, transfers: [] } : { bills: raw.bills, transfers: raw.transfers ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

class SqlitePersistence implements Persistence {
  readonly kind = "sqlite";

  constructor(
    private readonly db: import("node:sqlite").DatabaseSync,
    private readonly legacyFile: string,
  ) {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS bills (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, data TEXT NOT NULL);
    `);
  }

  async load(): Promise<Snapshot> {
    const count = (this.db.prepare("SELECT COUNT(*) AS n FROM bills").get() as { n: number }).n;
    if (count === 0) {
      const legacy = await readJsonFile(this.legacyFile);
      if (legacy) {
        this.write({ bills: legacy.bills, removedBills: [], transfers: legacy.transfers, removedTransfers: [] });
        await rename(this.legacyFile, `${this.legacyFile}.imported`);
      }
    }
    const rows = (table: string) => (this.db.prepare(`SELECT data FROM ${table}`).all() as { data: string }[]).map((r) => JSON.parse(r.data));
    return { bills: rows("bills") as StoredBill[], transfers: rows("transfers") as StoredTransfer[] };
  }

  async save(changes: Changes): Promise<void> {
    this.write(changes);
  }

  private write({ bills, removedBills, transfers, removedTransfers }: Changes): void {
    const putBill = this.db.prepare("INSERT OR REPLACE INTO bills (id, created_at, data) VALUES (?, ?, ?)");
    const dropBill = this.db.prepare("DELETE FROM bills WHERE id = ?");
    const putTransfer = this.db.prepare("INSERT OR REPLACE INTO transfers (id, created_at, data) VALUES (?, ?, ?)");
    const dropTransfer = this.db.prepare("DELETE FROM transfers WHERE id = ?");
    this.db.exec("BEGIN");
    try {
      for (const b of bills) putBill.run(b.id, b.createdAt, JSON.stringify(b));
      for (const id of removedBills) dropBill.run(id);
      for (const t of transfers) putTransfer.run(t.id, t.createdAt, JSON.stringify(t));
      for (const id of removedTransfers) dropTransfer.run(id);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async copyTo(file: string): Promise<void> {
    await unlink(file).catch(() => {});
    this.db.prepare("VACUUM INTO ?").run(file);
  }

  close(): void {
    this.db.close();
  }
}

class JsonPersistence implements Persistence {
  readonly kind = "json";

  constructor(private readonly file: string) {}

  async load(): Promise<Snapshot> {
    return (await readJsonFile(this.file)) ?? { bills: [], transfers: [] };
  }

  async save(_changes: Changes, all: () => Snapshot): Promise<void> {
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(all()));
    await rename(tmp, this.file);
  }


  async copyTo(file: string): Promise<void> {
    await copyFile(this.file, file).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  close(): void {}
}

/** SQLite next to `jsonFile` where Node has it, otherwise the JSON file itself. */
export async function openPersistence(jsonFile: string, { sqlite = true } = {}): Promise<Persistence> {
  await mkdir(path.dirname(jsonFile), { recursive: true });
  const lib = sqlite ? await loadSqlite() : null;
  if (!lib) return new JsonPersistence(jsonFile);
  return new SqlitePersistence(new lib.DatabaseSync(path.join(path.dirname(jsonFile), "billsplit.db")), jsonFile);
}

/**
 * Makes today's backup in `dir` (if there is none yet) and deletes those older than
 * BACKUP_DAYS days. Returns the file written, or null when today's already existed.
 */
export async function dailyBackup(persistence: Persistence, dir: string, now = new Date()): Promise<string | null> {
  await mkdir(dir, { recursive: true });
  const day = now.toISOString().slice(0, 10);
  const ext = persistence.kind === "sqlite" ? "db" : "json";
  const file = path.join(dir, `billsplit-${day}.${ext}`);
  const exists = await stat(file).then(
    () => true,
    () => false,
  );
  if (!exists) await persistence.copyTo(file);
  const backups = (await readdir(dir)).filter((name) => /^billsplit-\d{4}-\d{2}-\d{2}\.(db|json)$/.test(name)).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - BACKUP_DAYS))) await unlink(path.join(dir, old)).catch(() => {});
  return exists ? null : file;
}

/** The daily backups in `dir`, newest first (see dailyBackup). */
export async function listBackups(dir: string): Promise<{ day: string; file: string }[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  return names
    .map((name) => ({ name, day: /^billsplit-(\d{4}-\d{2}-\d{2})\.(db|json)$/.exec(name)?.[1] }))
    .filter((b): b is { name: string; day: string } => Boolean(b.day))
    .sort((a, b) => b.day.localeCompare(a.day))
    .map((b) => ({ day: b.day, file: path.join(dir, b.name) }));
}

/** Several bills as they were in a backup file (id → bill; those not in it are missing). */
export async function readBackupBills(file: string, billIds: string[]): Promise<Map<string, StoredBill>> {
  const found = new Map<string, StoredBill>();
  if (file.endsWith(".json")) {
    for (const b of (await readJsonFile(file))?.bills ?? []) if (billIds.includes(b.id)) found.set(b.id, b);
    return found;
  }
  const lib = await loadSqlite();
  if (!lib || !billIds.length) return found;
  const db = new lib.DatabaseSync(file, { readOnly: true });
  try {
    const get = db.prepare("SELECT data FROM bills WHERE id = ?");
    for (const id of billIds) {
      const row = get.get(id) as { data: string } | undefined;
      if (row) found.set(id, JSON.parse(row.data) as StoredBill);
    }
  } finally {
    db.close();
  }
  return found;
}

/** One bill as it was in a backup file (SQLite opened read-only, or the JSON file); null when it was not in it. */
export async function readBackupBill(file: string, billId: string): Promise<StoredBill | null> {
  if (file.endsWith(".json")) return (await readJsonFile(file))?.bills.find((b) => b.id === billId) ?? null;
  const lib = await loadSqlite();
  if (!lib) return null;
  const db = new lib.DatabaseSync(file, { readOnly: true });
  try {
    const row = db.prepare("SELECT data FROM bills WHERE id = ?").get(billId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as StoredBill) : null;
  } finally {
    db.close();
  }
}
