import {
  compactClaims,
  openShare,
  participantShare,
  sanitizeClaims,
  sanitizeSplits,
  type BillData,
  type ClaimsInput,
  type BillSnapshot,
  type Debtor,
  type ItemClaims,
  type NetworkEdge,
  type PublicParticipant,
  type ShareCredit,
  type Transfer,
  type TransferAllocation,
} from "./bill";
import { formatMoney } from "./money";

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

/** A settlement payment as stored: names and titles are looked up when it is shown. */
export interface StoredTransfer extends Omit<Transfer, "allocations"> {
  allocations: TransferAllocation[];
}

export interface TransferInput {
  toId: string;
  /** Who paid; the viewer unless the recipient records a payment they received (it is confirmed then). */
  fromId?: string;
  amount: number;
  currency: string;
  allocations: TransferAllocation[];
}

const MAX_ALLOCATIONS = 200;

/** A message for one person's devices (sent as a push notification by the server). */
export interface Notice {
  title: string;
  body: string;
  /** Where tapping it leads, as an app route (e.g. "/dashboard"). */
  path: string;
}

export class BillCore {
  protected bills = new Map<string, StoredBill>();
  protected transfers = new Map<string, StoredTransfer>();

  /** Called after every change; subclasses persist and notify subscribers. */
  protected changed(_billId: string): void {}

  /** Called after a settlement payment was created or decided (in addition to `changed` for its bills). */
  protected transfersChanged(): void {}

  /** Tells a participant about something that needs them (the server sends it as a push notification). */
  protected notify(_participantId: string, _notice: Notice): void {}

  /** Whether a participant has the app open right now (the server tracks open connections). */
  protected isOnline(_participantId: string): boolean {
    return false;
  }

  /** Whether the participant takes part in the bill (payer or friend). */
  participates(billId: string, participantId: string): boolean {
    return Boolean(this.bills.get(billId)?.participants[participantId]);
  }

  /** Ids of the bills a participant takes part in. */
  billsOf(participantId: string): string[] {
    return [...this.bills.values()].filter((b) => b.participants[participantId]).map((b) => b.id);
  }

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
    const before = p.markedPaidAt;
    p.markedPaidAt = paid ? new Date().toISOString() : undefined;
    this.changed(billId);
    if (paid && !before) {
      const amount = p.payAmount ?? participantShare(bill.data, this.publicParticipants(bill), participantId).total;
      this.notify(bill.ownerId, {
        title: `${p.name} hat bezahlt`,
        body: `${formatMoney(amount, bill.data.currency)} für „${bill.data.title}“ – bitte prüfe den Eingang.`,
        path: `/b/${billId}`,
      });
    }
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

  // ───────────── settlement payments (see Transfer) ─────────────

  /** What settlement payments (waiting or confirmed) covered of a participant's share in a bill. */
  protected credit(billId: string, participantId: string): ShareCredit {
    const credit: ShareCredit = { confirmed: 0, pending: 0, notes: [] };
    for (const t of this.transfers.values()) {
      if (t.status !== "pending" && t.status !== "confirmed") continue;
      for (const a of t.allocations) {
        if (a.billId !== billId || a.debtorId !== participantId) continue;
        if (t.status === "confirmed") credit.confirmed += a.amount;
        else credit.pending += a.amount;
        const money = formatMoney(a.amount, t.currency);
        const how = t.amount === 0 ? `gegenseitig verrechnet (${t.fromName} ↔ ${t.toName})` : `per Ausgleich ${t.fromName} → ${t.toName}`;
        credit.notes.push(`${money} ${how}${t.status === "pending" ? ` (wartet auf Bestätigung von ${t.toName})` : " ✓"}`);
      }
    }
    return credit;
  }

  private debtorCredit(billId: string, participantId: string): Pick<Debtor, "credited" | "creditPending" | "creditNotes"> {
    const c = this.credit(billId, participantId);
    return c.notes.length ? { credited: c.confirmed, creditPending: c.pending, creditNotes: c.notes } : {};
  }

  /** Open part of a participant's share (after payments, confirmations and settlement payments). */
  private openOf(bill: StoredBill, participantId: string): number {
    const p = bill.participants[participantId];
    if (!p || participantId === bill.ownerId) return 0;
    const share = participantShare(bill.data, this.publicParticipants(bill), participantId).total;
    const c = this.credit(bill.id, participantId);
    return openShare(share, p, c.confirmed + c.pending);
  }

  /** Open shares in all bills the viewer takes part in – the basis for settling up with as few payments as possible. */
  network(viewerId: string): NetworkEdge[] {
    const edges: NetworkEdge[] = [];
    for (const id of this.bills.keys()) {
      const bill = this.get(id);
      if (!bill.participants[viewerId]) continue;
      const owner = bill.participants[bill.ownerId];
      for (const [pid, p] of Object.entries(bill.participants)) {
        const amount = this.openOf(bill, pid);
        if (amount <= 0) continue;
        edges.push({
          billId: bill.id,
          title: bill.data.title,
          createdAt: bill.createdAt,
          currency: bill.data.currency,
          debtorId: pid,
          debtorName: p.name,
          creditorId: bill.ownerId,
          creditorName: owner?.name ?? "",
          amount,
          payment: bill.data.payment,
        });
      }
    }
    return edges;
  }

  /**
   * Records a settlement payment the viewer made – or, with `fromId`, one the viewer received
   * (then it counts as confirmed right away: only the recipient confirms anyway). Every
   * allocation must be an open share in a bill the viewer takes part in, and together they must
   * leave everyone even: the payer's settled debts exceed their settled claims by exactly the
   * amount, the recipient's claims exceed their debts by it, and for everybody else both are
   * equal. An amount of 0 offsets debts that cancel out exactly; the other side confirms it.
   */
  createTransfer(viewerId: string, input: TransferInput): string {
    const { toId, amount, currency, allocations } = input;
    const fromId = input.fromId ?? viewerId;
    const received = fromId !== viewerId;
    if (received && toId !== viewerId) throw new BillError("Eintragen kannst Du nur Zahlungen an Dich.", 403);
    if (toId === fromId) throw new BillError("Du kannst Dir nicht selbst etwas zahlen.", 400);
    if (!Number.isInteger(amount) || amount < 0 || (amount === 0 && received)) throw new BillError("Ungültiger Betrag.", 400);
    if (!allocations.length || allocations.length > MAX_ALLOCATIONS) throw new BillError("Ungültige Verrechnung.", 400);

    const perShare = new Map<string, number>();
    const balance = new Map<string, number>();
    const names = new Map<string, string>();
    for (const a of allocations) {
      if (!Number.isInteger(a.amount) || a.amount <= 0) throw new BillError("Ungültiger Betrag in der Verrechnung.", 400);
      const bill = this.get(a.billId);
      if (!bill.participants[viewerId]) throw new BillError("Verrechnen lässt sich nur mit Rechnungen, an denen Du teilnimmst.", 403);
      if (bill.data.currency !== currency) throw new BillError("Die Rechnungen haben verschiedene Währungen.", 400);
      if (a.creditorId !== bill.ownerId || a.debtorId === bill.ownerId || !bill.participants[a.debtorId]) {
        throw new BillError("Ungültige Verrechnung.", 400);
      }
      const key = `${a.billId}:${a.debtorId}`;
      perShare.set(key, (perShare.get(key) ?? 0) + a.amount);
      if (perShare.get(key)! > this.openOf(bill, a.debtorId)) {
        throw new BillError("Ein Betrag hat sich inzwischen geändert. Bitte lade die Übersicht neu.", 409);
      }
      balance.set(a.debtorId, (balance.get(a.debtorId) ?? 0) + a.amount);
      balance.set(a.creditorId, (balance.get(a.creditorId) ?? 0) - a.amount);
      names.set(a.debtorId, bill.participants[a.debtorId].name);
      names.set(a.creditorId, bill.participants[a.creditorId].name);
    }
    for (const [person, value] of balance) {
      const expected = person === fromId ? amount : person === toId ? -amount : 0;
      if (value !== expected) throw new BillError("Die Verrechnung geht nicht auf.", 400);
    }
    // Both sides must be part of it (also when an offset of 0 leaves them even).
    if (!balance.has(fromId) || !balance.has(toId)) throw new BillError("Die Verrechnung geht nicht auf.", 400);

    const id = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const now = new Date().toISOString();
    const t: StoredTransfer = {
      id,
      createdAt: now,
      currency,
      fromId,
      fromName: names.get(fromId) ?? "",
      toId,
      toName: names.get(toId) ?? "",
      amount,
      allocations: allocations.map(({ billId, debtorId, creditorId, amount }) => ({ billId, debtorId, creditorId, amount })),
      status: received ? "confirmed" : "pending",
      ...(received ? { decidedAt: now, recordedByRecipient: true } : {}),
    };
    this.transfers.set(id, t);
    this.transfersTouched(id);
    const money = formatMoney(amount, currency);
    if (received) {
      this.notify(fromId, {
        title: `${t.toName} hat Deinen Ausgleich eingetragen`,
        body: `${money} als erhalten – Deine Anteile bei ${t.toName} sind beglichen.`,
        path: "/dashboard",
      });
    } else if (amount === 0) {
      this.notify(toId, {
        title: `${t.fromName} möchte gegenseitig verrechnen`,
        body: "Eure offenen Beträge gleichen sich genau aus – bitte bestätige das im Dashboard.",
        path: "/dashboard",
      });
    } else {
      this.notify(toId, {
        title: `${t.fromName} hat Dir ${money} gesendet`,
        body: "Bestätige den Eingang im Dashboard, sobald das Geld da ist.",
        path: "/dashboard",
      });
    }
    return id;
  }

  /** The recipient confirms or rejects a settlement payment; the payer can take it back while it waits. */
  decideTransfer(viewerId: string, transferId: string, action: "confirm" | "reject" | "cancel"): void {
    const t = this.transfers.get(transferId);
    if (!t) throw new BillError("Diese Ausgleichszahlung gibt es nicht (mehr).", 404);
    if (t.status !== "pending") throw new BillError("Diese Ausgleichszahlung ist schon abgeschlossen.", 409);
    if (action === "cancel" ? viewerId !== t.fromId : viewerId !== t.toId) {
      throw new BillError(action === "cancel" ? "Nur wer gezahlt hat, kann das zurückziehen." : "Nur der Empfänger kann das bestätigen.", 403);
    }
    t.status = action === "confirm" ? "confirmed" : action === "reject" ? "rejected" : "cancelled";
    t.decidedAt = new Date().toISOString();
    this.transfersTouched(transferId);
    const money = formatMoney(t.amount, t.currency);
    const offset = t.amount === 0;
    if (action === "cancel") {
      this.notify(t.toId, {
        title: offset ? `${t.fromName} hat die Verrechnung zurückgezogen` : `${t.fromName} hat die Zahlung zurückgezogen`,
        body: offset ? "Die Beträge sind wieder offen." : `${money} – die Anteile sind wieder offen.`,
        path: "/dashboard",
      });
    } else {
      this.notify(t.fromId, {
        title:
          action === "confirm"
            ? offset
              ? `${t.toName} hat die Verrechnung bestätigt ✓`
              : `${t.toName} hat ${money} erhalten ✓`
            : offset
              ? `${t.toName} hat die Verrechnung abgelehnt`
              : `${t.toName} hat ${money} nicht erhalten`,
        body: action === "confirm" ? "Die Anteile sind in allen Rechnungen beglichen." : "Die Anteile sind wieder offen.",
        path: "/dashboard",
      });
    }
  }

  /**
   * Settlement payments the viewer made, received or is part of (their share was settled),
   * newest first – with only the shares from bills the viewer takes part in: the recipient
   * learns nothing about bills between others.
   */
  listTransfers(viewerId: string): Transfer[] {
    const name = (billId: string, pid: string) => this.bills.get(billId)?.participants[pid]?.name ?? "";
    return [...this.transfers.values()]
      .filter((t) => t.fromId === viewerId || t.toId === viewerId || t.allocations.some((a) => a.debtorId === viewerId || a.creditorId === viewerId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
      .map((t) => ({
        ...t,
        allocations: t.allocations
          .filter((a) => this.bills.get(a.billId)?.participants[viewerId])
          .map((a) => ({
          ...a,
          billTitle: this.bills.get(a.billId)?.data.title ?? "Rechnung",
          debtorName: name(a.billId, a.debtorId),
          creditorName: name(a.billId, a.creditorId),
          })),
      }));
  }

  private transfersTouched(transferId: string): void {
    const t = this.transfers.get(transferId);
    for (const billId of new Set(t?.allocations.map((a) => a.billId))) if (this.bills.has(billId)) this.changed(billId);
    this.transfersChanged();
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
      online: Object.keys(bill.participants).filter((pid) => this.isOnline(pid)).length,
    };
    if (me && !isOwner) {
      const p = bill.participants[me];
      if (p.payClickedAt && p.payAmount !== undefined) {
        snap.myPayment = { at: p.payClickedAt, amount: p.payAmount, markedPaidAt: p.markedPaidAt };
      }
      if (p.received) snap.myReceived = true;
      const credit = this.credit(billId, me);
      if (credit.notes.length) snap.myCredit = credit;
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
            ...this.debtorCredit(billId, id),
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
