import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  billedItems,
  billTotal,
  claimCost,
  equalShare,
  hasTip,
  isFullyAssigned,
  sharedPerPerson,
  sharedTotal,
  splitHeadCount,
  subtotal,
  slotHolders,
  slotParts,
  tipTotal,
  unitShare,
  type BillItem,
  type BillSnapshot,
  type PublicParticipant,
} from "../lib/bill";
import { formatMoney } from "../lib/money";

interface Props {
  snapshot: BillSnapshot;
  /** Called with the units ("slots") the viewer takes of an item and those offered for sharing; undefined = read-only. */
  onSetSlots?: (itemId: string, slots: number[], splits: number[]) => void;
  /** Opens the stored photo the bill was read from; undefined when there is none. */
  onShowOriginal?: () => void;
  /** Payer in equal split: crosses a line out (or brings it back) so it is not billed. */
  onToggleExcluded?: (itemId: string) => void;
}

export function formatDate(iso: string): string {
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
  onToggleExcluded,
  each,
  people = 1,
}: {
  item: BillItem;
  index: number;
  participants: PublicParticipant[];
  me: string | null;
  currency: string;
  /** Equal split: what every person pays of this line (nothing can be ticked then). */
  each?: number;
  /** Equal split: number of people the line is divided by. */
  people?: number;
  onSetSlots?: (itemId: string, slots: number[], splits: number[]) => void;
  onToggleExcluded?: (itemId: string) => void;
}) {
  const holders = slotHolders(item.id, participants);
  const mine = me ? participants.find((p) => p.id === me) : undefined;
  const mySlots = mine?.claims[item.id] ?? [];
  const mySplits = mine?.splits?.[item.id] ?? [];
  /** Offered units nobody has joined yet: the other half is still open. */
  const waiting = (p: PublicParticipant) => (p.splits?.[item.id] ?? []).filter((slot) => holders.get(slot)?.length === 1);
  const myUnits = mySlots.length;
  const claimants = participants.filter((p) => (p.claims[item.id] ?? []).length > 0);
  const excluded = Boolean(item.excluded);
  const done = excluded || isFullyAssigned(item, participants);
  // Pressed in while the finger rests on the line, pops back up on release.
  const [holding, setHolding] = useState(false);
  const shared = [...holders.keys()].some((slot) => slotParts(item.id, slot, participants, holders) > 1);
  const freeSlots = Array.from({ length: item.qty }, (_, slot) => slot).filter((slot) => !holders.has(slot));
  const others = claimants
    .filter((p) => p.id !== me)
    .map((p) => `${p.id}:${p.claims[item.id].join("+")}`)
    .join(",");
  const flash = useFlash(others);
  const canEdit = Boolean(onSetSlots && me) && each === undefined && !excluded;
  // A single item that is taken can still be shared by ticking it; a unit of a
  // multi-quantity item is shared by tapping the name of whoever has it.
  const interactive = onToggleExcluded ? true : canEdit && (myUnits > 0 || freeSlots.length > 0 || item.qty === 1);

  function toggle() {
    if (onToggleExcluded) {
      onToggleExcluded(item.id);
      return;
    }
    if (!onSetSlots) return;
    // Ticking takes one unit; more can be added with the stepper.
    if (myUnits > 0) onSetSlots(item.id, [], []);
    else onSetSlots(item.id, [freeSlots[0] ?? 0], []);
  }

  /** Shares a unit with someone who has it (preferably one they offered), or stops sharing with them. */
  function toggleShare(otherId: string) {
    if (!onSetSlots) return;
    const other = participants.find((p) => p.id === otherId);
    const theirs = other?.claims[item.id] ?? [];
    const together = mySlots.filter((slot) => theirs.includes(slot));
    if (together.length) {
      onSetSlots(item.id, mySlots.filter((slot) => !together.includes(slot)), mySplits);
      return;
    }
    const offered = other ? waiting(other) : [];
    const slot = offered[0] ?? theirs[0];
    if (slot !== undefined) onSetSlots(item.id, [...mySlots, slot], mySplits);
  }

  // One of my own units that only I have – it can be offered for sharing.
  const soloSlot = mySlots.find((slot) => holders.get(slot)?.length === 1);

  /** Pays only half of an own unit right away; the other half waits for someone to join. */
  function toggleOffer() {
    if (!onSetSlots) return;
    if (mySplits.length) onSetSlots(item.id, mySlots, []);
    else if (soloSlot !== undefined) onSetSlots(item.id, mySlots, [soloSlot]);
  }

  const myWaiting = mine ? waiting(mine).length > 0 : false;
  const othersWaiting = participants.filter((p) => p.id !== me && waiting(p).length > 0);

  const fill = Math.min(1, myUnits / item.qty);

  return (
    <li
      data-item={item.id}
      className={`rline${done ? " done" : ""}${excluded ? " excluded" : ""}${myUnits > 0 ? " mine" : ""}${flash ? " flash" : ""}${
        each !== undefined || excluded ? " equal" : ""
      }${onToggleExcluded ? " strikable" : ""}${holding ? " holding" : ""}`}
      style={{ animationDelay: `${180 + index * 70}ms` }}
    >
      <button
        type="button"
        className="rline-main"
        onClick={toggle}
        onPointerDown={onToggleExcluded ? () => setHolding(true) : undefined}
        onPointerUp={onToggleExcluded ? () => setHolding(false) : undefined}
        onPointerLeave={onToggleExcluded ? () => setHolding(false) : undefined}
        onPointerCancel={onToggleExcluded ? () => setHolding(false) : undefined}
        disabled={!interactive}
        aria-pressed={onToggleExcluded ? excluded : myUnits > 0}
        aria-label={`${item.qty > 1 ? `${item.qty} × ` : ""}${item.name}, ${formatMoney(item.total, currency)}${
          onToggleExcluded ? (excluded ? " – gestrichen, antippen zum Wiederaufnehmen" : " – antippen zum Streichen") : ""
        }`}
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
            {item.divisor && <span className="pencil rline-divisor">/{item.divisor}</span>}
          </span>
          {item.qty > 1 && <span className="rline-unit">à {formatMoney(Math.round(item.total / item.qty), currency)}</span>}
        </span>
        <span className="rline-dots" aria-hidden="true" />
        {each !== undefined && !excluded && (
          <span className="pencil rline-each" title="Anteil pro Person">
            {formatMoney(each, currency)}
          </span>
        )}
        <span className="rline-price">
          {item.fullTotal !== undefined && <s className="rline-full">{formatMoney(item.fullTotal, currency)}</s>}
          {formatMoney(item.total, currency)}
        </span>
        {each !== undefined && !excluded && <span className="pencil rline-div">/{people}</span>}
      </button>

      {canEdit && item.qty > 1 && myUnits > 0 && (
        <div className="rline-stepper">
          <button type="button" onClick={() => onSetSlots!(item.id, mySlots.slice(0, -1), mySplits)} aria-label="Eins weniger">
            −
          </button>
          <span>
            {formatUnits(me ? unitShare(item, participants, me) : 0)} von {item.qty} für dich
          </span>
          <button
            type="button"
            onClick={() => onSetSlots!(item.id, [...mySlots, freeSlots[0]], mySplits)}
            disabled={freeSlots.length === 0}
            aria-label="Eins mehr"
          >
            +
          </button>
        </div>
      )}

      {claimants.length > 0 && each === undefined && (
        <ul className="rline-claims">
          {claimants.map((p) => {
            const units = unitShare(item, participants, p.id);
            const isMe = p.id === me;
            const sharing = isMe ? mySplits.length > 0 : (p.claims[item.id] ?? []).some((slot) => mySlots.includes(slot));
            const offering = !isMe && waiting(p).length > 0;
            const label = (
              <>
                <span className="claim-dot" aria-hidden="true">✓</span>
                {isMe ? "Du" : p.name}
                {(item.qty > 1 || units < 1) && <> ×{formatUnits(units)}</>}
                <span className="claim-cost">{formatMoney(claimCost(item, units), currency)}</span>
              </>
            );
            const clickable = canEdit && (!isMe || mySplits.length > 0 || soloSlot !== undefined);
            return (
              <li key={p.id} className={isMe ? "me" : undefined}>
                {clickable ? (
                  <button
                    type="button"
                    className={`claim-btn${sharing ? " sharing" : ""}${offering ? " offer" : ""}`}
                    onClick={() => (isMe ? toggleOffer() : toggleShare(p.id))}
                    aria-pressed={sharing}
                    aria-label={
                      isMe
                        ? sharing
                          ? "Doch nicht teilen"
                          : "Zum Teilen freigeben und nur die Hälfte zahlen"
                        : sharing
                          ? `Nicht mehr mit ${p.name} teilen`
                          : `Ein Stück mit ${p.name} teilen`
                    }
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
      {canEdit && myWaiting && (
        <p className="rline-hint">
          Du zahlst {item.qty > 1 ? "von einem Stück nur " : ""}die Hälfte. Die andere Hälfte bleibt offen, bis jemand auf deinen
          Namen tippt.
        </p>
      )}
      {canEdit &&
        othersWaiting.map((p) => (
          <p key={p.id} className="rline-hint offer">
            {p.name} möchte teilen – tippe auf den Namen, um die andere Hälfte zu übernehmen.
          </p>
        ))}
      {canEdit && item.qty > 1 && done && myUnits === 0 && (
        <p className="rline-hint">Alle Stück sind vergeben. Tippe auf einen Namen, um ein Stück zu teilen.</p>
      )}
    </li>
  );
}

function FeeLine({ name, amount, currency, each, people }: { name: string; amount: number; currency: string; each?: number; people?: number }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>
        {each !== undefined && <span className="pencil rline-each">{formatMoney(each, currency)}</span>}
        {formatMoney(amount, currency)}
        {each !== undefined && <span className="pencil rline-div">/{people}</span>}
      </dd>
    </>
  );
}

/** Grain that makes handwriting and strokes look drawn with a pencil (referenced via CSS). */
export function PencilFilter() {
  return (
    <svg width="0" height="0" className="pencil-defs" aria-hidden="true" focusable="false">
      <filter id="pencil-grain" x="-10%" y="-30%" width="120%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" result="wobbly" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.4" result="grain" />
        <feComposite in="wobbly" in2="grain" operator="in" />
      </filter>
    </svg>
  );
}

/** Equal split: the total over a hand-drawn fraction bar, the head count below, and the share next to it. */
function EqualFraction({ total, people, share, currency }: { total: number; people: number; share: number; currency: string }) {
  return (
    <span className="fraction" aria-label={`${formatMoney(total, currency)} geteilt durch ${people} ist ${formatMoney(share, currency)} pro Person`}>
      <span className="fraction-stack" aria-hidden="true">
        <span>{formatMoney(total, currency)}</span>
        {/* A swung pencil stroke: a filled, tapering shape plus a fainter second pass. */}
        <svg className="fraction-bar" viewBox="0 0 120 12" preserveAspectRatio="none">
          <path d="M2 8.2 C 22 4.4, 50 9.4, 84 5.6 S 112 4.6, 118 2.8 C 113 5.4, 102 6.6, 85 7.9 C 52 11.4, 24 6.8, 2 8.6 Z" />
          <path d="M9 9.2 C 34 7.6, 62 9.6, 92 6.9 S 110 5.9, 114 5.2 C 108 7.1, 96 8.1, 90 8.3 C 62 10.6, 34 8.6, 9 9.6 Z" className="fraction-bar-thin" />
        </svg>
        <span className="pencil fraction-den">{people}</span>
      </span>
      <span className="pencil fraction-result" aria-hidden="true">
        = {formatMoney(share, currency)}
        <small>pro Person</small>
      </span>
    </span>
  );
}

/** Where the tap demo runs: the spot a finger taps on two lines, then they get crossed out. */
interface TapDemo {
  taps: { x: number; y: number }[];
  width: number;
}

const TAP_DEMO_KEY = (billId: string) => `billsplit.tapDemo.${billId}`;

/**
 * Equal split, payer's view: shows a few times on two lines that tapping crosses a line out.
 * Runs once per bill (and stops as soon as the payer taps a line).
 */
function useTapDemo(billId: string, enabled: boolean, list: RefObject<HTMLUListElement | null>) {
  const [demo, setDemo] = useState<TapDemo | null>(null);
  useLayoutEffect(() => {
    if (!enabled || !list.current) return;
    try {
      if (localStorage.getItem(TAP_DEMO_KEY(billId))) return;
      localStorage.setItem(TAP_DEMO_KEY(billId), "1");
    } catch {
      // Without storage the demo simply shows again next time.
    }
    const lines = [...list.current.querySelectorAll<HTMLElement>("li[data-item]:not(.excluded)")].slice(0, 2);
    const wrap = list.current.parentElement;
    if (!lines.length || !wrap) return;
    // Layout offsets relative to the wrapper are not affected by the lines' print-in animation.
    const taps = lines.map((line) => {
      const name = line.querySelector<HTMLElement>(".rline-strike");
      // Through the item name, also when a unit price is printed below it.
      const row = line.querySelector<HTMLElement>(".rline-name");
      return {
        x: line.offsetLeft + (name?.offsetLeft ?? 0) + Math.min((name?.offsetWidth ?? 80) / 2, 70),
        y: line.offsetTop + (row ? row.offsetTop + row.offsetHeight * 0.55 : line.offsetHeight / 2),
      };
    });
    setDemo({ taps, width: wrap.offsetWidth });
  }, [billId, enabled, list]);
  return [demo, () => setDemo(null)] as const;
}

/** The digital bill in classic receipt style, with tick circles in front of every line. */
export default function Receipt({ snapshot, onSetSlots, onShowOriginal, onToggleExcluded }: Props) {
  const { data, participants, me, ownerName } = snapshot;
  const billed = billedItems(data);
  const sub = subtotal(billed);
  const total = billTotal(data);
  const assigned = billed.filter((i) => isFullyAssigned(i, participants)).length;
  const equal = Boolean(data.equalSplit);
  const people = splitHeadCount(data, participants);
  const perPerson = (amount: number) => (equal ? Math.round(amount / people) : undefined);
  const list = useRef<HTMLUListElement>(null);
  const [demo, endDemo] = useTapDemo(snapshot.id, Boolean(onToggleExcluded), list);
  const toggleExcluded = onToggleExcluded && ((itemId: string) => (endDemo(), onToggleExcluded(itemId)));

  return (
    <article className="receipt" aria-label="Digitale Rechnung">
      <PencilFilter />
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

        <div className="receipt-lines-wrap">
          {demo && (
            <svg className="ink-demo bill-demo" width={demo.width} height="100%" aria-hidden="true">
              {demo.taps.map((t, i) => (
                <g key={i} className={`ink-demo-tap-group tap-${i + 1}`}>
                  <circle className="ink-demo-tap" cx={t.x} cy={t.y} r="16" />
                  <path
                    className="ink-demo-tapstrike"
                    pathLength={1}
                    d={`M6 ${t.y + 2} C ${demo.width * 0.3} ${t.y - 2}, ${demo.width * 0.6} ${t.y + 3}, ${demo.width - 8} ${t.y}`}
                  />
                </g>
              ))}
            </svg>
          )}
          <ul className="receipt-lines" ref={list}>
            {data.items.map((item, idx) => (
              <ReceiptLine
                key={item.id}
                item={item}
                index={idx}
                participants={participants}
                me={me}
                currency={data.currency}
                onSetSlots={onSetSlots}
                onToggleExcluded={toggleExcluded}
                each={perPerson(item.total)}
                people={people}
              />
            ))}
          </ul>
        </div>

        <div className="receipt-rule" aria-hidden="true" />
        <dl className="receipt-sums">
          {sharedTotal(data) !== 0 && (
            <>
              <dt>Zwischensumme</dt>
              <dd>
                {equal && <span className="pencil rline-each">{formatMoney(perPerson(sub)!, data.currency)}</span>}
                {formatMoney(sub, data.currency)}
                {equal && <span className="pencil rline-div">/{people}</span>}
              </dd>
              {(data.fees ?? []).map((fee) => (
                <FeeLine key={fee.id} name={fee.name} amount={fee.amount} currency={data.currency} each={perPerson(fee.amount)} people={people} />
              ))}
              {hasTip(data) && (
                <FeeLine
                  name={`Trinkgeld${data.tipAmount ? "" : ` ${data.tipPercent} %`}`}
                  amount={tipTotal(data)}
                  currency={data.currency}
                  each={perPerson(tipTotal(data))}
                  people={people}
                />
              )}
            </>
          )}
          {sharedTotal(data) !== 0 && !equal && (
            <>
              <dt className="tip-split">
                {(data.fees ?? []).length > 0 ? (hasTip(data) ? "Gebühren & Trinkgeld" : "Gebühren") : "Trinkgeld"} ÷{" "}
                {splitHeadCount(data, participants)} Personen
              </dt>
              <dd className="tip-split">je {formatMoney(sharedPerPerson(data, participants), data.currency)}</dd>
            </>
          )}
          <dt className="grand">SUMME</dt>
          {equal ? (
            <dd className="grand">
              <EqualFraction total={total} people={people} share={equalShare(data, participants)} currency={data.currency} />
            </dd>
          ) : (
            <dd className="grand">{formatMoney(total, data.currency)}</dd>
          )}
        </dl>
        <div className="receipt-rule double" aria-hidden="true" />
        <p className="receipt-progress">
          {equal ? `Gleichmäßig auf ${people} Personen verteilt` : `${assigned} von ${billed.length} Positionen vollständig zugeordnet`}
        </p>
        <div className="receipt-barcode" aria-hidden="true" />
        <p className="receipt-thanks">Danke &amp; bis zum nächsten Mal!</p>
        {onShowOriginal && (
          <button type="button" className="receipt-original" onClick={onShowOriginal}>
            Zum Originalbeleg
          </button>
        )}
      </div>
    </article>
  );
}
