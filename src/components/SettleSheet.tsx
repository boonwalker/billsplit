import { useState } from "react";
import type { PersonBalance } from "../lib/balances";
import { copyText } from "../lib/clipboard";
import { clickPress, clickRelease } from "../lib/haptics";
import { centsToInput, formatMoney } from "../lib/money";
import { otherMethods, payAction, type OtherMethod } from "../lib/payment";
import { bookSettlement, netOf, sameEntries } from "../lib/settle";
import TransferSheet from "./TransferSheet";

interface Props {
  person: PersonBalance;
  currency: string;
  myName: string;
  /** Loads the current open amounts with this person again (null when they are all settled). */
  reload: () => Promise<PersonBalance | null>;
  onClose: (changed: boolean) => void;
}

type Stage = "review" | "copied" | "confirm" | "booking" | "done";

/**
 * Settling up with one person across all bills: every open amount bill by bill, the net
 * amount, the way to pay it (PayPal, bank transfer, Wero) and – once paid – booking it in
 * each bill: my shares in their bills as paid, their shares in mine as received.
 */
export default function SettleSheet({ person: shown, currency, myName, reload, onClose }: Props) {
  const [person, setPerson] = useState(shown);
  const [stage, setStage] = useState<Stage>("review");
  const [copied, setCopied] = useState(false);
  const [transfer, setTransfer] = useState<OtherMethod | null>(null);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const net = netOf(person);
  const pay = -net;
  const payment = person.payment ?? {};
  const action = payAction(payment, Math.max(0, pay), currency);
  const others = otherMethods(payment);
  const bills = new Set(person.entries.map((e) => e.billId)).size;
  const fmt = (c: number) => formatMoney(c, currency);

  /** Books everything – but only if the amounts are still the ones that were paid / shown. */
  async function book() {
    setNotice(null);
    setStage("booking");
    try {
      const current = await reload();
      if (!current || !sameEntries(current.entries, person.entries)) {
        if (current) setPerson(current);
        setNotice("Die Beträge haben sich gerade geändert. Bitte prüfe die neue Aufstellung – noch wurde nichts eingetragen.");
        setStage("review");
        if (!current) onClose(true);
        return;
      }
      await bookSettlement(person.entries, setProgress);
      setStage("done");
    } catch (e) {
      setNotice(`${e instanceof Error ? e.message : "Das Eintragen ist fehlgeschlagen."} Bereits Eingetragenes bleibt – bitte nochmal versuchen.`);
      setStage("review");
    }
  }

  const reference = `billsplit · Ausgleich ${myName ? `von ${myName} ` : ""}(${bills} ${bills === 1 ? "Rechnung" : "Rechnungen"})`.slice(0, 140);

  return (
    <div className="sheet-backdrop settle-backdrop" onClick={(e) => e.target === e.currentTarget && stage !== "booking" && onClose(stage === "done")}>
      <div className="sheet settle-sheet" role="dialog" aria-label={`Mit ${person.name} ausgleichen`}>
        <h2>Mit {person.name} ausgleichen</h2>

        {stage === "done" ? (
          <>
            <p className="settle-done">✓ In {bills === 1 ? "der Rechnung" : `allen ${bills} Rechnungen`} eingetragen.</p>
            <p className="muted small">
              {person.owed > 0 && <>{person.name} sieht in den eigenen Rechnungen, dass Du bezahlt hast. </>}
              {person.lent > 0 && <>In Deinen Rechnungen ist der Anteil von {person.name} als erhalten markiert.</>}
            </p>
            <button type="button" className="btn btn-primary btn-large" onClick={() => onClose(true)}>
              Fertig
            </button>
          </>
        ) : (
          <>
            {/* Bill by bill, so every euro can be traced to its bill. */}
            <ul className="settle-entries">
              {person.entries.map((e) => (
                <li key={`${e.billId}-${e.direction}`}>
                  <span>
                    <b>{e.title}</b>
                    <small className="muted">{e.direction === "owed" ? `Du schuldest ${person.name}` : `${person.name} schuldet Dir`}</small>
                  </span>
                  <span className={`settle-amount ${e.direction}`}>
                    {e.direction === "owed" ? "−" : "+"}
                    {fmt(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="settle-total">
              {net < 0 ? (
                <>
                  Du zahlst {person.name} <b>{fmt(pay)}</b>
                </>
              ) : net > 0 ? (
                <>
                  {person.name} zahlt Dir <b>{fmt(net)}</b>
                </>
              ) : (
                <>Gleicht sich genau aus</>
              )}
            </p>

            {notice && <p className="alert">{notice}</p>}

            {stage === "booking" && <p className="muted small">Wird eingetragen … {progress > 0 && `(${progress} von ${person.entries.length})`}</p>}

            {/* I pay: PayPal in two taps (the amount goes to the clipboard first), or bank / Wero. */}
            {net < 0 && stage === "review" && action.kind === "paypalMe" && (
              <button
                type="button"
                className="btn btn-paypal btn-large"
                onPointerDown={clickPress}
                onClick={() => {
                  setCopied(copyText(centsToInput(pay)));
                  setStage("copied");
                  clickRelease();
                }}
              >
                Ausgleich zahlen · {fmt(pay)}
              </button>
            )}
            {net < 0 && stage === "copied" && action.kind === "paypalMe" && (
              <>
                <p className="paybar-note settle-copied">
                  {copied ? `✓ ${fmt(pay)} in die Zwischenablage kopiert – in PayPal ins Betragsfeld tippen und „Einfügen“ wählen.` : `Trag in PayPal ${fmt(pay)} ein.`}
                </p>
                <a className="btn btn-paypal btn-large" href={action.url} target="_blank" rel="noreferrer" onClick={() => setStage("confirm")}>
                  Mit PayPal bezahlen · {fmt(pay)}
                </a>
              </>
            )}
            {net < 0 && stage === "review" && action.kind === "email" && (
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
                In PayPal bezahlen · {fmt(pay)}
              </a>
            )}
            {net < 0 && stage === "review" && others.length > 0 && (
              <button type="button" className={action.kind === "none" ? "btn btn-paypal btn-large" : "link settle-other"} onClick={() => setTransfer(others[0])}>
                {action.kind === "none" ? `Ausgleich zahlen · ${fmt(pay)}` : `Lieber per ${others.map((m) => (m === "bank" ? "Überweisung" : "Wero")).join(" oder ")}`}
              </button>
            )}

            {/* After paying: only now is it booked in the bills. */}
            {net < 0 && (stage === "confirm" || (stage === "review" && action.kind === "none" && others.length === 0)) && (
              <>
                {stage === "confirm" && <p className="settle-question">Hast Du {fmt(pay)} an {person.name} gesendet?</p>}
                {action.kind === "none" && others.length === 0 && stage === "review" && (
                  <p className="muted small">{person.name} hat keine Zahlungsdaten hinterlegt – zahl den Betrag auf anderem Weg.</p>
                )}
                <button type="button" className="btn btn-primary btn-large" onClick={book}>
                  ✓ Bezahlt – in {bills === 1 ? "der Rechnung" : `allen ${bills} Rechnungen`} eintragen
                </button>
                {stage === "confirm" && (
                  <button type="button" className="btn btn-ghost" onClick={() => setStage("review")}>
                    Noch nicht
                  </button>
                )}
              </>
            )}

            {/* They pay me (or it evens out): confirm once the money is there. */}
            {net > 0 && stage === "review" && (
              <>
                <p className="muted small">
                  {person.name} sieht den Ausgleich im eigenen Dashboard. Sobald das Geld da ist, trag es hier ein.
                </p>
                <button type="button" className="btn btn-primary btn-large" onClick={book}>
                  ✓ {fmt(net)} erhalten – eintragen
                </button>
              </>
            )}
            {net === 0 && stage === "review" && (
              <button type="button" className="btn btn-primary btn-large" onClick={book}>
                Gegenseitig verrechnen
              </button>
            )}

            {stage !== "booking" && (
              <button type="button" className="btn btn-ghost" onClick={() => onClose(false)}>
                Schließen
              </button>
            )}
          </>
        )}

        {transfer && (
          <TransferSheet
            payment={payment}
            methods={others}
            initial={transfer}
            amount={pay}
            currency={currency}
            ownerName={person.name}
            reference={reference}
            onClose={() => {
              setTransfer(null);
              setStage("confirm");
            }}
          />
        )}
      </div>
    </div>
  );
}
