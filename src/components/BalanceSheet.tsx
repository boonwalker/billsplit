import type { Balances, BillLine } from "../lib/balances";
import { formatDate, t } from "../lib/i18n";
import { formatMoney } from "../lib/money";

interface Props {
  balances: Balances;
  onOpenBill: (billId: string, participantId?: string) => void;
  onClose: () => void;
}

/** One bill in a column: what was split, and what of it is still open. */
function Line({ line, onOpen }: { line: BillLine; onOpen: () => void }) {
  const share = formatMoney(line.share, line.currency);
  const detail = line.refund
    ? t("Rückzahlung {amount}", { amount: share })
    : line.side === "lent"
      ? t("Anteile {amount}", { amount: share })
      : t("Dein Anteil {amount}", { amount: share });
  return (
    <li>
      <button type="button" className={`balance-bill ${line.side}`} onClick={onOpen}>
        <b>{line.title}</b>
        <small className="muted">{formatDate(line.createdAt)}</small>
        <small className="muted">{detail}</small>
        {line.open > 0 ? (
          <span className="balance-bill-open">{t("{amount} offen", { amount: formatMoney(line.open, line.currency) })}</span>
        ) : (
          <span className="history-settled">{t("✓ beglichen")}</span>
        )}
      </button>
    </li>
  );
}

/**
 * The overall balance, bill by bill – also the settled ones: on the left the bills I paid
 * (others owe me, "Du leihst"), on the right those someone else paid ("Du schuldest").
 */
export default function BalanceSheet({ balances, onOpenBill, onClose }: Props) {
  const { currency } = balances;
  const columns = (["lent", "owed"] as const).map((side) => ({
    side,
    label: side === "lent" ? t("Du leihst") : t("Du schuldest"),
    total: side === "lent" ? balances.lent : balances.owed,
    lines: balances.bills.filter((b) => b.side === side),
  }));
  return (
    <div className="sheet-backdrop settle-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet settle-sheet balance-sheet" role="dialog" aria-label={t("Deine Bilanz")}>
        <h2>{t("Deine Bilanz")}</h2>
        <div className="balance-columns">
          {columns.map((c) => (
            <section key={c.side} className={`balance-column ${c.side}`} aria-label={c.label}>
              <header>
                <span>
                  <i className={`swatch ${c.side}`} aria-hidden="true" />
                  {c.label}
                </span>
                <b>{formatMoney(c.total, currency)}</b>
              </header>
              {c.lines.length ? (
                <ul>
                  {c.lines.map((line) => (
                    <Line key={`${line.billId}:${line.side}`} line={line} onOpen={() => onOpenBill(line.billId, line.participantId)} />
                  ))}
                </ul>
              ) : (
                <p className="muted small">{t("Keine Rechnungen")}</p>
              )}
            </section>
          ))}
        </div>
        {balances.unassigned > 0 && (
          <p className="muted small">{t("Davon {amount} noch von niemandem abgehakt.", { amount: formatMoney(balances.unassigned, currency) })}</p>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t("Schließen")}
        </button>
      </div>
    </div>
  );
}
