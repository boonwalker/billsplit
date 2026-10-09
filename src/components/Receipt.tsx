import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  billTotal,
  claimCost,
  claimedUnits,
  hasTip,
  sharedPerPerson,
  sharedTotal,
  splitHeadCount,
  subtotal,
  tipTotal,
  type BillItem,
  type BillSnapshot,
  type PublicParticipant,
} from "../lib/bill";
import { formatMoney } from "../lib/money";

interface Props {
  snapshot: BillSnapshot;
  /** Called with the new number of units the viewer takes of an item; undefined = read-only. */
  onSetUnits?: (itemId: string, units: number) => void;
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

function ReceiptLine({
  item,
  index,
  participants,
  me,
  currency,
  onSetUnits,
}: {
  item: BillItem;
  index: number;
  participants: PublicParticipant[];
  me: string | null;
  currency: string;
  onSetUnits?: (itemId: string, units: number) => void;
}) {
  const totalUnits = claimedUnits(item.id, participants);
  const myUnits = me ? (participants.find((p) => p.id === me)?.claims[item.id] ?? 0) : 0;
  const claimants = participants.filter((p) => (p.claims[item.id] ?? 0) > 0);
  const done = totalUnits >= item.qty;
  const shared = totalUnits > item.qty;
  const others = claimants
    .filter((p) => p.id !== me)
    .map((p) => `${p.id}:${p.claims[item.id]}`)
    .join(",");
  const flash = useFlash(others);
  const interactive = Boolean(onSetUnits && me);

  function toggle() {
    if (!onSetUnits) return;
    // Ticking takes one unit; more can be added with the stepper.
    onSetUnits(item.id, myUnits > 0 ? 0 : 1);
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
            {item.qty > 1 && <span className="rline-qty">{item.qty}x </span>}
            {item.name}
          </span>
          {item.qty > 1 && <span className="rline-unit">à {formatMoney(Math.round(item.total / item.qty), currency)}</span>}
        </span>
        <span className="rline-dots" aria-hidden="true" />
        <span className="rline-price">{formatMoney(item.total, currency)}</span>
      </button>

      {interactive && item.qty > 1 && myUnits > 0 && (
        <div className="rline-stepper">
          <button type="button" onClick={() => onSetUnits!(item.id, myUnits - 1)} aria-label="Eins weniger">
            −
          </button>
          <span>
            {myUnits} von {item.qty} für dich
          </span>
          <button type="button" onClick={() => onSetUnits!(item.id, myUnits + 1)} disabled={myUnits >= item.qty} aria-label="Eins mehr">
            +
          </button>
        </div>
      )}

      {claimants.length > 0 && (
        <ul className="rline-claims">
          {claimants.map((p) => {
            const units = p.claims[item.id];
            const isMe = p.id === me;
            return (
              <li key={p.id} className={isMe ? "me" : undefined}>
                <span className="claim-dot" aria-hidden="true">✓</span>
                {isMe ? "Du" : p.name}
                {item.qty > 1 && <> ×{units}</>}
                <span className="claim-cost">{formatMoney(claimCost(item, units, totalUnits), currency)}</span>
              </li>
            );
          })}
          {shared && <li className="shared-note">geteilt</li>}
        </ul>
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
export default function Receipt({ snapshot, onSetUnits }: Props) {
  const { data, participants, me, ownerName } = snapshot;
  const sub = subtotal(data.items);
  const total = billTotal(data);
  const assigned = data.items.filter((i) => claimedUnits(i.id, participants) >= i.qty).length;

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
              onSetUnits={onSetUnits}
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
