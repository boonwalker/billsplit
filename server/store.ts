import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { BillData } from "../src/lib/bill.ts";
import { BillCore, BillError, type StoredBill } from "../src/lib/billCore.ts";

export { BillError as StoreError };

/** Bills are deleted this long after creation. */
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

export const BillDataSchema = z.object({
  title: z.string().trim().max(80),
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  tipPercent: z.number().min(0).max(100),
  tipAmount: z.number().int().min(0).max(10_000_000).optional(),
  items: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/),
        name: z.string().trim().min(1).max(120),
        qty: z.number().int().min(1).max(999),
        total: z.number().int().min(-10_000_000).max(10_000_000),
      }),
    )
    .min(1)
    .max(300),
  payment: z.object({
    paypalMe: z.string().max(40).optional(),
    paypalEmail: z.string().max(120).optional(),
  }),
});

export const ParticipantNameSchema = z.string().trim().min(1).max(40);

/**
 * Devices identify themselves with a random secret key. Only its hash is used as
 * participant id, so ids can be shown to everyone without letting others act as them.
 */
export function participantIdFromKey(key: string): string {
  return createHash("sha256").update(key).digest("base64url").slice(0, 16);
}

export type ChangeListener = (billId: string) => void;

/** Server-side bill store: the shared rules plus a JSON file and change notifications. */
export class BillStore extends BillCore {
  private listeners = new Set<ChangeListener>();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string | null) {
    super();
  }

  async load(): Promise<void> {
    if (!this.file) return;
    try {
      const raw = JSON.parse(await readFile(this.file, "utf8")) as StoredBill[];
      const cutoff = Date.now() - RETENTION_MS;
      for (const bill of raw) {
        if (Date.parse(bill.createdAt) > cutoff) this.bills.set(bill.id, bill);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected override changed(billId: string): void {
    for (const l of this.listeners) l(billId);
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, 500);
  }

  async flush(): Promise<void> {
    if (!this.file) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify([...this.bills.values()]));
    await rename(tmp, this.file);
  }

  createBill(data: BillData, ownerId: string, ownerName: string): string {
    return this.create(randomBytes(9).toString("base64url"), data, ownerId, ownerName);
  }
}
