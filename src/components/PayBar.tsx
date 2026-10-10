import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { hasTip, participantShare, type BillSnapshot } from "../lib/bill";
import { centsToInput, formatMoney } from "../lib/money";
import { copyText } from "../lib/clipboard";
import { clickPress, clickRelease } from "../lib/haptics";
import { otherMethods, payAction, type OtherMethod } from "../lib/payment";
import TransferSheet from "./TransferSheet";

interface Props {
  snapshot: BillSnapshot;
  /** Records the pay click on the server (fire and forget). */
  onPay: () => void;
  /** Marks the friend's share as paid (or takes that back). */
  onMarkPaid: (paid: boolean) => void;
  /** The bar's height whenever it changes (it grows after paying), so the page can scroll past it. */
  onHeight?: (px: number) => void;
}

/** Shrinks the text a little (in half-pixel steps, down to 10px) until it fits on one line. */
function fitOneLine(el: HTMLElement) {
  el.style.fontSize = "";
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && size > 10) {
    size -= 0.5;
    el.style.fontSize = `${size}px`;
  }
}

/** Callback ref: fits the element on one line now and again whenever its width changes. */
function useOneLine() {
  const observer = useRef<ResizeObserver | null>(null);
  return useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    let width = -1;
    observer.current = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fitOneLine(el);
    });
    observer.current.observe(el);
  }, []);
}

/** Sticky bottom bar for friends: their individual sum and the pay button. */
export default function PayBar({ snapshot, onPay, onMarkPaid, onHeight }: Props) {
  const bar = useRef<HTMLDivElement>(null);
  const oneLine = useOneLine();
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || !onHeight) return;
    const report = () => onHeight(el.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeight]);
  const [copied, setCopied] = useState(false);
  /** Amount copied in the first tap; the second tap then opens PayPal. */
  const [prepared, setPrepared] = useState<{ amount: string; copied: boolean } | null>(null);
  const { data, participants, me, myPayment, ownerName } = snapshot;
  const share = me ? participantShare(data, participants, me) : { subtotal: 0, shared: 0, total: 0 };
  const alreadyPaid = myPayment?.amount ?? 0;
  const due = Math.max(0, share.total - alreadyPaid);
  const action = payAction(data.payment, due, data.currency);
  const nothing = due <= 0;
  /** Bank transfer / Wero: shown in a sheet with copy buttons. */
  const others = otherMethods(data.payment);
  const [sheet, setSheet] = useState<OtherMethod | null>(null);
  const myName = participants.find((p) => p.id === me)?.name ?? "";
  const reference = `billsplit · ${data.title}${myName ? ` · ${myName}` : ""}`.slice(0, 140);
  const otherLabel = others.map((m) => (m === "bank" ? "Überweisung" : "Wero")).join(" oder ");

  /** Opens the transfer details (and notes the pay click, as the PayPal button does). */
  function openSheet(method: OtherMethod, record = true) {
    if (record && !nothing) onPay();
    setSheet(method);
  }

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
    <div className="paybar" ref={bar} role="region" aria-label="Dein Anteil">
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

        {/* The payer confirmed the share as received (e.g. offset in the dashboard): nothing to pay here. */}
        {snapshot.myReceived && (
          <p className="paybar-note paybar-copied">✓ {ownerName || "Der Rechnungssteller"} hat Deinen Anteil als erhalten markiert.</p>
        )}

        {!snapshot.myReceived && myPayment && (
          <p className="paybar-note">
            ✓ Bezahlung über {formatMoney(myPayment.amount, data.currency)} an {ownerName || "den Rechnungssteller"} gestartet
            {due > 0 && <> – durch deine neue Auswahl kommen {formatMoney(due, data.currency)} dazu</>}.
          </p>
        )}

        {!snapshot.myReceived && (
          <>
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
            {myPayment && nothing && action.kind === "none" && others.length > 0 && (
              <button type="button" className="btn btn-done btn-large" onClick={() => openSheet(others[0], false)}>
                Zahlungsdaten erneut anzeigen
              </button>
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
                onPointerDown={nothing ? undefined : clickPress}
                onClick={() => {
                  prepareAmount();
                  clickRelease();
                }}
              >
                {nothing ? "Hake deine Positionen ab" : <>Anteil begleichen · {formatMoney(due, data.currency)}</>}
              </button>
            )}
            {action.kind === "paypalMe" && !(myPayment && nothing) && ready && (
              <>
                <p className="paybar-note paybar-copied">
                  {ready.copied ? (
                    <>
                      ✓ {formatMoney(due, data.currency)} in die Zwischenablage kopiert –
                      <span className="paybar-oneline" ref={oneLine}>
                        in PayPal ins Betragsfeld tippen und „Einfügen“ wählen.
                      </span>
                    </>
                  ) : (
                    `Trag in PayPal ${formatMoney(due, data.currency)} ein.`
                  )}
                </p>
                <a className="btn btn-paypal btn-large" href={action.url} target="_blank" rel="noreferrer" onClick={onPay}>
                  Mit PayPal bezahlen · {formatMoney(due, data.currency)}
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

            {/* Without PayPal the main button opens the bank / Wero details. */}
            {action.kind === "none" && others.length > 0 && !(myPayment && nothing) && (
              <button
                type="button"
                className={`btn btn-paypal btn-large${nothing ? " disabled" : ""}`}
                disabled={nothing}
                onPointerDown={nothing ? undefined : clickPress}
                onClick={() => {
                  openSheet(others[0]);
                  clickRelease();
                }}
              >
                {nothing ? "Hake deine Positionen ab" : <>Anteil begleichen · {formatMoney(due, data.currency)}</>}
              </button>
            )}
            {/* With PayPal as the main way, bank transfer and Wero are offered below it. */}
            {action.kind !== "none" && others.length > 0 && !nothing && (
              <button type="button" className="link paybar-other" onClick={() => openSheet(others[0])}>
                Lieber per {otherLabel}
              </button>
            )}
            {action.kind === "none" && others.length === 0 && (
              <p className="paybar-note">{ownerName || "Der Rechnungssteller"} hat keine Zahlungsdaten hinterlegt.</p>
            )}
          </>
        )}
        {sheet && (
          <TransferSheet
            payment={data.payment}
            methods={others}
            initial={sheet}
            amount={nothing ? (myPayment?.amount ?? share.total) : due}
            currency={data.currency}
            ownerName={ownerName}
            reference={reference}
            onClose={() => setSheet(null)}
          />
        )}
      </div>
    </div>
  );
}
