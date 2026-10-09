import { useState } from "react";
import type { BillItem } from "../lib/bill";
import { formatMoney } from "../lib/money";

type Mode = "full" | "part" | "none";

interface Choice {
  mode: Mode;
  /** Share that is billed, in percent (only for "part"). */
  percent: string;
}

/** Common shares, e.g. 250 ml of a litre of milk. */
const PRESETS: [string, string][] = [
  ["25", "¼"],
  ["50", "½"],
  ["75", "¾"],
];

const percentOf = (choice: Choice) => Math.min(100, Math.max(0, Number(choice.percent.replace(",", ".")) || 0));
const shareLabel = (percent: number) => PRESETS.find(([p]) => Number(p) === percent)?.[1] ?? `${percent} %`;

/** The items as billed: left out, or reduced to the chosen share. */
export function applyChoices(items: BillItem[], choices: Record<string, Choice>): BillItem[] {
  return items.flatMap((item) => {
    const choice = choices[item.id];
    if (!choice || choice.mode === "full") return [item];
    if (choice.mode === "none") return [];
    const percent = percentOf(choice);
    const total = Math.round((item.total * percent) / 100);
    if (percent <= 0 || total === 0) return [];
    if (percent >= 100) return [item];
    return [{ ...item, name: `${item.name} (${shareLabel(percent)})`, total }];
  });
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

/**
 * Asked after a supermarket receipt was recognised: which items are not (or only partly)
 * billed – e.g. a litre of milk bought, but only 250 ml used for the shared recipe.
 */
export default function SupermarketSheet({ items, currency, onDone, onReview }: Props) {
  /** First the question, then either straight on ("all") or the item list ("some"). */
  const [step, setStep] = useState<"ask" | "all" | "some">("ask");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [equal, setEqual] = useState(true);
  const [persons, setPersons] = useState<number | undefined>(undefined);
  const choiceOf = (id: string): Choice => choices[id] ?? { mode: "full", percent: "25" };
  const set = (id: string, patch: Partial<Choice>) => setChoices((c) => ({ ...c, [id]: { ...choiceOf(id), ...patch } }));

  const billed = step === "some" ? applyChoices(items, choices) : items;
  const billedSum = billed.reduce((s, i) => s + i.total, 0);
  const fullSum = items.reduce((s, i) => s + i.total, 0);

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
              <p className="muted">
                Wähle pro Artikel: voll, teilweise oder gar nicht abrechnen. Auf der Rechnung kannst du später auch mit dem
                Finger z. B. „/3“ auf eine Zeile schreiben.
              </p>
            )}

            {step === "some" && (
              <ul className="shop-items">
                {items.map((item) => {
                  const choice = choiceOf(item.id);
                  const after = billed.find((b) => b.id === item.id);
                  return (
                    <li key={item.id} className={`shop-item ${choice.mode}`}>
                      <div className="shop-item-head">
                        <span className="shop-item-name">
                          {item.qty > 1 && <span className="rline-qty">{item.qty}x </span>}
                          {item.name}
                        </span>
                        <span className="shop-item-price">
                          {choice.mode !== "full" && <s>{formatMoney(item.total, currency)}</s>}
                          {formatMoney(after?.total ?? 0, currency)}
                        </span>
                      </div>
                      <div className="shop-modes" role="radiogroup" aria-label={`${item.name} abrechnen`}>
                        {(
                          [
                            ["full", "Voll"],
                            ["part", "Teilweise"],
                            ["none", "Nicht"],
                          ] as [Mode, string][]
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            role="radio"
                            aria-checked={choice.mode === mode}
                            className={choice.mode === mode ? "on" : ""}
                            onClick={() => set(item.id, { mode })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {choice.mode === "part" && (
                        <div className="chips">
                          {PRESETS.map(([percent, label]) => (
                            <button
                              key={percent}
                              type="button"
                              className={`chip${choice.percent === percent ? " active" : ""}`}
                              onClick={() => set(item.id, { percent })}
                            >
                              {label}
                            </button>
                          ))}
                          <label className="tip-field">
                            <input
                              inputMode="decimal"
                              aria-label={`Anteil von ${item.name} in Prozent`}
                              value={choice.percent}
                              onChange={(e) => set(item.id, { percent: e.target.value.replace(/[^\d.,]/g, "").slice(0, 5) })}
                            />
                            <span>%</span>
                          </label>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
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
              QR-Code erstellen
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
