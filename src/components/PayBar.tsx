import { useState } from "react";
import { hasTip, participantShare, type BillSnapshot } from "../lib/bill";
import { centsToInput, formatMoney } from "../lib/money";
import { payAction } from "../lib/payment";

interface Props {
  snapshot: BillSnapshot;
  /** Records the pay click on the server (fire and forget). */
  onPay: () => void;
}

/** Sticky bottom bar for friends: their individual sum and the pay button. */
export default function PayBar({ snapshot, onPay }: Props) {
  const [copied, setCopied] = useState(false);
  const [amountCopied, setAmountCopied] = useState<string | null>(null);
  const { data, participants, me, myPayment, ownerName } = snapshot;
  const share = me ? participantShare(data, participants, me) : { subtotal: 0, shared: 0, total: 0 };
  const alreadyPaid = myPayment?.amount ?? 0;
  const due = Math.max(0, share.total - alreadyPaid);
  const action = payAction(data.payment, due, data.currency);
  const nothing = due <= 0;

  /**
   * PayPal often drops the amount from the PayPal.Me link (it opens with only the
   * recipient preset), so the amount goes to the clipboard to paste it there.
   * Called right in the tap, as Safari only allows clipboard writes during a gesture.
   */
  function payByPaypalMe(amount: number) {
    onPay();
    const text = centsToInput(amount);
    navigator.clipboard?.writeText(text).then(
      () => setAmountCopied(text),
      () => {
        // clipboard not available – the amount is on the button anyway
      },
    );
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
            onClick={() => action.kind === "paypalMe" && payByPaypalMe(myPayment.amount)}
          >
            PayPal erneut öffnen
          </a>
        )}

        {action.kind === "paypalMe" && !(myPayment && nothing) && (
          <a
            className={`btn btn-paypal btn-large${nothing ? " disabled" : ""}`}
            href={nothing ? undefined : action.url}
            target="_blank"
            rel="noreferrer"
            aria-disabled={nothing}
            onClick={(e) => (nothing ? e.preventDefault() : payByPaypalMe(due))}
          >
            {nothing ? "Hake deine Positionen ab" : <>Mit PayPal bezahlen · {formatMoney(due, data.currency)}</>}
          </a>
        )}
        {action.kind === "paypalMe" && amountCopied && (
          <p className="paybar-note">Betrag {amountCopied} kopiert – falls PayPal ihn nicht übernimmt, einfach einfügen.</p>
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
