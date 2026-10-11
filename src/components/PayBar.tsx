import { rich, t, tMsg } from "../lib/i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useOneLine } from "../lib/useOneLine";
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
  // Covered by settlement payments (dashboard), confirmed or still waiting for the recipient.
  const credit = snapshot.myCredit ? snapshot.myCredit.confirmed + snapshot.myCredit.pending : 0;
  const due = Math.max(0, share.total - alreadyPaid - credit);
  const coveredByCredit = credit > 0 && due === 0 && !myPayment;
  const action = payAction(data.payment, due, data.currency);
  const nothing = due <= 0;
  /** Bank transfer / Wero: shown in a sheet with copy buttons. */
  const others = otherMethods(data.payment);
  const [sheet, setSheet] = useState<OtherMethod | null>(null);
  const myName = participants.find((p) => p.id === me)?.name ?? "";
  const reference = `klicksplit · ${data.title}${myName ? ` · ${myName}` : ""}`.slice(0, 140);
  const otherLabel = others.length > 1 ? t("Lieber per Überweisung oder Wero") : others[0] === "bank" ? t("Lieber per Überweisung") : t("Lieber per Wero");

  /**
   * Back from PayPal (or the banking app): ask right away whether the money went out, instead
   * of relying on the friend to find "Als bezahlt markieren" – which is easily forgotten.
   */
  const away = useRef<"no" | "leaving" | "away">("no");
  const [askPaid, setAskPaid] = useState(false);
  const leaving = () => (away.current = "leaving");
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (away.current === "leaving") away.current = "away";
      } else if (away.current === "away") {
        away.current = "no";
        setAskPaid(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  const asking = askPaid && Boolean(myPayment) && !myPayment?.markedPaidAt && nothing && !snapshot.myReceived;

  /** Opens the transfer details (and notes the pay click, as the PayPal button does). */
  function openSheet(method: OtherMethod, record = true) {
    if (record && !nothing) onPay();
    leaving();
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
    leaving();
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
    } catch {
      // clipboard not available – the address is shown anyway
    }
  }

  return (
    <div className="paybar" ref={bar} role="region" aria-label={t("Dein Anteil")}>
      <div className="paybar-inner">
        <div className="paybar-sum">
          <span className="paybar-label">
            {t("Dein Anteil")}
            {share.shared !== 0 && (
              <small>
                {" "}
                {(data.fees ?? []).length > 0
                  ? hasTip(data)
                    ? t("inkl. {amount} Anteil an Gebühren & Trinkgeld", { amount: formatMoney(share.shared, data.currency) })
                    : t("inkl. {amount} Anteil an Gebühren", { amount: formatMoney(share.shared, data.currency) })
                  : t("inkl. {amount} Anteil an Trinkgeld", { amount: formatMoney(share.shared, data.currency) })}
              </small>
            )}
          </span>
          <strong className="paybar-total" key={share.total}>
            {formatMoney(share.total, data.currency)}
          </strong>
        </div>

        {/* The payer confirmed the share as received (e.g. offset in the dashboard): nothing to pay here. */}
        {snapshot.myReceived && (
          <p className="paybar-note paybar-copied">✓ {t("{name} hat Deinen Anteil als erhalten markiert.", { name: ownerName || t("Der Rechnungssteller") })}</p>
        )}

        {snapshot.myCredit?.notes.map(tMsg).map((note) => (
          <p key={note} className="paybar-note">
            ✓ {note}
          </p>
        ))}

        {!snapshot.myReceived && myPayment && (
          <p className="paybar-note">
            ✓{" "}
            {due > 0
              ? t("Bezahlung über {amount} an {name} gestartet – durch Deine neue Auswahl kommen {extra} dazu.", {
                  amount: formatMoney(myPayment.amount, data.currency),
                  name: ownerName || t("den Rechnungssteller"),
                  extra: formatMoney(due, data.currency),
                })
              : t("Bezahlung über {amount} an {name} gestartet.", {
                  amount: formatMoney(myPayment.amount, data.currency),
                  name: ownerName || t("den Rechnungssteller"),
                })}
          </p>
        )}

        {asking && myPayment && (
          <div className="paybar-ask" role="alertdialog" aria-label={t("Hast Du bezahlt?")}>
            <p>
              {t("Hast Du {amount} an {name} gesendet?", {
                amount: formatMoney(myPayment.amount, data.currency),
                name: ownerName || t("den Rechnungssteller"),
              })}
            </p>
            <div className="paybar-ask-actions">
              <button
                type="button"
                className="btn btn-mark"
                onClick={() => {
                  onMarkPaid(true);
                  setAskPaid(false);
                }}
              >
                ✓ {t("Ja, gesendet")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setAskPaid(false)}>
                {t("Noch nicht")}
              </button>
            </div>
          </div>
        )}

        {!snapshot.myReceived && !coveredByCredit && !asking && (
          <>
            {myPayment && nothing && action.kind !== "none" && (
              <a
                className="btn btn-done btn-large"
                href={action.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (action.kind === "paypalMe") copyText(centsToInput(myPayment.amount));
                  leaving();
                }}
              >
                {t("PayPal erneut öffnen")}
              </a>
            )}
            {myPayment && nothing && action.kind === "none" && others.length > 0 && (
              <button type="button" className="btn btn-done btn-large" onClick={() => openSheet(others[0], false)}>
                {t("Zahlungsdaten erneut anzeigen")}
              </button>
            )}
            {myPayment && nothing && (
              <button
                type="button"
                className={`btn btn-large ${myPayment.markedPaidAt ? "btn-done btn-marked" : "btn-mark"}`}
                aria-pressed={Boolean(myPayment.markedPaidAt)}
                onClick={() => onMarkPaid(!myPayment.markedPaidAt)}
              >
                {myPayment.markedPaidAt ? t("✓ Als bezahlt markiert") : t("Als bezahlt markieren")}
              </button>
            )}
            {myPayment?.markedPaidAt && nothing && (
              <p className="paybar-note">
                {t("{name} sieht das jetzt. Nochmal tippen macht es rückgängig.", { name: ownerName || t("Der Rechnungssteller") })}
              </p>
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
                {nothing ? t("Hake Deine Positionen ab") : t("Anteil begleichen · {amount}", { amount: formatMoney(due, data.currency) })}
              </button>
            )}
            {action.kind === "paypalMe" && !(myPayment && nothing) && ready && (
              <>
                <p className="paybar-note paybar-copied">
                  {ready.copied ? (
                    <>
                      ✓ {t("{amount} in die Zwischenablage kopiert –", { amount: formatMoney(due, data.currency) })}
                      <span className="paybar-oneline" ref={oneLine}>
                        {t("in PayPal ins Betragsfeld tippen und „Einfügen“ wählen.")}
                      </span>
                    </>
                  ) : (
                    t("Trag in PayPal {amount} ein.", { amount: formatMoney(due, data.currency) })
                  )}
                </p>
                <a
                  className="btn btn-paypal btn-large"
                  href={action.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    onPay();
                    leaving();
                  }}
                >
                  {t("Mit PayPal bezahlen · {amount}", { amount: formatMoney(due, data.currency) })}
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
                  {nothing ? t("Hake Deine Positionen ab") : t("In PayPal bezahlen · {amount}", { amount: formatMoney(due, data.currency) })}
                </a>
                {!nothing && (
                  <p className="paybar-note">
                    {rich(t("Sende {amount} an <b>{email}</b>", { amount: formatMoney(due, data.currency), email: action.email }))}{" "}
                    {copied && t("(Adresse kopiert)")}
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
                {nothing ? t("Hake Deine Positionen ab") : t("Anteil begleichen · {amount}", { amount: formatMoney(due, data.currency) })}
              </button>
            )}
            {/* With PayPal as the main way, bank transfer and Wero are offered below it. */}
            {action.kind !== "none" && others.length > 0 && !nothing && (
              <button type="button" className="link paybar-other" onClick={() => openSheet(others[0])}>
                {otherLabel}
              </button>
            )}
            {action.kind === "none" && others.length === 0 && (
              <p className="paybar-note">{t("{name} hat keine Zahlungsdaten hinterlegt.", { name: ownerName || t("Der Rechnungssteller") })}</p>
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
            onClose={() => {
              setSheet(null);
              // Copied the details and paid in the banking app meanwhile? Ask once the sheet is closed.
              if (away.current !== "no") {
                away.current = "no";
                setAskPaid(true);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
