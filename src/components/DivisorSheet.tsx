import { useState } from "react";
import type { BillItem } from "../lib/bill";
import { rich, t } from "../lib/i18n";
import { formatMoney } from "../lib/money";

export const MAX_DIVISOR = 5;

/** Payer, bill with ticking: who had the line – tapping a person gives it to them, several share it. */
export interface AssignPeople {
  people: { id: string; name: string; me: boolean }[];
  /** Who holds the line now. */
  holders: string[];
  onToggle: (personId: string) => void;
  busy: boolean;
}

interface Props {
  item: BillItem;
  currency: string;
  onApply: (divisor: number) => void;
  onClose: () => void;
  assign?: AssignPeople;
}

/**
 * Payer only (long press on a line): bill just a part of it – e.g. of a litre of milk only half
 * goes into the split, the payer takes the other half. Big pencilled "/ 2" with arrows, like
 * the head count in "Manches nicht".
 */
export default function DivisorSheet({ item, currency, onApply, onClose, assign }: Props) {
  const full = item.fullTotal ?? item.total;
  const [divisor, setDivisor] = useState(Math.min(MAX_DIVISOR, item.divisor ?? 1));
  const billed = Math.round(full / divisor);

  return (
    <div className="sheet-backdrop divisor-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet divisor-sheet" role="dialog" aria-label={t("{name} nur anteilig berechnen", { name: item.name })}>
        <h2>{item.name}</h2>

        {assign && (
          <>
            <h3 className="divisor-section">{t("Wer hatte das?")}</h3>
            <p className="muted small">{t("Antippen = direkt zuordnen · mehrere = teilen")}</p>
            <div className="expense-people assign-people" role="group" aria-label={t("Wer hatte das?")} aria-busy={assign.busy}>
              {assign.people.map((p) => {
                const on = assign.holders.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`person-pick${on ? " on" : ""}`}
                    aria-pressed={on}
                    disabled={assign.busy}
                    onClick={() => assign.onToggle(p.id)}
                  >
                    <span className="person-pick-avatar" aria-hidden="true">
                      {p.me ? t("Du") : p.name.trim().slice(0, 1).toUpperCase() || "?"}
                    </span>
                    <span className="person-pick-name">{p.me ? t("Du") : p.name}</span>
                  </button>
                );
              })}
            </div>
            <h3 className="divisor-section">{t("Nur einen Teil aufteilen")}</h3>
          </>
        )}
        <p className="muted">{t("Nur einen Teil davon aufteilen – den Rest trägst Du selbst.")}</p>

        <div className="divide-by divisor-big" role="group" aria-label={t("Geteilt durch")}>
          <svg className="divide-by-sign" viewBox="0 0 40 90" aria-hidden="true">
            <path d="M33 5 C 28 28, 19 55, 7 86" />
            <path d="M35 9 C 29 33, 21 58, 10 84" className="divide-by-sign-thin" />
          </svg>
          <span className="divide-by-value" aria-live="polite">
            {divisor}
          </span>
          <div className="divide-by-arrows">
            <button type="button" onClick={() => setDivisor((d) => Math.min(MAX_DIVISOR, d + 1))} disabled={divisor >= MAX_DIVISOR} aria-label={t("Kleinerer Teil")}>
              <svg viewBox="0 0 40 20" aria-hidden="true">
                <path d="M4 16 C 12 10, 16 6, 20 3 C 25 7, 30 11, 36 16" />
              </svg>
            </button>
            <button type="button" onClick={() => setDivisor((d) => Math.max(1, d - 1))} disabled={divisor <= 1} aria-label={t("Größerer Teil")}>
              <svg viewBox="0 0 40 20" aria-hidden="true">
                <path d="M4 4 C 12 10, 16 14, 20 17 C 25 13, 30 9, 36 4" />
              </svg>
            </button>
          </div>
        </div>

        <p className="divisor-result">
          {divisor === 1 ? (
            rich(t("Wird ganz aufgeteilt: <b>{amount}</b>", { amount: formatMoney(full, currency) }))
          ) : (
            rich(
              t("Aufgeteilt werden <b>{billed}</b> statt {full} – {rest} trägst Du.", {
                billed: formatMoney(billed, currency),
                full: formatMoney(full, currency),
                rest: formatMoney(full - billed, currency),
              }),
            )
          )}
        </p>

        <button
          type="button"
          className="btn btn-primary btn-large"
          onClick={() => {
            // Only the people changed (bill with ticking): nothing to save here.
            if (divisor !== (item.divisor ?? 1)) onApply(divisor);
            onClose();
          }}
        >
          {t("Übernehmen@@Teiler")}
        </button>
      </div>
    </div>
  );
}
