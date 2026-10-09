import { useId } from "react";
import { formatMoney, parseMoney, type Cents } from "../lib/money";

export type TipMode = "percent" | "amount";

export interface TipValue {
  mode: TipMode;
  /** Raw input, e.g. "10" or "7,5". */
  percent: string;
  /** Raw input, e.g. "5,00". */
  amount: string;
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
}

/** Tip input as percentage or fixed amount, with a live preview of the new total. */
export default function TipControl({ value, onChange, subtotal, currency }: Props) {
  const uid = useId();
  const tip = tipCents(value, subtotal);
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

      <dl className="tip-preview">
        <dt>Rechnung</dt>
        <dd>{formatMoney(subtotal, currency)}</dd>
        <dt>+ Trinkgeld</dt>
        <dd>{formatMoney(tip, currency)}</dd>
        <dt className="strong">Du hast bezahlt</dt>
        <dd className="strong">{formatMoney(subtotal + tip, currency)}</dd>
      </dl>
    </div>
  );
}
