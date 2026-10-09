import {
  participantShare,
  sanitizeClaims,
  type BillData,
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
  payClickedAt?: string;
  payAmount?: number;
  received?: boolean;
}

export interface StoredBill {
  id: string;
  createdAt: string;
  ownerId: string;
  data: BillData;
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

  setClaims(billId: string, participantId: string, claims: ItemClaims): void {
    const bill = this.get(billId);
    const p = this.participant(bill, participantId);
    const others = Object.entries(bill.participants)
      .filter(([id]) => id !== participantId)
      .map(([, other]) => other.claims);
    p.claims = sanitizeClaims(claims, bill.data.items, others);
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

  setReceived(billId: string, requesterId: string, debtorId: string, received: boolean): void {
    const bill = this.get(billId);
    if (requesterId !== bill.ownerId) throw new BillError("Nur wer die Rechnung bezahlt hat, kann Zahlungseingänge abhaken.", 403);
    this.participant(bill, debtorId).received = received;
    this.changed(billId);
  }

  updateData(billId: string, requesterId: string, data: BillData): void {
    const bill = this.get(billId);
    if (requesterId !== bill.ownerId) throw new BillError("Nur wer die Rechnung bezahlt hat, kann sie bearbeiten.", 403);
    bill.data = data;
    // Earlier claims win when a reduced quantity no longer covers everyone.
    const kept: ItemClaims[] = [];
    for (const p of Object.values(bill.participants)) {
      p.claims = sanitizeClaims(p.claims, data.items, kept);
      kept.push(p.claims);
    }
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
