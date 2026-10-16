import { t } from "../lib/i18n";
import { formatMoney } from "../lib/money";
import type { NewRefund } from "../lib/refunds";

/** Before a change that leaves friends having paid too much: who, how much – and that it is owed back. */
export default function RefundConfirm({
  refunds,
  currency,
  onConfirm,
  onCancel,
}: {
  refunds: NewRefund[];
  currency: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const fmt = (c: number) => formatMoney(c, currency);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="sheet confirm-sheet" role="alertdialog" aria-labelledby="refund-title">
        <h2 id="refund-title">{refunds.length === 1 ? t("{name} hat schon bezahlt", { name: refunds[0].name }) : t("Einige haben schon bezahlt")}</h2>
        {refunds.map((r) => (
          <p key={r.id} className="muted">
            {t("{name} hat schon {paid} bezahlt – danach wären es nur {share}. Die {extra} werden {name} gutgeschrieben: Du schuldest sie {name} dann.", {
              name: r.name,
              paid: fmt(r.paid),
              share: fmt(r.share),
              extra: fmt(r.extra),
            })}
          </p>
        ))}
        <button type="button" className="btn btn-primary btn-large" onClick={onConfirm}>
          {t("Trotzdem ändern")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t("Abbrechen")}
        </button>
      </div>
    </div>
  );
}
