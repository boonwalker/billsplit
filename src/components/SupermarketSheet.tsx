import { Fragment, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { BillItem } from "../lib/bill";
import { boundsOf, type InkPoint, type Stroke } from "../lib/ink";
import { formatMoney } from "../lib/money";
import InkLayer from "./InkLayer";
import { PencilFilter } from "./Receipt";

/** What the payer marked on a line: struck through (not billed) or – by tapping it – divided by the number of people below. */
export interface Mark {
  struck?: boolean;
  perPerson?: boolean;
}

/** The divisor a mark stands for; persons is the head count set below the receipt. */
export function markDivisor(mark: Mark | undefined, persons: number | undefined): number {
  if (!mark || mark.struck) return 1;
  return mark.perPerson ? (persons ?? 1) : 1;
}

const isMarked = (mark: Mark | undefined) => Boolean(mark?.struck || mark?.perPerson);

/** The items as billed: struck lines left out, divided lines reduced to their part. */
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
  const b = boundsOf(strokes[0]);
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
  /** Items that are probably not a shared expense; they are listed first, ready to be crossed out. */
  isPersonal?: (item: BillItem) => boolean;
}

/** Likely personal items first, otherwise in receipt order. */
export function orderForMarking(items: BillItem[], isPersonal: (item: BillItem) => boolean): BillItem[] {
  return [...items.filter(isPersonal), ...items.filter((i) => !isPersonal(i))];
}

/** Where the demo animations run: a stroke across the first line, a tap on the price of the second. */
interface DemoSpots {
  strikeY: number;
  tapX: number;
  tapY: number;
  width: number;
}

/**
 * Asked after a supermarket receipt was recognised: is anything not (or only partly)
 * billed – e.g. a litre of milk bought, but only 250 ml used for the shared recipe?
 * With "Manches nicht" the payer crosses lines out or writes "/2", "/3" … on them.
 */
export default function SupermarketSheet({ items, currency, onDone, isPersonal = () => false }: Props) {
  /** First the question, then either straight on ("all") or the receipt to mark ("some"). */
  const [step, setStep] = useState<"ask" | "all" | "some">("ask");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [equal, setEqual] = useState(true);
  const [persons, setPersons] = useState<number | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  /** The line that was just tapped: it is pressed in and pops back up. */
  const [pressed, setPressed] = useState<{ id: string; n: number } | null>(null);
  const ordered = orderForMarking(items, isPersonal);
  const personalCount = ordered.filter(isPersonal).length;
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
    const lines = list.current.querySelectorAll<HTMLElement>("li[data-item]");
    const wrap = list.current.parentElement;
    if (!lines.length || !wrap) return;
    const centre = (el: HTMLElement) => el.offsetTop + el.offsetHeight / 2;
    const second = lines[1] ?? lines[0];
    const price = second.querySelector<HTMLElement>(".rline-price");
    setDemo({
      strikeY: centre(lines[0]),
      tapX: price ? second.offsetLeft + price.offsetLeft + price.offsetWidth / 2 : wrap.offsetWidth - 40,
      tapY: centre(second),
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

  /** Tapping a marked line removes the mark; tapping any other line (name or price) divides it by the number of people. */
  function tap(point: InkPoint) {
    const line = [...(list.current?.querySelectorAll<HTMLElement>("li[data-item]") ?? [])].find((el) => {
      const r = el.getBoundingClientRect();
      return point.y >= r.top - 6 && point.y <= r.bottom + 6;
    });
    const item = line && items.find((i) => i.id === line.dataset.item);
    if (!line || !item) return;
    setPressed((p) => ({ id: item.id, n: (p?.n ?? 0) + 1 }));
    if (isMarked(marks[item.id])) {
      setMarks((m) => ({ ...m, [item.id]: {} }));
      setNotice(`${item.name}: Markierung entfernt.`);
      return;
    }
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
    const usable = strokes.filter((st) => st.length > 1);
    if (!usable.length) return;
    if (!isStrikeThrough(usable, list.current?.getBoundingClientRect().width ?? 300)) {
      setNotice("Streich eine Zeile quer durch – oder tipp sie an, um sie durch die Personenzahl zu teilen.");
      return;
    }
    const b = boundsOf(usable[0]);
    const item = items.find((i) => i.id === lineAt((b.minY + b.maxY) / 2));
    if (!item) return;
    const struck = !marks[item.id]?.struck;
    setMarks((m) => ({ ...m, [item.id]: { struck } }));
    setNotice(struck ? `${item.name} wird nicht abgerechnet.` : `${item.name} wird wieder abgerechnet.`);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Marking lines always splits the rest equally: everything not crossed out is shared by x people.
    if (billed.length) onDone(billed, step === "some" || equal, persons, step === "some");
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
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="icon-btn" aria-label="Zurück" onClick={() => setStep("ask")}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <h1>Was soll nicht mit?</h1>
          <div className="topbar-action">
            <span className="pill">Letzter Schritt</span>
          </div>
        </header>
        <p className="scribble-help">
          <b>Durchstreichen</b> = nicht abrechnen · <b>Antippen</b> = durch die Personenzahl teilen · nochmal antippen =
          zurück · mit zwei Fingern scrollen
        </p>

        <div className="scribble-scroll ink-scroll">
          <article className="receipt shop-paper" aria-label="Rechnung zum Markieren">
            <div className="receipt-paper">
              <div className="receipt-lines-wrap">
                <InkLayer onInk={readInk} onTap={tap} onStart={() => setTouched(true)} />
                {demo && !touched && (
                  <svg className="ink-demo" width={demo.width} height="100%" aria-hidden="true">
                    <path
                      className="ink-demo-strike"
                      pathLength={1}
                      d={`M6 ${demo.strikeY + 2} C ${demo.width * 0.3} ${demo.strikeY - 3}, ${demo.width * 0.6} ${demo.strikeY + 4}, ${demo.width - 8} ${demo.strikeY - 1}`}
                    />
                    <circle className="ink-demo-tap" cx={demo.tapX} cy={demo.tapY} r="16" />
                    <text className="pencil ink-demo-tapped" x={demo.tapX - 72} y={demo.tapY + 8}>
                      /{persons ?? 3}
                    </text>
                  </svg>
                )}
                <ul className="receipt-lines" ref={list}>
                  {ordered.map((item, index) => {
                    const mark = marks[item.id] ?? {};
                    const divisor = markDivisor(mark, persons);
                    const divided = divisor > 1 ? Math.round(item.total / divisor) : null;
                    const label = persons ?? "?";
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
                          className={`rline${mark.struck ? " done" : ""}${pressed?.id === item.id ? " pressed" : ""}`}
                        >
                          {/* Re-keyed on every tap so the press animation starts again. */}
                          <div className="rline-main" key={pressed?.id === item.id ? pressed.n : 0}>
                            <span className="rline-text">
                              <span className="rline-name">
                                <span className="rline-strike">
                                  {item.qty > 1 && <span className="rline-qty">{item.qty}x </span>}
                                  {item.name}
                                </span>
                                {mark.perPerson && <span className="pencil rline-divisor">/{label}</span>}
                              </span>
                            </span>
                            <span className="rline-dots" aria-hidden="true" />
                            <span className="rline-price">
                              {divided !== null && <s className="rline-full">{formatMoney(item.total, currency)}</s>}
                              {formatMoney(divided ?? item.total, currency)}
                            </span>
                            {/* Every line that is not crossed out is shared by everyone. */}
                            {!mark.struck && <span className="pencil rline-div">/{persons ?? "x"}</span>}
                          </div>
                        </li>
                      </Fragment>
                    );
                  })}
                </ul>
              </div>
            </div>
          </article>
        </div>

        <footer className="scribble-foot">
          {notice && (
            <p className="scribble-notice" role="status">
              {notice}
            </p>
          )}
          <div className="scribble-controls">
            {/* What a tap on a line divides by – also the head count for the equal split. */}
            <div className={`divide-by${askPersons ? " ask" : ""}`} role="group" aria-label="Antippen teilt durch">
              <span className="divide-by-label">Antippen teilt durch</span>
              <div className="divide-by-control">
                <svg className="divide-by-slash" viewBox="0 0 40 90" aria-hidden="true">
                  <path d="M33 5 C 28 28, 19 55, 7 86" />
                  <path d="M35 9 C 29 33, 21 58, 10 84" className="divide-by-slash-thin" />
                </svg>
                <div className="divide-by-number">
                  <button type="button" onClick={() => setPersons((n) => Math.min(100, (n ?? 1) + 1))} aria-label="Eine Person mehr">
                    <svg viewBox="0 0 40 20" aria-hidden="true">
                      <path d="M4 16 C 12 10, 16 6, 20 3 C 25 7, 30 11, 36 16" />
                    </svg>
                  </button>
                  <span aria-live="polite">{persons ?? "?"}</span>
                  <button type="button" onClick={() => setPersons((n) => (n && n > 2 ? n - 1 : undefined))} aria-label="Eine Person weniger">
                    <svg viewBox="0 0 40 20" aria-hidden="true">
                      <path d="M4 4 C 12 10, 16 14, 20 17 C 25 13, 30 9, 36 4" />
                    </svg>
                  </button>
                </div>
              </div>
              <span className="divide-by-hint">{persons ? "Personen, inkl. dir" : "Personenzahl wählen"}</span>
            </div>
            <div className="scribble-side">
              <p className="scribble-sum">
                = {formatMoney(billedSum, currency)}
                {billedSum !== fullSum && <small>statt {formatMoney(fullSum, currency)}</small>}
              </p>
              <p className="scribble-each">
                {persons ? `je ${formatMoney(Math.round(billedSum / persons), currency)} pro Person` : "÷ x Personen"}
              </p>
            </div>
          </div>
          <button className="btn btn-primary btn-large" disabled={billed.length === 0}>
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
