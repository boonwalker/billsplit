import { useState } from "react";
import type { BillItem } from "../lib/bill";
import { formatMoney } from "../lib/money";

export const MAX_DIVISOR = 5;

interface Props {
  item: BillItem;
  currency: string;
  onApply: (divisor: number) => void;
  onClose: () => void;
}

/**
 * Payer only (long press on a line): bill just a part of it – e.g. of a litre of milk only half
 * goes into the split, the payer takes the other half. Big pencilled "/ 2" with arrows, like
 * the head count in "Manches nicht".
 */
export default function DivisorSheet({ item, currency, onApply, onClose }: Props) {
  const full = item.fullTotal ?? item.total;
  const [divisor, setDivisor] = useState(Math.min(MAX_DIVISOR, item.divisor ?? 1));
  const billed = Math.round(full / divisor);

  return (
    <div className="sheet-backdrop divisor-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet divisor-sheet" role="dialog" aria-label={`${item.name} nur anteilig berechnen`}>
        <h2>{item.name}</h2>
        <p className="muted">Nur einen Teil davon aufteilen – den Rest trägst Du selbst.</p>

        <div className="divide-by divisor-big" role="group" aria-label="Geteilt durch">
          <svg className="divide-by-sign" viewBox="0 0 40 90" aria-hidden="true">
            <path d="M33 5 C 28 28, 19 55, 7 86" />
            <path d="M35 9 C 29 33, 21 58, 10 84" className="divide-by-sign-thin" />
          </svg>
          <span className="divide-by-value" aria-live="polite">
            {divisor}
          </span>
          <div className="divide-by-arrows">
            <button type="button" onClick={() => setDivisor((d) => Math.min(MAX_DIVISOR, d + 1))} disabled={divisor >= MAX_DIVISOR} aria-label="Kleinerer Teil">
              <svg viewBox="0 0 40 20" aria-hidden="true">
                <path d="M4 16 C 12 10, 16 6, 20 3 C 25 7, 30 11, 36 16" />
              </svg>
            </button>
            <button type="button" onClick={() => setDivisor((d) => Math.max(1, d - 1))} disabled={divisor <= 1} aria-label="Größerer Teil">
              <svg viewBox="0 0 40 20" aria-hidden="true">
                <path d="M4 4 C 12 10, 16 14, 20 17 C 25 13, 30 9, 36 4" />
              </svg>
            </button>
          </div>
        </div>

        <p className="divisor-result">
          {divisor === 1 ? (
            <>Wird ganz aufgeteilt: <b>{formatMoney(full, currency)}</b></>
          ) : (
            <>
              Aufgeteilt werden <b>{formatMoney(billed, currency)}</b> statt {formatMoney(full, currency)} – {formatMoney(full - billed, currency)} trägst
              Du.
            </>
          )}
        </p>

        <button
          type="button"
          className="btn btn-primary btn-large"
          onClick={() => {
            onApply(divisor);
            onClose();
          }}
        >
          Übernehmen
        </button>
      </div>
    </div>
  );
}
