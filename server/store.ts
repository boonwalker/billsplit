import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { BillData } from "../src/lib/bill.ts";
import { BillCore, BillError, type Notice } from "../src/lib/billCore.ts";
import { dailyBackup, openPersistence, type Persistence } from "./persistence.ts";

export { BillError as StoreError };

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
  tipByShare: z.boolean().optional(),
  tipSplitCount: z.number().int().min(1).max(100).optional(),
  equalSplit: z.boolean().optional(),
  ownerExcluded: z.boolean().optional(),
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
        maybePersonal: z.boolean().optional(),
        for: z.array(z.string().min(1).max(100)).max(30).optional(),
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

/** Server-side bill store: the shared rules plus storage on disk (see persistence.ts) and change notifications. */
export class BillStore extends BillCore {
  private listeners = new Set<ChangeListener>();
  private saveTimer: NodeJS.Timeout | null = null;
  private persistence: Persistence | null = null;
  /** Bills and settlement payments changed since the last save (only those are written). */
  private dirtyBills = new Set<string>();
  private dirtyTransfers = new Set<string>();

  /** file: the bills file (`bills.json`); the database and backups go next to it. null: memory only (tests). */
  constructor(
    private readonly file: string | null,
    private readonly options: { sqlite?: boolean } = {},
  ) {
    super();
  }

  /** How the data is stored ("sqlite", "json" or "memory"). */
  get storage(): string {
    return this.persistence?.kind ?? "memory";
  }

  async load(): Promise<void> {
    if (!this.file) return;
    this.persistence = await openPersistence(this.file, this.options);
    // Bills are kept for good – no expiry (decided on 16.10.2026).
    const { bills, transfers } = await this.persistence.load();
    for (const bill of bills) this.bills.set(bill.id, bill);
    for (const t of transfers) this.transfers.set(t.id, t);
    const deleted = await readFile(this.deletedPath()!, "utf8").then((text) => JSON.parse(text) as Record<string, string>, () => ({}));
    this.deleted = new Map(Object.entries(deleted));
    await this.removeOrphanImages();
  }

  /** Today's backup in `backups/` next to the data (if there is none yet); keeps two weeks. */
  async backup(): Promise<string | null> {
    if (!this.file || !this.persistence) return null;
    await this.flush();
    return dailyBackup(this.persistence, path.join(path.dirname(this.file), "backups"));
  }

  /** How many bills are stored (for the admin page). */
  billCount(): number {
    return this.bills.size;
  }

  /** A consistent copy of all data, e.g. to download it (see the admin endpoint). */
  async exportTo(file: string): Promise<boolean> {
    if (!this.persistence) return false;
    await this.flush();
    await this.persistence.copyTo(file);
    return true;
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ───── notices for one person (the server sends them as push notifications) ─────
  private noticeListeners = new Set<(participantId: string, notice: Notice) => void>();

  onNotice(listener: (participantId: string, notice: Notice) => void): () => void {
    this.noticeListeners.add(listener);
    return () => this.noticeListeners.delete(listener);
  }

  protected override notify(participantId: string, notice: Notice): void {
    for (const l of this.noticeListeners) l(participantId, notice);
  }

  private reaches: (participantId: string) => boolean = () => false;

  /** Tells the store whom notifications reach (participants with a push subscription). */
  setReachability(check: (participantId: string) => boolean): void {
    this.reaches = check;
  }

  protected override canNotify(participantId: string): boolean {
    return this.reaches(participantId);
  }

  protected override changed(billId: string): void {
    for (const l of this.listeners) l(billId, "data");
    this.dirtyBills.add(billId);
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

  protected override transfersChanged(transferId: string): void {
    this.dirtyTransfers.add(transferId);
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush().catch((error: unknown) => console.error("Speichern fehlgeschlagen", error));
    }, 500);
  }

  async flush(): Promise<void> {
    const persistence = this.persistence;
    if (!persistence || (!this.dirtyBills.size && !this.dirtyTransfers.size)) return;
    const billIds = [...this.dirtyBills];
    const transferIds = [...this.dirtyTransfers];
    this.dirtyBills.clear();
    this.dirtyTransfers.clear();
    try {
      await persistence.save(
        {
          bills: billIds.map((id) => this.bills.get(id)).filter((b) => b !== undefined),
          removedBills: billIds.filter((id) => !this.bills.has(id)),
          transfers: transferIds.map((id) => this.transfers.get(id)).filter((t) => t !== undefined),
          removedTransfers: transferIds.filter((id) => !this.transfers.has(id)),
        },
        () => ({ bills: [...this.bills.values()], transfers: [...this.transfers.values()] }),
      );
    } catch (error) {
      // Try again with the next change (or the next flush).
      for (const id of billIds) this.dirtyBills.add(id);
      for (const id of transferIds) this.dirtyTransfers.add(id);
      throw error;
    }
  }

  close(): void {
    this.persistence?.close();
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

  /** Erases a person's data (see BillCore.anonymize) – and the receipt photos of the bills they paid. */
  async erase(participantId: string): Promise<number> {
    const owned = this.anonymize(participantId);
    for (const billId of owned) {
      const bill = this.bills.get(billId);
      if (bill) bill.receiptImage = undefined;
      this.images.delete(billId);
      const file = this.imagePath(billId);
      if (file) await unlink(file).catch(() => {});
    }
    return owned.length;
  }

  /** Bills deleted on the admin page (id → when): the app then drops them from its list, too. */
  private deleted = new Map<string, string>();

  private deletedPath(): string | null {
    return this.file ? path.join(path.dirname(this.file), "deleted-bills.json") : null;
  }

  wasDeleted(billId: string): boolean {
    return this.deleted.has(billId);
  }

  /** Deletes a bill for good (see BillCore.removeBill), with its receipt photo. */
  async deleteBill(billId: string): Promise<ReturnType<BillCore["removeBill"]>> {
    const result = this.removeBill(billId);
    // Right away (before anything is awaited): from now on every request learns it was deleted.
    this.deleted.set(billId, new Date().toISOString());
    this.images.delete(billId);
    const image = this.imagePath(billId);
    if (image) await unlink(image).catch(() => {});
    const file = this.deletedPath();
    if (file) await writeFile(file, JSON.stringify(Object.fromEntries(this.deleted)));
    await this.flush();
    return result;
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
