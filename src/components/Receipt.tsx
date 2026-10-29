import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  billedItem,
  billedItems,
  billTotal,
  claimCost,
  discountTotal,
  feeSplit,
  equalShare,
  hasTip,
  isFullyAssigned,
  lineFor,
  perHeadFees,
  personalTotal,
  poolTotal,
  sharedPerPerson,
  sharedTotal,
  splitHeadCount,
  tipPerHead,
  tipTotal,
  subtotal,
  slotHolders,
  slotParts,
  tipOnReceipt,
  unitShare,
  type BillItem,
  type BillSnapshot,
  type PublicParticipant,
} from "../lib/bill";
import { formatDate as formatLocaleDate, locale, t } from "../lib/i18n";
import { formatMoney } from "../lib/money";
import { vibrate } from "../lib/haptics";
import ClaimDemo, { onceInView, useClaimDemo } from "./ClaimDemo";
import ReceiptDemo, { demoLayout, useDemoLoop, type DemoLayout } from "./ReceiptDemo";

interface Props {
  snapshot: BillSnapshot;
  /** Called with the units ("slots") the viewer takes of an item and those offered for sharing; undefined = read-only. */
  onSetSlots?: (itemId: string, slots: number[], splits: number[]) => void;
  /** Opens the stored photo the bill was read from; undefined when there is none. */
  onShowOriginal?: () => void;
  /** Payer in equal split: crosses a line out (or brings it back) so it is not billed. */
  onToggleExcluded?: (itemId: string) => void;
  /** Payer: a line was held – open its settings (bill only a part). */
  onEditDivisor?: (itemId: string) => void;
  /** Payer: a tap right on the pencilled "/2" bills the whole line again. */
  onResetDivisor?: (itemId: string) => void;
  /** … the same for a fee and for the tip. */
  onToggleFee?: (feeId: string) => void;
  onToggleTip?: () => void;
  /** "Stimmt nicht?": in these lines the other guest's name can be tapped away (see BillCore.contestShare). */
  contest?: Contest;
  /** Payer: a guest's name on a line was held – ask whether to take their part off it. */
  onHoldShare?: (personId: string, itemId: string) => void;
}

/** Lines someone shared with me after I had paid, and how to take them back. */
export interface Contest {
  personId: string;
  personName: string;
  itemIds: string[];
  onRemove: (itemId: string) => void;
}

export function formatDate(iso: string): string {
  return iso ? formatLocaleDate(`${iso}T12:00:00`, { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
}

/** Short pulse when a claim appears that the viewer did not make (live update from a friend). */
function useFlash(key: string): boolean {
  const prev = useRef(key);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current === key) return;
    prev.current = key;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(timer);
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
  return units.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function ReceiptLine({
  item,
  index,
  participants,
  me,
  currency,
  onSetSlots,
  onToggleExcluded,
  onLongPress,
  onResetDivisor,
  each,
  people = 1,
  forNames,
  contest,
  onHoldShare,
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
  /** Equal split: the line was given to these people (see lineFor) – their names instead of the share per person. */
  forNames?: string[];
  onSetSlots?: (itemId: string, slots: number[], splits: number[]) => void;
  onToggleExcluded?: (itemId: string) => void;
  /** Payer: holding the line opens its settings (bill only a part of it). */
  onLongPress?: () => void;
  /** Payer: a tap right on the "/2" takes it back (instead of crossing the line out). */
  onResetDivisor?: () => void;
  /** "Stimmt nicht?" for this line: the other guest's name taps away their part. */
  contest?: Contest;
  /** Payer: holding a guest's name asks whether to take their part off this line. */
  onHoldShare?: (personId: string) => void;
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
  // Some units crossed out by the payer: "3x" becomes "2x" in pencil, only the rest is billed.
  const struckUnits = excluded ? 0 : Math.min(item.qty - 1, item.struck ?? 0);
  const billedTotal = billedItem(item).total;
  // Equal split (forNames set): ticks do not count here, only crossing out.
  const done = excluded || (forNames === undefined && isFullyAssigned(item, participants));
  // Pressed in while the finger rests on the line, pops back up on release.
  const [holding, setHolding] = useState(false);
  // "geteilt" only once a unit really has two holders; an offered half nobody joined yet is still waiting.
  const shared = [...holders.values()].some((ids) => ids.length > 1);
  const waitingSlots = [...holders.keys()].filter((slot) => holders.get(slot)?.length === 1 && slotParts(item.id, slot, participants, holders) > 1);
  // Next to one's own name: "Du … wartest auf jemanden".
  const iAmWaiting = waitingSlots.some((slot) => holders.get(slot)?.[0] === me);
  const someoneElseWaiting = waitingSlots.some((slot) => holders.get(slot)?.[0] !== me);
  const freeSlots = Array.from({ length: item.qty }, (_, slot) => slot).filter((slot) => !holders.has(slot));
  /** Halves others offered and nobody joined yet: ticking the circle takes the other half too. */
  const offeredSlots = participants.filter((p) => p.id !== me).flatMap(waiting);
  const others = claimants
    .filter((p) => p.id !== me)
    .map((p) => `${p.id}:${p.claims[item.id].join("+")}`)
    .join(",");
  const flash = useFlash(others);
  const canEdit = Boolean(onSetSlots && me) && each === undefined && !excluded;
  // A single item that is taken can still be shared by ticking it; a unit of a
  // multi-quantity item is shared by tapping the name of whoever has it.
  // Others already took the whole line: there is nothing left to tick, only sharing by tapping
  // a name – so the tick circle goes away and the line itself does nothing.
  const takenByOthers = canEdit && done && myUnits === 0;
  const interactive = onToggleExcluded ? true : canEdit && !takenByOthers && (myUnits > 0 || freeSlots.length > 0 || offeredSlots.length > 0);

  // Long press (payer): opens the settings of the line instead of ticking or striking it.
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  function endPress() {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
    setHolding(false);
  }
  /** Equal split, payer: a sideways stroke across the line crosses it out, like a tap. */
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(0);
  function pressDown(e: ReactPointerEvent) {
    setHolding(true);
    if (onToggleExcluded) swipeStart.current = { x: e.clientX, y: e.clientY };
    if (!onLongPress) return;
    longPressed.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      endPress();
      vibrate([12]);
      window.getSelection()?.removeAllRanges();
      onLongPress();
    }, 480);
  }
  function pressMove(e: ReactPointerEvent) {
    const start = pressStart.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) endPress();
    const swipe = swipeStart.current;
    if (swipe && onToggleExcluded) {
      const dx = Math.abs(e.clientX - swipe.x);
      if (dx > 10) setHolding(false);
      if (dx > 44 && Math.abs(e.clientY - swipe.y) < dx * 0.6) {
        swipeStart.current = null;
        // The click a browser may still send after the stroke must not toggle it back.
        swiped.current = Date.now();
        vibrate([12]);
        onToggleExcluded(item.id);
      }
    }
  }
  function pressEnd() {
    swipeStart.current = null;
    endPress();
  }

  // Long press on a guest's name (payer): asks whether to take their part off the line.
  const chipTimer = useRef<number | null>(null);
  const chipStart = useRef<{ x: number; y: number } | null>(null);
  const chipHeld = useRef(false);
  const [holdingChip, setHoldingChip] = useState<string | null>(null);
  function chipEnd() {
    if (chipTimer.current) window.clearTimeout(chipTimer.current);
    chipTimer.current = null;
    chipStart.current = null;
    setHoldingChip(null);
  }
  const chipHold = (personId: string) =>
    onHoldShare && personId !== me
      ? {
          onPointerDown: (e: ReactPointerEvent) => {
            chipHeld.current = false;
            chipStart.current = { x: e.clientX, y: e.clientY };
            setHoldingChip(personId);
            chipTimer.current = window.setTimeout(() => {
              chipHeld.current = true;
              chipEnd();
              vibrate([12]);
              window.getSelection()?.removeAllRanges();
              onHoldShare(personId);
            }, 480);
          },
          onPointerMove: (e: ReactPointerEvent) => {
            const start = chipStart.current;
            if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) chipEnd();
          },
          onPointerUp: chipEnd,
          onPointerLeave: chipEnd,
          onPointerCancel: chipEnd,
          onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
          // The click that ends the long press does nothing else (e.g. share a unit).
          onClickCapture: (e: ReactMouseEvent) => {
            if (!chipHeld.current) return;
            chipHeld.current = false;
            e.stopPropagation();
            e.preventDefault();
          },
        }
      : {};

  function toggle(e: ReactMouseEvent<HTMLButtonElement>) {
    // The click that ends a long press only closes it.
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    // Right on the "/2" (a little room around it, but not the whole line): bill the whole line again.
    const mark = item.divisor && onResetDivisor ? e.currentTarget.querySelector(".rline-divisor") : null;
    if (mark) {
      const r = mark.getBoundingClientRect();
      const slop = 8;
      if (e.clientX >= r.left - slop && e.clientX <= r.right + slop && e.clientY >= r.top - slop && e.clientY <= r.bottom + slop) {
        onResetDivisor!();
        return;
      }
    }
    if (!interactive) return;
    if (Date.now() - swiped.current < 600) return;
    if (onToggleExcluded) {
      onToggleExcluded(item.id);
      return;
    }
    if (!onSetSlots) return;
    // Ticking takes one unit (or, when none is free, the other half of an offered one);
    // more can be added with the stepper.
    if (myUnits > 0) onSetSlots(item.id, [], []);
    else onSetSlots(item.id, [freeSlots[0] ?? offeredSlots[0] ?? 0], []);
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

  // How much of the line is mine: a shared unit fills the circle only halfway.
  const fill = Math.min(1, (me ? unitShare(item, participants, me) : 0) / item.qty);
  const lineLabel = `${item.qty > 1 ? `${item.qty} × ` : ""}${item.name}, ${formatMoney(item.total, currency)}`;

  return (
    <li
      data-item={item.id}
      data-qty={item.qty}
      className={`rline${done ? " done" : ""}${takenByOthers ? " taken" : ""}${excluded ? " excluded" : ""}${struckUnits > 0 ? " partly" : ""}${item.fullTotal !== undefined ? " repriced" : ""}${myUnits > 0 ? " mine" : ""}${flash ? " flash" : ""}${
        each !== undefined || excluded ? " equal" : ""
      }${onToggleExcluded ? " strikable" : ""}${onLongPress ? " pressable" : ""}${holding ? " holding" : ""}`}
      style={{ animationDelay: `${180 + index * 70}ms` }}
    >
      <button
        type="button"
        className="rline-main"
        onClick={toggle}
        onPointerDown={onToggleExcluded || onLongPress ? pressDown : undefined}
        onPointerMove={onToggleExcluded || onLongPress ? pressMove : undefined}
        onPointerUp={onToggleExcluded || onLongPress ? pressEnd : undefined}
        onPointerLeave={onToggleExcluded || onLongPress ? pressEnd : undefined}
        onPointerCancel={onToggleExcluded || onLongPress ? pressEnd : undefined}
        onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
        disabled={!interactive && !onLongPress}
        aria-pressed={onToggleExcluded ? excluded : myUnits > 0}
        aria-label={
          onToggleExcluded
            ? excluded
              ? t("{line} – gestrichen, antippen zum Wiederaufnehmen", { line: lineLabel })
              : t("{line} – antippen zum Streichen", { line: lineLabel })
            : lineLabel
        }
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
              {item.qty > 1 && (
                <span className="rline-qty">
                  {struckUnits > 0 ? <s>{item.qty}x</s> : `${item.qty}x`}
                  {struckUnits > 0 && <span className="pencil rline-left"> {item.qty - struckUnits}x</span>}{" "}
                </span>
              )}
              {item.name}
            </span>
            {item.divisor && <span className="pencil rline-divisor">/{item.divisor}</span>}
          </span>
          {item.qty > 1 && <span className="rline-unit">{t("à {price}", { price: formatMoney(Math.round(item.total / item.qty), currency) })}</span>}
        </span>
        <span className="rline-dots" aria-hidden="true" />
        {each !== undefined && !excluded && forNames?.length ? (
          <span className="pencil rline-each rline-for" title={t("Direkt zugeordnet")}>
            {forNames.join(" + ")}
          </span>
        ) : (
          each !== undefined &&
          !excluded && (
            <span className="pencil rline-each" title={t("Anteil pro Person")}>
              {formatMoney(each, currency)}
            </span>
          )
        )}
        <span className="rline-price">
          {item.fullTotal !== undefined && <s className="rline-full">{formatMoney(item.fullTotal, currency)}</s>}
          {struckUnits > 0 && <s className="rline-full">{formatMoney(item.total, currency)}</s>}
          {formatMoney(billedTotal, currency)}
        </span>
        {each !== undefined && !excluded && !forNames?.length && <span className="pencil rline-div">/{people}</span>}
      </button>

      {canEdit && item.qty > 1 && myUnits > 0 && (
        <div className="rline-stepper">
          <button type="button" onClick={() => onSetSlots!(item.id, mySlots.slice(0, -1), mySplits)} aria-label={t("Eins weniger")}>
            −
          </button>
          <span>
            {t("{units} von {qty} für Dich", { units: formatUnits(me ? unitShare(item, participants, me) : 0), qty: item.qty })}
          </span>
          <button
            type="button"
            onClick={() => onSetSlots!(item.id, [...mySlots, freeSlots[0]], mySplits)}
            disabled={freeSlots.length === 0}
            aria-label={t("Eins mehr")}
          >
            +
          </button>
        </div>
      )}

      {claimants.length > 0 && each === undefined && forNames === undefined && (
        <ul className="rline-claims">
          {claimants.map((p) => {
            const units = unitShare(item, participants, p.id);
            const isMe = p.id === me;
            const sharing = isMe ? mySplits.length > 0 : (p.claims[item.id] ?? []).some((slot) => mySlots.includes(slot));
            const offering = !isMe && waiting(p).length > 0;
            const label = (
              <>
                <span className="claim-dot" aria-hidden="true">✓</span>
                {isMe ? t("Du") : p.name}
                {(item.qty > 1 || units < 1) && <> ×{formatUnits(units)}</>}
                <span className="claim-cost">{formatMoney(claimCost(item, units), currency)}</span>
              </>
            );
            const clickable = canEdit && (!isMe || mySplits.length > 0 || soloSlot !== undefined);
            if (contest && p.id === contest.personId) {
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="claim-btn contest"
                    onClick={() => contest.onRemove(item.id)}
                    aria-label={t("Anteil von {name} wegklicken", { name: p.name })}
                  >
                    {label}
                    <span className="claim-x" aria-hidden="true">
                      ✕
                    </span>
                  </button>
                </li>
              );
            }
            return (
              <li
                key={p.id}
                className={[isMe ? "me" : "", onHoldShare && !isMe ? "holdable" : "", holdingChip === p.id ? "holding" : ""].filter(Boolean).join(" ") || undefined}
                {...chipHold(p.id)}
              >
                {clickable ? (
                  <button
                    type="button"
                    className={`claim-btn${sharing ? " sharing" : ""}${offering ? " offer" : ""}`}
                    onClick={() => (isMe ? toggleOffer() : toggleShare(p.id))}
                    aria-pressed={sharing}
                    aria-label={
                      isMe
                        ? sharing
                          ? t("Doch nicht teilen")
                          : t("Zum Teilen freigeben und nur die Hälfte zahlen")
                        : sharing
                          ? t("Nicht mehr mit {name} teilen", { name: p.name })
                          : t("Ein Stück mit {name} teilen", { name: p.name })
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
          {shared && <li className="shared-note">{t("geteilt")}</li>}
          {iAmWaiting && <li className="shared-note">{t("wartest auf jemanden")}</li>}
          {someoneElseWaiting && <li className="shared-note">{t("wartet auf jemanden")}</li>}
        </ul>
      )}
      {contest && (
        <p className="rline-hint contest">
          {t("Hattest Du „{item}“ allein? Tippe auf {name}, um den Anteil wegzuklicken.", { item: item.name, name: contest.personName })}
        </p>
      )}
      {canEdit && myWaiting && (
        <p className="rline-hint">
          {item.qty > 1
            ? t("Du zahlst von einem Stück nur die Hälfte. Die andere Hälfte bleibt offen, bis jemand auf Deinen Namen tippt.")
            : t("Du zahlst die Hälfte. Die andere Hälfte bleibt offen, bis jemand auf Deinen Namen tippt.")}
        </p>
      )}
      {canEdit &&
        othersWaiting.map((p) => (
          <p key={p.id} className="rline-hint offer">
            {t("{name} möchte teilen – tippe auf den Kreis oder den Namen, um die andere Hälfte zu übernehmen.", { name: p.name })}
          </p>
        ))}
      {canEdit && item.qty > 1 && done && myUnits === 0 && (
        <p className="rline-hint">{t("Alle Stück sind vergeben. Tippe auf einen Namen, um ein Stück zu teilen.")}</p>
      )}
    </li>
  );
}

/**
 * A fee or the tip below the subtotal. In the equal split the payer can tap it to cross it
 * out (and back in), with the same press-in and pop as the item lines.
 */
export function FeeLine({
  name,
  amount,
  currency,
  each,
  people,
  excluded,
  onToggle,
}: {
  name: string;
  amount: number;
  currency: string;
  each?: number;
  people?: number;
  excluded?: boolean;
  onToggle?: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const cls = `fee-line${excluded ? " struck" : ""}${onToggle ? " strikable" : ""}${holding ? " holding" : ""}`;
  const press = onToggle
    ? {
        onClick: onToggle,
        onPointerDown: () => setHolding(true),
        onPointerUp: () => setHolding(false),
        onPointerLeave: () => setHolding(false),
        onPointerCancel: () => setHolding(false),
      }
    : {};
  return (
    <>
      <dt
        className={cls}
        {...press}
        role={onToggle ? "button" : undefined}
        tabIndex={onToggle ? 0 : undefined}
        aria-pressed={onToggle ? Boolean(excluded) : undefined}
        aria-label={
          onToggle
            ? excluded
              ? t("{line} – gestrichen, antippen zum Wiederaufnehmen", { line: `${name}, ${formatMoney(amount, currency)}` })
              : t("{line} – antippen zum Streichen", { line: `${name}, ${formatMoney(amount, currency)}` })
            : undefined
        }
        onKeyDown={onToggle ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle()) : undefined}
      >
        <span className="fee-strike">{name}</span>
      </dt>
      <dd className={cls} {...press}>
        {each !== undefined && !excluded && <span className="pencil rline-each">{formatMoney(each, currency)}</span>}
        <span className="fee-strike">{formatMoney(amount, currency)}</span>
        {each !== undefined && !excluded && <span className="pencil rline-div">/{people}</span>}
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
    <span className="fraction" aria-label={t("{total} geteilt durch {people} ist {share} pro Person", { total: formatMoney(total, currency), people, share: formatMoney(share, currency) })}>
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
        <small>{t("pro Person")}</small>
      </span>
    </span>
  );
}

const TAP_DEMO_KEY = (billId: string) => `billsplit.tapDemo.${billId}`;

/**
 * Equal split, payer's view: shows in a loop how lines are crossed out (with the finger or by
 * tapping) and that holding one down bills only a part of it. Runs once per bill and stops as
 * soon as the payer touches a line.
 */
function useTapDemo(billId: string, enabled: boolean, canHold: boolean, list: RefObject<HTMLUListElement | null>) {
  const [demo, setDemo] = useState<DemoLayout | null>(null);
  useLayoutEffect(() => {
    if (!enabled || !list.current) return;
    try {
      if (localStorage.getItem(TAP_DEMO_KEY(billId))) return;
    } catch {
      // Without storage the demo simply shows again next time.
    }
    const layout = demoLayout(list.current, "li[data-item]:not(.excluded)");
    const lines = list.current.querySelectorAll<HTMLElement>("li[data-item]");
    if (!layout || !lines.length) return;
    if (!canHold) delete layout.hold;
    // Starts once the lines are on screen (the payer first sees the QR code).
    return onceInView(lines[Math.min(lines.length, 3) - 1], () => {
      try {
        localStorage.setItem(TAP_DEMO_KEY(billId), "1");
      } catch {
        // see above
      }
      setDemo(layout);
    });
  }, [billId, enabled, canHold, list]);
  return [demo, () => setDemo(null)] as const;
}

/** The digital bill in classic receipt style, with tick circles in front of every line. */
export default function Receipt({ snapshot, onSetSlots, onShowOriginal, onToggleExcluded, onEditDivisor, onResetDivisor, onToggleFee, onToggleTip, contest, onHoldShare }: Props) {
  const { data, participants, me, ownerName } = snapshot;
  const billed = billedItems(data);
  const sub = subtotal(billed);
  const total = billTotal(data);
  const assigned = billed.filter((i) => isFullyAssigned(i, participants)).length;
  const equal = Boolean(data.equalSplit);
  // Supermarket, "Alles aufteilen": for the payer, what is probably not for everyone is listed first.
  const maybePersonal = snapshot.isOwner && equal && data.items.some((i) => i.maybePersonal) && data.items.some((i) => !i.maybePersonal);
  const groupHeading = (idx: number) => {
    if (!maybePersonal) return null;
    const item = data.items[idx];
    const before = data.items[idx - 1];
    if (item.maybePersonal && (!before || !before.maybePersonal)) return <li className="rline-group" aria-hidden="true">{t("Vielleicht nicht für alle?")}</li>;
    if (!item.maybePersonal && before?.maybePersonal) return <li className="rline-group" aria-hidden="true">{t("Für alle")}</li>;
    return null;
  };
  const people = splitHeadCount(data, participants);
  // One person (an expense assigned to one friend): nothing to divide.
  const perPerson = (amount: number) => (equal && people > 1 ? Math.round(amount / people) : undefined);
  const list = useRef<HTMLUListElement>(null);
  const [demo, endDemo] = useTapDemo(snapshot.id, Boolean(onToggleExcluded), Boolean(onEditDivisor), list);
  const demoLoop = useDemoLoop(demo, Boolean(demo));
  const toggleExcluded = onToggleExcluded && ((itemId: string) => (endDemo(), onToggleExcluded(itemId)));
  const editDivisor = onEditDivisor && ((itemId: string) => (endDemo(), onEditDivisor(itemId)));
  // Normal split: show once how ticking, sharing and offering to share works.
  const claimDemo = useClaimDemo(snapshot.id, Boolean(onSetSlots && me) && !equal, list);
  const setSlots = onSetSlots && ((itemId: string, slots: number[], splits: number[]) => (claimDemo.stop(), onSetSlots(itemId, slots, splits)));
  const otherName = participants.find((p) => p.id !== me && p.name.trim())?.name.trim() ?? "Anna";

  return (
    <article className="receipt" aria-label={t("Digitale Rechnung")}>
      <PencilFilter />
      <div className="receipt-paper">
        <header className="receipt-head">
          <div className="receipt-logo" aria-hidden="true">
            ✦
          </div>
          <h2>{data.title || t("Rechnung")}</h2>
          <p>{formatDate(data.date)}</p>
          <p className="receipt-paidby">{t("bezahlt von {name}", { name: ownerName || "?" })}</p>
        </header>

        <div className="receipt-rule" aria-hidden="true" />
        <div className="receipt-cols" aria-hidden="true">
          <span>{t("Artikel")}</span>
          <span>{data.currency}</span>
        </div>

        <div className="receipt-lines-wrap">
          {demo && <ReceiptDemo layout={demo} phase={demoLoop.phase} round={demoLoop.round} ghostDivisor />}
          {claimDemo.layout && !equal && <ClaimDemo layout={claimDemo.layout} step={claimDemo.step} stage={claimDemo.stage} otherName={otherName} />}
          <ul className="receipt-lines" ref={list}>
            {data.items.map((item, idx) => (
              <Fragment key={item.id}>
                {groupHeading(idx)}
              <ReceiptLine
                key={item.id}
                item={item}
                index={idx}
                participants={participants}
                me={me}
                currency={data.currency}
                onSetSlots={setSlots}
                onToggleExcluded={toggleExcluded}
                onLongPress={editDivisor && !item.excluded ? () => editDivisor(item.id) : undefined}
                onResetDivisor={onResetDivisor && (() => (endDemo(), onResetDivisor(item.id)))}
                each={perPerson(billedItem(item).total)}
                people={people}
                forNames={equal ? lineFor(item, participants).map((id) => (id === me ? t("Du") : (participants.find((p) => p.id === id)?.name ?? "?"))) : undefined}
                contest={contest?.itemIds.includes(item.id) ? contest : undefined}
                onHoldShare={onHoldShare && !equal ? (personId) => onHoldShare(personId, item.id) : undefined}
              />
              </Fragment>
            ))}
          </ul>
        </div>

        <div className="receipt-rule" aria-hidden="true" />
        <dl className="receipt-sums">
          {/* Also when everything here is crossed out: the lines stay, struck through. */}
          {((data.fees ?? []).length > 0 || hasTip(data)) && (
            <>
              <dt>{t("Zwischensumme")}</dt>
              <dd>
                {equal && <span className="pencil rline-each">{formatMoney(perPerson(sub - personalTotal(data, participants))!, data.currency)}</span>}
                {formatMoney(sub, data.currency)}
                {equal && <span className="pencil rline-div">/{people}</span>}
              </dd>
              {(data.fees ?? []).map((fee) => (
                <FeeLine
                  key={fee.id}
                  name={fee.name}
                  amount={fee.amount}
                  currency={data.currency}
                  each={perPerson(fee.amount)}
                  people={people}
                  excluded={fee.excluded}
                  onToggle={onToggleFee && (() => onToggleFee(fee.id))}
                />
              ))}
              {hasTip(data) && (
                <FeeLine
                  name={data.tipAmount ? t("Trinkgeld") : t("Trinkgeld {percent} %", { percent: data.tipPercent })}
                  amount={tipOnReceipt(data)}
                  currency={data.currency}
                  each={perPerson(tipOnReceipt(data))}
                  people={people}
                  excluded={data.tipExcluded}
                  onToggle={onToggleTip}
                />
              )}
            </>
          )}
          {/* A discount that took back a fee (free delivery): said once, so the per-head fees add up. */}
          {!equal &&
            feeSplit(data).offsets.map((o) => (
              <Fragment key={`${o.discount.id}-${o.fee.id}`}>
                <dt className="tip-split">{t("{discount} mit {fee} verrechnet", { discount: o.discount.name, fee: o.fee.name })}</dt>
                <dd className="tip-split">{formatMoney(-o.amount, data.currency)}</dd>
              </Fragment>
            ))}
          {sharedTotal(data) !== 0 && !equal && (
            <>
              <dt className="tip-split">
                {perHeadFees(data) !== 0
                  ? tipPerHead(data) !== 0
                    ? t("Gebühren & Trinkgeld ÷ {count} Personen", { count: splitHeadCount(data, participants) })
                    : t("Gebühren ÷ {count} Personen", { count: splitHeadCount(data, participants) })
                  : t("Trinkgeld ÷ {count} Personen", { count: splitHeadCount(data, participants) })}
              </dt>
              <dd className="tip-split">{t("je {amount}", { amount: formatMoney(sharedPerPerson(data, participants), data.currency) })}</dd>
            </>
          )}
          {/* The tip raises every item by the same percentage (see itemShare). */}
          {data.tipByShare && tipTotal(data) > 0 && sub > 0 && !equal && (
            <>
              <dt className="tip-split">{t("Trinkgeld auf jede Position")}</dt>
              <dd className="tip-split">
                +{new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(tipTotal(data) / sub)}
              </dd>
            </>
          )}
          {/* Discounts lower every item by the same percentage (see itemShare). */}
          {discountTotal(data) !== 0 && sub > 0 && !equal && (
            <>
              <dt className="tip-split">{t("Rabatt auf jede Position")}</dt>
              <dd className="tip-split">
                {new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(discountTotal(data) / sub)}
              </dd>
            </>
          )}
          {/* Lines given to particular people: the full sum first, then what everyone shares. */}
          {equal && people > 1 && personalTotal(data, participants) > 0 && (
            <>
              <dt className="grand">{t("SUMME")}</dt>
              <dd className="grand">{formatMoney(total, data.currency)}</dd>
            </>
          )}
          <dt className="grand">{equal && people > 1 && personalTotal(data, participants) > 0 ? t("Für alle") : t("SUMME")}</dt>
          {equal && people > 1 ? (
            <dd className="grand">
              <EqualFraction total={poolTotal(data, participants)} people={people} share={equalShare(data, participants)} currency={data.currency} />
            </dd>
          ) : (
            <dd className="grand">{formatMoney(total, data.currency)}</dd>
          )}
        </dl>
        <div className="receipt-rule double" aria-hidden="true" />
        <p className="receipt-progress">
          {equal
            ? people === 1
              ? t("Geht komplett an eine Person")
              : t("Gleichmäßig auf {people} Personen verteilt", { people })
            : t("{assigned} von {count} Positionen vollständig zugeordnet", { assigned, count: billed.length })}
        </p>
        <div className="receipt-barcode" aria-hidden="true" />
        <p className="receipt-thanks">{t("Danke & bis zum nächsten Mal!")}</p>
        <p className="receipt-brand">{t("mit klicksplit geteilt")} · klicksplit.de</p>
        {onShowOriginal && (
          <button type="button" className="receipt-original" onClick={onShowOriginal}>
            {t("Zum Originalbeleg")}
          </button>
        )}
      </div>
    </article>
  );
}
