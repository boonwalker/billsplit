import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { billedItems, type BillItem } from "../lib/bill";
import { boundsOf, type InkPoint, type Stroke } from "../lib/ink";
import { formatMoney } from "../lib/money";
import InkLayer from "./InkLayer";
import { formatDate, PencilFilter } from "./Receipt";

/** What the payer marked on a line: struck through (by a stroke or a tap) means not billed. */
export interface Mark {
  struck?: boolean;
}

/** The items for the bill: struck lines stay visible but are excluded from billing. */
export function applyMarks(items: BillItem[], marks: Record<string, Mark>): BillItem[] {
  return items.map((item) => (marks[item.id]?.struck ? { ...item, excluded: true } : item));
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
  /** Shown in the head of the receipt, like on the finished bill. */
  title?: string;
  date?: string;
  ownerName?: string;
}

/** Likely personal items first, otherwise in receipt order. */
export function orderForMarking(items: BillItem[], isPersonal: (item: BillItem) => boolean): BillItem[] {
  return [...items.filter(isPersonal), ...items.filter((i) => !isPersonal(i))];
}

/** Where the demo animations run: a stroke across the first line, taps on two more lines. */
interface DemoSpots {
  strikeY: number;
  /** Lines the tap demo alternates between: where the finger taps, then the line gets crossed out. */
  taps: { x: number; y: number }[];
  width: number;
}

/**
 * Asked after a supermarket receipt was recognised: is anything not (or only partly)
 * billed – e.g. a litre of milk bought, but only 250 ml used for the shared recipe?
 * With "Manches nicht" the payer crosses lines out (or taps them); the rest is split equally.
 */
export default function SupermarketSheet({ items, currency, onDone, isPersonal = () => false, title, date, ownerName }: Props) {
  /** First the question, then either straight on ("all") or the receipt to mark ("some"). */
  const [step, setStep] = useState<"ask" | "all" | "some">("ask");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [persons, setPersons] = useState<number | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  /** The line that was just tapped: it is pressed in and pops back up. */
  const [pressed, setPressed] = useState<{ id: string; n: number } | null>(null);
  const ordered = orderForMarking(items, isPersonal);
  const personalCount = ordered.filter(isPersonal).length;
  const [demo, setDemo] = useState<DemoSpots | null>(null);
  const list = useRef<HTMLUListElement>(null);

  // The notice floats over the receipt for a moment, then gets out of the way.
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(t);
  }, [notice]);

  const billed = step === "some" ? applyMarks(items, marks) : items;
  const billedSum = billedItems({ items: billed }).reduce((s, i) => s + i.total, 0);
  const anyBilled = billed.some((i) => !i.excluded);
  const fullSum = items.reduce((s, i) => s + i.total, 0);

  // Place the demo strokes on the first lines once the paper is laid out. Layout offsets
  // (relative to the wrapper, which is positioned) are not affected by the paper's print-in animation.
  useLayoutEffect(() => {
    if (step !== "some" || !list.current) return;
    const lines = list.current.querySelectorAll<HTMLElement>("li[data-item]");
    const wrap = list.current.parentElement;
    if (!lines.length || !wrap) return;
    const centre = (el: HTMLElement) => el.offsetTop + el.offsetHeight / 2;
    // The strike demo on the first line, tap demos on the next two (likely personal ones come first).
    const all = [...lines];
    const tapLines = all.length > 2 ? all.slice(1, 3) : all.slice(0, 2);
    const taps = tapLines.map((line) => {
      const name = line.querySelector<HTMLElement>(".rline-strike");
      return { x: line.offsetLeft + (name?.offsetLeft ?? 0) + Math.min((name?.offsetWidth ?? 80) / 2, 70), y: centre(line) };
    });
    setDemo({ strikeY: centre(lines[0]), taps, width: wrap.offsetWidth });
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

  /** Crosses lines out, or brings them back when they are crossed out already. */
  function toggle(hit: BillItem[]) {
    if (!hit.length) return;
    const next = { ...marks };
    for (const item of hit) next[item.id] = { struck: !marks[item.id]?.struck };
    setMarks(next);
    const names = hit.map((i) => i.name).join(", ");
    const verb = hit.length > 1 ? "werden" : "wird";
    setNotice(hit.every((i) => next[i.id].struck) ? `${names} ${verb} nicht abgerechnet.` : `${names} ${verb} wieder abgerechnet.`);
  }

  /** A tap crosses the line out (or back in); it is pressed in and pops back up. */
  function tap(point: InkPoint) {
    const line = [...(list.current?.querySelectorAll<HTMLElement>("li[data-item]") ?? [])].find((el) => {
      const r = el.getBoundingClientRect();
      return point.y >= r.top - 6 && point.y <= r.bottom + 6;
    });
    const item = line && items.find((i) => i.id === line.dataset.item);
    if (!item) return;
    setPressed((p) => ({ id: item.id, n: (p?.n ?? 0) + 1 }));
    toggle([item]);
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
    if (anyBilled) onDone(billed, true, persons, step === "some");
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
                <InkLayer onInk={readInk} onTap={tap} onStart={() => setTouched(true)} />
                {demo && !touched && (
                  <svg className="ink-demo" width={demo.width} height="100%" aria-hidden="true">
                    <path
                      className="ink-demo-strike"
                      pathLength={1}
                      d={`M6 ${demo.strikeY + 2} C ${demo.width * 0.3} ${demo.strikeY - 3}, ${demo.width * 0.6} ${demo.strikeY + 4}, ${demo.width - 8} ${demo.strikeY - 1}`}
                    />
                    {demo.taps.map((t, i) => (
                      <g key={i} className={`ink-demo-tap-group tap-${i + 1}`}>
                        <circle className="ink-demo-tap" cx={t.x} cy={t.y} r="16" />
                        {/* After the tap the line gets crossed out in pencil. */}
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
                  {ordered.map((item, index) => {
                    const mark = marks[item.id] ?? {};
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
                              </span>
                              {item.qty > 1 && <span className="rline-unit">à {formatMoney(Math.round(item.total / item.qty), currency)}</span>}
                            </span>
                            <span className="rline-dots" aria-hidden="true" />
                            <span className="rline-price">
                              {formatMoney(item.total, currency)}
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
              <div className="receipt-rule" aria-hidden="true" />
              <dl className="receipt-sums">
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
            </div>
          </article>
        </div>

        <footer className="scribble-foot">
          {notice && (
            <p className="scribble-notice" role="status" key={notice}>
              {notice}
            </p>
          )}
          <div className="scribble-controls">
            {/* "/ 4": what everything not crossed out is divided by – the head count for the equal split. */}
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
            <div className="scribble-side">
              <p className="scribble-sum">
                = {formatMoney(billedSum, currency)}
                {billedSum !== fullSum && <small>statt {formatMoney(fullSum, currency)}</small>}
              </p>
              <p className="scribble-each">
                {persons ? `je ${formatMoney(Math.round(billedSum / persons), currency)} pro Person` : "Personenzahl wählen"}
              </p>
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
              Soll etwas <b>nicht</b> oder <b>nur teilweise</b> in Rechnung gestellt werden, z.B. Gewürze,
              Duschgel, Klopapier?
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
            {/* Split equally by default; the payer can still switch it off on the bill. */}
            <div className="row between shop-persons">
              <span>Wie viele teilen sich den Einkauf?</span>
              {personsStepper}
            </div>
            <p className="muted small">inklusive Dir</p>

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
