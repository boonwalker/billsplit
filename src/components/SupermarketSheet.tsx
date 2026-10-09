import { useLayoutEffect, useRef, useState } from "react";
import type { BillItem } from "../lib/bill";
import { boundsOf, recognizeDivisor, type Stroke } from "../lib/ink";
import { formatMoney } from "../lib/money";
import InkLayer from "./InkLayer";
import { PencilFilter } from "./Receipt";

/** What the payer marked on a line: struck through (not billed) or divided ("/3"). */
export interface Mark {
  struck?: boolean;
  divisor?: number;
}

/** The items as billed: struck lines left out, divided lines reduced to their part (like divideItem). */
export function applyMarks(items: BillItem[], marks: Record<string, Mark>): BillItem[] {
  return items.flatMap((item) => {
    const mark = marks[item.id];
    if (mark?.struck) return [];
    if (!mark?.divisor || mark.divisor <= 1) return [item];
    return [{ ...item, fullTotal: item.total, divisor: mark.divisor, total: Math.round(item.total / mark.divisor) }];
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
  onReview: () => void;
}

/** Where the demo animations run: across the first line, and on the price of the second. */
interface DemoSpots {
  strikeY: number;
  writeY: number;
  writeX: number;
  width: number;
}

/**
 * Asked after a supermarket receipt was recognised: is anything not (or only partly)
 * billed – e.g. a litre of milk bought, but only 250 ml used for the shared recipe?
 * With "Manches nicht" the payer crosses lines out or writes "/2", "/3" … on them.
 */
export default function SupermarketSheet({ items, currency, onDone, onReview }: Props) {
  /** First the question, then either straight on ("all") or the receipt to mark ("some"). */
  const [step, setStep] = useState<"ask" | "all" | "some">("ask");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [equal, setEqual] = useState(true);
  const [persons, setPersons] = useState<number | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [demo, setDemo] = useState<DemoSpots | null>(null);
  const list = useRef<HTMLUListElement>(null);

  const billed = step === "some" ? applyMarks(items, marks) : items;
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
    const price = second.querySelector<HTMLElement>(".rline-price");
    setDemo({
      strikeY: centre(lines[0]),
      writeY: centre(second),
      writeX: price ? second.offsetLeft + price.offsetLeft - 34 : wrap.offsetWidth - 110,
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

  return (
    <div className="sheet-backdrop">
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          if (billed.length) onDone(billed, equal, persons, step === "some");
        }}
      >
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
            <button type="button" className="btn btn-ghost" onClick={onReview}>
              Positionen nochmal prüfen
            </button>
          </>
        ) : (
          <>
            {step === "some" && (
              <>
                <p className="muted">
                  <b>Durchstreichen</b>, was nicht abgerechnet wird. <b>/2, /3 …</b> auf den Preis schreiben, um nur einen
                  Teil abzurechnen. Scrollen mit zwei Fingern.
                </p>
                <article className="receipt shop-paper" aria-label="Rechnung zum Markieren">
                  <PencilFilter />
                  <div className="receipt-paper">
                    <div className="receipt-lines-wrap writing">
                      <InkLayer onInk={readInk} onStart={() => setTouched(true)} />
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
                            d={`M${demo.writeX} ${demo.writeY + 13} L ${demo.writeX + 11} ${demo.writeY - 13}`}
                          />
                          <path
                            className="ink-demo-digit"
                            pathLength={1}
                            d={`M${demo.writeX + 15} ${demo.writeY - 6} C ${demo.writeX + 17} ${demo.writeY - 15}, ${demo.writeX + 30} ${demo.writeY - 14}, ${demo.writeX + 28} ${demo.writeY - 5} C ${demo.writeX + 26} ${demo.writeY + 2}, ${demo.writeX + 16} ${demo.writeY + 8}, ${demo.writeX + 14} ${demo.writeY + 13} L ${demo.writeX + 30} ${demo.writeY + 12}`}
                          />
                        </svg>
                      )}
                      <ul className="receipt-lines" ref={list}>
                        {items.map((item) => {
                          const mark = marks[item.id] ?? {};
                          const divided = mark.divisor && mark.divisor > 1 ? Math.round(item.total / mark.divisor) : null;
                          return (
                            <li key={item.id} data-item={item.id} className={`rline${mark.struck ? " done" : ""}`}>
                              <div className="rline-main">
                                <span className="rline-text">
                                  <span className="rline-name">
                                    <span className="rline-strike">
                                      {item.qty > 1 && <span className="rline-qty">{item.qty}x </span>}
                                      {item.name}
                                    </span>
                                    {divided !== null && <span className="pencil rline-divisor">/{mark.divisor}</span>}
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
                {notice && (
                  <p className="shop-notice" role="status">
                    {notice}
                  </p>
                )}
              </>
            )}

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
                <div className="stepper-mini" role="group" aria-label="Personen, die sich den Einkauf teilen">
                  <button type="button" onClick={() => setPersons((n) => (n && n > 2 ? n - 1 : undefined))} aria-label="Eine Person weniger">
                    −
                  </button>
                  <span>{persons ?? "?"}</span>
                  <button type="button" onClick={() => setPersons((n) => Math.min(100, (n ?? 1) + 1))} aria-label="Eine Person mehr">
                    +
                  </button>
                </div>
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
              {billedSum !== fullSum && <> von {formatMoney(fullSum, currency)}</>}
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
