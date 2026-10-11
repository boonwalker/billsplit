import { useState } from "react";
import { t } from "../lib/i18n";
import type { PaymentInfo } from "../lib/bill";
import { copyText } from "../lib/clipboard";
import { clickPress, clickRelease } from "../lib/haptics";
import { centsToInput, formatMoney, type Cents } from "../lib/money";
import { otherMethods, payAction, type OtherMethod } from "../lib/payment";
import { useOneLine } from "../lib/useOneLine";
import TransferSheet from "./TransferSheet";

interface Props {
  payment: PaymentInfo;
  amount: Cents;
  currency: string;
  /** Who gets the money. */
  recipient: string;
  /** Payment reference for bank transfers and Wero. */
  reference: string;
  /** Label of the button that books the payment once it was sent. */
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
}

/**
 * Paying someone outside the app, then confirming it: PayPal in two taps (the amount goes to the
 * clipboard first – PayPal often drops it from the link), or the bank / Wero details to copy.
 * Only after "sent?" is answered with yes, `onConfirm` books it.
 */
export default function PayButtons({ payment, amount, currency, recipient, reference, confirmLabel, onConfirm, busy }: Props) {
  const [stage, setStage] = useState<"pay" | "copied" | "confirm">("pay");
  const [copied, setCopied] = useState(false);
  const [transfer, setTransfer] = useState<OtherMethod | null>(null);
  const oneLine = useOneLine();
  const action = payAction(payment, amount, currency);
  const others = otherMethods(payment);
  const fmt = (c: Cents) => formatMoney(c, currency);
  const noWay = action.kind === "none" && others.length === 0;

  if (busy) return <p className="muted small pay-buttons-busy">{t("Wird eingetragen …")}</p>;

  return (
    <div className="pay-buttons">
      {stage === "pay" && action.kind === "paypalMe" && (
        <button
          type="button"
          className="btn btn-paypal btn-large"
          onPointerDown={clickPress}
          onClick={() => {
            setCopied(copyText(centsToInput(amount)));
            setStage("copied");
            clickRelease();
          }}
        >
          {t("{amount} an {name} zahlen", { amount: fmt(amount), name: recipient })}
        </button>
      )}
      {stage === "copied" && action.kind === "paypalMe" && (
        <>
          <p className="paybar-note settle-copied">
            {copied ? (
              <>
                ✓ {t("{amount} in die Zwischenablage kopiert –", { amount: fmt(amount) })}
                <span className="paybar-oneline" ref={oneLine}>
                  {t("in PayPal ins Betragsfeld tippen und „Einfügen“ wählen.")}
                </span>
              </>
            ) : (
              t("Trag in PayPal {amount} ein.", { amount: fmt(amount) })
            )}
          </p>
          <a className="btn btn-paypal btn-large" href={action.url} target="_blank" rel="noreferrer" onClick={() => setStage("confirm")}>
            {t("Mit PayPal bezahlen · {amount}", { amount: fmt(amount) })}
          </a>
        </>
      )}
      {stage === "pay" && action.kind === "email" && (
        <a
          className="btn btn-paypal btn-large"
          href={action.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            copyText(action.email);
            setStage("confirm");
          }}
        >
          {t("In PayPal bezahlen · {amount}", { amount: fmt(amount) })}
        </a>
      )}
      {stage === "pay" && others.length > 0 && (
        <button type="button" className={action.kind === "none" ? "btn btn-paypal btn-large" : "link settle-other"} onClick={() => setTransfer(others[0])}>
          {action.kind === "none"
            ? t("{amount} an {name} zahlen", { amount: fmt(amount), name: recipient })
            : others.length > 1
              ? t("Lieber per Überweisung oder Wero")
              : others[0] === "bank"
                ? t("Lieber per Überweisung")
                : t("Lieber per Wero")}
        </button>
      )}

      {(stage === "confirm" || noWay) && (
        <>
          {stage === "confirm" ? (
            <p className="settle-question">
              {t("Hast Du {amount} an {name} gesendet?", { amount: fmt(amount), name: recipient })}
            </p>
          ) : (
            <p className="muted small">{t("{name} hat keine Zahlungsdaten hinterlegt – zahl den Betrag auf anderem Weg.", { name: recipient })}</p>
          )}
          <button type="button" className="btn btn-primary btn-large" onClick={onConfirm}>
            {confirmLabel}
          </button>
          {stage === "confirm" && (
            <button type="button" className="btn btn-ghost" onClick={() => setStage("pay")}>
              {t("Noch nicht")}
            </button>
          )}
        </>
      )}

      {transfer && (
        <TransferSheet
          payment={payment}
          methods={others}
          initial={transfer}
          amount={amount}
          currency={currency}
          ownerName={recipient}
          reference={reference}
          onClose={() => {
            setTransfer(null);
            setStage("confirm");
          }}
        />
      )}
    </div>
  );
}
