import { t } from "../lib/i18n";
import { formatMoney } from "../lib/money";
import type { NewRefund } from "../lib/refunds";

/** Payer, after holding a guest's name on a line: take their part off it? (Paid already: owed back then.) */
export default function RemoveShareConfirm({
  name,
  item,
  amount,
  refund,
  currency,
  onConfirm,
  onCancel,
}: {
  name: string;
  item: string;
  /** What their part of the line costs now. */
  amount: number;
  /** They paid already: what they would be owed back afterwards. */
  refund?: NewRefund;
  currency: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const fmt = (c: number) => formatMoney(c, currency);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="sheet confirm-sheet" role="alertdialog" aria-labelledby="remove-share-title">
        <h2 id="remove-share-title">{t("Anteil von {name} entfernen?", { name })}</h2>
        <p className="muted">
          {t("{name} hat „{item}“ abgehakt ({amount}). Danach ist der Anteil wieder frei – {name} bekommt eine Mitteilung und kann neu abhaken.", {
            name,
            item,
            amount: fmt(amount),
          })}
        </p>
        {refund && (
          <p className="muted">
            {t("{name} hat schon {paid} bezahlt – danach wären es nur {share}. Die {extra} werden {name} gutgeschrieben: Du schuldest sie {name} dann.", {
              name,
              paid: fmt(refund.paid),
              share: fmt(refund.share),
              extra: fmt(refund.extra),
            })}
          </p>
        )}
        <button type="button" className="btn btn-primary btn-large" onClick={onConfirm}>
          {t("Anteil entfernen")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t("Abbrechen")}
        </button>
      </div>
    </div>
  );
}
