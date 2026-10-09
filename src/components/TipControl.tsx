import { useId } from "react";
import { formatMoney, parseMoney, type Cents } from "../lib/money";

export type TipMode = "percent" | "amount";

export interface TipValue {
  mode: TipMode;
  /** Raw input, e.g. "10" or "7,5". */
  percent: string;
  /** Raw input, e.g. "5,00". */
  amount: string;
  /** Expected number of people incl. the payer; empty = count who scans the QR code. */
  persons: string;
}

/** Expected head count from the input, or undefined for "count automatically". */
export function tipPersons(tip: TipValue): number | undefined {
  const n = parseInt(tip.persons, 10);
  return n >= 1 ? Math.min(n, 100) : undefined;
}

const PERCENT_PRESETS = ["5", "10", "15"];

/** Tip in cents that the given input adds to a bill with this subtotal. */
export function tipCents(tip: TipValue, sub: Cents): Cents {
  if (tip.mode === "amount") return Math.max(0, parseMoney(tip.amount) ?? 0);
  const pct = Math.min(100, Math.max(0, Number(tip.percent.replace(",", ".")) || 0));
  return Math.round((sub * pct) / 100);
}

interface Props {
  value: TipValue;
  onChange: (value: TipValue) => void;
  subtotal: Cents;
  currency: string;
  /** Fees that are shared per person together with the tip (shown in the preview). */
  fees?: Cents;
  /** False when the head count is asked separately (delivery orders). */
  showPersons?: boolean;
}

/** Tip input as percentage or fixed amount, optional head count, and a live preview. */
export default function TipControl({ value, onChange, subtotal, currency, fees = 0, showPersons = true }: Props) {
  const uid = useId();
  const tip = tipCents(value, subtotal);
  const persons = tipPersons(value);
  const set = (patch: Partial<TipValue>) => onChange({ ...value, ...patch });

  return (
    <div className="tip-control">
      <div className="tip-mode" role="radiogroup" aria-label="Trinkgeld angeben als">
        <button type="button" role="radio" aria-checked={value.mode === "percent"} className={value.mode === "percent" ? "on" : ""} onClick={() => set({ mode: "percent" })}>
          in Prozent
        </button>
        <button type="button" role="radio" aria-checked={value.mode === "amount"} className={value.mode === "amount" ? "on" : ""} onClick={() => set({ mode: "amount" })}>
          als Betrag
        </button>
      </div>

      {value.mode === "percent" ? (
        <div className="chips">
          {PERCENT_PRESETS.map((p) => (
            <button key={p} type="button" className={`chip${value.percent === p ? " active" : ""}`} onClick={() => set({ percent: p })}>
              {p} %
            </button>
          ))}
          <label className="tip-field">
            <input
              id={`${uid}-percent`}
              inputMode="decimal"
              aria-label="Trinkgeld in Prozent"
              value={value.percent === "0" ? "" : value.percent}
              placeholder="eigener"
              onChange={(e) => set({ percent: e.target.value.replace(/[^\d.,]/g, "") || "0" })}
            />
            <span>%</span>
          </label>
        </div>
      ) : (
        <label className="tip-field wide">
          <input
            id={`${uid}-amount`}
            inputMode="decimal"
            aria-label="Trinkgeld als Betrag"
            value={value.amount}
            placeholder="0,00"
            onChange={(e) => set({ amount: e.target.value.replace(/[^\d.,]/g, "") })}
          />
          <span>{currency === "EUR" ? "€" : currency}</span>
        </label>
      )}

      {showPersons && (
      <label className="tip-persons">
        <span>
          Aufteilen auf
          <small>optional</small>
        </span>
        <input
          id={`${uid}-persons`}
          inputMode="numeric"
          aria-label="Trinkgeld aufteilen auf Personen"
          value={value.persons}
          placeholder="auto"
          onChange={(e) => set({ persons: e.target.value.replace(/\D/g, "").slice(0, 3) })}
        />
        <span>Personen</span>
      </label>
      )}
      {showPersons && (
        <p className="tip-hint">
          {persons
            ? `Inklusive dir. Wer später scannt, wird mitgezählt – es werden aber mindestens ${persons} Personen angenommen.`
            : "Leer lassen: Gezählt wird automatisch, wer den QR-Code scannt, plus du."}
        </p>
      )}

      <dl className="tip-preview">
        <dt>Rechnung</dt>
        <dd>{formatMoney(subtotal, currency)}</dd>
        {fees !== 0 && (
          <>
            <dt>+ Gebühren</dt>
            <dd>{formatMoney(fees, currency)}</dd>
          </>
        )}
        <dt>+ Trinkgeld</dt>
        <dd>{formatMoney(tip, currency)}</dd>
        {persons && tip + fees !== 0 && (
          <>
            <dt>{fees !== 0 ? "Gebühren & Trinkgeld pro Person" : "Trinkgeld pro Person"}</dt>
            <dd>{formatMoney(Math.round((tip + fees) / persons), currency)}</dd>
          </>
        )}
        <dt className="strong">Du hast bezahlt</dt>
        <dd className="strong">{formatMoney(subtotal + fees + tip, currency)}</dd>
      </dl>
    </div>
  );
}
