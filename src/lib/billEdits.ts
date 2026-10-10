import type { BillData } from "./bill";

/**
 * The payer's changes on the finished bill (equal split): crossing out lines, fees and the
 * tip, and billing only a part of a line. Each returns the changed bill data.
 */

/**
 * Crosses a forgotten line out (or brings it back); it is then not billed. Of a line with
 * several units every tap crosses out one more, after the last one they all come back.
 */
export function toggleItemExcluded(data: BillData, itemId: string): BillData {
  const items = data.items.map((item) => {
    if (item.id !== itemId) return item;
    const rest = { ...item };
    delete rest.excluded;
    delete rest.struck;
    if (item.excluded) return rest;
    const struck = (item.struck ?? 0) + 1;
    return struck >= item.qty ? { ...rest, excluded: true } : { ...rest, struck };
  });
  return { ...data, items };
}

/**
 * Only 1/divisor of a line goes into the split (e.g. half of a litre of milk), the payer takes
 * the rest. The receipt price is kept in fullTotal; 1 restores the line.
 */
export function setItemDivisor(data: BillData, itemId: string, divisor: number): BillData {
  const items = data.items.map((item) => {
    if (item.id !== itemId) return item;
    const full = item.fullTotal ?? item.total;
    const rest = { ...item, total: full };
    delete rest.fullTotal;
    delete rest.divisor;
    return divisor > 1 ? { ...rest, fullTotal: full, divisor, total: Math.round(full / divisor) } : rest;
  });
  return { ...data, items };
}

/** Crosses a fee out (or brings it back). */
export function toggleFeeExcluded(data: BillData, feeId: string): BillData {
  const fees = (data.fees ?? []).map((fee) => {
    if (fee.id !== feeId) return fee;
    if (!fee.excluded) return { ...fee, excluded: true };
    const rest = { ...fee };
    delete rest.excluded;
    return rest;
  });
  return { ...data, fees };
}

/** … and the tip. */
export function toggleTipExcluded(data: BillData): BillData {
  return { ...data, tipExcluded: data.tipExcluded ? undefined : true };
}
