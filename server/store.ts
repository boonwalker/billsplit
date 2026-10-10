import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { BillData } from "../src/lib/bill.ts";
import { BillCore, BillError, type StoredBill, type StoredTransfer } from "../src/lib/billCore.ts";

export { BillError as StoreError };

/** Bills are deleted this long after creation. */
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Largest amount in cents (10 million in the bill's currency). Generous on purpose: bills in
 * currencies like AED or JPY, or the odd luxury dinner, quickly reach six or seven figures.
 */
const MAX_CENTS = 1_000_000_000;
const cents = () => z.number().int().min(-MAX_CENTS).max(MAX_CENTS);

export const BillDataSchema = z.object({
  title: z.string().trim().max(80),
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  tipPercent: z.number().min(0).max(100),
  tipAmount: z.number().int().min(0).max(MAX_CENTS).optional(),
  tipExcluded: z.boolean().optional(),
  tipSplitCount: z.number().int().min(1).max(100).optional(),
  equalSplit: z.boolean().optional(),
  supermarket: z.boolean().optional(),
  partial: z.boolean().optional(),
  fees: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/),
        name: z.string().trim().min(1).max(80),
        amount: cents(),
        excluded: z.boolean().optional(),
      }),
    )
    .max(10)
    .optional(),
  items: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/),
        name: z.string().trim().min(1).max(120),
        qty: z.number().int().min(1).max(999),
        total: cents(),
        fullTotal: cents().optional(),
        divisor: z.number().int().min(2).max(99).optional(),
        excluded: z.boolean().optional(),
        struck: z.number().int().min(1).max(998).optional(),
      }),
    )
    .min(1)
    .max(300),
  payment: z.object({
    paypalMe: z.string().max(40).optional(),
    paypalEmail: z.string().max(120).optional(),
    iban: z
      .string()
      .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/)
      .optional(),
    holder: z.string().trim().max(70).optional(),
    wero: z.string().trim().max(120).optional(),
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

/** data: the bill itself changed · presence: only who of its people is online. */
export type ChangeListener = (billId: string, kind: "data" | "presence") => void;

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
      // Older files hold just the list of bills; newer ones the settlement payments as well.
      const raw = JSON.parse(await readFile(this.file, "utf8")) as StoredBill[] | { bills: StoredBill[]; transfers?: StoredTransfer[] };
      const { bills, transfers = [] } = Array.isArray(raw) ? { bills: raw } : raw;
      const cutoff = Date.now() - RETENTION_MS;
      for (const bill of bills) {
        if (Date.parse(bill.createdAt) > cutoff) this.bills.set(bill.id, bill);
      }
      for (const t of transfers) {
        if (Date.parse(t.createdAt) > cutoff) this.transfers.set(t.id, t);
      }
      await this.removeOrphanImages();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected override changed(billId: string): void {
    for (const l of this.listeners) l(billId, "data");
    this.scheduleSave();
  }

  // ───── presence: who has the app open (an open event stream) ─────
  private online = new Set<string>();

  protected override isOnline(participantId: string): boolean {
    return this.online.has(participantId);
  }

  /** Marks a participant on- or offline; their bills' viewers get the new head count. */
  setOnline(participantId: string, online: boolean): void {
    if (this.online.has(participantId) === online) return;
    if (online) this.online.add(participantId);
    else this.online.delete(participantId);
    for (const billId of this.billsOf(participantId)) for (const l of this.listeners) l(billId, "presence");
  }

  protected override transfersChanged(): void {
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
    await writeFile(tmp, JSON.stringify({ bills: [...this.bills.values()], transfers: [...this.transfers.values()] }));
    await rename(tmp, this.file);
  }

  /** Receipt photos live next to the bills file; without a file (tests) in memory. */
  private images = new Map<string, Buffer>();

  private imagePath(billId: string): string | null {
    return this.file ? path.join(path.dirname(this.file), "receipts", `${billId}.jpg`) : null;
  }

  async setReceiptImage(billId: string, requesterId: string, jpeg: Buffer): Promise<void> {
    this.assertOwner(billId, requesterId);
    const file = this.imagePath(billId);
    if (file) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, jpeg);
    } else {
      this.images.set(billId, jpeg);
    }
    this.markReceiptImage(billId, requesterId);
  }

  async receiptImage(billId: string): Promise<Buffer | null> {
    if (!this.has(billId)) return null;
    const file = this.imagePath(billId);
    if (!file) return this.images.get(billId) ?? null;
    return readFile(file).catch(() => null);
  }

  /** Deletes photos of bills that expired or no longer exist. */
  private async removeOrphanImages(): Promise<void> {
    if (!this.file) return;
    const dir = path.join(path.dirname(this.file), "receipts");
    const names = await readdir(dir).catch(() => [] as string[]);
    for (const name of names) {
      if (!this.has(name.replace(/\.jpg$/, ""))) await unlink(path.join(dir, name)).catch(() => {});
    }
  }

  createBill(data: BillData, ownerId: string, ownerName: string): string {
    return this.create(randomBytes(9).toString("base64url"), data, ownerId, ownerName);
  }
}
