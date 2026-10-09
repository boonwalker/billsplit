import { useState } from "react";
import { hasTip, participantShare, type BillSnapshot } from "../lib/bill";
import { centsToInput, formatMoney } from "../lib/money";
import { copyText } from "../lib/clipboard";
import { payAction } from "../lib/payment";

interface Props {
  snapshot: BillSnapshot;
  /** Records the pay click on the server (fire and forget). */
  onPay: () => void;
  /** Marks the friend's share as paid (or takes that back). */
  onMarkPaid: (paid: boolean) => void;
}

/** Sticky bottom bar for friends: their individual sum and the pay button. */
export default function PayBar({ snapshot, onPay, onMarkPaid }: Props) {
  const [copied, setCopied] = useState(false);
  /** Amount copied in the first tap; the second tap then opens PayPal. */
  const [prepared, setPrepared] = useState<{ amount: string; copied: boolean } | null>(null);
  const { data, participants, me, myPayment, ownerName } = snapshot;
  const share = me ? participantShare(data, participants, me) : { subtotal: 0, shared: 0, total: 0 };
  const alreadyPaid = myPayment?.amount ?? 0;
  const due = Math.max(0, share.total - alreadyPaid);
  const action = payAction(data.payment, due, data.currency);
  const nothing = due <= 0;

  /**
   * PayPal often drops the amount from the PayPal.Me link (it opens with only the
   * recipient preset), so the amount goes to the clipboard to paste it there. This
   * happens in a tap of its own: when the same tap also left for PayPal, iOS lost the
   * clipboard write.
   */
  const dueText = centsToInput(due);
  const ready = prepared?.amount === dueText ? prepared : null;
  function prepareAmount() {
    setPrepared({ amount: dueText, copied: copyText(dueText) });
  }

  async function payByEmail(email: string) {
    onPay();
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
    } catch {
      // clipboard not available – the address is shown anyway
    }
  }

  return (
    <div className="paybar" role="region" aria-label="Dein Anteil">
      <div className="paybar-inner">
        <div className="paybar-sum">
          <span className="paybar-label">
            Dein Anteil
            {share.shared !== 0 && (
              <small>
                {" "}
                inkl. {formatMoney(share.shared, data.currency)} Anteil an{" "}
                {(data.fees ?? []).length > 0 ? (hasTip(data) ? "Gebühren & Trinkgeld" : "Gebühren") : "Trinkgeld"}
              </small>
            )}
          </span>
          <strong className="paybar-total" key={share.total}>
            {formatMoney(share.total, data.currency)}
          </strong>
        </div>

        {myPayment && (
          <p className="paybar-note">
            ✓ Bezahlung über {formatMoney(myPayment.amount, data.currency)} an {ownerName || "den Rechnungssteller"} gestartet
            {due > 0 && <> – durch deine neue Auswahl kommen {formatMoney(due, data.currency)} dazu</>}.
          </p>
        )}

        {myPayment && nothing && action.kind !== "none" && (
          <a
            className="btn btn-done btn-large"
            href={action.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => action.kind === "paypalMe" && copyText(centsToInput(myPayment.amount))}
          >
            PayPal erneut öffnen
          </a>
        )}
        {myPayment && nothing && (
          <button
            type="button"
            className={`btn btn-large ${myPayment.markedPaidAt ? "btn-done btn-marked" : "btn-mark"}`}
            aria-pressed={Boolean(myPayment.markedPaidAt)}
            onClick={() => onMarkPaid(!myPayment.markedPaidAt)}
          >
            {myPayment.markedPaidAt ? "✓ Als bezahlt markiert" : "Als bezahlt markieren"}
          </button>
        )}
        {myPayment?.markedPaidAt && nothing && (
          <p className="paybar-note">{ownerName || "Der Rechnungssteller"} sieht das jetzt. Nochmal tippen macht es rückgängig.</p>
        )}

        {action.kind === "paypalMe" && !(myPayment && nothing) && !ready && (
          <button
            type="button"
            className={`btn btn-paypal btn-large${nothing ? " disabled" : ""}`}
            disabled={nothing}
            onClick={prepareAmount}
          >
            {nothing ? "Hake deine Positionen ab" : <>Anteil begleichen · {formatMoney(due, data.currency)}</>}
          </button>
        )}
        {action.kind === "paypalMe" && !(myPayment && nothing) && ready && (
          <>
            <p className="paybar-note paybar-copied">
              {ready.copied
                ? `✓ ${formatMoney(due, data.currency)} kopiert – in PayPal ins Betragsfeld tippen und „Einfügen“ wählen.`
                : `Trag in PayPal ${formatMoney(due, data.currency)} ein.`}
            </p>
            <a className="btn btn-paypal btn-large" href={action.url} target="_blank" rel="noreferrer" onClick={onPay}>
              Weiter zu PayPal
            </a>
          </>
        )}

        {action.kind === "email" && !(myPayment && nothing) && (
          <>
            <a
              className={`btn btn-paypal btn-large${nothing ? " disabled" : ""}`}
              href={nothing ? undefined : action.url}
              target="_blank"
              rel="noreferrer"
              aria-disabled={nothing}
              onClick={(e) => (nothing ? e.preventDefault() : void payByEmail(action.email))}
            >
              {nothing ? "Hake deine Positionen ab" : <>In PayPal bezahlen · {formatMoney(due, data.currency)}</>}
            </a>
            {!nothing && (
              <p className="paybar-note">
                Sende {formatMoney(due, data.currency)} an <b>{action.email}</b> {copied && "(Adresse kopiert)"}
              </p>
            )}
          </>
        )}

        {action.kind === "none" && <p className="paybar-note">{ownerName || "Der Rechnungssteller"} hat keine PayPal-Daten hinterlegt.</p>}
      </div>
    </div>
  );
}
