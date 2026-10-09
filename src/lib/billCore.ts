import {
  compactClaims,
  participantShare,
  sanitizeClaims,
  sanitizeSplits,
  type BillData,
  type ClaimsInput,
  type BillSnapshot,
  type Debtor,
  type ItemClaims,
  type PublicParticipant,
} from "./bill";

/**
 * The rules of a shared bill, independent of where it is stored. Used by the
 * Node server and by the serverless demo that keeps bills in the browser.
 */

export class BillError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface StoredParticipant {
  name: string;
  joinedAt: string;
  claims: ItemClaims;
  /** Held units offered for sharing (see PublicParticipant.splits). */
  splits?: ItemClaims;
  payClickedAt?: string;
  payAmount?: number;
  received?: boolean;
  /** The friend marked their share as paid. */
  markedPaidAt?: string;
}

export interface StoredBill {
  id: string;
  createdAt: string;
  ownerId: string;
  data: BillData;
  /** True once the photo or screenshot of the receipt was stored. */
  receiptImage?: boolean;
  /** Insertion order is join order. */
  participants: Record<string, StoredParticipant>;
}

export class BillCore {
  protected bills = new Map<string, StoredBill>();

  /** Called after every change; subclasses persist and notify subscribers. */
  protected changed(_billId: string): void {}

  protected get(billId: string): StoredBill {
    const bill = this.bills.get(billId);
    if (!bill) throw new BillError("Diese Rechnung gibt es nicht (mehr).", 404);
    upgradeClaims(bill);
    return bill;
  }

  private participant(bill: StoredBill, participantId: string): StoredParticipant {
    const p = bill.participants[participantId];
    if (!p) throw new BillError("Du nimmst an dieser Rechnung noch nicht teil.", 403);
    return p;
  }

  has(billId: string): boolean {
    return this.bills.has(billId);
  }

  create(id: string, data: BillData, ownerId: string, ownerName: string): string {
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

  /** Sets the units a participant takes; splits are those of them offered for sharing (kept when omitted). */
  setClaims(billId: string, participantId: string, claims: ClaimsInput, splits?: ClaimsInput): void {
    const bill = this.get(billId);
    const p = this.participant(bill, participantId);
    const others = Object.entries(bill.participants)
      .filter(([id]) => id !== participantId)
      .map(([, other]) => other.claims);
    p.claims = sanitizeClaims(claims, bill.data.items, p.claims, others);
    p.splits = sanitizeSplits(splits ?? p.splits ?? {}, p.claims);
    this.changed(billId);
  }

  /** Records that a friend tapped "Bezahlen" and with which amount; returns that amount. */
  recordPayClick(billId: string, participantId: string): number {
    const bill = this.get(billId);
    if (participantId === bill.ownerId) throw new BillError("Du hast die Rechnung selbst bezahlt.", 400);
    const p = this.participant(bill, participantId);
    const amount = participantShare(bill.data, this.publicParticipants(bill), participantId).total;
    p.payClickedAt = new Date().toISOString();
    p.payAmount = amount;
    this.changed(billId);
    return amount;
  }

  /** A friend marks their own share as paid (or takes it back). */
  setMarkedPaid(billId: string, participantId: string, paid: boolean): void {
    const bill = this.get(billId);
    if (participantId === bill.ownerId) throw new BillError("Du hast die Rechnung selbst bezahlt.", 400);
    const p = this.participant(bill, participantId);
    p.markedPaidAt = paid ? new Date().toISOString() : undefined;
    this.changed(billId);
  }

  setReceived(billId: string, requesterId: string, debtorId: string, received: boolean): void {
    const bill = this.get(billId);
    if (requesterId !== bill.ownerId) throw new BillError("Nur wer die Rechnung bezahlt hat, kann Zahlungseingänge abhaken.", 403);
    this.participant(bill, debtorId).received = received;
    this.changed(billId);
  }

  /** Throws unless the requester is the payer of the bill. */
  assertOwner(billId: string, requesterId: string): void {
    if (requesterId !== this.get(billId).ownerId) throw new BillError("Nur wer die Rechnung bezahlt hat, kann sie bearbeiten.", 403);
  }

  /** Records that the receipt photo was stored (the bytes are kept by the subclass). */
  markReceiptImage(billId: string, requesterId: string): void {
    this.assertOwner(billId, requesterId);
    this.get(billId).receiptImage = true;
    this.changed(billId);
  }

  updateData(billId: string, requesterId: string, data: BillData): void {
    const bill = this.get(billId);
    this.assertOwner(billId, requesterId);
    bill.data = data;
    // When a quantity was lowered, the units taken first are kept.
    const participants = Object.values(bill.participants);
    const compacted = compactClaims(
      participants.map((p) => p.claims),
      data.items,
      participants.map((p) => p.splits ?? {}),
    );
    participants.forEach((p, i) => {
      p.claims = compacted.claims[i];
      p.splits = compacted.splits[i];
    });
    this.changed(billId);
  }

  private publicParticipants(bill: StoredBill): PublicParticipant[] {
    return Object.entries(bill.participants).map(([id, p]) => ({
      id,
      name: p.name,
      isOwner: id === bill.ownerId,
      claims: p.claims,
      splits: p.splits ?? {},
    }));
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
      hasReceiptImage: Boolean(bill.receiptImage),
    };
    if (me && !isOwner) {
      const p = bill.participants[me];
      if (p.payClickedAt && p.payAmount !== undefined) {
        snap.myPayment = { at: p.payClickedAt, amount: p.payAmount, markedPaidAt: p.markedPaidAt };
      }
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
            markedPaidAt: p.markedPaidAt,
          }),
        );
    }
    return snap;
  }
}

/** Bills stored before units were tracked individually hold plain unit counts; turn them into slots. */
function upgradeClaims(bill: StoredBill): void {
  const participants = Object.values(bill.participants);
  const legacy = (c: Record<string, unknown>) => Object.values(c).some((v) => !Array.isArray(v));
  if (!participants.some((p) => legacy(p.claims))) return;
  const done: ItemClaims[] = [];
  for (const p of participants) {
    p.claims = sanitizeClaims(p.claims as ClaimsInput, bill.data.items, {}, done);
    done.push(p.claims);
  }
}
