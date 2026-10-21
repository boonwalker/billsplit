import { fill, msg, type Msg, type Vars } from "../i18n";
import {
  billTotal,
  compactClaims,
  openShare,
  overpaidShare,
  participantShare,
  sanitizeClaims,
  sanitizeSplits,
  type BillData,
  type ClaimsInput,
  type Contact,
  type BillSnapshot,
  type Debtor,
  type ItemClaims,
  type MyBill,
  type NetworkEdge,
  type PublicParticipant,
  type ShareCredit,
  type Transfer,
  type TransferAllocation,
} from "./bill";

/** One bill in brief, for the admin page (see BillCore.summaries). */
export interface BillSummary {
  id: string;
  title: string;
  createdAt: string;
  currency: string;
  total: number;
  ownerId: string;
  participants: { id: string; name: string; joinedAt: string; paid: boolean }[];
}

/**
 * The rules of a shared bill, independent of where it is stored. Used by the
 * Node server and by the serverless demo that keeps bills in the browser.
 */

/** A refused request; `template` and `vars` let the server answer in the reader's language. */
export class BillError extends Error {
  readonly template: string;
  constructor(
    message: string,
    readonly status: number,
    readonly vars?: Vars,
  ) {
    super(fill(message, vars, "de-DE"));
    this.template = message;
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
  /** What was open when the payer ticked "erhalten" without a pay click (see PaidState). */
  receivedAmount?: number;
  /** The friend marked their share as paid. */
  markedPaidAt?: string;
  /** Last reminder the payer sent as a notification (at most one every REMIND_COOLDOWN_MS). */
  remindedAt?: string;
  /** The payer put them in ("Ausgabe zuweisen" → directly to Andy), they did not scan the QR code. */
  assigned?: boolean;
}

/** The name of someone whose data was erased (stored data, never translated). */
export const ERASED_NAME = "Gelöscht";

/** A friend gets at most one reminder notification per bill in this time. */
export const REMIND_COOLDOWN_MS = 12 * 60 * 60 * 1000;

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
  /** Texts to translate into each recipient's language (see push.ts). */
  title: Msg;
  body: Msg;
  /** Where tapping it leads, as an app route (e.g. "/dashboard"). */
  path: string;
}

export class BillCore {
  protected bills = new Map<string, StoredBill>();
  protected transfers = new Map<string, StoredTransfer>();

  /** Called after every change; subclasses persist and notify subscribers. */
  protected changed(_billId: string): void {}

  /** Called after a settlement payment was created or decided (in addition to `changed` for its bills). */
  protected transfersChanged(_transferId: string): void {}

  /** Tells a participant about something that needs them (the server sends it as a push notification). */
  protected notify(_participantId: string, _notice: Notice): void {}

  /** Whether notifications reach a participant (the server knows their push subscriptions). */
  protected canNotify(_participantId: string): boolean {
    return false;
  }

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

  /** The name a participant used most recently (to take it over on another device). */
  nameOf(participantId: string): string | null {
    const bills = [...this.bills.values()].filter((b) => b.participants[participantId]);
    bills.sort((a, b) => b.participants[participantId].joinedAt.localeCompare(a.participants[participantId].joinedAt));
    return bills[0]?.participants[participantId].name ?? null;
  }

  /**
   * Erasing a person's data on request (admin page): their name becomes ERASED_NAME in every bill
   * and settlement payment, the payment details of bills they paid are removed. Amounts, ticks and
   * payments stay – the others' bills must still add up. Returns the bills they paid.
   */
  anonymize(participantId: string): string[] {
    const owned: string[] = [];
    for (const [billId, bill] of this.bills) {
      const p = bill.participants[participantId];
      if (!p) continue;
      p.name = ERASED_NAME;
      if (bill.ownerId === participantId) {
        bill.data = { ...bill.data, payment: {} };
        owned.push(billId);
      }
      this.changed(billId);
    }
    for (const t of this.transfers.values()) {
      if (t.fromId !== participantId && t.toId !== participantId) continue;
      if (t.fromId === participantId) t.fromName = ERASED_NAME;
      if (t.toId === participantId) t.toName = ERASED_NAME;
      this.transfersChanged(t.id);
    }
    return owned;
  }

  /**
   * Removes a bill as if it had never existed (admin page). Settlement payments lose its shares
   * and their amount shrinks by them; one that no longer adds up without them (it passed money
   * on between other people) is dropped as a whole. Returns everyone whose bills or balances changed.
   */
  removeBill(billId: string): { people: string[]; adjusted: number; dropped: number } {
    const bill = this.get(billId);
    const people = new Set(Object.keys(bill.participants));
    const others = new Set<string>();
    let adjusted = 0;
    let dropped = 0;
    for (const t of [...this.transfers.values()]) {
      if (!t.allocations.some((a) => a.billId === billId)) continue;
      people.add(t.fromId).add(t.toId);
      const rest = t.allocations.filter((a) => a.billId !== billId);
      const balance = new Map<string, number>();
      for (const a of rest) {
        balance.set(a.debtorId, (balance.get(a.debtorId) ?? 0) + a.amount);
        balance.set(a.creditorId, (balance.get(a.creditorId) ?? 0) - a.amount);
        people.add(a.debtorId).add(a.creditorId);
        others.add(a.billId);
      }
      // The same rule as in createTransfer: the payer gains what the recipient loses, nobody else anything.
      const amount = balance.get(t.fromId) ?? 0;
      const addsUp =
        amount >= 0 &&
        balance.has(t.fromId) &&
        balance.has(t.toId) &&
        [...balance].every(([person, value]) => value === (person === t.fromId ? amount : person === t.toId ? -amount : 0));
      if (addsUp) {
        t.allocations = rest;
        t.amount = amount;
        adjusted++;
      } else {
        this.transfers.delete(t.id);
        dropped++;
      }
      this.transfersChanged(t.id);
    }
    this.bills.delete(billId);
    this.changed(billId);
    for (const id of others) if (this.bills.has(id)) this.changed(id);
    return { people: [...people], adjusted, dropped };
  }

  /**
   * One person, two identities: on the iPhone, Safari and the home-screen app keep separate
   * keys. Moves everything `fromId` did (joined bills, ticked units, payments, settlement
   * payments) over to `intoId`. Where both are in the same bill, the units and marks are combined.
   * With `ownership: false` (Safari → app, proven only by a one-time code) the bills `fromId`
   * paid stay theirs – a leaked code must never make someone else the payer. Returns the bills
   * that changed.
   */
  mergeParticipant(fromId: string, intoId: string, { ownership = true }: { ownership?: boolean } = {}): string[] {
    if (fromId === intoId) return [];
    const kept = new Set(
      this.billsOf(fromId).filter((id) => {
        const bill = this.get(id);
        // The payer and a friend of the same bill are always two people (e.g. a test phone that
        // joined as a friend, then signed in to the payer's account): never one entry.
        if (bill.participants[intoId] && (bill.ownerId === fromId || bill.ownerId === intoId)) return true;
        return !ownership && bill.ownerId === fromId;
      }),
    );
    const union = (a: ItemClaims = {}, b: ItemClaims = {}) => {
      const out: ItemClaims = { ...a };
      for (const [item, slots] of Object.entries(b)) out[item] = [...new Set([...(out[item] ?? []), ...slots])].sort((x, y) => x - y);
      return out;
    };
    const changed: string[] = [];
    for (const id of this.billsOf(fromId)) {
      if (kept.has(id)) continue;
      const bill = this.get(id);
      const from = bill.participants[fromId];
      const into = bill.participants[intoId];
      const merged: StoredParticipant = into
        ? {
            ...from,
            ...into,
            claims: union(into.claims, from.claims),
            splits: union(into.splits, from.splits),
            payClickedAt: into.payClickedAt ?? from.payClickedAt,
            payAmount: into.payAmount ?? from.payAmount,
            markedPaidAt: into.markedPaidAt ?? from.markedPaidAt,
            received: Boolean(into.received || from.received) || undefined,
          }
        : from;
      // Keep the join order: the merged person takes the earlier of the two places.
      const participants: Record<string, StoredParticipant> = {};
      for (const [pid, p] of Object.entries(bill.participants)) {
        if (pid === fromId || pid === intoId) {
          if (!participants[intoId]) participants[intoId] = merged;
        } else participants[pid] = p;
      }
      bill.participants = participants;
      if (bill.ownerId === fromId) bill.ownerId = intoId;
      changed.push(id);
      this.changed(id);
    }
    for (const t of this.transfers.values()) {
      const touches = t.fromId === fromId || t.toId === fromId || t.allocations.some((a) => a.debtorId === fromId || a.creditorId === fromId);
      // Payments that settle shares in bills staying with `fromId` stay theirs as well.
      if (!touches || t.allocations.some((a) => kept.has(a.billId))) continue;
      if (t.fromId === fromId) t.fromId = intoId;
      if (t.toId === fromId) t.toId = intoId;
      for (const a of t.allocations) {
        if (a.debtorId === fromId) a.debtorId = intoId;
        if (a.creditorId === fromId) a.creditorId = intoId;
      }
      this.transfersChanged(t.id);
    }
    return changed;
  }

  /** For the admin page: every bill in brief – who took part and whether they paid, no items or payment details. */
  summaries(): BillSummary[] {
    return [...this.bills.values()].map((b) => ({
      id: b.id,
      title: b.data.title,
      createdAt: b.createdAt,
      currency: b.data.currency,
      total: billTotal(b.data),
      ownerId: b.ownerId,
      participants: Object.entries(b.participants).map(([id, p]) => ({
        id,
        name: p.name,
        joinedAt: p.joinedAt,
        paid: Boolean(p.received || p.markedPaidAt),
      })),
    }));
  }

  /** The bills a participant takes part in, newest first (to rebuild the list on a new device). */
  myBills(participantId: string): MyBill[] {
    return [...this.bills.values()]
      .filter((b) => b.participants[participantId])
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((b) => ({
        id: b.id,
        title: b.data.title,
        createdAt: b.createdAt,
        role: b.ownerId === participantId ? "owner" : "guest",
        currency: b.data.currency,
      }));
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
    // Ticking themselves: a participant of their own now, no longer just assigned by the payer.
    delete p.assigned;
    p.splits = sanitizeSplits(splits ?? p.splits ?? {}, p.claims);
    this.changed(billId);
  }

  /** People the viewer shares bills with – most bills, then most recent first (for "Ausgabe zuweisen"). */
  contacts(viewerId: string, limit = 12): Contact[] {
    const found = new Map<string, Contact>();
    for (const bill of this.bills.values()) {
      if (!bill.participants[viewerId]) continue;
      for (const [pid, p] of Object.entries(bill.participants)) {
        if (pid === viewerId) continue;
        const c = found.get(pid) ?? { id: pid, name: p.name, bills: 0, lastAt: "" };
        c.bills++;
        if (bill.createdAt > c.lastAt) {
          c.lastAt = bill.createdAt;
          c.name = p.name;
        }
        found.set(pid, c);
      }
    }
    return [...found.values()].sort((a, b) => b.bills - a.bills || b.lastAt.localeCompare(a.lastAt)).slice(0, limit);
  }

  /**
   * The payer assigns items straight to people they know from earlier bills (a taxi for Andy, or
   * shared with Andy) – they join the bill with those units and get a notification. Only people
   * who share a bill with the payer; the payer's own units can be part of it.
   */
  assign(billId: string, requesterId: string, people: { id: string; claims: ClaimsInput }[]): void {
    const bill = this.get(billId);
    this.assertOwner(billId, requesterId);
    const known = new Map(this.contacts(requesterId, Infinity).map((c) => [c.id, c]));
    for (const { id } of people) {
      if (id !== requesterId && !known.has(id)) throw new BillError("Diese Person kennst Du noch aus keiner Rechnung.", 403);
    }
    const added: string[] = [];
    for (const { id, claims } of people) {
      if (!bill.participants[id]) {
        bill.participants[id] = { name: known.get(id)!.name, joinedAt: new Date().toISOString(), claims: {}, ...(id === requesterId ? {} : { assigned: true }) };
        added.push(id);
      }
      const others = Object.entries(bill.participants)
        .filter(([pid]) => pid !== id)
        .map(([, p]) => p.claims);
      bill.participants[id].claims = sanitizeClaims(claims, bill.data.items, bill.participants[id].claims, others);
      // Taken back before anything happened: they leave the bill again, as if never assigned.
      if (this.untouchedAssignee(billId, id)) {
        delete bill.participants[id];
        if (added.includes(id)) added.splice(added.indexOf(id), 1);
      }
    }
    this.changed(billId);
    const from = bill.participants[bill.ownerId]?.name ?? "";
    const participants = this.publicParticipants(bill);
    for (const id of added) {
      const amount = participantShare(bill.data, participants, id).total;
      this.notify(id, {
        title: msg("{name} hat Dir {amount} zugeordnet", { name: from, amount: { cents: amount, currency: bill.data.currency } }),
        body: msg("Für „{title}“ – hier kannst Du direkt begleichen.", { title: bill.data.title }),
        path: `/b/${billId}?an=${id}`,
      });
    }
  }

  /**
   * Put in by the payer only (not scanned, nothing ticked themselves), with nothing assigned
   * any more and no payment of any kind: they can leave the bill without a trace.
   */
  private untouchedAssignee(billId: string, participantId: string): boolean {
    const p = this.bills.get(billId)?.participants[participantId];
    if (!p?.assigned || Object.keys(p.claims).length > 0) return false;
    if (p.payClickedAt || p.markedPaidAt || p.received) return false;
    for (const t of this.transfers.values()) {
      if (t.allocations.some((a) => a.billId === billId && (a.debtorId === participantId || a.creditorId === participantId))) return false;
    }
    return true;
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
        title: msg("{name} hat bezahlt", { name: p.name }),
        body: msg("{amount} für „{title}“ – bitte prüfe den Eingang.", { amount: { cents: amount, currency: bill.data.currency }, title: bill.data.title }),
        // Straight to that friend in the list below the receipt, to check the money and tick "erhalten".
        path: `/b/${billId}?an=${participantId}`,
      });
    }
  }

  setReceived(billId: string, requesterId: string, debtorId: string, received: boolean): void {
    const bill = this.get(billId);
    if (requesterId !== bill.ownerId) throw new BillError("Nur wer die Rechnung bezahlt hat, kann Zahlungseingänge abhaken.", 403);
    const p = this.participant(bill, debtorId);
    // Without a pay click the amount is what is open now – so a later change shows what was paid.
    if (received && !p.received && p.payAmount === undefined) p.receivedAmount = this.openOf(bill, debtorId);
    if (!received) delete p.receivedAmount;
    p.received = received;
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
        const vars = { money: { cents: a.amount, currency: t.currency }, from: t.fromName, to: t.toName };
        const pending = t.status === "pending";
        credit.notes.push(
          t.amount === 0
            ? pending
              ? msg("{money} gegenseitig verrechnet ({from} ↔ {to}) (wartet auf Bestätigung von {to})", vars)
              : msg("{money} gegenseitig verrechnet ({from} ↔ {to}) ✓", vars)
            : pending
              ? msg("{money} per Ausgleich {from} → {to} (wartet auf Bestätigung von {to})", vars)
              : msg("{money} per Ausgleich {from} → {to} ✓", vars),
        );
      }
    }
    return credit;
  }

  private debtorCredit(billId: string, participantId: string): Pick<Debtor, "credited" | "creditPending" | "creditNotes"> {
    const c = this.credit(billId, participantId);
    return c.notes.length ? { credited: c.confirmed, creditPending: c.pending, creditNotes: c.notes } : {};
  }

  /**
   * What the payer owes a friend back: they paid more than their share is now (the payer
   * changed the bill afterwards), less what settlement payments already paid back.
   */
  refundOf(bill: StoredBill, participantId: string): number {
    const p = bill.participants[participantId];
    if (!p || participantId === bill.ownerId) return 0;
    const share = participantShare(bill.data, this.publicParticipants(bill), participantId).total;
    const c = this.credit(bill.id, participantId);
    let repaid = 0;
    for (const t of this.transfers.values()) {
      if (t.status !== "pending" && t.status !== "confirmed") continue;
      for (const a of t.allocations) {
        if (a.billId === bill.id && a.debtorId === bill.ownerId && a.creditorId === participantId) repaid += a.amount;
      }
    }
    return Math.max(0, overpaidShare(share, p, c.confirmed + c.pending) - repaid);
  }

  /** Open part of a participant's share (after payments, confirmations and settlement payments). */
  private openOf(bill: StoredBill, participantId: string): number {
    const p = bill.participants[participantId];
    if (!p || participantId === bill.ownerId) return 0;
    const share = participantShare(bill.data, this.publicParticipants(bill), participantId).total;
    const c = this.credit(bill.id, participantId);
    return openShare(share, p, c.confirmed + c.pending);
  }

  /**
   * "Erinnern" as a notification: the payer reminds a friend of their open share – or, when
   * they have not ticked anything yet, to tick what they had. Only for friends notifications
   * reach, at most once per REMIND_COOLDOWN_MS (the app falls back to WhatsApp otherwise).
   */
  remind(billId: string, requesterId: string, debtorId: string, now = Date.now()): void {
    const bill = this.get(billId);
    this.assertOwner(billId, requesterId);
    if (debtorId === bill.ownerId) throw new BillError("Du kannst Dich nicht selbst erinnern.", 400);
    const p = this.participant(bill, debtorId);
    if (p.received || p.markedPaidAt) throw new BillError("{name} hat schon bezahlt.", 409, { name: p.name });
    const open = this.openOf(bill, debtorId);
    const ticked = participantShare(bill.data, this.publicParticipants(bill), debtorId).total > 0;
    if (ticked && open <= 0) throw new BillError("Bei {name} ist nichts mehr offen.", 409, { name: p.name });
    this.assertRemindable(debtorId, [p], now);
    const from = bill.participants[bill.ownerId]?.name ?? "";
    this.notify(debtorId, {
      title: msg("{name} erinnert Dich", { name: from }),
      body: ticked
        ? msg("Für „{title}“ sind bei Dir noch {amount} offen.", { title: bill.data.title, amount: { cents: open, currency: bill.data.currency } })
        : msg("Bitte hake in „{title}“ ab, was Du hattest.", { title: bill.data.title }),
      // Straight to their own share, with the pay button.
      path: `/b/${billId}?an=${debtorId}`,
    });
    p.remindedAt = new Date(now).toISOString();
    this.changed(billId);
  }

  /** "Erinnern" in the dashboard: one notification about everything a person still owes the requester. */
  remindPerson(requesterId: string, personId: string, now = Date.now()): void {
    const edges = this.network(requesterId).filter((e) => e.creditorId === requesterId && e.debtorId === personId);
    if (!edges.length) throw new BillError("Bei dieser Person ist nichts offen.", 409);
    const shares = edges.map((e) => this.participant(this.get(e.billId), personId));
    this.assertRemindable(personId, shares, now);
    const totals = new Map<string, number>();
    for (const e of edges) totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount);
    // "9,50 € und 12,00 $" when the bills have different currencies.
    const amounts = [...totals]
      .map(([currency, cents]) => msg("{amount}", { amount: { cents, currency } }))
      .reduce((all, next) => msg("{first} und {next}", { first: all, next }));
    const from = this.get(edges[0].billId).participants[requesterId]?.name ?? "";
    this.notify(personId, {
      title: msg("{name} erinnert Dich", { name: from }),
      body:
        edges.length === 1
          ? msg("Für „{title}“ sind bei Dir noch {amount} offen.", { title: edges[0].title, amount: amounts })
          : msg("Bei Dir sind noch {amount} aus {count} Rechnungen offen.", { amount: amounts, count: edges.length }),
      path: edges.length === 1 ? `/b/${edges[0].billId}?an=${personId}` : "/dashboard",
    });
    const at = new Date(now).toISOString();
    for (const p of shares) p.remindedAt = at;
    for (const e of edges) this.changed(e.billId);
  }

  /** People in the requester's bills whom notifications reach, and when each was last reminded. */
  reminderStatus(requesterId: string): { reachable: string[]; remindedAt: Record<string, string> } {
    const reachable = new Set<string>();
    const remindedAt: Record<string, string> = {};
    for (const bill of this.bills.values()) {
      if (bill.ownerId !== requesterId) continue;
      for (const [pid, p] of Object.entries(bill.participants)) {
        if (pid === requesterId) continue;
        if (this.canNotify(pid)) reachable.add(pid);
        if (p.remindedAt && (!remindedAt[pid] || p.remindedAt > remindedAt[pid])) remindedAt[pid] = p.remindedAt;
      }
    }
    return { reachable: [...reachable], remindedAt };
  }

  private assertRemindable(participantId: string, shares: StoredParticipant[], now: number): void {
    if (!this.canNotify(participantId)) throw new BillError("Diese Person hat keine Benachrichtigungen eingeschaltet.", 409);
    if (shares.some((p) => p.remindedAt && now - Date.parse(p.remindedAt) < REMIND_COOLDOWN_MS)) {
      throw new BillError("Du hast vor Kurzem schon erinnert.", 429);
    }
  }

  /** Open shares in all bills the viewer takes part in – the basis for settling up with as few payments as possible. */
  network(viewerId: string): NetworkEdge[] {
    const edges: NetworkEdge[] = [];
    for (const id of this.bills.keys()) {
      const bill = this.get(id);
      if (!bill.participants[viewerId]) continue;
      const owner = bill.participants[bill.ownerId];
      for (const [pid, p] of Object.entries(bill.participants)) {
        // Paid too much: the payer owes it back – the other way round.
        const refund = this.refundOf(bill, pid);
        if (refund > 0) {
          edges.push({
            billId: bill.id,
            title: bill.data.title,
            createdAt: bill.createdAt,
            currency: bill.data.currency,
            debtorId: bill.ownerId,
            debtorName: owner?.name ?? "",
            creditorId: pid,
            creditorName: p.name,
            amount: refund,
            payment: {},
          });
        }
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
      // A share the payer is owed – or money the payer owes back (see refundOf).
      const refund = a.debtorId === bill.ownerId;
      const friend = refund ? a.creditorId : a.debtorId;
      if ((refund ? a.debtorId !== bill.ownerId : a.creditorId !== bill.ownerId) || friend === bill.ownerId || !bill.participants[friend]) {
        throw new BillError("Ungültige Verrechnung.", 400);
      }
      const key = `${a.billId}:${a.debtorId}:${a.creditorId}`;
      perShare.set(key, (perShare.get(key) ?? 0) + a.amount);
      if (perShare.get(key)! > (refund ? this.refundOf(bill, friend) : this.openOf(bill, a.debtorId))) {
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
    const money = { cents: amount, currency };
    if (received) {
      this.notify(fromId, {
        title: msg("{name} hat Deinen Ausgleich eingetragen", { name: t.toName }),
        body: msg("{amount} als erhalten – Deine Anteile bei {name} sind beglichen.", { amount: money, name: t.toName }),
        path: `/dashboard?zahlung=${id}`,
      });
    } else if (amount === 0) {
      this.notify(toId, {
        title: msg("{name} möchte gegenseitig verrechnen", { name: t.fromName }),
        body: msg("Eure offenen Beträge gleichen sich genau aus – bitte bestätige das im Dashboard."),
        path: `/dashboard?zahlung=${id}`,
      });
    } else {
      this.notify(toId, {
        title: msg("{name} hat Dir {amount} gesendet", { name: t.fromName, amount: money }),
        body: msg("Bestätige den Eingang im Dashboard, sobald das Geld da ist."),
        path: `/dashboard?zahlung=${id}`,
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
      throw action === "cancel" ? new BillError("Nur wer gezahlt hat, kann das zurückziehen.", 403) : new BillError("Nur der Empfänger kann das bestätigen.", 403);
    }
    t.status = action === "confirm" ? "confirmed" : action === "reject" ? "rejected" : "cancelled";
    t.decidedAt = new Date().toISOString();
    this.transfersTouched(transferId);
    const money = { cents: t.amount, currency: t.currency };
    const offset = t.amount === 0;
    if (action === "cancel") {
      this.notify(t.toId, {
        title: offset
          ? msg("{name} hat die Verrechnung zurückgezogen", { name: t.fromName })
          : msg("{name} hat die Zahlung zurückgezogen", { name: t.fromName }),
        body: offset ? msg("Die Beträge sind wieder offen.") : msg("{amount} – die Anteile sind wieder offen.", { amount: money }),
        path: "/dashboard",
      });
    } else {
      this.notify(t.fromId, {
        title:
          action === "confirm"
            ? offset
              ? msg("{name} hat die Verrechnung bestätigt ✓", { name: t.toName })
              : msg("{name} hat {amount} erhalten ✓", { name: t.toName, amount: money })
            : offset
              ? msg("{name} hat die Verrechnung abgelehnt", { name: t.toName })
              : msg("{name} hat {amount} nicht erhalten", { name: t.toName, amount: money }),
        body: action === "confirm" ? msg("Die Anteile sind in allen Rechnungen beglichen.") : msg("Die Anteile sind wieder offen."),
        path: `/dashboard?zahlung=${t.id}`,
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
    this.transfersChanged(transferId);
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
      const refund = this.refundOf(bill, me);
      if (refund > 0) snap.myRefund = refund;
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
            receivedAmount: p.receivedAmount,
            markedPaidAt: p.markedPaidAt,
            refund: this.refundOf(bill, id) || undefined,
            assigned: p.assigned,
            reachable: this.canNotify(id),
            remindedAt: p.remindedAt,
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
