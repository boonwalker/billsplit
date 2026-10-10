import { tipCents, tipPersons, type TipValue } from "../components/TipControl";
import { newItemId, subtotal, type BillData, type BillFee, type BillItem } from "./bill";
import { centsToInput, parseMoney } from "./money";
import { paymentFromProfile } from "./payment";
import type { ParsedReceipt, ReceiptItem } from "./receipt";
import { loadDraft, loadProfile } from "./storage";

/**
 * The bill while it is being checked and edited (text fields as typed), and how it turns into
 * the bill data that is published. The draft is kept on the device until the bill exists.
 */

export interface Row {
  id: string;
  name: string;
  qty: string;
  total: string;
  /** Kept from the bill: crossed out by the payer (completely or some units). */
  excluded?: boolean;
  struck?: number;
}

export interface FeeRow {
  id: string;
  name: string;
  amount: string;
  /** Kept from the bill: crossed out by the payer. */
  excluded?: boolean;
}

export interface Draft {
  title: string;
  date: string;
  currency: string;
  tip: TipValue;
  /** The tip was read from the receipt, so the payer is not asked again. */
  tipOnReceipt: boolean;
  rows: Row[];
  /** Delivery, service and similar fees – shared per person like the tip. */
  fees: FeeRow[];
  /** A delivery/takeaway order: ask how many people ordered together. */
  delivery: boolean;
  receiptTotal: number | null;
  engine: "ai" | "ocr" | null;
  /** Kept from the bill when it is edited (set on the bill page). */
  equalSplit?: boolean;
  /** A supermarket receipt: ask which items are not or only partly billed. */
  supermarket?: boolean;
  /** Kept from the bill when it is edited: the payer bills some items not or only partly. */
  partial?: boolean;
  /** Kept from the bill when it is edited: the payer crossed the tip out. */
  tipExcluded?: boolean;
}

export const newFeeRow = (fee?: { id?: string; name: string; amount: number; excluded?: boolean }): FeeRow => ({
  id: fee?.id ?? newItemId(),
  name: fee?.name ?? "",
  amount: fee ? centsToInput(fee.amount) : "",
  excluded: fee?.excluded,
});

export function feeRowToFee(row: FeeRow): BillFee | null {
  const amount = parseMoney(row.amount);
  if (!row.name.trim() || amount === null || amount === 0) return null;
  return { id: row.id, name: row.name.trim(), amount, ...(row.excluded ? { excluded: true } : {}) };
}

export const draftFees = (draft: Draft): BillFee[] => draft.fees.map(feeRowToFee).filter((f): f is BillFee => f !== null);

export const newRow = (item?: ReceiptItem & { id?: string }): Row => ({
  id: item?.id ?? newItemId(),
  name: item?.name ?? "",
  qty: String(item?.qty ?? 1),
  total: item ? centsToInput(item.total) : "",
  excluded: item?.excluded,
  struck: item?.struck,
});

export function emptyDraft(): Draft {
  return {
    title: "",
    date: new Date().toISOString().slice(0, 10),
    currency: "EUR",
    tip: { mode: "percent", percent: "0", total: "", persons: "" },
    tipOnReceipt: false,
    rows: [newRow()],
    fees: [],
    delivery: false,
    receiptTotal: null,
    engine: null,
  };
}

export function draftFromData(data: BillData): Draft {
  return {
    title: data.title,
    date: data.date,
    currency: data.currency,
    tip: {
      ...(data.tipAmount
        ? { mode: "amount" as const, percent: "0", total: "", amount: centsToInput(data.tipAmount) }
        : { mode: "percent" as const, percent: String(data.tipPercent), total: "" }),
      persons: data.tipSplitCount ? String(data.tipSplitCount) : "",
    },
    tipOnReceipt: false,
    equalSplit: data.equalSplit,
    supermarket: data.supermarket,
    partial: data.partial,
    tipExcluded: data.tipExcluded,
    rows: data.items.map(newRow),
    fees: (data.fees ?? []).map(newFeeRow),
    delivery: (data.fees ?? []).length > 0,
    receiptTotal: null,
    engine: null,
  };
}

export function rowToItem(row: Row): BillItem | null {
  const total = parseMoney(row.total);
  const qty = parseInt(row.qty, 10);
  if (!row.name.trim() || total === null || !(qty >= 1)) return null;
  return {
    id: row.id,
    name: row.name.trim(),
    qty,
    total,
    ...(row.excluded ? { excluded: true } : {}),
    // A changed quantity may leave nothing to cross out partly any more.
    ...(row.struck && row.struck < qty ? { struck: row.struck } : {}),
  };
}


export function toBillData(draft: Draft, items: BillItem[]): BillData {
  const base = {
    title: draft.title.trim() || "Rechnung",
    date: draft.date,
    currency: draft.currency,
    items,
    payment: paymentFromProfile(loadProfile()),
    tipSplitCount: tipPersons(draft.tip),
    equalSplit: draft.equalSplit || undefined,
    supermarket: draft.supermarket || undefined,
    partial: draft.partial || undefined,
    tipExcluded: draft.tipExcluded || undefined,
    fees: draftFees(draft).length ? draftFees(draft) : undefined,
  };
  if (draft.tip.mode === "total" || draft.tip.mode === "amount") {
    const amount = tipCents(draft.tip, subtotal(items), (base.fees ?? []).reduce((s, f) => s + f.amount, 0));
    return { ...base, tipPercent: 0, tipAmount: amount > 0 ? amount : undefined };
  }
  return { ...base, tipPercent: Math.min(100, Math.max(0, Number(draft.tip.percent.replace(",", ".")) || 0)) };
}

/** Restores a saved draft; drafts from older versions lack the tip fields. */
export function restoreDraft(): Draft {
  const saved = loadDraft<Partial<Draft>>();
  if (!saved?.rows) return emptyDraft();
  const empty = emptyDraft();
  return {
    ...empty,
    ...saved,
    // Drafts from older versions may carry a tip mode that no longer exists.
    tip: saved.tip?.mode === "percent" || saved.tip?.mode === "total" || saved.tip?.mode === "amount" ? { ...empty.tip, ...saved.tip } : empty.tip,
    tipOnReceipt: saved.tipOnReceipt ?? false,
    fees: saved.fees ?? [],
    delivery: saved.delivery ?? false,
  } as Draft;
}

/** Recognition is trusted enough to skip the review when the AI read it and the sum matches the printed total. */
export function isConfident(r: ParsedReceipt): boolean {
  const sum = r.items.reduce((s, i) => s + i.total, 0) + r.fees.reduce((s, f) => s + f.amount, 0);
  return r.engine === "ai" && r.items.length > 0 && (r.total === null || r.total === sum);
}
