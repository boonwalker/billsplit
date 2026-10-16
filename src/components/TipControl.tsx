import { useId } from "react";
import { locale, t } from "../lib/i18n";
import { centsToInput, formatMoney, parseMoney, type Cents } from "../lib/money";

/**
 * "amount" = the tip itself, e.g. 5 €; "total" = the payer enters what they paid in the end and
 * the tip is the difference to the bill.
 */
export type TipMode = "amount" | "percent" | "total";

export interface TipValue {
  mode: TipMode;
  /** Raw input, e.g. "10" or "7,5". */
  percent: string;
  /** Raw input of the final amount paid incl. tip, e.g. "50,00". */
  total: string;
  /** Raw input of the tip itself, e.g. "5,00" (missing in drafts from older versions). */
  amount?: string;
  /** Expected number of people incl. the payer; empty = count who scans the QR code. */
  persons: string;
}

/** Expected head count from the input, or undefined for "count automatically". */
export function tipPersons(tip: TipValue): number | undefined {
  const n = parseInt(tip.persons, 10);
  return n >= 1 ? Math.min(n, 100) : undefined;
}

const PERCENT_PRESETS = ["5", "10", "15"];
/** Usual tips for a delivery driver, in cents. */
const DELIVERY_PRESETS = [50, 100, 200];

/** "0,50 €", "1 €", "2 €": whole amounts without cents. */
const presetLabel = (cents: Cents, currency: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

/** Tip in cents that the given input adds to a bill with this subtotal and these fees. */
export function tipCents(tip: TipValue, sub: Cents, fees: Cents = 0): Cents {
  if (tip.mode === "amount") return Math.max(0, parseMoney(tip.amount ?? "") ?? 0);
  if (tip.mode === "total") return Math.max(0, (parseMoney(tip.total) ?? 0) - sub - fees);
  const pct = Math.min(100, Math.max(0, Number(tip.percent.replace(",", ".")) || 0));
  return Math.round((sub * pct) / 100);
}

interface Props {
  value: TipValue;
  onChange: (value: TipValue) => void;
  subtotal: Cents;
  currency: string;
  /** All fees of the bill, discounts included (shown in the preview). */
  fees?: Cents;
  /** The fees shared per person together with the tip (without discounts); default: `fees`. */
  perHeadFees?: Cents;
  /** False when the head count is asked separately (delivery orders). */
  showPersons?: boolean;
  /** A delivery order: quick amounts for the driver under "absolut". */
  delivery?: boolean;
}

/** Tip input as percentage or fixed amount, optional head count, and a live preview. */
export default function TipControl({ value, onChange, subtotal, currency, fees = 0, perHeadFees = fees, showPersons = true, delivery = false }: Props) {
  const uid = useId();
  const tip = tipCents(value, subtotal, fees);
  const billAmount = subtotal + fees;
  const enteredTotal = value.mode === "total" ? parseMoney(value.total) : null;
  const persons = tipPersons(value);
  const set = (patch: Partial<TipValue>) => onChange({ ...value, ...patch });

  return (
    <div className="tip-control">
      <div className="tip-mode" role="radiogroup" aria-label={t("Trinkgeld angeben als")}>
        <button type="button" role="radio" aria-checked={value.mode === "amount"} className={value.mode === "amount" ? "on" : ""} onClick={() => set({ mode: "amount" })}>
          {t("absolut")}
        </button>
        <button type="button" role="radio" aria-checked={value.mode === "percent"} className={value.mode === "percent" ? "on" : ""} onClick={() => set({ mode: "percent" })}>
          {t("in Prozent")}
        </button>
        <button type="button" role="radio" aria-checked={value.mode === "total"} className={value.mode === "total" ? "on" : ""} onClick={() => set({ mode: "total" })}>
          {t("als Endbetrag")}
        </button>
      </div>

      {value.mode === "amount" ? (
        <>
          <label className="tip-field wide" key="amount">
            <input
              id={`${uid}-amount`}
              inputMode="decimal"
              aria-label={t("Trinkgeld als Betrag")}
              value={value.amount ?? ""}
              placeholder={centsToInput(0)}
              onChange={(e) => set({ amount: e.target.value.replace(/[^\d.,]/g, "") })}
            />
            <span>{currency === "EUR" ? "€" : currency}</span>
          </label>
          {delivery && (
            <div className="chips tip-presets" role="group" aria-label={t("Trinkgeld für den Lieferdienst")}>
              {DELIVERY_PRESETS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  className={`chip${parseMoney(value.amount ?? "") === cents ? " active" : ""}`}
                  onClick={() => set({ amount: centsToInput(cents) })}
                >
                  {presetLabel(cents, currency)}
                </button>
              ))}
            </div>
          )}
        </>
      ) : value.mode === "percent" ? (
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
              aria-label={t("Trinkgeld in Prozent")}
              value={value.percent === "0" ? "" : value.percent}
              placeholder={t("eigener")}
              onChange={(e) => set({ percent: e.target.value.replace(/[^\d.,]/g, "") || "0" })}
            />
            <span>%</span>
          </label>
        </div>
      ) : (
        <>
          {/* A word, not the bill amount, as placeholder: a grey "208,00" looked like a locked, filled-in field
              on the iPhone (16.10.2026). Own key: never the reused element of another mode. */}
          <label className="tip-field wide" key="total">
            <input
              id={`${uid}-total`}
              inputMode="decimal"
              aria-label={t("Endbetrag inklusive Trinkgeld")}
              value={value.total}
              placeholder={t("Was hast Du bezahlt?")}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => set({ total: e.target.value.replace(/[^\d.,]/g, "") })}
            />
            <span>{currency === "EUR" ? "€" : currency}</span>
          </label>
          {enteredTotal !== null && enteredTotal < billAmount && (
            <p className="tip-hint">{t("Der Endbetrag liegt unter dem Rechnungsbetrag von {amount}.", { amount: formatMoney(billAmount, currency) })}</p>
          )}
        </>
      )}

      {showPersons && (
      <label className="tip-persons">
        <span>
          {t("Aufteilen auf")}
          <small>{t("optional")}</small>
        </span>
        <input
          id={`${uid}-persons`}
          inputMode="numeric"
          aria-label={t("Trinkgeld aufteilen auf Personen")}
          value={value.persons}
          placeholder={t("auto")}
          onChange={(e) => set({ persons: e.target.value.replace(/\D/g, "").slice(0, 3) })}
        />
        <span>{t("Personen")}</span>
      </label>
      )}
      {showPersons && (
        <p className="tip-hint">
          {persons
            ? t("Inklusive Dir. Wer später scannt, wird mitgezählt – es werden aber mindestens {n} Personen angenommen.", { n: persons })
            : t("Leer lassen: Gezählt wird automatisch, wer den QR-Code scannt, plus Du.")}
        </p>
      )}

      <dl className="tip-preview">
        <dt>{t("Rechnung")}</dt>
        <dd>{formatMoney(subtotal, currency)}</dd>
        {fees !== 0 && (
          <>
            <dt>{t("+ Gebühren")}</dt>
            <dd>{formatMoney(fees, currency)}</dd>
          </>
        )}
        <dt>{t("+ Trinkgeld")}</dt>
        <dd>{formatMoney(tip, currency)}</dd>
        {persons && tip + perHeadFees !== 0 && (
          <>
            <dt>{perHeadFees !== 0 ? t("Gebühren & Trinkgeld pro Person") : t("Trinkgeld pro Person")}</dt>
            <dd>{formatMoney(Math.round((tip + perHeadFees) / persons), currency)}</dd>
          </>
        )}
        <dt className="strong">{t("Du hast bezahlt")}</dt>
        <dd className="strong">{formatMoney(subtotal + fees + tip, currency)}</dd>
      </dl>
    </div>
  );
}
