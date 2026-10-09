import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  participantShare,
  sanitizeClaims,
  type BillData,
  type BillSnapshot,
  type Debtor,
  type ItemClaims,
  type PublicParticipant,
} from "../src/lib/bill.ts";

/** Bills are deleted this long after creation. */
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

export class StoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const name = z.string().trim().min(1).max(40);

export const BillDataSchema = z.object({
  title: z.string().trim().max(80),
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  tipPercent: z.number().min(0).max(100),
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

export const ParticipantNameSchema = name;

interface StoredParticipant {
  name: string;
  joinedAt: string;
  claims: ItemClaims;
  payClickedAt?: string;
  payAmount?: number;
  received?: boolean;
}

interface StoredBill {
  id: string;
  createdAt: string;
  ownerId: string;
  data: BillData;
  /** Insertion order is join order. */
  participants: Record<string, StoredParticipant>;
}

/**
 * Devices identify themselves with a random secret key. Only its hash is used as
 * participant id, so ids can be shown to everyone without letting others act as them.
 */
export function participantIdFromKey(key: string): string {
  return createHash("sha256").update(key).digest("base64url").slice(0, 16);
}

function newBillId(): string {
  return randomBytes(9).toString("base64url");
}

export type ChangeListener = (billId: string) => void;

export class BillStore {
  private bills = new Map<string, StoredBill>();
  private listeners = new Set<ChangeListener>();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string | null) {}

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

  private changed(billId: string): void {
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

  private get(billId: string): StoredBill {
    const bill = this.bills.get(billId);
    if (!bill) throw new StoreError("Diese Rechnung gibt es nicht (mehr).", 404);
    return bill;
  }

  private participant(bill: StoredBill, participantId: string): StoredParticipant {
    const p = bill.participants[participantId];
    if (!p) throw new StoreError("Du nimmst an dieser Rechnung noch nicht teil.", 403);
    return p;
  }

  create(data: BillData, ownerId: string, ownerName: string): string {
    const id = newBillId();
    const now = new Date().toISOString();
    this.bills.set(id, {
      id,
      createdAt: now,
      ownerId,
      data,
      participants: { [ownerId]: { name: ownerName, joinedAt: now, claims: {} } },
    });
    this.changed(id);
    return id;
  }

  /** Scanning the QR code joins the bill; the friend then shows up as debtor for the payer. */
  join(billId: string, participantId: string, participantName: string): void {
    const bill = this.get(billId);
    const existing = bill.participants[participantId];
    if (existing) {
      if (existing.name === participantName) return;
      existing.name = participantName;
    } else {
      bill.participants[participantId] = { name: participantName, joinedAt: new Date().toISOString(), claims: {} };
    }
    this.changed(billId);
  }

  setClaims(billId: string, participantId: string, claims: ItemClaims): void {
    const bill = this.get(billId);
    const p = this.participant(bill, participantId);
    p.claims = sanitizeClaims(claims, bill.data.items);
    this.changed(billId);
  }

  /** Records that a friend tapped "Bezahlen" and with which amount; returns that amount. */
  recordPayClick(billId: string, participantId: string): number {
    const bill = this.get(billId);
    if (participantId === bill.ownerId) throw new StoreError("Du hast die Rechnung selbst bezahlt.", 400);
    const p = this.participant(bill, participantId);
    const amount = participantShare(bill.data, this.publicParticipants(bill), participantId).total;
    p.payClickedAt = new Date().toISOString();
    p.payAmount = amount;
    this.changed(billId);
    return amount;
  }

  setReceived(billId: string, requesterId: string, debtorId: string, received: boolean): void {
    const bill = this.get(billId);
    if (requesterId !== bill.ownerId) throw new StoreError("Nur wer die Rechnung bezahlt hat, kann Zahlungseingänge abhaken.", 403);
    this.participant(bill, debtorId).received = received;
    this.changed(billId);
  }

  updateData(billId: string, requesterId: string, data: BillData): void {
    const bill = this.get(billId);
    if (requesterId !== bill.ownerId) throw new StoreError("Nur wer die Rechnung bezahlt hat, kann sie bearbeiten.", 403);
    bill.data = data;
    for (const p of Object.values(bill.participants)) p.claims = sanitizeClaims(p.claims, data.items);
    this.changed(billId);
  }

  private publicParticipants(bill: StoredBill): PublicParticipant[] {
    return Object.entries(bill.participants).map(([id, p]) => ({
      id,
      name: p.name,
      isOwner: id === bill.ownerId,
      claims: p.claims,
    }));
  }

  has(billId: string): boolean {
    return this.bills.has(billId);
  }

  /** The bill as seen by one device. Payment details of friends are only visible to the payer. */
  snapshot(billId: string, viewerId: string | null): BillSnapshot {
    const bill = this.get(billId);
    const participants = this.publicParticipants(bill);
    const isOwner = viewerId === bill.ownerId;
    const me = viewerId && bill.participants[viewerId] ? viewerId : null;
    const snap: BillSnapshot = {
      id: bill.id,
      createdAt: bill.createdAt,
      data: bill.data,
      ownerName: bill.participants[bill.ownerId]?.name ?? "",
      participants,
      me,
      isOwner,
    };
    if (me && !isOwner) {
      const p = bill.participants[me];
      if (p.payClickedAt && p.payAmount !== undefined) snap.myPayment = { at: p.payClickedAt, amount: p.payAmount };
    }
    if (isOwner) {
      snap.debtors = Object.entries(bill.participants)
        .filter(([id]) => id !== bill.ownerId)
        .map(
          ([id, p]): Debtor => ({
            id,
            name: p.name,
            joinedAt: p.joinedAt,
            amount: participantShare(bill.data, participants, id).total,
            payClickedAt: p.payClickedAt,
            payAmount: p.payAmount,
            received: Boolean(p.received),
          }),
        );
    }
    return snap;
  }
}
