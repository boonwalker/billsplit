import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { billedItems, type BillFee, type BillItem } from "../lib/bill";
import { boundsOf, type InkPoint, type Stroke } from "../lib/ink";
import { vibrate } from "../lib/haptics";
import { formatMoney } from "../lib/money";
import DivisorSheet from "./DivisorSheet";
import InkLayer from "./InkLayer";
import PhotoViewer from "./PhotoViewer";
import ReceiptDemo, { demoLayout, useDemoLoop, type DemoLayout } from "./ReceiptDemo";
import { FeeLine, formatDate, PencilFilter } from "./Receipt";

/**
 * What the payer marked on a line: how many of its units are crossed out (by strokes or taps).
 * A single item is all or nothing; of "3x Joghurt" one or two can go as well.
 */
export interface Mark {
  units?: number;
  /** Long press: only 1/divisor of the line goes into the split (the payer takes the rest). */
  divisor?: number;
}

const struckUnits = (item: BillItem, mark?: Mark) => Math.min(item.qty, mark?.units ?? 0);

/**
 * The items for the bill: fully struck lines stay visible but are excluded from billing;
 * of partly struck ones only the remaining units are billed (the receipt keeps all of them).
 */
export function applyMarks(items: BillItem[], marks: Record<string, Mark>): BillItem[] {
  return items.map((original) => {
    const divisor = marks[original.id]?.divisor ?? 1;
    const item =
      divisor > 1 ? { ...original, fullTotal: original.total, divisor, total: Math.round(original.total / divisor) } : original;
    const units = struckUnits(item, marks[item.id]);
    if (units === 0) return item;
    if (units >= item.qty) return { ...item, excluded: true };
    return { ...item, struck: units };
  });
}

interface Props {
  items: BillItem[];
  currency: string;
  /**
   * persons: how many share the purchase (payer included), undefined = count who joins.
   * partial: the payer said some items are not or only partly billed.
   */
  onDone: (items: BillItem[], equalSplit: boolean, persons: number | undefined, partial: boolean, excludedFees: string[]) => void;
  /** Fees on the receipt (e.g. a paper bag): shown below a subtotal, they can be crossed out too. */
  fees?: BillFee[];
  /** Items that are probably not a shared expense; they are listed first, ready to be crossed out. */
  isPersonal?: (item: BillItem) => boolean;
  /** Shown in the head of the receipt, like on the finished bill. */
  title?: string;
  date?: string;
  ownerName?: string;
  /** The photo the receipt was read from, linked at the bottom like on the finished bill. */
  photoUrl?: string;
}

/** For the finished bill: lines crossed out completely move to the bottom, the rest keeps the receipt order. */
export function struckLast(items: BillItem[]): BillItem[] {
  return [...items.filter((i) => !i.excluded), ...items.filter((i) => i.excluded)];
}

/** Likely personal items first, otherwise in receipt order. */
export function orderForMarking(items: BillItem[], isPersonal: (item: BillItem) => boolean): BillItem[] {
  return [...items.filter(isPersonal), ...items.filter((i) => !isPersonal(i))];
}


/**
 * Asked after a supermarket receipt was recognised: is anything not (or only partly)
 * billed – e.g. a litre of milk bought, but only 250 ml used for the shared recipe?
 * With "Manches nicht" the payer crosses lines out (or taps them); the rest is split equally.
 */
export default function SupermarketSheet({ items, fees = [], currency, onDone, isPersonal = () => false, title, date, ownerName, photoUrl }: Props) {
  /** First the question, then either straight on ("all") or the receipt to mark ("some"). */
  const [step, setStep] = useState<"ask" | "all" | "some">("ask");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [persons, setPersons] = useState<number | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  /** "Manches nicht": split the rest equally (default) or let everyone tick their own lines. */
  const [split, setSplit] = useState(true);
  /** The line whose settings are open after a long press. */
  const [divisorFor, setDivisorFor] = useState<string | null>(null);
  /** The line that was just tapped: it is pressed in and pops back up. */
  const [pressed, setPressed] = useState<{ id: string; n: number } | null>(null);
  const ordered = orderForMarking(items, isPersonal);
  const personalCount = ordered.filter(isPersonal).length;
  const [demo, setDemo] = useState<DemoLayout | null>(null);
  const list = useRef<HTMLUListElement>(null);

  // The notice floats over the receipt for a moment, then gets out of the way.
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(t);
  }, [notice]);

  /** Fees crossed out in "Manches nicht". */
  const [struckFees, setStruckFees] = useState<string[]>([]);
  const billed = step === "some" ? applyMarks(items, marks) : items;
  const itemsSum = billedItems({ items: billed }).reduce((s, i) => s + i.total, 0);
  const excludedFees = step === "some" ? struckFees : [];
  const billedSum = itemsSum + fees.reduce((s, f) => s + (excludedFees.includes(f.id) ? 0 : f.amount), 0);
  const anyBilled = billed.some((i) => !i.excluded);
  const fullSum = items.reduce((s, i) => s + i.total, 0) + fees.reduce((s, f) => s + f.amount, 0);

  function toggleFee(fee: BillFee) {
    const struck = !struckFees.includes(fee.id);
    setStruckFees(struck ? [...struckFees, fee.id] : struckFees.filter((id) => id !== fee.id));
    setNotice(`${fee.name} wird ${struck ? "nicht" : "wieder"} abgerechnet.`);
  }

  // Place the demos on the lines once the paper is laid out; they loop until the paper is touched.
  // Without the equal split everyone ticks their own lines: no long press, so the demo leaves it out.
  useLayoutEffect(() => {
    if (step !== "some" || !list.current) return;
    const layout = demoLayout(list.current);
    if (layout && !split) delete layout.hold;
    setDemo(layout);
  }, [step, items, split]);
  const { phase: demoPhase, round: demoRound } = useDemoLoop(demo, step === "some" && !touched);

  /** The line under a vertical position (the nearest one when written between lines). */
  function lineAt(y: number): string | null {
    const lines = [...(list.current?.querySelectorAll<HTMLElement>("li[data-item]") ?? [])];
    if (!lines.length) return null;
    const distance = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    };
    return lines.reduce((best, el) => (distance(el) < distance(best) ? el : best)).dataset.item ?? null;
  }

  /**
   * Crosses lines out, or brings them back when they are crossed out already. Of a line with
   * several units every stroke or tap takes one more; after the last one they all come back.
   */
  function toggle(hit: BillItem[]) {
    if (!hit.length) return;
    const next = { ...marks };
    for (const item of hit) {
      const units = struckUnits(item, marks[item.id]);
      next[item.id] = { units: units >= item.qty ? 0 : units + 1 };
    }
    setMarks(next);
    if (hit.length === 1) {
      const [item] = hit;
      const units = struckUnits(item, next[item.id]);
      setNotice(
        units === 0
          ? `${item.name} wird wieder abgerechnet.`
          : units < item.qty
            ? `${units} von ${item.qty} × ${item.name} ${units === 1 ? "wird" : "werden"} nicht abgerechnet – nochmal tippen streicht eins mehr.`
            : `${item.name} wird nicht abgerechnet.`,
      );
      return;
    }
    const names = hit.map((i) => i.name).join(", ");
    setNotice(hit.every((i) => struckUnits(i, next[i.id]) > 0) ? `${names} werden nicht abgerechnet.` : `${names} werden wieder abgerechnet.`);
  }

  /** The line under a touch point. */
  function itemAt(point: InkPoint): BillItem | undefined {
    const line = [...(list.current?.querySelectorAll<HTMLElement>("li[data-item]") ?? [])].find((el) => {
      const r = el.getBoundingClientRect();
      return point.y >= r.top - 6 && point.y <= r.bottom + 6;
    });
    return line ? items.find((i) => i.id === line.dataset.item) : undefined;
  }

  /** Long press: open the settings of the line – bill only a part of it. */
  function hold(point: InkPoint) {
    const item = itemAt(point);
    if (!item) return;
    vibrate([12]);
    // A selection iOS may have started under the resting finger.
    window.getSelection()?.removeAllRanges();
    setPressed((p) => ({ id: item.id, n: (p?.n ?? 0) + 1 }));
    setDivisorFor(item.id);
  }

  function setDivisor(item: BillItem, divisor: number) {
    setMarks((m) => ({ ...m, [item.id]: { ...m[item.id], divisor: divisor > 1 ? divisor : undefined } }));
    setNotice(divisor > 1 ? `${item.name}: nur 1/${divisor} wird aufgeteilt, den Rest trägst Du.` : `${item.name} wird wieder ganz aufgeteilt.`);
  }

  /** Whether a tap hit the pencilled "/2" of a line (a little room around it, but not the whole line). */
  function onDivisor(item: BillItem, point: InkPoint): boolean {
    const mark = list.current?.querySelector<HTMLElement>(`li[data-item="${CSS.escape(item.id)}"] .rline-divisor`);
    if (!mark) return false;
    const r = mark.getBoundingClientRect();
    const slop = 8;
    return point.x >= r.left - slop && point.x <= r.right + slop && point.y >= r.top - slop && point.y <= r.bottom + slop;
  }

  /**
   * A tap crosses the line out (or back in); it is pressed in and pops back up. A tap right on
   * the "/2" takes that back instead: the whole line goes into the split again.
   */
  function tap(point: InkPoint) {
    const item = itemAt(point);
    if (!item) return;
    setPressed((p) => ({ id: item.id, n: (p?.n ?? 0) + 1 }));
    if ((marks[item.id]?.divisor ?? 1) > 1 && onDivisor(item, point)) setDivisor(item, 1);
    else toggle([item]);
  }

  /** Every stroke crosses out the line it was drawn on (up/down swipes scroll instead). */
  function readInk(strokes: Stroke[]) {
    const ids = new Set<string>();
    for (const stroke of strokes.filter((st) => st.length > 1)) {
      const b = boundsOf(stroke);
      const id = lineAt((b.minY + b.maxY) / 2);
      if (id) ids.add(id);
    }
    toggle(items.filter((i) => ids.has(i.id)));
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // A shopping trip is always split equally: everything not crossed out is shared by x people.
    // Marking lines splits the rest equally unless the payer switched that off above the receipt.
    if (anyBilled) onDone(step === "some" ? struckLast(billed) : billed, step === "some" ? split : true, persons, step === "some", excludedFees);
  };

  const personsStepper = (
    <div className="stepper-mini" role="group" aria-label="Personen, die sich den Einkauf teilen">
      <button type="button" onClick={() => setPersons((n) => (n && n > 2 ? n - 1 : undefined))} aria-label="Eine Person weniger">
        −
      </button>
      <span>{persons ?? "?"}</span>
      <button type="button" onClick={() => setPersons((n) => Math.min(100, (n ?? 1) + 1))} aria-label="Eine Person mehr">
        +
      </button>
    </div>
  );

  // "Manches nicht": the whole screen becomes the receipt paper to scribble on.
  if (step === "some") {
    return (
      <form className="scribble" onSubmit={submit}>
        <PencilFilter />
        <div className="scribble-scroll ink-scroll">
          <button
            type="button"
            role="switch"
            aria-checked={split}
            className={`equal-toggle scribble-toggle${split ? " on" : ""}`}
            onClick={() => setSplit((on) => !on)}
          >
            <span className="equal-toggle-text">
              <b>Gleichverteilung</b>
              <small>{split ? "Alles, was nicht gestrichen ist, wird gleichmäßig geteilt." : "Aus: Jeder hakt auf der Rechnung selbst ab, was er hatte."}</small>
            </span>
            <span className="switch" aria-hidden="true" />
          </button>
          <article className="receipt shop-paper" aria-label="Rechnung zum Markieren">
            <div className="receipt-paper">
              <header className="receipt-head">
                <div className="receipt-logo" aria-hidden="true">
                  ✦
                </div>
                <h2>{title || "Einkauf"}</h2>
                <p>{formatDate(date ?? "")}</p>
                {ownerName && <p className="receipt-paidby">bezahlt von {ownerName}</p>}
              </header>
              <div className="receipt-rule" aria-hidden="true" />
              <div className="receipt-cols" aria-hidden="true">
                <span>Artikel</span>
                <span>{currency}</span>
              </div>
              <div className="receipt-lines-wrap">
                <InkLayer onInk={readInk} onTap={tap} onLongPress={split ? hold : undefined} onStart={() => setTouched(true)} />
                {demo && !touched && <ReceiptDemo layout={demo} phase={demoPhase} round={demoRound} />}
                <ul className="receipt-lines" ref={list}>
                  {ordered.map((item, index) => {
                    const units = struckUnits(item, marks[item.id]);
                    const allStruck = units >= item.qty;
                    const partly = units > 0 && !allStruck;
                    // The demo shows "/2" on its line for a moment without marking it.
                    const divisor = marks[item.id]?.divisor ?? (demoPhase === "held" && demo?.hold?.id === item.id ? 2 : 1);
                    const base = divisor > 1 ? Math.round(item.total / divisor) : item.total;
                    const price = partly ? Math.round((base * (item.qty - units)) / item.qty) : base;
                    const heading =
                      personalCount > 0 && personalCount < ordered.length && (index === 0 || index === personalCount) ? (
                        <li className="rline-group" aria-hidden="true">
                          {index === 0 ? "Wahrscheinlich nicht für alle" : "Für alle"}
                        </li>
                      ) : null;
                    return (
                      <Fragment key={item.id}>
                        {heading}
                        <li
                          data-item={item.id}
                          data-qty={item.qty}
                          className={`rline${allStruck ? " done" : ""}${partly ? " partly" : ""}${divisor > 1 ? " repriced" : ""}${
                            pressed?.id === item.id ? " pressed" : ""
                          }${demoPhase === "press" && demo?.hold?.id === item.id ? " demo-holding" : ""}`}
                        >
                          {/* Re-keyed on every tap so the press animation starts again. */}
                          <div className="rline-main" key={pressed?.id === item.id ? pressed.n : 0}>
                            <span className="rline-text">
                              <span className="rline-name">
                                <span className="rline-strike">
                                  {item.qty > 1 && (
                                    <span className="rline-qty">
                                      {partly ? <s>{item.qty}x</s> : `${item.qty}x`}
                                      {partly && <span className="pencil rline-left"> {item.qty - units}x</span>}{" "}
                                    </span>
                                  )}
                                  {item.name}
                                </span>
                                {divisor > 1 && <span className="pencil rline-divisor">/{divisor}</span>}
                              </span>
                              {item.qty > 1 && <span className="rline-unit">à {formatMoney(Math.round(item.total / item.qty), currency)}</span>}
                            </span>
                            <span className="rline-dots" aria-hidden="true" />
                            <span className="rline-price">
                              {(partly || divisor > 1) && <s className="rline-full">{formatMoney(item.total, currency)}</s>}
                              {formatMoney(price, currency)}
                            </span>
                            {/* Every line that is not crossed out is shared by everyone. */}
                            {split && !allStruck && <span className="pencil rline-div">/{persons ?? "x"}</span>}
                          </div>
                        </li>
                      </Fragment>
                    );
                  })}
                </ul>
              </div>
              <div className="receipt-rule" aria-hidden="true" />
              <dl className="receipt-sums">
                {fees.length > 0 && (
                  <>
                    <dt>Zwischensumme</dt>
                    <dd>{formatMoney(itemsSum, currency)}</dd>
                    {fees.map((fee) => (
                      <FeeLine
                        key={fee.id}
                        name={fee.name}
                        amount={fee.amount}
                        currency={currency}
                        excluded={struckFees.includes(fee.id)}
                        onToggle={() => toggleFee(fee)}
                      />
                    ))}
                  </>
                )}
                {billedSum !== fullSum && (
                  <>
                    <dt>Auf dem Beleg</dt>
                    <dd>{formatMoney(fullSum, currency)}</dd>
                  </>
                )}
                <dt className="grand">SUMME</dt>
                <dd className="grand">{formatMoney(billedSum, currency)}</dd>
              </dl>
              <div className="receipt-rule double" aria-hidden="true" />
              <div className="receipt-barcode" aria-hidden="true" />
              <p className="receipt-thanks">Danke &amp; bis zum nächsten Mal!</p>
              {photoUrl && (
                <button type="button" className="receipt-original" onClick={() => setShowPhoto(true)}>
                  Zum Originalbeleg
                </button>
              )}
            </div>
          </article>
        </div>
        {divisorFor &&
          (() => {
            const item = items.find((i) => i.id === divisorFor);
            return (
              item && (
                <DivisorSheet
                  item={{ ...item, divisor: marks[item.id]?.divisor }}
                  currency={currency}
                  onApply={(d) => setDivisor(item, d)}
                  onClose={() => setDivisorFor(null)}
                />
              )
            );
          })()}
        {showPhoto && photoUrl && <PhotoViewer src={photoUrl} alt="Originalbeleg" onClose={() => setShowPhoto(false)} />}

        <footer className="scribble-foot">
          {notice && (
            <p className="scribble-notice" role="status" key={notice}>
              {notice}
            </p>
          )}
          <div className="scribble-controls">
            {/* "/ 4": what everything not crossed out is divided by – the head count for the equal split. */}
            {split ? (
            <div className="divide-by" role="group" aria-label="Alles geteilt durch">
              {/* A pencilled "/" – a firm stroke with a fainter second pass. */}
              <svg className="divide-by-sign" viewBox="0 0 40 90" aria-hidden="true">
                <path d="M33 5 C 28 28, 19 55, 7 86" />
                <path d="M35 9 C 29 33, 21 58, 10 84" className="divide-by-sign-thin" />
              </svg>
              <span className="divide-by-value" aria-live="polite">
                {persons ?? "?"}
              </span>
              <div className="divide-by-arrows">
                <button type="button" onClick={() => setPersons((n) => Math.min(100, (n ?? 1) + 1))} aria-label="Eine Person mehr">
                  <svg viewBox="0 0 40 20" aria-hidden="true">
                    <path d="M4 16 C 12 10, 16 6, 20 3 C 25 7, 30 11, 36 16" />
                  </svg>
                </button>
                <button type="button" onClick={() => setPersons((n) => (n && n > 2 ? n - 1 : undefined))} aria-label="Eine Person weniger">
                  <svg viewBox="0 0 40 20" aria-hidden="true">
                    <path d="M4 4 C 12 10, 16 14, 20 17 C 25 13, 30 9, 36 4" />
                  </svg>
                </button>
              </div>
            </div>
            ) : (
              <p className="scribble-own">Jeder hakt ab, was er hatte.</p>
            )}
            <div className="scribble-side">
              <p className="scribble-sum">
                = {formatMoney(billedSum, currency)}
                {billedSum !== fullSum && <small>statt {formatMoney(fullSum, currency)}</small>}
              </p>
              {split && (
                <p className="scribble-each">
                  {persons ? `je ${formatMoney(Math.round(billedSum / persons), currency)} pro Person` : "Personenzahl wählen"}
                </p>
              )}
            </div>
          </div>
          <div className="scribble-actions">
            <button type="button" className="icon-btn scribble-back" aria-label="Zurück" onClick={() => setStep("ask")}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="btn btn-primary btn-large" disabled={!anyBilled}>
              Rechnung erstellen
            </button>
          </div>
        </footer>
      </form>
    );
  }

  return (
    <div className="sheet-backdrop">
      <form className="sheet" onSubmit={submit}>
        <div className="sheet-emoji" aria-hidden="true">
          🛒
        </div>
        <h2>Supermarkt-Einkauf</h2>

        {step === "ask" ? (
          <>
            <p className="muted">
              Soll etwas <b>nicht</b> oder <b>nur teilweise</b> in Rechnung gestellt werden?
              <small className="shop-examples">z.B. Gewürze, Duschgel, Pfand?</small>
            </p>
            <button type="button" className="btn btn-primary btn-large" onClick={() => setStep("all")}>
              Alles aufteilen
            </button>
            <button type="button" className="btn btn-secondary btn-large" onClick={() => setStep("some")}>
              Manches nicht
            </button>
            {/* Straight to the bill without the equal split: everyone ticks what they had. */}
            <button type="button" className="btn btn-secondary btn-large" onClick={() => onDone(items, false, undefined, false, [])}>
              Jeder selber abhaken
            </button>
          </>
        ) : (
          <>
            {/* Split equally by default; the payer can still switch it off on the bill. */}
            <div className="row between shop-persons">
              <span>
                Wie viele teilen sich den Einkauf? <span className="shop-persons-hint">inklusive Dir</span>
              </span>
              {personsStepper}
            </div>

            <p className="shop-sum">
              Abgerechnet werden <b>{formatMoney(billedSum, currency)}</b>
            </p>

            <button className="btn btn-primary btn-large" disabled={!anyBilled}>
              Rechnung erstellen
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStep("ask")}>
              Zurück
            </button>
          </>
        )}
      </form>
    </div>
  );
}
