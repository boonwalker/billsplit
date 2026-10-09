import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { BillItem } from "../lib/bill";
import { boundsOf, recognizeDivisor, type InkPoint, type Stroke } from "../lib/ink";
import { formatMoney } from "../lib/money";
import InkLayer from "./InkLayer";
import { PencilFilter } from "./Receipt";

/**
 * What the payer marked on a line: struck through (not billed), divided by a written
 * number ("/3"), or – by tapping the price – divided by the number of people below.
 */
export interface Mark {
  struck?: boolean;
  divisor?: number;
  perPerson?: boolean;
}

/** The divisor a mark stands for; persons is the head count set below the receipt. */
export function markDivisor(mark: Mark | undefined, persons: number | undefined): number {
  if (!mark || mark.struck) return 1;
  return (mark.perPerson ? persons : mark.divisor) ?? 1;
}

const isMarked = (mark: Mark | undefined) => Boolean(mark && (mark.struck || mark.perPerson || (mark.divisor ?? 1) > 1));

/** The items as billed: struck lines left out, divided lines reduced to their part (like divideItem). */
export function applyMarks(items: BillItem[], marks: Record<string, Mark>, persons?: number): BillItem[] {
  return items.flatMap((item) => {
    const mark = marks[item.id];
    if (mark?.struck) return [];
    const divisor = markDivisor(mark, persons);
    if (divisor <= 1) return [item];
    return [{ ...item, fullTotal: item.total, divisor, total: Math.round(item.total / divisor) }];
  });
}

/** A long, flat stroke across a line: crossing it out. */
export function isStrikeThrough(strokes: Stroke[], areaWidth: number): boolean {
  if (strokes.length !== 1) return false;
  const b = boundsOf(strokes);
  const width = b.maxX - b.minX;
  return width > Math.max(60, areaWidth * 0.3) && b.maxY - b.minY < width * 0.35;
}

interface Props {
  items: BillItem[];
  currency: string;
  /**
   * persons: how many share the purchase (payer included), undefined = count who joins.
   * partial: the payer said some items are not or only partly billed.
   */
  onDone: (items: BillItem[], equalSplit: boolean, persons: number | undefined, partial: boolean) => void;
}

/** Where the demo animations run: across the first line, and on the price of the second. */
interface DemoSpots {
  strikeY: number;
  writeY: number;
  writeX: number;
  /** Centre of the price that is tapped in the third demo. */
  tapX: number;
  tapY: number;
  width: number;
}

/**
 * Asked after a supermarket receipt was recognised: is anything not (or only partly)
 * billed – e.g. a litre of milk bought, but only 250 ml used for the shared recipe?
 * With "Manches nicht" the payer crosses lines out or writes "/2", "/3" … on them.
 */
export default function SupermarketSheet({ items, currency, onDone }: Props) {
  /** First the question, then either straight on ("all") or the receipt to mark ("some"). */
  const [step, setStep] = useState<"ask" | "all" | "some">("ask");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [equal, setEqual] = useState(true);
  const [persons, setPersons] = useState<number | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [demo, setDemo] = useState<DemoSpots | null>(null);
  /** Briefly highlights the head count when a tap on a price needs it. */
  const [askPersons, setAskPersons] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  const billed = step === "some" ? applyMarks(items, marks, persons) : items;
  const billedSum = billed.reduce((s, i) => s + i.total, 0);
  const fullSum = items.reduce((s, i) => s + i.total, 0);

  // Place the demo strokes on the first lines once the paper is laid out. Layout offsets
  // (relative to the wrapper, which is positioned) are not affected by the paper's print-in animation.
  useLayoutEffect(() => {
    if (step !== "some" || !list.current) return;
    const lines = list.current.querySelectorAll<HTMLElement>("li");
    const wrap = list.current.parentElement;
    if (!lines.length || !wrap) return;
    const centre = (el: HTMLElement) => el.offsetTop + el.offsetHeight / 2;
    const second = lines[1] ?? lines[0];
    const third = lines[2] ?? lines[lines.length - 1];
    const price = second.querySelector<HTMLElement>(".rline-price");
    const tapped = third.querySelector<HTMLElement>(".rline-price");
    setDemo({
      strikeY: centre(lines[0]),
      writeY: centre(second),
      writeX: price ? second.offsetLeft + price.offsetLeft - 34 : wrap.offsetWidth - 110,
      tapX: tapped ? third.offsetLeft + tapped.offsetLeft + tapped.offsetWidth / 2 : wrap.offsetWidth - 40,
      tapY: centre(third),
      width: wrap.offsetWidth,
    });
  }, [step, items]);

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

  /** Tapping a drawing removes it; tapping a price divides it by the number of people. */
  function tap(point: InkPoint) {
    const line = [...(list.current?.querySelectorAll<HTMLElement>("li[data-item]") ?? [])].find((el) => {
      const r = el.getBoundingClientRect();
      return point.y >= r.top - 6 && point.y <= r.bottom + 6;
    });
    const item = line && items.find((i) => i.id === line.dataset.item);
    if (!line || !item) return;
    if (isMarked(marks[item.id])) {
      setMarks((m) => ({ ...m, [item.id]: {} }));
      setNotice(`${item.name}: Markierung entfernt.`);
      return;
    }
    const price = line.querySelector(".rline-price")?.getBoundingClientRect();
    if (!price || point.x < price.left - 16 || point.x > price.right + 16) return;
    setMarks((m) => ({ ...m, [item.id]: { perPerson: true } }));
    if (persons) {
      setNotice(`${item.name} ÷ ${persons}: ${formatMoney(Math.round(item.total / persons), currency)} statt ${formatMoney(item.total, currency)}`);
    } else {
      setNotice(`${item.name} wird durch die Personenzahl geteilt – stell unten ein, wie viele es sind.`);
      setAskPersons(true);
      window.setTimeout(() => setAskPersons(false), 1600);
    }
  }

  function readInk(strokes: Stroke[]) {
    const usable = strokes.filter((s) => s.length > 1);
    if (!usable.length) return;
    const b = boundsOf(usable);
    const item = items.find((i) => i.id === lineAt((b.minY + b.maxY) / 2));
    if (!item) return;
    if (isStrikeThrough(usable, list.current?.getBoundingClientRect().width ?? 300)) {
      const struck = !marks[item.id]?.struck;
      setMarks((m) => ({ ...m, [item.id]: { struck } }));
      setNotice(struck ? `${item.name} wird nicht abgerechnet.` : `${item.name} wird wieder abgerechnet.`);
      return;
    }
    const read = recognizeDivisor(usable);
    if (!read) {
      setNotice("Nicht erkannt – streich eine Zeile durch oder schreib z. B. /2 auf den Preis.");
      return;
    }
    setMarks((m) => ({ ...m, [item.id]: read.divisor > 1 ? { divisor: read.divisor } : {} }));
    setNotice(
      read.divisor > 1
        ? `${item.name} ÷ ${read.divisor}: ${formatMoney(Math.round(item.total / read.divisor), currency)} statt ${formatMoney(item.total, currency)}`
        : `${item.name}: wieder voller Preis`,
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (billed.length) onDone(billed, equal, persons, step === "some");
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
        <header className="scribble-head">
          <button type="button" className="scribble-link" onClick={() => setStep("ask")}>
            ← zurück
          </button>
          <h2 className="pencil">Was soll nicht mit?</h2>
          <p className="pencil scribble-help">
            durchstreichen = raus · /2 /3 … schreiben = teilen · Preis antippen = ÷ Personen · Kritzel antippen = weg ·
            zwei Finger = scrollen
          </p>
        </header>

        <div className="scribble-scroll ink-scroll">
          <article className="receipt shop-paper" aria-label="Rechnung zum Markieren">
            <div className="receipt-paper">
              <div className="receipt-lines-wrap writing">
                <InkLayer onInk={readInk} onTap={tap} onStart={() => setTouched(true)} />
                {demo && !touched && (
                  <svg className="ink-demo" width={demo.width} height="100%" aria-hidden="true">
                    <path
                      className="ink-demo-strike"
                      pathLength={1}
                      d={`M6 ${demo.strikeY + 2} C ${demo.width * 0.3} ${demo.strikeY - 3}, ${demo.width * 0.6} ${demo.strikeY + 4}, ${demo.width - 8} ${demo.strikeY - 1}`}
                    />
                    <path
                      className="ink-demo-slash"
                      pathLength={1}
                      d={`M${demo.writeX} ${demo.writeY + 15} L ${demo.writeX + 13} ${demo.writeY - 15}`}
                    />
                    <path
                      className="ink-demo-digit"
                      pathLength={1}
                      d={`M${demo.writeX + 17} ${demo.writeY - 7} C ${demo.writeX + 19} ${demo.writeY - 17}, ${demo.writeX + 34} ${demo.writeY - 16}, ${demo.writeX + 32} ${demo.writeY - 6} C ${demo.writeX + 30} ${demo.writeY + 2}, ${demo.writeX + 18} ${demo.writeY + 9}, ${demo.writeX + 16} ${demo.writeY + 15} L ${demo.writeX + 34} ${demo.writeY + 14}`}
                    />
                    <circle className="ink-demo-tap" cx={demo.tapX} cy={demo.tapY} r="16" />
                    <text className="pencil ink-demo-tapped" x={demo.tapX - 72} y={demo.tapY + 8}>
                      /{persons ?? 3}
                    </text>
                  </svg>
                )}
                <ul className="receipt-lines" ref={list}>
                  {items.map((item) => {
                    const mark = marks[item.id] ?? {};
                    const divisor = markDivisor(mark, persons);
                    const divided = divisor > 1 ? Math.round(item.total / divisor) : null;
                    const label = mark.perPerson ? (persons ?? "?") : mark.divisor;
                    return (
                      <li key={item.id} data-item={item.id} className={`rline${mark.struck ? " done" : ""}`}>
                        <div className="rline-main">
                          <span className="rline-text">
                            <span className="rline-name">
                              <span className="rline-strike">
                                {item.qty > 1 && <span className="rline-qty">{item.qty}x </span>}
                                {item.name}
                              </span>
                              {(divided !== null || mark.perPerson) && <span className="pencil rline-divisor">/{label}</span>}
                            </span>
                          </span>
                          <span className="rline-dots" aria-hidden="true" />
                          <span className="rline-price">
                            {divided !== null && <s className="rline-full">{formatMoney(item.total, currency)}</s>}
                            {formatMoney(divided ?? item.total, currency)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </article>
        </div>

        <footer className="scribble-foot">
          {notice && (
            <p className="pencil scribble-notice" role="status">
              {notice}
            </p>
          )}
          <div className={`scribble-row${askPersons ? " ask" : ""}`}>
            <span className="pencil">Wie viele teilen?</span>
            {personsStepper}
          </div>
          <label className="scribble-row scribble-check">
            <input type="checkbox" checked={equal} onChange={(e) => setEqual(e.target.checked)} />
            <span className="pencil">gleichmäßig auf alle verteilen</span>
          </label>
          <p className="pencil scribble-sum">
            = {formatMoney(billedSum, currency)}
            {billedSum !== fullSum && <small> statt {formatMoney(fullSum, currency)}</small>}
          </p>
          <button className="scribble-submit" disabled={billed.length === 0}>
            Rechnung erstellen
          </button>
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
              Soll etwas <b>nicht</b> oder <b>nur teilweise</b> in Rechnung gestellt werden? Z. B. 1 l Milch gekauft, aber nur
              250 ml fürs Rezept gebraucht.
            </p>
            <button type="button" className="btn btn-primary btn-large" onClick={() => setStep("all")}>
              Alles aufteilen
            </button>
            <button type="button" className="btn btn-secondary btn-large" onClick={() => setStep("some")}>
              Manches nicht
            </button>
          </>
        ) : (
          <>
            <label className="shop-equal">
              <input type="checkbox" checked={equal} onChange={(e) => setEqual(e.target.checked)} />
              <span>
                <b>Gleichmäßig auf alle verteilen</b>
                <small>Niemand muss abhaken. Lässt sich auf der Rechnung jederzeit umschalten.</small>
              </span>
            </label>
            {equal && (
              <div className="row between shop-persons">
                <span>Wie viele teilen sich den Einkauf?</span>
                {personsStepper}
              </div>
            )}
            {equal && (
              <p className="muted small">
                {persons
                  ? `${formatMoney(Math.round(billedSum / persons), currency)} pro Person, inklusive dir.`
                  : "Ohne Angabe wird gezählt, wer per QR-Code beitritt, plus du."}
              </p>
            )}

            <p className="shop-sum">
              Abgerechnet werden <b>{formatMoney(billedSum, currency)}</b>
            </p>

            <button className="btn btn-primary btn-large" disabled={billed.length === 0}>
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
