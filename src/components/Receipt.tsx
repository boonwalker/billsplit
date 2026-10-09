import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  billTotal,
  claimCost,
  hasTip,
  isFullyAssigned,
  sharedPerPerson,
  sharedTotal,
  splitHeadCount,
  subtotal,
  slotHolders,
  tipTotal,
  unitShare,
  type BillItem,
  type BillSnapshot,
  type PublicParticipant,
} from "../lib/bill";
import { formatMoney } from "../lib/money";

interface Props {
  snapshot: BillSnapshot;
  /** Called with the units ("slots") the viewer takes of an item; undefined = read-only. */
  onSetSlots?: (itemId: string, slots: number[]) => void;
}

function formatDate(iso: string): string {
  return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
}

/** Short pulse when a claim appears that the viewer did not make (live update from a friend). */
function useFlash(key: string): boolean {
  const prev = useRef(key);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current === key) return;
    prev.current = key;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(t);
  }, [key]);
  return flash;
}

/** 1.5 → "1½", 0.333 → "⅓"; other fractions with one decimal. */
function formatUnits(units: number): string {
  const whole = Math.floor(units + 1e-9);
  const rest = units - whole;
  if (rest < 1e-6) return String(whole);
  const glyph = [
    [1 / 2, "½"],
    [1 / 3, "⅓"],
    [2 / 3, "⅔"],
    [1 / 4, "¼"],
    [3 / 4, "¾"],
    [1 / 5, "⅕"],
  ].find(([value]) => Math.abs((value as number) - rest) < 1e-6)?.[1];
  if (glyph) return `${whole || ""}${glyph}`;
  return units.toFixed(1).replace(".", ",");
}

function ReceiptLine({
  item,
  index,
  participants,
  me,
  currency,
  onSetSlots,
}: {
  item: BillItem;
  index: number;
  participants: PublicParticipant[];
  me: string | null;
  currency: string;
  onSetSlots?: (itemId: string, slots: number[]) => void;
}) {
  const holders = slotHolders(item.id, participants);
  const mySlots = me ? (participants.find((p) => p.id === me)?.claims[item.id] ?? []) : [];
  const myUnits = mySlots.length;
  const claimants = participants.filter((p) => (p.claims[item.id] ?? []).length > 0);
  const done = isFullyAssigned(item, participants);
  const shared = [...holders.values()].some((ids) => ids.length > 1);
  const freeSlots = Array.from({ length: item.qty }, (_, slot) => slot).filter((slot) => !holders.has(slot));
  const others = claimants
    .filter((p) => p.id !== me)
    .map((p) => `${p.id}:${p.claims[item.id].join("+")}`)
    .join(",");
  const flash = useFlash(others);
  const canEdit = Boolean(onSetSlots && me);
  // A single item that is taken can still be shared by ticking it; a unit of a
  // multi-quantity item is shared by tapping the name of whoever has it.
  const interactive = canEdit && (myUnits > 0 || freeSlots.length > 0 || item.qty === 1);

  function toggle() {
    if (!onSetSlots) return;
    // Ticking takes one unit; more can be added with the stepper.
    if (myUnits > 0) onSetSlots(item.id, []);
    else onSetSlots(item.id, [freeSlots[0] ?? 0]);
  }

  /** Shares a unit with someone who has it, or stops sharing with them. */
  function toggleShare(otherId: string) {
    if (!onSetSlots) return;
    const theirs = participants.find((p) => p.id === otherId)?.claims[item.id] ?? [];
    const together = mySlots.filter((slot) => theirs.includes(slot));
    if (together.length) onSetSlots(item.id, mySlots.filter((slot) => !together.includes(slot)));
    else if (theirs.length) onSetSlots(item.id, [...mySlots, theirs[0]]);
  }

  const fill = Math.min(1, myUnits / item.qty);

  return (
    <li
      className={`rline${done ? " done" : ""}${myUnits > 0 ? " mine" : ""}${flash ? " flash" : ""}`}
      style={{ animationDelay: `${180 + index * 70}ms` }}
    >
      <button
        type="button"
        className="rline-main"
        onClick={toggle}
        disabled={!interactive}
        aria-pressed={myUnits > 0}
        aria-label={`${item.qty > 1 ? `${item.qty} × ` : ""}${item.name}, ${formatMoney(item.total, currency)}`}
      >
        <span className="tick" aria-hidden="true" style={{ "--fill": fill } as CSSProperties}>
          <svg viewBox="0 0 24 24">
            <circle className="tick-ring" cx="12" cy="12" r="10" />
            <circle className="tick-arc" cx="12" cy="12" r="10" pathLength="100" />
            <path className="tick-check" d="M7.5 12.5l3 3 6-6.5" pathLength="1" />
          </svg>
        </span>
        <span className="rline-text">
          <span className="rline-name">
            {/* Inline so the strike-through runs through every wrapped line, not between them. */}
            <span className="rline-strike">
              {item.qty > 1 && <span className="rline-qty">{item.qty}x </span>}
              {item.name}
            </span>
          </span>
          {item.qty > 1 && <span className="rline-unit">à {formatMoney(Math.round(item.total / item.qty), currency)}</span>}
        </span>
        <span className="rline-dots" aria-hidden="true" />
        <span className="rline-price">{formatMoney(item.total, currency)}</span>
      </button>

      {canEdit && item.qty > 1 && myUnits > 0 && (
        <div className="rline-stepper">
          <button type="button" onClick={() => onSetSlots!(item.id, mySlots.slice(0, -1))} aria-label="Eins weniger">
            −
          </button>
          <span>
            {formatUnits(me ? unitShare(item, participants, me) : 0)} von {item.qty} für dich
          </span>
          <button
            type="button"
            onClick={() => onSetSlots!(item.id, [...mySlots, freeSlots[0]])}
            disabled={freeSlots.length === 0}
            aria-label="Eins mehr"
          >
            +
          </button>
        </div>
      )}

      {claimants.length > 0 && (
        <ul className="rline-claims">
          {claimants.map((p) => {
            const units = unitShare(item, participants, p.id);
            const isMe = p.id === me;
            const sharing = !isMe && (p.claims[item.id] ?? []).some((slot) => mySlots.includes(slot));
            const label = (
              <>
                <span className="claim-dot" aria-hidden="true">✓</span>
                {isMe ? "Du" : p.name}
                {(item.qty > 1 || units < 1) && <> ×{formatUnits(units)}</>}
                <span className="claim-cost">{formatMoney(claimCost(item, units), currency)}</span>
              </>
            );
            return (
              <li key={p.id} className={isMe ? "me" : undefined}>
                {canEdit && !isMe ? (
                  <button
                    type="button"
                    className={`claim-btn${sharing ? " sharing" : ""}`}
                    onClick={() => toggleShare(p.id)}
                    aria-pressed={sharing}
                    aria-label={sharing ? `Nicht mehr mit ${p.name} teilen` : `Ein Stück mit ${p.name} teilen`}
                  >
                    {label}
                  </button>
                ) : (
                  label
                )}
              </li>
            );
          })}
          {shared && <li className="shared-note">geteilt</li>}
        </ul>
      )}
      {canEdit && item.qty > 1 && done && myUnits === 0 && (
        <p className="rline-hint">Alle Stück sind vergeben. Tippe auf einen Namen, um dessen Stück mit ihm zu teilen.</p>
      )}
    </li>
  );
}

function FeeLine({ name, amount, currency }: { name: string; amount: number; currency: string }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>{formatMoney(amount, currency)}</dd>
    </>
  );
}

/** The digital bill in classic receipt style, with tick circles in front of every line. */
export default function Receipt({ snapshot, onSetSlots }: Props) {
  const { data, participants, me, ownerName } = snapshot;
  const sub = subtotal(data.items);
  const total = billTotal(data);
  const assigned = data.items.filter((i) => isFullyAssigned(i, participants)).length;

  return (
    <article className="receipt" aria-label="Digitale Rechnung">
      <div className="receipt-paper">
        <header className="receipt-head">
          <div className="receipt-logo" aria-hidden="true">
            ✦
          </div>
          <h2>{data.title || "Rechnung"}</h2>
          <p>{formatDate(data.date)}</p>
          <p className="receipt-paidby">bezahlt von {ownerName || "?"}</p>
        </header>

        <div className="receipt-rule" aria-hidden="true" />
        <div className="receipt-cols" aria-hidden="true">
          <span>Artikel</span>
          <span>{data.currency}</span>
        </div>

        <ul className="receipt-lines">
          {data.items.map((item, idx) => (
            <ReceiptLine
              key={item.id}
              item={item}
              index={idx}
              participants={participants}
              me={me}
              currency={data.currency}
              onSetSlots={onSetSlots}
            />
          ))}
        </ul>

        <div className="receipt-rule" aria-hidden="true" />
        <dl className="receipt-sums">
          {sharedTotal(data) !== 0 && (
            <>
              <dt>Zwischensumme</dt>
              <dd>{formatMoney(sub, data.currency)}</dd>
              {(data.fees ?? []).map((fee) => (
                <FeeLine key={fee.id} name={fee.name} amount={fee.amount} currency={data.currency} />
              ))}
              {hasTip(data) && (
                <FeeLine
                  name={`Trinkgeld${data.tipAmount ? "" : ` ${data.tipPercent} %`}`}
                  amount={tipTotal(data)}
                  currency={data.currency}
                />
              )}
              <dt className="tip-split">
                {(data.fees ?? []).length > 0 ? (hasTip(data) ? "Gebühren & Trinkgeld" : "Gebühren") : "Trinkgeld"} ÷{" "}
                {splitHeadCount(data, participants)} Personen
              </dt>
              <dd className="tip-split">je {formatMoney(sharedPerPerson(data, participants), data.currency)}</dd>
            </>
          )}
          <dt className="grand">SUMME</dt>
          <dd className="grand">{formatMoney(total, data.currency)}</dd>
        </dl>
        <div className="receipt-rule double" aria-hidden="true" />
        <p className="receipt-progress">
          {assigned} von {data.items.length} Positionen vollständig zugeordnet
        </p>
        <div className="receipt-barcode" aria-hidden="true" />
        <p className="receipt-thanks">Danke &amp; bis zum nächsten Mal!</p>
      </div>
    </article>
  );
}
