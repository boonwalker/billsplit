import { useState } from "react";
import type { PaymentInfo } from "../lib/bill";
import { copyText } from "../lib/clipboard";
import { centsToInput, formatMoney, type Cents } from "../lib/money";
import { formatIban, type OtherMethod } from "../lib/payment";
import { rich, t } from "../lib/i18n";

interface Props {
  payment: PaymentInfo;
  methods: OtherMethod[];
  initial: OtherMethod;
  amount: Cents;
  currency: string;
  /** Recipient name shown when the payer gave no account holder. */
  ownerName: string;
  /** Payment reference, so the payer sees who paid what. */
  reference: string;
  onClose: () => void;
}

const methodLabel = (method: OtherMethod): string => (method === "bank" ? t("Überweisung") : "Wero");

/** One value with its own copy button – the banking app has no link to prefill it. */
function CopyRow({ label, value, shown }: { label: string; value: string; shown?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-row">
      <span className="copy-row-text">
        <small>{label}</small>
        <b>{shown ?? value}</b>
      </span>
      <button
        type="button"
        className={`copy-row-btn${copied ? " done" : ""}`}
        onClick={() => {
          setCopied(copyText(value));
          window.setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? t("✓ Kopiert") : t("Kopieren")}
      </button>
    </div>
  );
}

/** Bank transfer or Wero: the details to paste into the banking app, each with a copy button. */
export default function TransferSheet({ payment, methods, initial, amount, currency, ownerName, reference, onClose }: Props) {
  const [method, setMethod] = useState<OtherMethod>(initial);
  const holder = payment.holder || ownerName;

  return (
    <div className="sheet-backdrop transfer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet transfer-sheet" role="dialog" aria-label={method === "bank" ? t("Per Überweisung bezahlen") : t("Per Wero bezahlen")}>
        <h2>{t("{amount} senden", { amount: formatMoney(amount, currency) })}</h2>
        {methods.length > 1 && (
          <div className="transfer-tabs" role="tablist">
            {methods.map((m) => (
              <button key={m} type="button" role="tab" aria-selected={m === method} className={m === method ? "on" : undefined} onClick={() => setMethod(m)}>
                {methodLabel(m)}
              </button>
            ))}
          </div>
        )}

        {method === "bank" && payment.iban && (
          <>
            <CopyRow label={t("Empfänger")} value={holder} />
            <CopyRow label={t("IBAN")} value={payment.iban} shown={formatIban(payment.iban)} />
            <CopyRow label={t("Betrag")} value={centsToInput(amount)} shown={formatMoney(amount, currency)} />
            <CopyRow label={t("Verwendungszweck")} value={reference} />
            <p className="muted small">
              {t(
                "Öffne Deine Banking-App (z.B. Sparkasse, ING oder Trade Republic), lege eine neue Überweisung an und füge die Angaben ein.",
              )}
            </p>
          </>
        )}

        {method === "wero" && payment.wero && (
          <>
            <CopyRow label={t("An")} value={payment.wero} />
            <CopyRow label={t("Betrag")} value={centsToInput(amount)} shown={formatMoney(amount, currency)} />
            <CopyRow label={t("Nachricht")} value={reference} />
            <p className="muted small">
              {rich(t("Öffne Deine Banking-App, tippe auf <b>Wero</b> → <b>Senden</b> und füge die Nummer bzw. E-Mail von {name} ein.", { name: holder }))}
            </p>
          </>
        )}

        <button type="button" className="btn btn-primary btn-large" onClick={onClose}>
          {t("Fertig")}
        </button>
      </div>
    </div>
  );
}
